import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q


def source_path(instance, filename):
    return f"reading-sources/{uuid.uuid4().hex}.pdf"


class SharedReadingResult(models.Model):
    attempt = models.OneToOneField(
        "ReadingAttempt", null=True, blank=True, on_delete=models.CASCADE,
        related_name="shared_result",
    )
    full_attempt = models.OneToOneField(
        "ReadingFullAttempt", null=True, blank=True, on_delete=models.CASCADE,
        related_name="shared_result",
    )
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    snapshot = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.CheckConstraint(
            condition=(Q(attempt__isnull=False, full_attempt__isnull=True)
                       | Q(attempt__isnull=True, full_attempt__isnull=False)),
            name="shared_reading_exactly_one_attempt",
        )]


class ReadingPaper(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    book = models.CharField(max_length=150)
    test = models.PositiveSmallIntegerField()
    passage = models.PositiveSmallIntegerField()
    published_version = models.ForeignKey(
        "ReadingVersion",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["book", "test", "passage", "id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(test__gte=1, passage__gte=1, passage__lte=3),
                name="reading_test_passage_range",
            ),
            models.UniqueConstraint(
                fields=["owner", "book", "test", "passage"],
                name="reading_paper_identity",
            ),
        ]


class ReadingVersion(models.Model):
    paper = models.ForeignKey(
        ReadingPaper, on_delete=models.PROTECT, related_name="versions"
    )
    content = models.JSONField()
    keys = models.JSONField()
    source = models.FileField(upload_to=source_path)
    source_name = models.CharField(max_length=250)
    license = models.CharField(max_length=500)
    rights_confirmed = models.BooleanField(default=False)
    source_pages = models.JSONField(default=list)
    key_pages = models.JSONField(default=list)
    review_notes = models.TextField(blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-id"]


class ReadingAttempt(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    paper = models.ForeignKey(ReadingPaper, on_delete=models.PROTECT)
    version = models.ForeignKey(ReadingVersion, on_delete=models.PROTECT)
    answers = models.JSONField(default=dict)
    results = models.JSONField(default=list)
    score = models.PositiveSmallIntegerField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "paper"],
                condition=Q(submitted_at__isnull=True),
                name="one_active_reading_per_paper",
            )
        ]


class ReadingImportJob(models.Model):
    class State(models.TextChoices):
        QUEUED = "queued", "Queued"
        RUNNING = "running", "Running"
        NEEDS_REVIEW = "needs_review", "Needs administrator review"
        BLOCKED = "blocked", "Connection required"
        FAILED = "failed", "Failed"
        COMPLETED = "completed", "Published"

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    source = models.FileField(upload_to=source_path)
    source_name = models.CharField(max_length=250)
    source_digest = models.CharField(max_length=64)
    source_page_count = models.PositiveSmallIntegerField()
    book = models.CharField(max_length=150, blank=True)
    license = models.CharField(max_length=500)
    rights_confirmed = models.BooleanField(default=False)
    state = models.CharField(max_length=20, choices=State.choices, default=State.QUEUED)
    stage = models.CharField(max_length=80, default="queued")
    attempts = models.PositiveSmallIntegerField(default=0)
    progress = models.JSONField(default=dict)
    extracted_pages = models.JSONField(default=list)
    candidates = models.JSONField(default=list)
    findings = models.JSONField(default=list)
    metrics = models.JSONField(default=dict)
    published_papers = models.JSONField(default=list)
    error_code = models.CharField(max_length=80, blank=True)
    error_message = models.CharField(max_length=500, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-id"]
        indexes = [models.Index(fields=["owner", "state", "created_at"])]
        constraints = [
            models.CheckConstraint(
                condition=Q(source_page_count__gte=1, source_page_count__lte=200),
                name="reading_import_page_limit",
            )
        ]


class ReadingFullAttempt(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="reading_full_papers",
    )
    book = models.CharField(max_length=150)
    test = models.PositiveSmallIntegerField()
    version_one = models.ForeignKey(
        ReadingVersion, on_delete=models.PROTECT, related_name="full_first_attempts"
    )
    version_two = models.ForeignKey(
        ReadingVersion, on_delete=models.PROTECT, related_name="full_second_attempts"
    )
    version_three = models.ForeignKey(
        ReadingVersion, on_delete=models.PROTECT, related_name="full_third_attempts"
    )
    timed = models.BooleanField(default=True)
    deadline = models.DateTimeField(null=True, blank=True)
    answers = models.JSONField(default=dict)
    results = models.JSONField(default=list)
    score = models.PositiveSmallIntegerField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "owner", "book", "test", "timed"],
                condition=Q(submitted_at__isnull=True),
                name="one_active_full_reading",
            ),
            models.CheckConstraint(
                condition=Q(timed=True, deadline__isnull=False)
                | Q(timed=False, deadline__isnull=True),
                name="full_reading_deadline_mode",
            ),
        ]
