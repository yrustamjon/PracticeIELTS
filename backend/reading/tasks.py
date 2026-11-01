"""Durable Reading import worker; publication is an explicit separate API action."""

from celery import shared_task
from django.db import transaction
from django.utils import timezone

from .ml.pipeline import run_ocr_pipeline
from .ml.provider import ReadingMLError


@shared_task(
    bind=True,
    soft_time_limit=7200,
    time_limit=7260,
    acks_late=True,
    reject_on_worker_lost=True,
)
def process_reading_import(self, job_id):
    from .models import ReadingImportJob

    with transaction.atomic():
        job = ReadingImportJob.objects.select_for_update().get(pk=job_id)
        redelivered = bool((self.request.delivery_info or {}).get("redelivered"))
        if job.state != "queued" and not (job.state == "running" and redelivered):
            return
        if job.published_papers:
            return
        job.state = "running"
        job.stage = "preparing_source"
        job.attempts += 1
        job.started_at = timezone.now()
        job.finished_at = None
        job.error_code = ""
        job.error_message = ""
        job.save()

    def progress(stage, details):
        ReadingImportJob.objects.filter(pk=job_id, state="running").update(
            stage=stage, progress=details, updated_at=timezone.now()
        )

    try:
        result = run_ocr_pipeline(job, progress)
        with transaction.atomic():
            locked = ReadingImportJob.objects.select_for_update().get(pk=job_id)
            if locked.state != "running" or locked.published_papers:
                return
            locked.extracted_pages = result["extracted_pages"]
            locked.candidates = result["candidates"]
            locked.findings = result["findings"]
            locked.metrics = result["metrics"]
            locked.state = "needs_review"
            locked.stage = "ready_for_review"
            locked.progress = {
                "passages_done": len(locked.candidates),
                "passages_total": len(locked.candidates),
            }
            locked.finished_at = timezone.now()
            locked.save()
    except Exception as exc:
        error = (
            exc
            if isinstance(exc, ReadingMLError)
            else ReadingMLError(
                "reading_processing_failed",
                "Reading processing failed. The private source is retained; check the connection or source and retry.",
            )
        )
        ReadingImportJob.objects.filter(pk=job_id, state="running").update(
            state="blocked" if error.code == "provider_not_configured" else "failed",
            stage="blocked" if error.code == "provider_not_configured" else "failed",
            error_code=error.code,
            error_message=error.public_message,
            finished_at=timezone.now(),
            updated_at=timezone.now(),
        )
