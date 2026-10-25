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
    published_questions = models.ForeignKey(
        "exams.QuestionSet",
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


class ListeningTest(models.Model):
    title = models.CharField(max_length=200)
    category = models.ForeignKey(
        Category, on_delete=models.PROTECT, related_name="listening_tests"
    )
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    full_material = models.OneToOneField(
        Material,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="full_test",
    )
    assembly_state = models.CharField(
        max_length=12,
        default="waiting",
        choices=[(v, v) for v in ["waiting", "queued", "running", "ready", "failed"]],
    )
    assembly_error = models.TextField(blank=True)
    assembly_signature = models.JSONField(default=list)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["title", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["category", "title"], name="unique_book_test_title"
            )
        ]


class TestPart(models.Model):
    test = models.ForeignKey(
        ListeningTest, on_delete=models.PROTECT, related_name="parts"
    )
    number = models.PositiveSmallIntegerField()
    material = models.OneToOneField(
        Material, on_delete=models.PROTECT, related_name="test_part"
    )

    class Meta:
        ordering = ["number"]
        constraints = [
            models.UniqueConstraint(fields=["test", "number"], name="unique_test_part"),
            models.CheckConstraint(
                condition=Q(number__gte=1, number__lte=4), name="test_part_range"
            ),
        ]


class TranscriptVersion(models.Model):
    material = models.ForeignKey(
        Material, on_delete=models.PROTECT, related_name="versions"
    )
    audio = models.ForeignKey(AudioAsset, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    published_at = models.DateTimeField(null=True, blank=True)
    origin = models.CharField(max_length=16, default="manual")
    reference_text = models.TextField(blank=True)
    provider = models.CharField(max_length=150, blank=True)
    warnings = models.JSONField(default=list)

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
    words = models.JSONField(default=list)
    confidence = models.FloatField(null=True, blank=True)
    needs_review = models.BooleanField(default=False)

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


class PracticeTimingRevision(models.Model):
    """Append-only Easy playback corrections, separate from transcript content."""

    version = models.ForeignKey(
        TranscriptVersion, on_delete=models.PROTECT, related_name="timing_revisions"
    )
    grouping_version = models.PositiveSmallIntegerField(default=1)
    overrides = models.JSONField(default=dict)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-id"]


class PracticeSession(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    material = models.ForeignKey(Material, on_delete=models.PROTECT)
    version = models.ForeignKey(TranscriptVersion, on_delete=models.PROTECT)
    difficulty = models.CharField(
        max_length=8, choices=[(x, x) for x in ["easy", "medium", "hard", "full"]]
    )
    position = models.PositiveIntegerField(default=0)
    grouping_version = models.PositiveSmallIntegerField(default=1)
    timing_revision = models.ForeignKey(
        PracticeTimingRevision,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="sessions",
    )
    drafts = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "user",
                    "material",
                    "version",
                    "difficulty",
                    "grouping_version",
                ],
                condition=Q(timing_revision__isnull=True),
                name="unique_base_practice_session",
            ),
            models.UniqueConstraint(
                fields=[
                    "user",
                    "material",
                    "version",
                    "difficulty",
                    "grouping_version",
                    "timing_revision",
                ],
                condition=Q(timing_revision__isnull=False),
                name="unique_corrected_practice_session",
            ),
            models.CheckConstraint(
                condition=Q(timing_revision__isnull=True) | Q(difficulty="easy"),
                name="timing_revision_easy_only",
            ),
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
