import hashlib
import logging
import uuid

from django.conf import settings
from django.db import transaction

from .models import ProcessingJob

logger = logging.getLogger(__name__)


def job_data(job):
    if not job:
        return None
    return {
        "id": job.pk,
        "audio": job.audio_id,
        "state": job.state,
        "stage": job.stage,
        "attempts": job.attempts,
        "error_code": job.error_code,
        "error_message": job.error_message,
        "warnings": job.warnings,
        "result_version": job.result_version_id,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
    }


def queue_job(audio, user, reference_text="", force=False):
    fingerprint = f"{audio.pk}\0{settings.WHISPER_MODEL}\0{reference_text}"
    if force:
        fingerprint += "\0" + uuid.uuid4().hex
    digest = hashlib.sha256(fingerprint.encode()).hexdigest()
    with transaction.atomic():
        job, created = ProcessingJob.objects.get_or_create(
            input_digest=digest,
            defaults={
                "material": audio.material,
                "audio": audio,
                "requested_by": user,
                "reference_text": reference_text,
            },
        )
        if not created and job.state in (
            ProcessingJob.State.QUEUED,
            ProcessingJob.State.RUNNING,
            ProcessingJob.State.SUCCEEDED,
        ):
            return job
        if not created:
            job.state = ProcessingJob.State.QUEUED
            job.stage = "queued"
            job.error_code = ""
            job.error_message = ""
            job.finished_at = None
            job.save()

        def enqueue():
            from .tasks import process_audio

            try:
                process_audio.apply_async(
                    args=[job.pk], task_id="audio-job-" + str(job.pk)
                )
            except Exception:
                logger.exception("Unable to queue audio job %s", job.pk)
                ProcessingJob.objects.filter(pk=job.pk, state="queued").update(
                    state="failed",
                    stage="failed",
                    error_code="queue_unavailable",
                    error_message="The audio queue is unavailable. Your upload is saved. Please retry later.",
                )

        transaction.on_commit(enqueue)
    job.refresh_from_db()
    return job
