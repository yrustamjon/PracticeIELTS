"""Pipeline/permission tests use a deterministic speech provider; real model smoke is separate."""

import io
import wave
from unittest.mock import Mock

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from accounts.models import User
from learning.models import (
    AudioAsset,
    Category,
    Material,
    PracticeSession,
    Segment,
    TranscriptVersion,
)
from learning.services.comparison import groups
from processing.models import ProcessingJob
from processing.segmentation import (
    align_reference,
    clean_words,
    easy_chunks,
)
from processing.services import queue_job
from processing.tasks import process_audio
from processing.transcription import (
    FasterWhisperService,
    ModelUnavailable,
    NoSpeech,
    ReferenceMismatch,
    SpeechResult,
)

pytestmark = pytest.mark.django_db


def timed_words(
    text="The friendly community library opens at nine every weekday morning. Please bring your card.",
):
    return [
        {
            "word": word,
            "start_ms": i * 250,
            "end_ms": (i + 1) * 250 - 20,
            "probability": 0.95,
        }
        for i, word in enumerate(text.split())
    ]


def wav():
    f = io.BytesIO()
    with wave.open(f, "wb") as a:
        a.setnchannels(1)
        a.setsampwidth(2)
        a.setframerate(8000)
        a.writeframes(b"\0\0" * 32000)
    return SimpleUploadedFile("fixture.wav", f.getvalue(), content_type="audio/wav")


@pytest.fixture
def setup_data(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    teacher = User.objects.create_user(username="pipeline_teacher", role="teacher")
    student = User.objects.create_user(username="pipeline_student")
    other = User.objects.create_user(username="pipeline_other", role="teacher")
    category = Category.objects.create(name="Original fixtures")
    material = Material.objects.create(
        title="Original speech",
        owner=teacher,
        category=category,
        source="Original fixture",
        license="CC0",
        rights_confirmed=True,
    )
    audio = AudioAsset.objects.create(
        material=material,
        file=wav(),
        duration_ms=4000,
        mime_type="audio/wav",
        size=64044,
    )
    return teacher, student, other, material, audio


def make_job(setup_data, reference=""):
    teacher, _, _, material, audio = setup_data
    return ProcessingJob.objects.create(
        material=material,
        audio=audio,
        requested_by=teacher,
        reference_text=reference,
        input_digest="a" * 64,
    )


def test_audio_only_pipeline_creates_reviewable_version_once(setup_data, monkeypatch):
    monkeypatch.setattr(
        FasterWhisperService,
        "transcribe",
        lambda self, path, stage: SpeechResult(timed_words(), "test-provider"),
    )
    job = make_job(setup_data)
    process_audio.run(job.pk)
    job.refresh_from_db()
    assert (
        job.state == "succeeded"
        and job.stage == "ready_for_review"
        and job.attempts == 1
    )
    version = job.result_version
    assert version.origin == "speech" and version.published_at is None
    assert version.segments.count() == 2
    assert version.segments.first().words[0]["word"] == "The"
    assert not version.segments.first().needs_review
    process_audio.run(job.pk)
    assert TranscriptVersion.objects.filter(material=job.material).count() == 1
    session = PracticeSession.objects.create(
        user=setup_data[1], material=job.material, version=version, difficulty="easy"
    )
    easy = groups(session)
    assert len(easy) == 3 and all("word_count" in g for g in easy)
    assert easy[0]["end_ms"] <= version.segments.first().end_ms
    session.difficulty = "medium"
    medium = groups(session)
    assert len(medium) == 2 and not any("word_count" in g for g in medium)
    session.difficulty = "hard"
    assert len(groups(session)) == 1 and "word_count" not in groups(session)[0]


def test_provider_failure_never_fabricates_transcript(setup_data, monkeypatch):
    def failed(*args):
        raise ModelUnavailable()

    monkeypatch.setattr(FasterWhisperService, "transcribe", failed)
    job = make_job(setup_data)
    process_audio.run(job.pk)
    job.refresh_from_db()
    assert job.state == "failed" and job.error_code == "model_unavailable"
    assert not TranscriptVersion.objects.exists()


def test_old_request_cannot_replace_newer_audio_or_reference(setup_data, monkeypatch):
    monkeypatch.setattr(
        FasterWhisperService,
        "transcribe",
        lambda *args: SpeechResult(timed_words(), "test-provider"),
    )
    old = make_job(setup_data)
    ProcessingJob.objects.create(
        material=old.material,
        audio=old.audio,
        requested_by=setup_data[0],
        input_digest="b" * 64,
    )
    process_audio.run(old.pk)
    old.refresh_from_db()
    assert old.error_code == "superseded" and not TranscriptVersion.objects.exists()


def test_reference_text_preserved_with_uncertainty():
    recognized = timed_words("The community library opens at nine every morning.")
    reference = "The community library opens at ten every morning."
    segments = align_reference(reference, recognized)
    assert segments[0]["text"] == reference and segments[0]["needs_review"]
    unknown = segments[0]["words"][5]
    assert unknown["word"] == "ten" and unknown["start_ms"] is None
    assert len(easy_chunks(segments[0])) == 1
    with pytest.raises(ReferenceMismatch):
        align_reference(
            "Completely different reference from another lecture.", recognized
        )


def test_no_word_timings_cannot_create_fake_boundaries():
    with pytest.raises(NoSpeech):
        clean_words([], 1000)
    with pytest.raises(NoSpeech):
        clean_words([{"word": "bad", "start_ms": 1200, "end_ms": 1500}], 1000)
    manual = {
        "text": "A long manually reviewed sentence without word timestamps.",
        "start_ms": 100,
        "end_ms": 2300,
        "words": [],
    }
    assert easy_chunks(manual) == [manual]


def test_job_idempotency_and_failed_retry(
    setup_data, monkeypatch, django_capture_on_commit_callbacks
):
    queued = Mock()
    monkeypatch.setattr(process_audio, "apply_async", queued)
    with django_capture_on_commit_callbacks(execute=True):
        first = queue_job(setup_data[4], setup_data[0])
    with django_capture_on_commit_callbacks(execute=True):
        second = queue_job(setup_data[4], setup_data[0])
    assert first.pk == second.pk and queued.call_count == 1
    ProcessingJob.objects.filter(pk=first.pk).update(
        state="failed", error_code="model_unavailable"
    )
    with django_capture_on_commit_callbacks(execute=True):
        third = queue_job(setup_data[4], setup_data[0])
    assert third.pk == first.pk and third.state == "queued" and queued.call_count == 2


def test_upload_queues_transcription_and_private_job_visibility(
    setup_data, monkeypatch, django_capture_on_commit_callbacks
):
    client = APIClient()
    client.force_authenticate(setup_data[0])
    monkeypatch.setattr(process_audio, "apply_async", Mock())
    path = f"/api/v1/materials/{setup_data[3].pk}/"
    with django_capture_on_commit_callbacks(execute=True):
        response = client.post(path + "audio/", {"file": wav()}, format="multipart")
    assert (
        response.status_code == 201 and response.data["processing"]["state"] == "queued"
    )
    assert client.get(path + "processing/").status_code == 200
    client.force_authenticate(setup_data[1])
    assert client.get(path + "processing/").status_code == 404
    client.force_authenticate(setup_data[2])
    assert client.get(path + "processing/").status_code == 404
    client.force_authenticate(setup_data[0])
    bad = SimpleUploadedFile("not.pdf", b"bad data", content_type="application/pdf")
    assert (
        client.post(
            path + "audio/", {"file": wav(), "reference_file": bad}, format="multipart"
        ).status_code
        == 400
    )


def test_generated_publish_requires_explicit_review(setup_data, monkeypatch):
    monkeypatch.setattr(
        FasterWhisperService,
        "transcribe",
        lambda *args: SpeechResult(timed_words(), "test-provider"),
    )
    job = make_job(setup_data)
    process_audio.run(job.pk)
    job.refresh_from_db()
    client = APIClient()
    client.force_authenticate(setup_data[0])
    path = f"/api/v1/materials/{setup_data[3].pk}/"
    assert client.post(path + "publish/", {}, format="json").status_code == 400
    assert (
        client.post(
            path + "publish/", {"confirm_review": True}, format="json"
        ).status_code
        == 200
    )
    client.force_authenticate(setup_data[1])
    response = client.post(
        "/api/v1/sessions/",
        {"material": setup_data[3].pk, "difficulty": "easy"},
        format="json",
    )
    assert response.status_code == 200 and response.data["groups"][0]["word_count"] > 0
    medium = client.post(
        "/api/v1/sessions/",
        {"material": setup_data[3].pk, "difficulty": "medium"},
        format="json",
    )
    assert (
        len(medium.data["groups"]) == 2 and "word_count" not in medium.data["groups"][0]
    )


def test_reference_file_intake(
    setup_data, monkeypatch, django_capture_on_commit_callbacks
):
    monkeypatch.setattr(process_audio, "apply_async", Mock())
    client = APIClient()
    client.force_authenticate(setup_data[0])
    path = f"/api/v1/materials/{setup_data[3].pk}/"
    text = "The community library opens at nine."
    with django_capture_on_commit_callbacks(execute=True):
        r = client.post(
            path + "audio/",
            {
                "file": wav(),
                "reference_file": SimpleUploadedFile("reference.txt", text.encode()),
            },
            format="multipart",
        )
    assert r.status_code == 201
    assert (
        ProcessingJob.objects.get(pk=r.data["processing"]["id"]).reference_text == text
    )


def test_legacy_grouping_is_preserved_for_historical_sessions(setup_data):
    _, student, _, material, audio = setup_data
    version = TranscriptVersion.objects.create(material=material, audio=audio)
    for i in range(4):
        Segment.objects.create(
            version=version,
            position=i,
            text=f"Original sentence {i}.",
            start_ms=i * 900,
            end_ms=i * 900 + 800,
        )
    legacy = PracticeSession.objects.create(
        user=student,
        material=material,
        version=version,
        difficulty="medium",
        grouping_version=0,
    )
    current = PracticeSession.objects.create(
        user=student,
        material=material,
        version=version,
        difficulty="medium",
        grouping_version=1,
    )
    assert len(groups(legacy)) == 2 and len(groups(current)) == 4
    assert (
        groups(legacy)[0]["text"]
        == "Original sentence 0. Original sentence 1. Original sentence 2."
    )


def test_reference_sentence_split_preserves_titles_and_decimals():
    from processing.segmentation import split_reference_sentences

    assert split_reference_sentences("Dr. Brown paid 3.5 pounds. It was cheap.") == [
        "Dr. Brown paid 3.5 pounds.",
        "It was cheap.",
    ]
