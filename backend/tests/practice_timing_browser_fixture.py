"""Disposable, manually authored original PCM fixtures for the timing browser flow."""

import io
import json
import os
import re
import sys
import wave
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django

django.setup()
from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone

from accounts.models import User
from learning.models import (
    AudioAsset,
    AuditLog,
    Category,
    Material,
    PracticeSession,
    PracticeTimingRevision,
    Segment,
    TranscriptVersion,
)

stamp = os.environ["TIMING_QA_ID"]
if not re.fullmatch(r"[a-z0-9]{6,20}", stamp):
    raise RuntimeError("Expected an exact disposable timing QA id")
admin_name, student_name = f"timing_admin_{stamp}", f"timing_student_{stamp}"
category_name = f"Original timing QA {stamp}"

if sys.argv[1] == "create":
    with transaction.atomic():
        admin = User.objects.create_user(
            username=admin_name, password=os.environ["TIMING_QA_PASSWORD"], role="admin"
        )
        User.objects.create_user(
            username=student_name, password=os.environ["TIMING_QA_PASSWORD"]
        )
        category = Category.objects.create(name=category_name)
        material = Material.objects.create(
            title=category_name,
            category=category,
            owner=admin,
            source="Original silent PCM browser fixture",
            license="CC0",
            rights_confirmed=True,
        )
        out = io.BytesIO()
        with wave.open(out, "wb") as wav:
            wav.setparams((1, 2, 8000, 0, "NONE", "not compressed"))
            wav.writeframes(b"\0\0" * 80000)
        audio = AudioAsset.objects.create(
            material=material,
            file=ContentFile(out.getvalue(), name="original-timing.wav"),
            duration_ms=10000,
            mime_type="audio/wav",
            size=len(out.getvalue()),
        )
        version = TranscriptVersion.objects.create(
            material=material, audio=audio, origin="manual", published_at=timezone.now()
        )
        tokens = (
            "One two three four five six seven eight nine ten eleven twelve.".split()
        )
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
                    "probability": 1,
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
    print(
        json.dumps(
            {"material": material.pk, "admin": admin_name, "student": student_name}
        )
    )
elif sys.argv[1] == "cleanup":
    files = []
    with transaction.atomic():
        owned = Material.objects.filter(owner__username=admin_name)
        PracticeSession.objects.filter(material__in=owned).delete()
        PracticeTimingRevision.objects.filter(version__material__in=owned).delete()
        AuditLog.objects.filter(material__in=owned).delete()
        owned.update(published_version=None, published_questions=None)
        Segment.objects.filter(version__material__in=owned).delete()
        TranscriptVersion.objects.filter(material__in=owned).delete()
        for asset in AudioAsset.objects.filter(material__in=owned):
            files.append((asset.file.storage, asset.file.name))
        AudioAsset.objects.filter(material__in=owned).delete()
        owned.delete()
        Category.objects.filter(name=category_name).delete()
        AuditLog.objects.filter(actor__username__in=[admin_name, student_name]).delete()
        User.objects.filter(username__in=[admin_name, student_name]).delete()
    for storage, name in files:
        storage.delete(name)
    print("Disposable timing fixtures removed.")
else:
    raise RuntimeError("Expected create or cleanup")
