from django.conf import settings
from django.db import models


class ProcessingJob(models.Model):
    class State(models.TextChoices):
        QUEUED = "queued", "Queued"
        RUNNING = "running", "Running"
        SUCCEEDED = "succeeded", "Ready for review"
        FAILED = "failed", "Failed"

    material = models.ForeignKey(
        "learning.Material", on_delete=models.PROTECT, related_name="processing_jobs"
    )
    audio = models.ForeignKey("learning.AudioAsset", on_delete=models.PROTECT)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    input_digest = models.CharField(max_length=64, unique=True)
    reference_text = models.TextField(blank=True)
    state = models.CharField(max_length=12, choices=State.choices, default=State.QUEUED)
    stage = models.CharField(max_length=80, default="queued")
    attempts = models.PositiveIntegerField(default=0)
    error_code = models.CharField(max_length=60, blank=True)
    error_message = models.CharField(max_length=500, blank=True)
    warnings = models.JSONField(default=list)
    result_version = models.ForeignKey(
        "learning.TranscriptVersion", null=True, blank=True, on_delete=models.PROTECT
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-id"]
        indexes = [models.Index(fields=["state", "created_at"])]
