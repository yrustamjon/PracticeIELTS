import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q


def audio_path(instance, filename):
    return f"originals/{uuid.uuid4().hex}{__import__('pathlib').Path(filename).suffix.lower()}"


class Category(models.Model):
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.PROTECT, related_name="children"
    )
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position", "name"]


class Material(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.ForeignKey(
        Category, on_delete=models.PROTECT, related_name="materials"
    )
    source = models.CharField(max_length=300, blank=True)
    license = models.CharField(max_length=300, blank=True)
    rights_confirmed = models.BooleanField(default=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    published_version = models.ForeignKey(
        "TranscriptVersion",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]


class AudioAsset(models.Model):
    material = models.ForeignKey(
        Material, on_delete=models.PROTECT, related_name="audio_assets"
    )
    file = models.FileField(upload_to=audio_path)
    duration_ms = models.PositiveIntegerField()
    mime_type = models.CharField(max_length=80)
    size = models.PositiveBigIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)


class TranscriptVersion(models.Model):
    material = models.ForeignKey(
        Material, on_delete=models.PROTECT, related_name="versions"
    )
    audio = models.ForeignKey(AudioAsset, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-id"]


class Segment(models.Model):
    version = models.ForeignKey(
        TranscriptVersion, on_delete=models.PROTECT, related_name="segments"
    )
    position = models.PositiveIntegerField()
    text = models.TextField()
    speaker = models.CharField(max_length=100, blank=True)
    start_ms = models.PositiveIntegerField()
    end_ms = models.PositiveIntegerField()

    class Meta:
        ordering = ["position"]
        constraints = [
            models.UniqueConstraint(
                fields=["version", "position"], name="unique_version_position"
            ),
            models.CheckConstraint(
                condition=Q(end_ms__gt=models.F("start_ms")),
                name="positive_segment_duration",
            ),
        ]


class PracticeSession(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    material = models.ForeignKey(Material, on_delete=models.PROTECT)
    version = models.ForeignKey(TranscriptVersion, on_delete=models.PROTECT)
    difficulty = models.CharField(
        max_length=8, choices=[(x, x) for x in ["easy", "medium", "hard", "full"]]
    )
    position = models.PositiveIntegerField(default=0)
    drafts = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "material", "version", "difficulty"],
                name="unique_practice_session",
            )
        ]


class StudentResponse(models.Model):
    session = models.ForeignKey(
        PracticeSession, on_delete=models.CASCADE, related_name="responses"
    )
    position = models.PositiveIntegerField()
    original_answer = models.TextField()
    result = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class AuditLog(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    action = models.CharField(max_length=80)
    material = models.ForeignKey(Material, null=True, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
