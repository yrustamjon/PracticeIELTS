"""Easy timing corrections use original silent PCM and preserve session snapshots."""

import io
import wave

import pytest
from django.core.files.base import ContentFile
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from learning.models import (
    AudioAsset,
    AuditLog,
    Category,
    Material,
    PracticeSession,
    Segment,
    StudentResponse,
    TranscriptVersion,
)
from learning.services.comparison import groups

pytestmark = pytest.mark.django_db


@pytest.fixture
def timing(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    users = {
        name: User.objects.create_user(username=f"timing-{name}", role=role)
        for name, role in (
            ("admin", "admin"),
            ("other_admin", "admin"),
            ("teacher", "teacher"),
            ("student", "student"),
        )
    }
    material = Material.objects.create(
        title="Original timing practice",
        category=Category.objects.create(name="Original timing fixtures"),
        owner=users["teacher"],
        source="Original silent PCM",
        license="CC0",
        rights_confirmed=True,
    )
    output = io.BytesIO()
    with wave.open(output, "wb") as audio:
        audio.setparams((1, 2, 8000, 0, "NONE", "not compressed"))
        audio.writeframes(b"\0\0" * 80000)
    asset = AudioAsset.objects.create(
        material=material,
        file=ContentFile(output.getvalue(), name="original-timing.wav"),
        duration_ms=10000,
        mime_type="audio/wav",
        size=len(output.getvalue()),
    )
    version = TranscriptVersion.objects.create(
        material=material, audio=asset, published_at=timezone.now()
    )
    tokens = "One two three four five six seven eight nine ten eleven twelve.".split()
    Segment.objects.create(
        version=version,
        position=0,
        text=" ".join(tokens),
        start_ms=100,
        end_ms=2450,
        words=[
            {
                "word": word,
                "start_ms": 100 + i * 200,
                "end_ms": 250 + i * 200,
                "probability": 0.99,
            }
            for i, word in enumerate(tokens)
        ],
    )
    for position, start, end in ((1, 3000, 4200), (2, 6000, 7000)):
        Segment.objects.create(
            version=version,
            position=position,
            text=f"Original sentence {position}.",
            start_ms=start,
            end_ms=end,
        )
    material.published_version = version
    material.save()
    client = APIClient()
    return client, users, material, version


def start(timing, name="admin", difficulty="easy"):
    client, users, material, _ = timing
    client.force_authenticate(users[name])
    response = client.post(
        "/api/v1/sessions/",
        {"material": material.pk, "difficulty": difficulty},
        format="json",
    )
    assert response.status_code == 200, response.data
    return response.data


def save(client, session, **changes):
    data = {
        "position": 1,
        "start_ms": 1350,
        "end_ms": 2400,
        "revision": session.get("timing_revision"),
    }
    return client.patch(
        f"/api/v1/sessions/{session['id']}/timing/", data | changes, format="json"
    )


def test_admin_correction_persists_exact_easy_chunk_without_rewriting_transcript(
    timing,
):
    client, _, material, version = timing
    student = start(timing, "student")
    admin = start(timing)
    old = list(version.segments.values("id", "text", "start_ms", "end_ms", "words"))
    # Unpublished corrections from the regular editor must remain untouched.
    draft = TranscriptVersion.objects.create(material=material, audio=version.audio)
    Segment.objects.create(
        version=draft, position=0, text="User draft edit.", start_ms=0, end_ms=9000
    )
    client.patch(
        f"/api/v1/sessions/{admin['id']}/",
        {"draft": "my answer", "draft_position": 1, "position": 1},
        format="json",
    )
    checked = client.post(
        f"/api/v1/sessions/{admin['id']}/check/",
        {"position": 1, "answer": "seven eight"},
        format="json",
    )
    assert checked.status_code == 200
    saved = save(client, admin)
    assert saved.status_code == 200, getattr(saved, "data", saved.content)
    assert saved.data["can_edit_timing"] is True
    assert saved.data["timing_revision"] is not None
    assert saved.data["version"] == version.pk
    assert saved.data["groups"][1]["start_ms"] == 1350
    assert saved.data["groups"][1]["end_ms"] == 2400
    assert saved.data["groups"][0] == admin["groups"][0]
    assert saved.data["groups"][2:] == admin["groups"][2:]
    assert saved.data["groups"][1]["word_count"] == admin["groups"][1]["word_count"]
    assert saved.data["drafts"] == {"1": "my answer"}
    assert saved.data["position"] == 1 and saved.data["checked_positions"] == [1]
    assert (
        client.get(f"/api/v1/sessions/{admin['id']}/").data["groups"]
        == saved.data["groups"]
    )
    material.refresh_from_db()
    assert material.published_version_id == version.pk
    assert material.versions.first().pk == draft.pk
    assert (
        list(version.segments.values("id", "text", "start_ms", "end_ms", "words"))
        == old
    )
    assert StudentResponse.objects.filter(session_id=admin["id"]).count() == 1
    assert (
        AuditLog.objects.filter(material=material, action="practice.timing").count()
        == 1
    )
    # Existing student history stays pinned; new Easy starts receive corrected timing.
    client.force_authenticate(timing[1]["student"])
    assert (
        client.get(f"/api/v1/sessions/{student['id']}/").data["groups"]
        == student["groups"]
    )
    newer = start(timing, "student")
    assert newer["id"] != student["id"]
    assert newer["groups"] == saved.data["groups"]
    medium = start(timing, "admin", "medium")
    assert medium["groups"][0]["start_ms"] == 100
    assert medium["groups"][0]["end_ms"] == 2450


@pytest.mark.parametrize("name", ["teacher", "student"])
def test_only_admin_or_django_staff_can_correct_timing(timing, name):
    session = start(timing, name)
    response = save(timing[0], session)
    assert response.status_code == 403
    assert session["can_edit_timing"] is False


def test_staff_administrator_can_correct_timing(timing):
    timing[1]["teacher"].is_staff = True
    timing[1]["teacher"].save()
    session = start(timing, "teacher")
    assert save(timing[0], session).status_code == 200


@pytest.mark.parametrize("difficulty", ["medium", "hard", "full"])
def test_timing_correction_is_easy_only(timing, difficulty):
    session = start(timing, difficulty=difficulty)
    assert save(timing[0], session).status_code == 400
    assert session["can_edit_timing"] is False


@pytest.mark.parametrize(
    "changes",
    [
        {"start_ms": True},
        {"end_ms": 2400.2},
        {"position": True},
        {"revision": False},
        {"start_ms": -1},
        {"end_ms": 10001},
        {"start_ms": 2400},
        {"end_ms": 1300},
        {"start_ms": 1200},
        {"end_ms": 3001},
        {"position": 999},
        {"start_ms": "1.35"},
    ],
)
def test_invalid_or_overlapping_intervals_are_rejected_without_changes(timing, changes):
    session = start(timing)
    response = save(timing[0], session, **changes)
    assert response.status_code == 400, response.data
    current = timing[0].get(f"/api/v1/sessions/{session['id']}/").data
    assert current["groups"] == session["groups"]
    assert current["timing_revision"] is None


def test_corrections_do_not_rewrite_other_sessions_or_previous_revisions(timing):
    client = timing[0]
    admin = start(timing)
    first = save(client, admin)
    assert first.status_code == 200
    student = start(timing, "student")
    client.force_authenticate(timing[1]["admin"])
    second = save(client, first.data, start_ms=1400, end_ms=2350)
    assert second.status_code == 200
    assert second.data["timing_revision"] != first.data["timing_revision"]
    assert start(timing)["id"] == admin["id"]
    client.force_authenticate(timing[1]["student"])
    assert (
        client.get(f"/api/v1/sessions/{student['id']}/").data["groups"]
        == student["groups"]
    )


def test_stale_revision_cannot_overwrite_another_admins_newer_correction(timing):
    first = start(timing)
    stale = start(timing, "other_admin")
    client = timing[0]
    client.force_authenticate(timing[1]["admin"])
    saved = save(client, first)
    assert saved.status_code == 200
    client.force_authenticate(timing[1]["other_admin"])
    rejected = save(client, stale)
    assert rejected.status_code == 409
    assert "latest" in str(rejected.data).lower()
    client.force_authenticate(timing[1]["admin"])
    assert save(client, saved.data, revision=None).status_code == 409


def test_session_ownership_and_old_publication_are_enforced(timing):
    admin = start(timing)
    client, users, material, version = timing
    client.force_authenticate(users["other_admin"])
    assert save(client, admin).status_code == 404
    client.force_authenticate(None)
    assert save(client, admin).status_code == 401
    client.force_authenticate(users["admin"])
    material.published_version = TranscriptVersion.objects.create(
        material=material, audio=version.audio
    )
    material.save()
    assert save(client, admin).status_code == 409


def test_legacy_easy_session_keeps_its_grouping_and_correction_scope(timing):
    client, users, material, version = timing
    session = PracticeSession.objects.create(
        user=users["admin"],
        material=material,
        version=version,
        difficulty="easy",
        grouping_version=0,
    )
    client.force_authenticate(users["admin"])
    original = groups(session)
    response = save(client, {"id": session.pk}, position=1, start_ms=3100, end_ms=4100)
    assert response.status_code == 200
    assert len(response.data["groups"]) == len(original) == 3
    # A legacy correction cannot change modern word-sized grouping.
    modern = start(timing)
    assert len(modern["groups"]) == 4
    assert modern["timing_revision"] is None
