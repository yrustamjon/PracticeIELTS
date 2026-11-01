import pytest
from django.contrib.admin.sites import site
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User
from learning.models import (
    AudioAsset,
    AuditLog,
    Category,
    Material,
    Segment,
    TranscriptVersion,
)

pytestmark = pytest.mark.django_db
PASSWORD = "Unique-study-739!"
NEW_PASSWORD = "Revised-study-841!"


@pytest.fixture
def accounts():
    return (
        User.objects.create_superuser(username="owner", password=PASSWORD),
        User.objects.create_user(username="delegated", password=PASSWORD, role="admin"),
        User.objects.create_user(username="learner", password=PASSWORD),
    )


def client_for(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


def test_only_superuser_creates_admin_and_never_accepts_elevation(accounts):
    owner, admin, student = accounts
    body = {"username": "new-admin", "email": "admin@example.test", "password": PASSWORD}
    for actor in [admin, student]:
        c = client_for(actor)
        assert c.get("/api/v1/admin/accounts/").status_code == 403
        assert c.post("/api/v1/admin/accounts/", body, format="json").status_code == 403
        assert c.get("/api/v1/admin/activity/").status_code == 403
    c = client_for(owner)
    for field in ["is_superuser", "is_staff", "role", "is_active"]:
        assert c.post("/api/v1/admin/accounts/", {**body, field: True}, format="json").status_code == 400
    assert c.post("/api/v1/admin/accounts/", {**body, "password": "123"}, format="json").status_code == 400
    created = c.post("/api/v1/admin/accounts/", body, format="json")
    assert created.status_code == 201
    user = User.objects.get(pk=created.data["id"])
    assert user.role == "admin" and user.can_edit and not user.is_superuser and not user.is_staff
    assert user.check_password(PASSWORD) and "password" not in created.data
    assert c.post("/api/v1/admin/accounts/", body, format="json").status_code == 400
    event = AuditLog.objects.get(action="admin.create")
    assert event.actor == owner and event.details["user_id"] == user.pk
    assert PASSWORD not in str(event.details)
    login = APIClient().post("/api/v1/auth/login/", {"username": "new-admin", "password": PASSWORD})
    assert login.status_code == 200 and not login.data["user"]["can_delete"]


def test_delete_is_server_enforced_and_successful_changes_are_logged(accounts):
    owner, admin, student = accounts
    c = client_for(admin)
    created = c.post("/api/v1/categories/", {"name": "Owned category"}, format="json")
    assert created.status_code == 201
    path = f"/api/v1/categories/{created.data['id']}/"
    assert c.delete(path).status_code == 403
    assert c.patch(path, {"description": "An edit"}, format="json").status_code == 200
    assert AuditLog.objects.filter(actor=admin, action="api.patch", details__path=path).exists()
    assert client_for(student).delete(path).status_code == 403
    assert client_for(owner).delete(path).status_code == 204
    assert not Category.objects.filter(pk=created.data["id"]).exists()
    assert AuditLog.objects.filter(actor=owner, action="api.delete", details__path=path).exists()


def test_activity_filter_and_django_admin_permissions(accounts):
    owner, admin, _ = accounts
    AuditLog.objects.create(actor=admin, action="material.update", details={"path": "/api/v1/materials/42/"})
    AuditLog.objects.create(actor=owner, action="auth.login")
    c = client_for(owner)
    result = c.get(f"/api/v1/admin/activity/?actor={admin.pk}&page_size=1")
    assert result.status_code == 200 and result.data["count"] == 1
    assert result.data["results"][0]["username"] == admin.username
    assert c.get("/api/v1/admin/activity/?search=material.update").data["count"] == 1
    admin.is_staff = True
    admin.save()
    from django.test import RequestFactory
    request = RequestFactory().get("/django-admin/accounts/user/")
    request.user = admin
    registered = site._registry[User]
    assert not registered.has_change_permission(request, owner)
    assert not registered.has_add_permission(request)
    assert not registered.has_delete_permission(request, owner)


@pytest.mark.parametrize("actor_index", [0, 1, 2])
def test_password_validation_rotation_and_old_tokens_invalid(accounts, actor_index):
    user = accounts[actor_index]
    c = client_for(user)
    old_refresh = RefreshToken.for_user(user)
    old_access = str(old_refresh.access_token)
    path = "/api/v1/auth/password/"
    for data in [
        {"current_password": "wrong", "new_password": NEW_PASSWORD},
        {"current_password": PASSWORD, "new_password": "123"},
        {"current_password": PASSWORD, "new_password": PASSWORD},
    ]:
        assert c.post(path, data, format="json").status_code == 400
        user.refresh_from_db()
        assert user.check_password(PASSWORD)
    result = c.post(path, {"current_password": PASSWORD, "new_password": NEW_PASSWORD}, format="json")
    assert result.status_code == 200 and result.cookies["refresh"]["httponly"]
    user.refresh_from_db()
    assert user.check_password(NEW_PASSWORD)
    authenticated = APIClient()
    authenticated.credentials(HTTP_AUTHORIZATION=f"Bearer {old_access}")
    assert authenticated.get("/api/v1/auth/me/").status_code == 401
    authenticated.credentials(HTTP_AUTHORIZATION=f"Bearer {result.data['access']}")
    assert authenticated.get("/api/v1/auth/me/").status_code == 200
    refresh_client = APIClient()
    refresh_client.cookies["refresh"] = str(old_refresh)
    assert refresh_client.post("/api/v1/auth/refresh/").status_code == 401
    refresh_client.cookies["refresh"] = result.cookies["refresh"].value
    assert refresh_client.post("/api/v1/auth/refresh/").status_code == 200
    event = AuditLog.objects.get(actor=user, action="auth.password_change")
    assert PASSWORD not in str(event.details) and NEW_PASSWORD not in str(event.details)


def test_admin_cannot_remove_saved_sentences_via_replacement(accounts):
    owner, admin, _ = accounts
    category = Category.objects.create(name="Original")
    m = Material.objects.create(title="Original", category=category, owner=admin)
    audio = AudioAsset.objects.create(material=m, file="unused.wav", duration_ms=2000, size=0, mime_type="audio/wav")
    version = TranscriptVersion.objects.create(material=m, audio=audio)
    for i in range(2):
        Segment.objects.create(version=version, position=i, text=f"Sentence {i}", start_ms=i*1000, end_ms=i*1000+900)
    path = f"/api/v1/materials/{m.pk}/transcript/"
    data = {"segments": [{"text": "Sentence 0", "start_ms": 0, "end_ms": 900}]}
    assert client_for(admin).put(path, data, format="json").status_code == 403
    assert m.versions.count() == 1
    assert client_for(owner).put(path, data, format="json").status_code == 201
    assert version.segments.count() == 2


def test_anonymous_cannot_manage_admins_or_change_password():
    c = APIClient()
    assert c.get("/api/v1/admin/accounts/").status_code == 401
    assert c.get("/api/v1/admin/activity/").status_code == 401
    assert c.post("/api/v1/auth/password/", {}).status_code == 401


def test_admin_can_author_but_not_remove_saved_questions(accounts):
    owner, admin, _ = accounts
    category = Category.objects.create(name="Questions")
    material = Material.objects.create(title="Original questions", category=category, owner=admin)
    AudioAsset.objects.create(material=material, file="unused.wav", duration_ms=2000, size=0, mime_type="audio/wav")
    questions = [
        {"number": i, "part": 1, "type": "short_answer", "prompt": f"Original question {i}", "instructions": "ONE WORD ONLY", "options": [], "answers": ["library"], "max_words": 1, "context": {}}
        for i in [1, 2]
    ]
    path = f"/api/v1/materials/{material.pk}/questions/"
    c = client_for(admin)
    assert c.put(path, {"questions": questions, "presentation": "text"}, format="json").status_code == 201
    questions[0]["prompt"] = "Corrected original question"
    assert c.put(path, {"questions": questions, "presentation": "text"}, format="json").status_code == 201
    assert c.put(path, {"questions": questions[:1], "presentation": "text"}, format="json").status_code == 403
    assert material.question_sets.count() == 2
    assert client_for(owner).put(path, {"questions": questions[:1], "presentation": "text"}, format="json").status_code == 201
    assert material.question_sets.last().questions.count() == 2


def test_admin_profile_reset_block_and_activity(accounts):
    owner, admin, student = accounts
    path = f"/api/v1/admin/accounts/{admin.pk}/"
    for actor in [admin, student]:
        assert client_for(actor).get(path).status_code == 403
        assert client_for(actor).patch(path, {"is_active": False}, format="json").status_code == 403
    assert APIClient().get(path).status_code == 401
    c = client_for(owner)
    assert c.get(path).data["username"] == admin.username
    assert c.get(f"/api/v1/admin/accounts/{student.pk}/").status_code == 404
    for body in [{"new_password": "123"}, {"role": "student"}, {}]:
        assert c.patch(path, body, format="json").status_code == 400
    refresh = RefreshToken.for_user(admin)
    access = str(refresh.access_token)
    assert c.patch(path, {"new_password": NEW_PASSWORD}, format="json").status_code == 200
    admin.refresh_from_db()
    assert admin.check_password(NEW_PASSWORD)
    logged = APIClient()
    logged.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    assert logged.get("/api/v1/auth/me/").status_code == 401
    login = APIClient().post("/api/v1/auth/login/", {"username": admin.username, "password": NEW_PASSWORD})
    assert login.status_code == 200
    logged.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
    assert c.patch(path, {"is_active": False}, format="json").status_code == 200
    assert logged.get("/api/v1/auth/me/").status_code == 401
    assert APIClient().post("/api/v1/auth/login/", {"username": admin.username, "password": NEW_PASSWORD}).status_code == 403
    assert c.patch(path, {"is_active": True}, format="json").status_code == 200
    refresh_client = APIClient()
    refresh_client.cookies["refresh"] = login.cookies["refresh"].value
    assert refresh_client.post("/api/v1/auth/refresh/").status_code == 401
    AuditLog.objects.create(actor=admin, action="material.update")
    logs = c.get(f"/api/v1/admin/activity/?account={admin.pk}").data["results"]
    assert {"admin.password_reset", "admin.block", "admin.unblock", "material.update"} <= {event["action"] for event in logs}
    assert NEW_PASSWORD not in str(logs)
    assert c.get("/api/v1/admin/activity/?account=bad").status_code == 400
    for body in [{"is_active": False}, {"new_password": NEW_PASSWORD}]:
        assert c.patch(f"/api/v1/admin/accounts/{owner.pk}/", body, format="json").status_code == 400
