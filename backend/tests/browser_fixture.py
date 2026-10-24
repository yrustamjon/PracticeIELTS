"""Create/remove only the exact disposable identities supplied by the browser test."""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django

django.setup()
from django.db import transaction

from accounts.models import User
from learning.models import (
    AudioAsset,
    AuditLog,
    Category,
    Material,
    PracticeSession,
    Segment,
    TranscriptVersion,
)

teacher = os.environ["TEST_TEACHER"]
student = os.environ["TEST_STUDENT"]
if not teacher.startswith("teacher_") or not student.startswith("student_"):
    raise RuntimeError("Expected disposable test identities")
if sys.argv[1] == "create":
    User.objects.create_user(
        username=teacher, password=os.environ["TEST_PASSWORD"], role="teacher"
    )
    User.objects.create_user(username=student, password=os.environ["TEST_PASSWORD"])
elif sys.argv[1] == "cleanup":
    with transaction.atomic():
        users = User.objects.filter(username__in=[teacher, student])
        materials = Material.objects.filter(owner__in=users)
        PracticeSession.objects.filter(user__in=users).delete()
        materials.update(published_version=None)
        Segment.objects.filter(version__material__in=materials).delete()
        TranscriptVersion.objects.filter(material__in=materials).delete()
        for asset in AudioAsset.objects.filter(material__in=materials):
            asset.file.delete(save=False)
            asset.delete()
        AuditLog.objects.filter(actor__in=users).delete()
        materials.delete()
        Category.objects.filter(
            name="Everyday English " + teacher.removeprefix("teacher_")
        ).delete()
        users.delete()
else:
    raise RuntimeError("Expected create or cleanup")
