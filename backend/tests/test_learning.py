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
    users[0].is_superuser = True
    users[0].save(update_fields=["is_superuser"])
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
    assert client.post(f"/api/v1/audio/{asset.pk}/playback/").status_code == 403
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
    full = client.get(url)
    assert full.status_code == 200
    original = b"".join(full.streaming_content)
    etag = full["ETag"]
    assert "private, no-cache" in full["Cache-Control"]
    cached = client.get(url, HTTP_IF_NONE_MATCH=etag)
    assert cached.status_code == 304 and cached.content == b""
    assert client.get(url, HTTP_IF_NONE_MATCH='W/' + etag).status_code == 304
    changed = client.get(url, HTTP_IF_NONE_MATCH='"old-revision"')
    assert changed.status_code == 200
    assert b"".join(changed.streaming_content) == original
    r = client.get(url, HTTP_RANGE="bytes=0-99")
    assert r.status_code == 206 and len(b"".join(r.streaming_content)) == 100
    assert r["Content-Range"].startswith("bytes 0-99/")
    assert client.get(url, HTTP_RANGE="bytes=9999999-").status_code == 416
    client.force_authenticate(None)
    assert client.get(url, HTTP_IF_NONE_MATCH=etag).status_code == 401


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
    users[0].is_superuser = True
    users[0].save(update_fields=["is_superuser"])
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
    "difficulty,count", [("easy", 2), ("medium", 2), ("hard", 1), ("full", 1)]
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
    if difficulty not in ("easy", "medium"):
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


def test_long_full_answer_is_bounded_before_allocating_alignment_matrix():
    with pytest.raises(ValueError, match="too long"):
        compare("word " * 1500, "word " * 1500)


def test_native_study_audio_cookie_is_scoped_revocable_and_range_capable(client, users, material):
    from rest_framework.test import APIClient
    from unittest.mock import patch
    import time
    published = publish(client, material)
    asset = Material.objects.get(pk=material['id']).audio_assets.first()
    client.force_authenticate(users[1])
    grant = client.post(f'/api/v1/audio/{asset.pk}/playback/', {}, format='json')
    assert grant.status_code == 200
    cookie = grant.cookies['study_audio']
    assert cookie['httponly'] and cookie['samesite'] == 'Strict'
    assert cookie['path'] == '/api/v1/audio/' and cookie['max-age'] == 600
    browser = APIClient()
    browser.cookies['study_audio'] = cookie.value
    url = published['audio']['stream_url']
    response = browser.get(url, HTTP_RANGE='bytes=0-99')
    assert response.status_code == 206 and len(b''.join(response.streaming_content)) == 100
    assert browser.get('/api/v1/auth/me/').status_code == 401
    assert browser.post(f'/api/v1/audio/{asset.pk}/playback/').status_code == 401
    with patch('django.core.signing.time.time', return_value=time.time()+601):
        assert browser.get(url).status_code == 401
    users[1].set_password('A-different-password-903!')
    users[1].save()
    assert browser.get(url, HTTP_IF_NONE_MATCH=response['ETag']).status_code == 401
    # Logout actively removes the media cookie from the current browser.
    csrf = browser.get('/api/v1/auth/csrf/').data['csrfToken']
    result = browser.post('/api/v1/auth/logout/', HTTP_X_CSRFTOKEN=csrf)
    assert result.status_code == 204 and result.cookies['study_audio']['max-age'] == 0


@pytest.mark.parametrize('difficulty', ['easy', 'medium', 'hard', 'full'])
@pytest.mark.parametrize('scope', ['part', 'full'])
def test_practice_public_share_modes(client, users, material, difficulty, scope):
    import uuid
    from learning.models import SharedPracticeResult

    from learning.models import ListeningTest, TestPart
    m = Material.objects.get(pk=material['id'])
    test = ListeningTest.objects.create(title='Original test', category=m.category, owner=users[0])
    if scope == 'part':
        TestPart.objects.create(test=test, number=1, material=m)
    else:
        test.full_material = m
        test.save()
    publish(client, material)
    client.force_authenticate(users[1])
    session = client.post('/api/v1/sessions/', {'material': material['id'], 'difficulty': difficulty}, format='json').data
    path = f"/api/v1/sessions/{session['id']}/"
    share = path + 'share/'
    token = client.post(share).data['token']
    initial = APIClient().get(f'/api/v1/shared-practice-results/{token}/').data
    assert initial['status'] == 'in_progress'
    assert initial['checked_count'] == 0 and initial['results'] == []
    assert initial['accuracy'] is None and initial['completed_at'] is None
    for i in range(len(session['groups'])):
        result = client.post(path + 'check/', {'position': i, 'answer': f'Checked answer {i}'}, format='json')
        assert result.status_code == 200, result.data
        live = APIClient().get(f'/api/v1/shared-practice-results/{token}/').data
        assert live['checked_count'] == i + 1
        assert len(live['results']) == i + 1
        assert live['status'] == ('completed' if i + 1 == len(session['groups']) else 'in_progress')
    token = client.post(share).data['token']
    assert client.post(share).data['token'] == token
    client.force_authenticate(users[2])
    for method in [client.get, client.post, client.delete]:
        assert method(share).status_code == 404
    public = APIClient()
    url = f'/api/v1/shared-practice-results/{token}/'
    response = public.get(url)
    assert response.status_code == 200
    data = response.data
    assert data['part_label'] == ('Part 1' if scope == 'part' else 'Full test')
    assert data['test_title'] == 'Original test'
    assert data['status'] == 'completed' and data['completed_at']
    assert data['checked_count'] == len(session['groups'])
    assert data['difficulty'] == difficulty
    assert data['exercise_count'] == len(session['groups'])
    assert data['results'][0]['answer'] == 'Checked answer 0'
    assert not {'user', 'email', 'audio', 'session', 'material'} & data.keys()
    assert response['Cache-Control'] == 'no-store'
    assert public.post(url).status_code == 405
    assert public.get(f'/api/v1/shared-practice-results/{uuid.uuid4()}/').status_code == 404
    client.force_authenticate(users[1])
    client.post(path + 'check/', {'position': 0, 'answer': 'Changed later'}, format='json')
    changed = public.get(url).data['results'][0]
    assert changed['answer'] == 'Changed later'
    assert changed['attempt_count'] == 2
    assert [row['number'] for row in changed['attempts']] == [1, 2]
    assert changed['attempts'][0]['accuracy'] == changed['first_accuracy']
    assert changed['attempts'][1]['accuracy'] == changed['accuracy']
    assert all(token['status'] != 'correct' for row in changed['attempts'] for token in row['mistakes'])
    assert any(row['mistakes'] for row in changed['attempts'])
    assert changed['first_accuracy'] == data['results'][0]['accuracy']
    assert data['results'][0]['attempt_count'] == 1
    assert client.get(share).data['token'] == token
    assert SharedPracticeResult.objects.get(token=token).snapshot == {}
    assert client.delete(share).status_code == 204
    assert public.get(url).status_code == 404
    new_token = client.post(share).data['token']
    assert new_token != token
    assert public.get(f'/api/v1/shared-practice-results/{new_token}/').data['results'][0]['answer'] == 'Changed later'
