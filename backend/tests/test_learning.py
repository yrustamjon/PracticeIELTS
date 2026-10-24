import io
import wave

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from accounts.models import User
from learning.models import (
    Material,
    PracticeSession,
    StudentResponse,
)
from learning.services.comparison import compare

pytestmark = pytest.mark.django_db


@pytest.fixture
def users():
    return [
        User.objects.create_user(username=name, password="Unique-study-739!", role=role)
        for name, role in [
            ("teacher", "teacher"),
            ("student", "student"),
            ("another", "student"),
            ("editor", "teacher"),
        ]
    ]


@pytest.fixture
def client():
    return APIClient()


def audio_file():
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(8000)
        wav.writeframes(b"\x00\x00" * 32000)
    return SimpleUploadedFile("original.wav", buf.getvalue(), content_type="audio/wav")


@pytest.fixture
def material(client, users, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    client.force_authenticate(users[0])
    category = client.post(
        "/api/v1/categories/", {"name": "Original listening"}, format="json"
    ).data["id"]
    m = client.post(
        "/api/v1/materials/",
        {
            "title": "At the library",
            "category": category,
            "source": "Original test fixture",
            "license": "CC0",
            "rights_confirmed": True,
        },
        format="json",
    ).data
    assert (
        client.post(
            f"/api/v1/materials/{m['id']}/audio/",
            {"file": audio_file()},
            format="multipart",
        ).status_code
        == 201
    )
    response = client.put(
        f"/api/v1/materials/{m['id']}/transcript/",
        {
            "segments": [
                {"text": "Welcome to our library.", "start_ms": 0, "end_ms": 1800},
                {"text": "The books are upstairs.", "start_ms": 2000, "end_ms": 4000},
            ]
        },
        format="json",
    )
    assert response.status_code == 201, response.data
    return m


def publish(client, m):
    r = client.post(f"/api/v1/materials/{m['id']}/publish/")
    assert r.status_code == 200, r.data
    return r.data


def test_auth_and_roles(client, users):
    assert client.get("/api/v1/categories/").status_code == 401
    result = client.post(
        "/api/v1/auth/login/",
        {"username": "student", "password": "Unique-study-739!"},
        format="json",
    )
    assert result.status_code == 200 and result.cookies["refresh"]["httponly"]
    client.credentials(HTTP_AUTHORIZATION="Bearer " + result.data["access"])
    assert client.get("/api/v1/auth/me/").data["role"] == "student"
    assert (
        client.post(
            "/api/v1/categories/", {"name": "Forbidden"}, format="json"
        ).status_code
        == 403
    )
    client.credentials()
    rotated = client.post("/api/v1/auth/refresh/")
    assert rotated.status_code == 200
    assert client.post("/api/v1/auth/logout/").status_code == 204
    assert client.post("/api/v1/auth/refresh/").status_code == 401


def test_csrf_enforced_and_refresh_revoked(users):
    c = APIClient(enforce_csrf_checks=True)
    assert (
        c.post(
            "/api/v1/auth/login/",
            {"username": "student", "password": "Unique-study-739!"},
        ).status_code
        == 403
    )
    token = c.get("/api/v1/auth/csrf/").data["csrfToken"]
    r = c.post(
        "/api/v1/auth/login/",
        {"username": "student", "password": "Unique-study-739!"},
        HTTP_X_CSRFTOKEN=token,
    )
    assert r.status_code == 200
    old = c.cookies["refresh"].value
    assert c.post("/api/v1/auth/refresh/", HTTP_X_CSRFTOKEN=token).status_code == 200
    c.cookies["refresh"] = old
    assert c.post("/api/v1/auth/refresh/", HTTP_X_CSRFTOKEN=token).status_code == 401


def test_register_cannot_elevate(client):
    r = client.post(
        "/api/v1/auth/register/",
        {
            "username": "newuser",
            "email": "new@example.test",
            "password": "Unique-study-739!",
            "role": "admin",
            "is_staff": True,
        },
        format="json",
    )
    assert r.status_code == 201 and r.data["user"]["role"] == "student"
    assert not User.objects.get(username="newuser").is_staff
    assert (
        client.post(
            "/api/v1/auth/register/",
            {"username": "bad", "password": "123"},
            format="json",
        ).status_code
        == 400
    )


def test_hierarchy_and_safe_delete(client, users):
    client.force_authenticate(users[0])
    a = client.post("/api/v1/categories/", {"name": "Source"}, format="json").data
    b = client.post(
        "/api/v1/categories/",
        {"name": "Custom depth", "parent": a["id"]},
        format="json",
    ).data
    assert (
        client.patch(
            f"/api/v1/categories/{a['id']}/", {"parent": b["id"]}, format="json"
        ).status_code
        == 400
    )
    assert client.delete(f"/api/v1/categories/{a['id']}/").status_code == 400
    assert (
        client.patch(
            f"/api/v1/categories/{b['id']}/",
            {"name": "Renamed", "parent": None, "position": 3},
            format="json",
        ).status_code
        == 200
    )
    assert client.delete(f"/api/v1/categories/{a['id']}/").status_code == 204


def test_draft_visibility_and_editor_ownership(client, users, material):
    m = material
    asset = Material.objects.get(pk=m["id"]).audio_assets.first()
    client.force_authenticate(users[1])
    assert client.get("/api/v1/materials/").data["count"] == 0
    assert client.get(f"/api/v1/materials/{m['id']}/").status_code == 404
    assert client.get(f"/api/v1/audio/{asset.pk}/stream/").status_code == 403
    client.force_authenticate(users[3])
    assert client.patch(
        f"/api/v1/materials/{m['id']}/", {"title": "Stolen"}, format="json"
    ).status_code in (403, 404)
    assert client.get(f"/api/v1/audio/{asset.pk}/stream/").status_code == 403


def test_publication_gates_and_audio(client, users, material):
    m = material
    client.patch(
        f"/api/v1/materials/{m['id']}/", {"rights_confirmed": False}, format="json"
    )
    assert client.post(f"/api/v1/materials/{m['id']}/publish/").status_code == 400
    client.patch(
        f"/api/v1/materials/{m['id']}/", {"rights_confirmed": True}, format="json"
    )
    published = publish(client, m)
    client.force_authenticate(users[1])
    url = published["audio"]["stream_url"]
    r = client.get(url, HTTP_RANGE="bytes=0-99")
    assert r.status_code == 206 and len(b"".join(r.streaming_content)) == 100
    assert r["Content-Range"].startswith("bytes 0-99/")
    assert client.get(url, HTTP_RANGE="bytes=9999999-").status_code == 416
    client.force_authenticate(None)
    assert client.get(url).status_code == 401


def test_invalid_upload_and_timestamps(client, users, material):
    path = f"/api/v1/materials/{material['id']}/"
    bad = SimpleUploadedFile("bad.wav", b"not audio", content_type="audio/wav")
    assert (
        client.post(path + "audio/", {"file": bad}, format="multipart").status_code
        == 400
    )
    for segments in [
        [{"text": "No", "start_ms": 0, "end_ms": 5000}],
        [{"text": "No", "start_ms": 1000, "end_ms": 999}],
        [{"text": "", "start_ms": 0, "end_ms": 1000}],
        [
            {"text": "A", "start_ms": 0, "end_ms": 2000},
            {"text": "B", "start_ms": 1000, "end_ms": 3000},
        ],
    ]:
        assert (
            client.put(
                path + "transcript/", {"segments": segments}, format="json"
            ).status_code
            == 400
        )


def test_full_practice_resume_and_version_pinning(client, users, material):
    m = publish(client, material)
    client.force_authenticate(users[1])
    r = client.post(
        "/api/v1/sessions/", {"material": m["id"], "difficulty": "easy"}, format="json"
    )
    assert r.status_code == 200
    s = r.data
    path = f"/api/v1/sessions/{s['id']}/"
    assert len(s["groups"]) == 2
    answer = "Welcome to the library."
    assert (
        client.patch(
            path, {"draft": answer, "draft_position": 0, "position": 1}, format="json"
        ).status_code
        == 200
    )
    check = client.post(
        path + "check/", {"position": 0, "answer": answer}, format="json"
    )
    assert check.status_code == 200 and check.data["accuracy"] < 100
    stored = StudentResponse.objects.get(session_id=s["id"])
    assert stored.original_answer == answer
    resume = client.post(
        "/api/v1/sessions/", {"material": m["id"], "difficulty": "easy"}, format="json"
    ).data
    assert (
        resume["id"] == s["id"]
        and resume["position"] == 1
        and resume["drafts"]["0"] == answer
    )
    stats = client.get("/api/v1/progress/").data
    assert (
        stats["sentences_completed"] == 1
        and stats["attempts"] == 1
        and stats["resume"]["id"] == s["id"]
    )
    assert (
        client.get("/api/v1/responses/?mistakes=true").data["results"][0]["answer"]
        == answer
    )
    client.force_authenticate(users[2])
    assert client.get(path).status_code == 404
    assert (
        client.post(path + "check/", {"answer": "x"}, format="json").status_code == 404
    )
    client.force_authenticate(users[0])
    changed = client.put(
        f"/api/v1/materials/{m['id']}/transcript/",
        {"segments": [{"text": "A revised reference.", "start_ms": 0, "end_ms": 4000}]},
        format="json",
    )
    assert changed.status_code == 201
    publish(client, m)
    assert PracticeSession.objects.get(pk=s["id"]).version_id == s["version"]
    assert stored.result["reference"] == "Welcome to our library."


@pytest.mark.parametrize(
    "difficulty,count", [("easy", 2), ("medium", 1), ("hard", 1), ("full", 1)]
)
def test_difficulty_groups(client, users, material, difficulty, count):
    m = publish(client, material)
    client.force_authenticate(users[1])
    session = client.post(
        "/api/v1/sessions/",
        {"material": m["id"], "difficulty": difficulty},
        format="json",
    ).data
    assert len(session["groups"]) == count
    if difficulty != "easy":
        assert session["groups"][0]["end_ms"] == 4000


def test_progress_is_empty_not_fabricated(client, users):
    client.force_authenticate(users[1])
    data = client.get("/api/v1/progress/").data
    assert data["accuracy"] is None and data["resume"] is None and data["attempts"] == 0
    assert all(day["count"] == 0 for day in data["weekly_activity"])


@pytest.mark.parametrize(
    "reference,answer,status",
    [
        ("one two three", "one three", "missing"),
        ("one two", "one two three", "extra"),
        ("library opens", "libary opens", "incorrect"),
    ],
)
def test_comparison_types(reference, answer, status):
    result = compare(reference, answer)
    assert (
        any(t["status"] == status for t in result["tokens"])
        and result["accuracy"] < 100
    )


def test_normalization_and_order():
    assert compare("Hello, WORLD!", "hello world")["accuracy"] == 100
    assert compare("Hello", "hello", {"capitalization": False})["accuracy"] == 0
    assert compare("one book", "1 book", {"numbers": True})["accuracy"] == 100
    assert (
        compare("I don't know", "i do not know", {"contractions": True})["accuracy"]
        == 100
    )
    assert compare("red blue", "blue red")["accuracy"] < 100


def test_published_material_does_not_leak_another_teachers_draft(
    client, users, material
):
    m = publish(client, material)
    client.put(
        f"/api/v1/materials/{m['id']}/transcript/",
        {
            "segments": [
                {"text": "Unpublished teacher notes.", "start_ms": 0, "end_ms": 4000}
            ]
        },
        format="json",
    )
    client.force_authenticate(users[3])
    data = client.get(f"/api/v1/materials/{m['id']}/").data
    assert data["segments"][0]["text"] == "Welcome to our library."
    assert client.post(f"/api/v1/materials/{m['id']}/publish/").status_code == 403


def test_whitespace_normalization():
    assert compare("one  two", "one two")["accuracy"] == 100
    assert compare("one  two", "one two", {"whitespace": False})["accuracy"] < 100
