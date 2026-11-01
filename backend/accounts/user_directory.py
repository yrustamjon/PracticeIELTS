"""Read-only administrator directory backed by persisted learning records."""

from datetime import timedelta

from django.db.models import Count, Max, Q, Sum
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from exams.models import MockAttempt
from learning.models import PracticeSession, StudentResponse

from .models import User


class IsUserDirectoryAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and request.user.can_view_users)


class DirectoryInput(serializers.Serializer):
    search = serializers.CharField(required=False, allow_blank=True, max_length=150)
    role = serializers.ChoiceField(
        choices=["", "student", "teacher", "admin"], required=False
    )


class DirectoryUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "role",
            "is_active",
            "is_superuser",
            "date_joined",
        ]


def percentage(score, total):
    return round(score * 100 / total, 1) if total else None


def learning_rows(ids):
    practice = {
        r["user_id"]: r
        for r in PracticeSession.objects.filter(user_id__in=ids)
        .values("user_id")
        .annotate(count=Count("id"), last=Max("updated_at"))
    }
    checks = {
        r["session__user_id"]: r
        for r in StudentResponse.objects.filter(session__user_id__in=ids)
        .values("session__user_id")
        .annotate(count=Count("id"), last=Max("created_at"))
    }
    mocks = {
        r["user_id"]: r
        for r in MockAttempt.objects.filter(user_id__in=ids)
        .values("user_id")
        .annotate(
            count=Count("id", filter=Q(submitted_at__isnull=False)),
            points=Sum(
                "score", filter=Q(submitted_at__isnull=False, score__isnull=False)
            ),
            total=Sum(
                "total", filter=Q(submitted_at__isnull=False, score__isnull=False)
            ),
            last=Max("updated_at"),
        )
    }
    return practice, checks, mocks


class AdminUsersView(APIView):
    permission_classes = [IsUserDirectoryAdmin]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        filters = DirectoryInput(data=request.query_params)
        filters.is_valid(raise_exception=True)
        users = User.objects.all().order_by("-date_joined", "-id")
        term = filters.validated_data.get("search", "").strip()
        if term:
            users = users.filter(Q(username__icontains=term) | Q(email__icontains=term))
        role = filters.validated_data.get("role")
        if role == "admin":
            users = users.filter(Q(role="admin") | Q(is_superuser=True))
        elif role:
            users = users.filter(role=role, is_superuser=False)
        paginator = PageNumberPagination()
        paginator.page_size = 20
        page = paginator.paginate_queryset(users, request, view=self)
        practice, checks, mocks = learning_rows([u.pk for u in page])
        rows = DirectoryUserSerializer(page, many=True).data
        for row in rows:
            p, c, m = (
                practice.get(row["id"], {}),
                checks.get(row["id"], {}),
                mocks.get(row["id"], {}),
            )
            dates = [r["last"] for r in [p, c, m] if r.get("last")]
            row.update(
                practice_sessions=p.get("count", 0),
                checked_answers=c.get("count", 0),
                completed_mocks=m.get("count", 0),
                mock_score_percent=percentage(
                    m.get("points") or 0, m.get("total") or 0
                ),
                last_learning_at=max(dates) if dates else None,
            )
        response = paginator.get_paginated_response(rows)
        response["Cache-Control"] = "private, no-store"
        return response


class AdminUsersOverview(APIView):
    permission_classes = [IsUserDirectoryAdmin]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        since = timezone.now() - timedelta(days=7)
        learning_users = User.objects.filter(
            Q(
                pk__in=PracticeSession.objects.filter(updated_at__gte=since).values(
                    "user_id"
                )
            )
            | Q(
                pk__in=StudentResponse.objects.filter(created_at__gte=since).values(
                    "session__user_id"
                )
            )
            | Q(
                pk__in=MockAttempt.objects.filter(updated_at__gte=since).values(
                    "user_id"
                )
            )
        ).count()
        users = User.objects.aggregate(
            total_users=Count("id"),
            students=Count("id", filter=Q(role="student", is_superuser=False)),
            active_accounts=Count("id", filter=Q(is_active=True)),
        )
        mocks = MockAttempt.objects.filter(submitted_at__isnull=False).aggregate(
            completed=Count("id"),
            points=Sum("score", filter=Q(score__isnull=False)),
            total=Sum("total", filter=Q(score__isnull=False)),
        )
        return Response(
            {
                **users,
                "learning_users_7d": learning_users,
                "completed_mocks": mocks["completed"],
                "checked_answers": StudentResponse.objects.count(),
                "mock_score_percent": percentage(
                    mocks["points"] or 0, mocks["total"] or 0
                ),
            },
            headers={"Cache-Control": "private, no-store"},
        )
