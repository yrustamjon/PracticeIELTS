import pytest

from tests.test_exams import publish, start

pytest_plugins = ["tests.test_exams"]

pytestmark = pytest.mark.django_db


def test_submitted_review_uses_pinned_audio_and_private_playback(exam_data):
    client, teacher, student, other, editor, material, version = exam_data
    publish(exam_data)
    attempt = start(exam_data)
    assert attempt['review_audio_url'] is None
    result = client.post(f'/api/v1/mock-attempts/{attempt["id"]}/submit/')
    assert result.status_code == 200
    url = f'/api/v1/audio/{version.audio_id}/stream/'
    assert result.data['review_audio_url'] == url
    assert client.post(f'/api/v1/audio/{version.audio_id}/playback/').status_code == 200
    audio = client.get(url, HTTP_RANGE='bytes=0-15')
    assert audio.status_code == 206
    assert len(b''.join(audio.streaming_content)) == 16
    client.force_authenticate(other)
    assert client.get(f'/api/v1/mock-attempts/{attempt["id"]}/').status_code == 404


def test_submitted_mock_grants_only_owner_access_to_pinned_full_audio(exam_data):
    from learning.models import AudioAsset
    client, teacher, student, other, editor, material, version = exam_data
    publish(exam_data)
    original = version.audio
    full_audio = AudioAsset.objects.create(material=material, file=original.file.name, duration_ms=original.duration_ms, mime_type=original.mime_type, size=original.size)
    questions = material.published_questions
    questions.audio = full_audio
    questions.save(update_fields=['audio'])
    attempt = start(exam_data)
    playback = f'/api/v1/audio/{full_audio.pk}/playback/'
    assert client.post(playback).status_code == 403
    result = client.post(f'/api/v1/mock-attempts/{attempt["id"]}/submit/')
    assert result.data['review_audio_url'] == f'/api/v1/audio/{full_audio.pk}/stream/'
    assert client.post(playback).status_code == 200
    client.force_authenticate(other)
    assert client.post(playback).status_code == 403
