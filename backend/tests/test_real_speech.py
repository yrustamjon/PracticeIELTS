"""Opt-in test with a real local speech model and original synthesized audio."""

import os
import subprocess

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from accounts.models import User
from learning.models import AudioAsset, Category, Material, PracticeSession
from learning.services.audio import inspect_audio
from learning.services.comparison import groups
from processing.models import ProcessingJob
from processing.tasks import process_audio

pytestmark = [
    pytest.mark.django_db,
    pytest.mark.skipif(
        os.getenv("RUN_SPEECH_TESTS") != "1",
        reason="Prepare the public speech model and set RUN_SPEECH_TESTS=1 to run real ASR integration.",
    ),
]


def test_real_audio_only_and_optional_reference_create_versioned_practice(
    settings, tmp_path
):
    settings.MEDIA_ROOT = tmp_path / "media"
    path = tmp_path / "original.wav"
    reference = "Good morning and welcome to our library. The books are upstairs. Please bring your student card."
    subprocess.run(
        [
            "ffmpeg",
            "-v",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            f"flite=text='{reference}':voice=slt",
            "-ar",
            "22050",
            str(path),
        ],
        check=True,
    )
    upload = SimpleUploadedFile(
        "original.wav", path.read_bytes(), content_type="audio/wav"
    )
    duration, mime = inspect_audio(upload)
    teacher = User.objects.create_user(username="real_speech_teacher", role="teacher")
    student = User.objects.create_user(username="real_speech_student")
    category = Category.objects.create(name="Original real speech fixture")
    material = Material.objects.create(
        title="Real local speech test",
        category=category,
        owner=teacher,
        source="Original synthetic speech",
        license="CC0",
        rights_confirmed=True,
    )
    audio = AudioAsset.objects.create(
        material=material,
        file=upload,
        duration_ms=duration,
        mime_type=mime,
        size=upload.size,
    )
    job = ProcessingJob.objects.create(
        material=material, audio=audio, requested_by=teacher, input_digest="c" * 64
    )
    process_audio.run(job.pk)
    job.refresh_from_db()
    assert job.state == "succeeded", (job.error_code, job.error_message)
    version = job.result_version
    assert version.origin == "speech" and version.provider.startswith("faster-whisper:")
    recognized = " ".join(version.segments.values_list("text", flat=True)).lower()
    assert "library" in recognized and "books" in recognized and "card" in recognized
    for segment in version.segments.all():
        assert 0 <= segment.start_ms < segment.end_ms <= duration
        assert segment.words and all(w["start_ms"] is not None for w in segment.words)
    session = PracticeSession.objects.create(
        user=student, material=material, version=version, difficulty="easy"
    )
    easy = groups(session)
    assert easy and all(g["word_count"] > 0 for g in easy)
    session.difficulty = "medium"
    assert len(groups(session)) == version.segments.count() and all(
        "word_count" not in g for g in groups(session)
    )
    session.difficulty = "hard"
    assert len(groups(session)) == (version.segments.count() + 2) // 3
    # The optional authoritative reference is preserved, never silently rewritten by ASR.
    aligned = ProcessingJob.objects.create(
        material=material,
        audio=audio,
        requested_by=teacher,
        input_digest="d" * 64,
        reference_text=reference,
    )
    process_audio.run(aligned.pk)
    aligned.refresh_from_db()
    assert aligned.state == "succeeded", (aligned.error_code, aligned.error_message)
    assert (
        aligned.result_version.reference_text == reference
        and aligned.result_version.origin == "reference"
    )
    client = APIClient()
    client.force_authenticate(teacher)
    published = client.post(
        f"/api/v1/materials/{material.pk}/publish/",
        {"confirm_review": True},
        format="json",
    )
    assert published.status_code == 200, published.data
    client.force_authenticate(student)
    response = client.post(
        "/api/v1/sessions/",
        {"material": material.pk, "difficulty": "easy"},
        format="json",
    )
    assert response.status_code == 200 and response.data["groups"][0]["word_count"] > 0
