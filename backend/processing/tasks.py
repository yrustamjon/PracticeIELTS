import logging
import shutil
import tempfile
from pathlib import Path

from celery import shared_task
from django.db import transaction
from django.utils import timezone

from learning.models import AuditLog, Segment, TranscriptVersion

from .alignment import WordAnchorAlignmentService
from .models import ProcessingJob
from .segmentation import clean_words, segment_recognition
from .transcription import FasterWhisperService, SpeechError

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=2,
    soft_time_limit=3600,
    time_limit=3660,
    acks_late=True,
    reject_on_worker_lost=True,
)
def process_audio(self, job_id):
    with transaction.atomic():
        job = (
            ProcessingJob.objects.select_for_update()
            .select_related("audio", "material")
            .get(pk=job_id)
        )
        redelivered = bool((self.request.delivery_info or {}).get("redelivered"))
        if job.state != ProcessingJob.State.QUEUED and not (
            job.state == ProcessingJob.State.RUNNING and redelivered
        ):
            return
        job.state = ProcessingJob.State.RUNNING
        job.stage = "preparing_audio"
        job.started_at = timezone.now()
        job.attempts += 1
        job.save()

    def stage(value):
        ProcessingJob.objects.filter(
            pk=job.pk, state="running", result_version__isnull=True
        ).update(stage=value, updated_at=timezone.now())

    try:
        with tempfile.TemporaryDirectory(prefix="practiceielts-") as directory:
            path = Path(directory) / ("recording" + Path(job.audio.file.name).suffix)
            with job.audio.file.open("rb") as source, path.open("wb") as target:
                shutil.copyfileobj(source, target)
            result = FasterWhisperService().transcribe(str(path), stage)
            stage("aligning_reference" if job.reference_text else "segmenting")
            words, warnings = clean_words(result.words, job.audio.duration_ms)
            segments = (
                WordAnchorAlignmentService().align(str(path), job.reference_text, words)
                if job.reference_text
                else segment_recognition(words)
            )
        if not segments:
            raise SpeechError()
        if any(s["needs_review"] for s in segments):
            warnings.append(
                "Some words or sentences have uncertain recognition/alignment. Listen and review before publishing."
            )
        stage("saving_version")
        with transaction.atomic():
            locked = ProcessingJob.objects.select_for_update().get(pk=job.pk)
            if locked.result_version_id:
                return
            if (
                job.material.audio_assets.order_by("-id").first().pk != job.audio_id
                or ProcessingJob.objects.filter(
                    material=job.material, id__gt=job.pk
                ).exists()
            ):
                locked.state = "failed"
                locked.stage = "superseded"
                locked.error_code = "superseded"
                locked.error_message = (
                    "A newer recording or processing request replaced this job."
                )
                locked.finished_at = timezone.now()
                locked.save()
                return
            version = TranscriptVersion.objects.create(
                material=job.material,
                audio=job.audio,
                origin="reference" if job.reference_text else "speech",
                reference_text=job.reference_text,
                provider=result.provider,
                warnings=warnings,
            )
            Segment.objects.bulk_create(
                [
                    Segment(version=version, position=i, **segment)
                    for i, segment in enumerate(segments)
                ]
            )
            locked.result_version = version
            locked.state = ProcessingJob.State.SUCCEEDED
            locked.stage = "ready_for_review"
            locked.warnings = warnings
            locked.finished_at = timezone.now()
            locked.error_code = ""
            locked.error_message = ""
            locked.save()
            AuditLog.objects.create(
                actor=job.requested_by,
                material=job.material,
                action="audio.auto_transcript",
            )
    except Exception as exc:
        code = exc.code if isinstance(exc, SpeechError) else "speech_processing_failed"
        message = (
            exc.public_message
            if isinstance(exc, SpeechError)
            else SpeechError.public_message
        )
        logger.exception("Audio processing failed for job %s (%s)", job_id, code)
        ProcessingJob.objects.filter(pk=job.pk, result_version__isnull=True).update(
            state="failed",
            stage="failed",
            error_code=code,
            error_message=message,
            finished_at=timezone.now(),
            updated_at=timezone.now(),
        )
        # Decode/reference/model access errors need changed input/configuration, not blind retries.
        if (
            isinstance(exc, (ConnectionError, TimeoutError))
            and self.request.retries < self.max_retries
        ):
            ProcessingJob.objects.filter(pk=job.pk).update(
                state="queued", stage="retry_wait"
            )
            raise self.retry(exc=exc, countdown=15 * (self.request.retries + 1))
