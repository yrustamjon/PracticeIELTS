from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.middleware.csrf import get_token
from drf_spectacular.utils import extend_schema, extend_schema_view, inline_serializer
from rest_framework import serializers
from rest_framework.authentication import CSRFCheck
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken, TokenError

from .models import User

Credentials = inline_serializer(
    name="Credentials",
    fields={
        "username": serializers.CharField(),
        "password": serializers.CharField(write_only=True),
    },
)
UserSchema = inline_serializer(
    name="UserProfile",
    fields={
        "id": serializers.IntegerField(),
        "username": serializers.CharField(),
        "email": serializers.EmailField(),
        "role": serializers.CharField(),
        "can_edit": serializers.BooleanField(),
    },
)
AuthSchema = inline_serializer(
    name="AuthenticationResult",
    fields={"access": serializers.CharField(), "user": UserSchema},
)


def user_data(user):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "can_edit": user.can_edit,
    }


def csrf(request):
    check = CSRFCheck(lambda r: None)
    check.process_request(request)
    reason = check.process_view(request, None, (), {})
    if reason:
        raise PermissionDenied(
            "CSRF verification failed. Refresh the page and try again."
        )


def cookie(response, refresh):
    response.set_cookie(
        "refresh",
        str(refresh),
        httponly=True,
        secure=not settings.DEBUG,
        samesite="Lax",
        path="/api/v1/auth/",
        max_age=7 * 86400,
    )
    return response


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["username", "email", "password"]

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)
        return value

    def create(self, data):
        return User.objects.create_user(**data)


@extend_schema_view(
    get=extend_schema(
        responses=inline_serializer(
            name="CsrfToken", fields={"csrfToken": serializers.CharField()}
        )
    )
)
class CsrfView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({"csrfToken": get_token(request)})


@extend_schema_view(
    post=extend_schema(request=RegisterSerializer, responses={201: AuthSchema})
)
class RegisterView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        csrf(request)
        s = RegisterSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = s.save()
        refresh = RefreshToken.for_user(user)
        return cookie(
            Response(
                {"access": str(refresh.access_token), "user": user_data(user)},
                status=201,
            ),
            refresh,
        )


@extend_schema_view(post=extend_schema(request=Credentials, responses=AuthSchema))
class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        csrf(request)
        user = authenticate(
            request,
            username=request.data.get("username"),
            password=request.data.get("password"),
        )
        if not user:
            return Response({"detail": "Incorrect username or password."}, status=401)
        refresh = RefreshToken.for_user(user)
        return cookie(
            Response({"access": str(refresh.access_token), "user": user_data(user)}),
            refresh,
        )


@extend_schema_view(post=extend_schema(request=None, responses=AuthSchema))
class RefreshView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        csrf(request)
        try:
            token = RefreshToken(request.COOKIES.get("refresh", ""))
            user = User.objects.get(pk=token["user_id"], is_active=True)
            token.blacklist()
            refresh = RefreshToken.for_user(user)
            return cookie(
                Response(
                    {"access": str(refresh.access_token), "user": user_data(user)}
                ),
                refresh,
            )
        except (TokenError, User.DoesNotExist):
            return Response({"detail": "Please sign in."}, status=401)


@extend_schema_view(post=extend_schema(request=None, responses={204: None}))
class LogoutView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        csrf(request)
        try:
            RefreshToken(request.COOKIES.get("refresh", "")).blacklist()
        except TokenError:
            pass
        response = Response(status=204)
        response.delete_cookie("refresh", path="/api/v1/auth/")
        return response


@extend_schema_view(get=extend_schema(responses=UserSchema))
class MeView(APIView):
    def get(self, request):
        return Response(user_data(request.user))
