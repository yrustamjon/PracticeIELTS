"""Opt-in real browser + real Django Range delivery under a slow connection."""
import io
import json
import os
import subprocess
import wave
from pathlib import Path

import pytest
from django.core.files.base import ContentFile
from django.utils import timezone
from rest_framework_simplejwt.tokens import AccessToken

from accounts.models import User
from learning.models import AudioAsset, Category, Material, TranscriptVersion


@pytest.mark.skipif(os.getenv('STREAM_BROWSER_TEST') != '1', reason='Opt-in Chromium network test')
@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("exam", [False, True])
def test_playback_advances_before_complete_download(live_server, settings, tmp_path, exam):
    settings.MEDIA_ROOT = tmp_path
    user = User.objects.create_user(username='stream-browser-student')
    category = Category.objects.create(name='Original streaming test')
    material = Material.objects.create(title='Original silence', category=category, owner=user)
    data = io.BytesIO()
    with wave.open(data, 'wb') as file:
        file.setparams((1, 2, 16000, 0, 'NONE', 'not compressed'))
        file.writeframes(b'\0\0' * 16000 * 120)
    payload = data.getvalue()
    name, mime = 'original-silence.wav', 'audio/wav'
    if exam:
        mp3_path = tmp_path / 'generated.mp3'
        subprocess.run(['ffmpeg', '-v', 'error', '-i', 'pipe:0',
            '-b:a', '128k', str(mp3_path)], input=payload, capture_output=True, check=True)
        payload = mp3_path.read_bytes()
        name, mime = 'original-silence.mp3', 'audio/mpeg'
    asset = AudioAsset.objects.create(material=material, file=ContentFile(payload, name=name),
        duration_ms=120000, mime_type=mime, size=len(payload))
    version = TranscriptVersion.objects.create(material=material, audio=asset, published_at=timezone.now())
    material.published_version = version
    material.save()
    attempt_id = None
    if exam:
        from datetime import timedelta
        from exams.models import MockAttempt, QuestionSet
        questions = QuestionSet.objects.create(material=material, audio=asset)
        attempt = MockAttempt.objects.create(user=user, material=material, version=version,
            question_set=questions, timing="timed", deadline=timezone.now() + timedelta(minutes=30))
        attempt_id = attempt.pk
    result = subprocess.run([
        '/home/PracticeIELTS/.runtime/node_modules/node/bin/node',
        str(Path(settings.BASE_DIR).parent/'frontend/tests/e2e/native-stream.mjs'),
    ], input=json.dumps({'base':live_server.url,'token':str(AccessToken.for_user(user)),'audio':asset.pk,'attempt':attempt_id}), text=True, capture_output=True, timeout=55)
    assert result.returncode == 0, result.stderr
    metrics = json.loads(result.stdout)
    assert metrics['time'] > .3
    assert metrics['buffered'] < metrics['duration'] - 5
    print('Real throttled playback:', metrics)
