import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from exams.models import MockAttempt, QuestionSet
from learning.models import (
    AudioAsset,
    Category,
    Material,
    PracticeSession,
    StudentResponse,
    TranscriptVersion,
)

pytestmark = pytest.mark.django_db


def client(user=None):
    c = APIClient()
    if user:
        c.force_authenticate(user)
    return c


def test_directory_permissions_are_read_only():
    admin = User.objects.create_user(username="admin-viewer", role="admin")
    owner = User.objects.create_superuser(username="owner-viewer")
    student = User.objects.create_user(username="student-viewer")
    teacher = User.objects.create_user(
        username="teacher-viewer", role="teacher", is_staff=True
    )
    inactive = User.objects.create_user(
        username="inactive-viewer", role="admin", is_active=False
    )
    for user in [None, student, teacher, inactive]:
        for path in ["/api/v1/admin/users/", "/api/v1/admin/users/overview/"]:
            assert client(user).get(path).status_code in (401, 403)
    for user in [admin, owner]:
        for path in ["/api/v1/admin/users/", "/api/v1/admin/users/overview/"]:
            assert client(user).get(path).status_code == 200
            assert client(user).post(path, {"role": "admin"}).status_code == 405
    assert client(admin).get("/api/v1/auth/me/").data["can_view_users"] is True
    assert client(teacher).get("/api/v1/auth/me/").data["can_view_users"] is False


def test_directory_persisted_metrics_search_role_pagination():
    admin = User.objects.create_user(username="directory-admin", role="admin")
    student = User.objects.create_user(
        username="actual-learner", email="learner@example.test"
    )
    category = Category.objects.create(name="Original fixture")
    material = Material.objects.create(
        title="Original fixture", category=category, owner=admin
    )
    audio = AudioAsset.objects.create(
        material=material,
        file="unused.wav",
        duration_ms=1000,
        size=0,
        mime_type="audio/wav",
    )
    version = TranscriptVersion.objects.create(material=material, audio=audio)
    questions = QuestionSet.objects.create(material=material, audio=audio)
    for difficulty in ["easy", "medium"]:
        session = PracticeSession.objects.create(
            user=student, material=material, version=version, difficulty=difficulty
        )
        for i in range(3):
            StudentResponse.objects.create(
                session=session, position=i, original_answer="answer", result={}
            )
    for score, total in [(1, 2), (3, 4)]:
        MockAttempt.objects.create(
            user=student,
            material=material,
            version=version,
            question_set=questions,
            timing="untimed",
            submitted_at=timezone.now(),
            score=score,
            total=total,
        )
    MockAttempt.objects.create(
        user=student,
        material=material,
        version=version,
        question_set=questions,
        timing="untimed",
    )
    c = client(admin)
    data = c.get("/api/v1/admin/users/?search=learner@example.test").data
    assert data["count"] == 1
    row = data["results"][0]
    assert row["practice_sessions"] == 2 and row["checked_answers"] == 6
    assert row["completed_mocks"] == 2 and row["mock_score_percent"] == 66.7
    assert row["last_learning_at"] is not None
    assert not {"password", "last_login", "is_staff", "answers", "token"} & row.keys()
    overview = c.get("/api/v1/admin/users/overview/").data
    assert overview == {
        "total_users": 2,
        "students": 1,
        "active_accounts": 2,
        "learning_users_7d": 1,
        "completed_mocks": 2,
        "checked_answers": 6,
        "mock_score_percent": 66.7,
    }
    assert c.get("/api/v1/admin/users/?role=admin").data["count"] == 1
    assert c.get("/api/v1/admin/users/?role=invalid").status_code == 400
    empty = c.get("/api/v1/admin/users/?search=directory-admin").data["results"][0]
    assert empty["mock_score_percent"] is None and empty["last_learning_at"] is None
    User.objects.bulk_create([User(username=f"empty-{i}") for i in range(21)])
    first = c.get("/api/v1/admin/users/")
    assert first.data["count"] == 23 and len(first.data["results"]) == 20
    assert len(c.get("/api/v1/admin/users/?page=2").data["results"]) == 3
    assert first["Cache-Control"] == "private, no-store"
