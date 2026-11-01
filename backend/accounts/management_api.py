"""Account settings and superuser-only administration."""
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework import generics, serializers
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)
from rest_framework_simplejwt.tokens import RefreshToken

from learning.models import AuditLog

from .models import User
from .views import AuthSchema, cookie, user_data


class IsSuperAdmin(BasePermission):
    message = "Only the super administrator can manage administrators and activity logs."

    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and request.user.is_active and request.user.is_superuser)


class AdminAccountSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    is_superuser = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "password", "is_active", "is_superuser", "date_joined"]
        read_only_fields = ["id", "is_active", "date_joined"]

    def validate(self, attrs):
        # The public contract never accepts privilege flags, including Django staff access.
        if set(self.initial_data) - {"username", "email", "password"}:
            raise serializers.ValidationError("Only username, email and password are accepted.")
        candidate = User(username=attrs.get("username", ""), email=attrs.get("email", ""))
        try:
            validate_password(attrs["password"], candidate)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": exc.messages})
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(**validated_data, role=User.Role.ADMIN, is_staff=False, is_superuser=False)


class AdminAccountsView(generics.ListCreateAPIView):
    permission_classes = [IsSuperAdmin]
    serializer_class = AdminAccountSerializer
    queryset = User.objects.filter(Q(role="admin") | Q(is_staff=True) | Q(is_superuser=True)).order_by("username", "id")
    search_fields = ["username", "email"]

    @transaction.atomic
    def perform_create(self, serializer):
        user = serializer.save()
        AuditLog.objects.create(actor=self.request.user, action="admin.create", details={"user_id": user.pk, "username": user.username})


class AdminAccountUpdateInput(serializers.Serializer):
    new_password = serializers.CharField(required=False, write_only=True, trim_whitespace=False)
    is_active = serializers.BooleanField(required=False)

    def validate(self, attrs):
        if not attrs or set(self.initial_data) - {"new_password", "is_active"}:
            raise serializers.ValidationError("Only new_password and is_active are accepted.")
        user = self.context["user"]
        if user.is_superuser:
            raise serializers.ValidationError("Use your own profile to change a super administrator password. Super administrators cannot be blocked here.")
        if "new_password" in attrs:
            try:
                validate_password(attrs["new_password"], user)
            except DjangoValidationError as exc:
                raise serializers.ValidationError({"new_password": exc.messages})
        return attrs


class AdminAccountDetailView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request, pk):
        from django.shortcuts import get_object_or_404
        user = get_object_or_404(AdminAccountsView.queryset, pk=pk)
        return Response(AdminAccountSerializer(user).data)

    @extend_schema(request=AdminAccountUpdateInput, responses=AdminAccountSerializer)
    @transaction.atomic
    def patch(self, request, pk):
        from django.shortcuts import get_object_or_404
        user = get_object_or_404(AdminAccountsView.queryset.select_for_update(), pk=pk)
        serializer = AdminAccountUpdateInput(data=request.data, context={"user": user})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        fields = []
        if "new_password" in data:
            user.set_password(data["new_password"])
            fields.append("password")
        if "is_active" in data:
            user.is_active = data["is_active"]
            fields.append("is_active")
        user.save(update_fields=fields)
        if "new_password" in data or data.get("is_active") is False:
            for token in OutstandingToken.objects.filter(user=user):
                BlacklistedToken.objects.get_or_create(token=token)
        for action in (["admin.password_reset"] if "new_password" in data else []) + (
            ["admin.unblock" if user.is_active else "admin.block"] if "is_active" in data else []
        ):
            AuditLog.objects.create(actor=request.user, action=action, details={"user_id": user.pk, "username": user.username})
        return Response(AdminAccountSerializer(user).data)


class PasswordChangeInput(serializers.Serializer):
    current_password = serializers.CharField(trim_whitespace=False, write_only=True)
    new_password = serializers.CharField(trim_whitespace=False, write_only=True)


class PasswordChangeView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    @extend_schema(request=PasswordChangeInput, responses=AuthSchema)
    @transaction.atomic
    def post(self, request):
        serializer = PasswordChangeInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user = User.objects.select_for_update().get(pk=request.user.pk)
        if not user.check_password(data["current_password"]):
            raise serializers.ValidationError({"current_password": "Current password is incorrect."})
        if user.check_password(data["new_password"]):
            raise serializers.ValidationError({"new_password": "Choose a different password."})
        try:
            validate_password(data["new_password"], user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"new_password": exc.messages})
        user.set_password(data["new_password"])
        user.save(update_fields=["password"])
        for token in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=token)
        AuditLog.objects.create(actor=user, action="auth.password_change")
        refresh = RefreshToken.for_user(user)
        return cookie(Response({"access": str(refresh.access_token), "user": user_data(user)}), refresh)


class AuditSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="actor.username", read_only=True)
    material_title = serializers.CharField(source="material.title", read_only=True, default=None)

    class Meta:
        model = AuditLog
        fields = ["id", "actor", "username", "action", "material", "material_title", "details", "created_at"]


class AdminActivityView(generics.ListAPIView):
    permission_classes = [IsSuperAdmin]
    serializer_class = AuditSerializer
    filterset_fields = ["actor", "action"]

    def get_queryset(self):
        queryset = super().get_queryset()
        subject = self.request.query_params.get("account")
        if subject:
            if not subject.isdigit():
                raise serializers.ValidationError({"account": "Enter a valid account ID."})
            queryset = queryset.filter(Q(actor_id=int(subject)) | Q(details__user_id=int(subject)))
        return queryset
    search_fields = ["actor__username", "action", "material__title"]
    queryset = AuditLog.objects.select_related("actor", "material").order_by("-created_at", "-id")
