"""Assemble immutable Full versions from four reviewed Part publications."""

import copy
import io
import logging
import shutil
import subprocess
import tempfile
import wave
from pathlib import Path

from django.core.files import File
from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone
from pypdf import PdfReader, PdfWriter
from rest_framework.exceptions import ValidationError

from exams.html_paper import MARKER
from exams.models import (
    AnswerKey,
    Question,
    QuestionDocument,
    QuestionOption,
    QuestionSet,
)

from .models import (
    AudioAsset,
    AuditLog,
    ListeningTest,
    Material,
    Segment,
    TranscriptVersion,
)

logger = logging.getLogger(__name__)


def snapshot(test):
    return [
        [p.number, p.material.published_version_id, p.material.published_questions_id]
        for p in test.parts.select_related("material").order_by("number")
    ]


def queue_assembly(test_id, retry=False):
    with transaction.atomic():
        test = ListeningTest.objects.select_for_update().get(pk=test_id)
        signature = snapshot(test)
        if test.full_material_id and not test.assembly_signature and not retry:
            return
        if len(signature) != 4 or any(not row[1] for row in signature):
            return
        if (
            test.assembly_state == "running"
            or (test.assembly_state == "queued" and not retry)
            or (test.assembly_state == "ready" and signature == test.assembly_signature)
        ):
            return
        test.assembly_state = "queued"
        test.assembly_error = ""
        test.save(update_fields=["assembly_state", "assembly_error", "updated_at"])
    from .tasks import assemble_listening_test

    try:
        assemble_listening_test.delay(test_id)
    except Exception:
        logger.exception("Could not queue Full test %s", test_id)
        ListeningTest.objects.filter(pk=test_id).update(
            assembly_state="failed",
            assembly_error="The background worker could not be reached. Start Redis/Celery, then retry Full test assembly.",
        )


def merge_questions(test, parts, full, audio, files):
    sets = [p.material.published_questions for p in parts]
    if not all(sets):
        return None  # Full dictation is still useful before every part has questions.
    presentations = {q.presentation for q in sets}
    if len(presentations) != 1 or "legacy_pdf" in presentations:
        raise ValidationError(
            "Use the same question presentation in all four Parts (text, native HTML or original PDF), then rebuild Full test."
        )
    presentation = sets[0].presentation
    document = None
    page_maps = []
    if presentation == "pdf":
        writer = PdfWriter()
        for qs in sets:
            mapping = {}
            with qs.document.file.open("rb") as source:
                reader = PdfReader(io.BytesIO(source.read()))
            for old in qs.document_pages:
                # Copy only explicitly approved pages; private keys/actions never follow.
                writer.add_page(
                    reader.pages[old - 1],
                    excluded_keys=[
                        "/Annots",
                        "/AA",
                        "/Metadata",
                        "/PieceInfo",
                        "/Thumb",
                        "/AF",
                    ],
                )
                mapping[old] = len(writer.pages)
            page_maps.append(mapping)
        output = io.BytesIO()
        writer.write(output)
        document = QuestionDocument(
            material=full, page_count=len(writer.pages), extraction_state="assembled"
        )
        document.file.save(
            "full-questions.pdf", ContentFile(output.getvalue()), save=False
        )
        files.append(document.file)
        document.save()
    qs = QuestionSet.objects.create(
        material=full,
        audio=audio,
        document=document,
        document_pages=list(range(1, document.page_count + 1)) if document else [],
        presentation=presentation,
        duration_seconds=sum(q.duration_seconds for q in sets),
    )
    sections, number = [], 0
    for i, (part, source) in enumerate(zip(parts, sets)):
        source_questions = list(
            source.questions.select_related("answer_key").prefetch_related("options")
        )
        numbers = {
            q.number: number + offset for offset, q in enumerate(source_questions, 1)
        }
        for q in source_questions:
            number += 1
            context = copy.deepcopy(q.context)
            if "answer_group" in context:
                context["answer_group"]["numbers"] = [
                    numbers[n] for n in context["answer_group"]["numbers"]
                ]
            if presentation == "pdf":
                context["pdf_field"]["page"] = page_maps[i][
                    context["pdf_field"]["page"]
                ]
            target = Question.objects.create(
                question_set=qs,
                number=number,
                part=part.number,
                type=q.type,
                prompt=q.prompt,
                instructions=q.instructions,
                max_words=q.max_words,
                context=context,
            )
            QuestionOption.objects.bulk_create(
                [
                    QuestionOption(question=target, key=o.key, text=o.text)
                    for o in q.options.all()
                ]
            )
            AnswerKey.objects.create(
                question=target, accepted_answers=q.answer_key.accepted_answers
            )
        for section in source.sections:
            html = MARKER.sub(
                lambda m: (
                    "{{" + str(numbers[int(m[1])]) + (":" + m[2] if m[2] else "") + "}}"
                ),
                section["html"],
            )
            sections.append({"part": part.number, "html": html})
    qs.sections = sections
    qs.published_at = timezone.now()
    qs.save(update_fields=["sections", "published_at"])
    return qs


def build_full_test(test_id):
    files = []
    try:
        # Serialize duplicate jobs and publication snapshots; historical versions stay intact.
        with transaction.atomic():
            test = ListeningTest.objects.select_for_update().get(pk=test_id)
            if (
                test.full_material_id
                and not test.assembly_signature
                and test.assembly_state not in ("queued", "running")
            ):
                return
            list(
                Material.objects.select_for_update()
                .filter(test_part__test=test)
                .order_by("pk")
            )
            signature = snapshot(test)
            if len(signature) != 4 or any(not row[1] for row in signature):
                raise ValidationError(
                    "Publish all four Part transcripts before assembling Full test."
                )
            if (
                test.assembly_signature == signature
                and test.full_material_id
                and test.assembly_state == "ready"
            ):
                return
            test.assembly_state = "running"
            test.save(update_fields=["assembly_state", "updated_at"])
            parts = list(
                test.parts.select_related(
                    "material__published_version__audio",
                    "material__published_questions",
                ).order_by("number")
            )
            full = test.full_material or Material.objects.create(
                title=test.title + " · Full test",
                category=test.category,
                owner=test.owner,
            )
            full.source = f"Reviewed Parts 1–4 · {test.category.name} · {test.title}"[
                :300
            ]
            full.license = "Permissions recorded on each component Part"
            full.rights_confirmed = all(p.material.rights_confirmed for p in parts)
            if not full.rights_confirmed:
                raise ValidationError(
                    "Confirm permission for every Part before publication."
                )
            offsets, lengths = [], []
            with tempfile.TemporaryDirectory(prefix="practiceielts-full-") as directory:
                output = Path(directory) / "full.wav"
                with wave.open(str(output), "wb") as combined:
                    combined.setparams((1, 2, 16000, 0, "NONE", "not compressed"))
                    frames = 0
                    for part in parts:
                        asset = part.material.published_version.audio
                        source = (
                            Path(directory)
                            / f"part-{part.number}{Path(asset.file.name).suffix}"
                        )
                        with asset.file.open("rb") as src, source.open("wb") as dst:
                            shutil.copyfileobj(src, dst)
                        decoded = Path(directory) / f"decoded-{part.number}.wav"
                        subprocess.run(
                            [
                                "ffmpeg",
                                "-v",
                                "error",
                                "-nostdin",
                                "-y",
                                "-i",
                                str(source),
                                "-vn",
                                "-ac",
                                "1",
                                "-ar",
                                "16000",
                                "-c:a",
                                "pcm_s16le",
                                str(decoded),
                            ],
                            check=True,
                            capture_output=True,
                            timeout=1800,
                        )
                        with wave.open(str(decoded), "rb") as clip:
                            offsets.append(round(frames * 1000 / 16000))
                            lengths.append(round(clip.getnframes() * 1000 / 16000))
                            frames += clip.getnframes()
                            while data := clip.readframes(65536):
                                combined.writeframesraw(data)
                audio = AudioAsset(
                    material=full,
                    duration_ms=round(frames * 1000 / 16000),
                    mime_type="audio/wav",
                    size=output.stat().st_size,
                )
                with output.open("rb") as f:
                    audio.file.save("full.wav", File(f), save=False)
                files.append(audio.file)
                audio.save()
            version = TranscriptVersion.objects.create(
                material=full,
                audio=audio,
                origin="assembled",
                provider="reviewed-part-publications",
                published_at=timezone.now(),
            )
            position = 0
            for part, offset, length in zip(parts, offsets, lengths):
                for s in part.material.published_version.segments.all():
                    word_times = copy.deepcopy(s.words)
                    for word in word_times:
                        for key in ("start_ms", "end_ms"):
                            if key in word:
                                word[key] += offset
                    end = min(s.end_ms, length)
                    if s.start_ms >= end:
                        raise ValidationError(
                            "A reviewed Part timestamp exceeds its decoded recording; correct it before assembly."
                        )
                    Segment.objects.create(
                        version=version,
                        position=position,
                        text=s.text,
                        speaker=s.speaker,
                        start_ms=s.start_ms + offset,
                        end_ms=end + offset,
                        words=word_times,
                        confidence=s.confidence,
                        needs_review=False,
                    )
                    position += 1
            full.published_questions = merge_questions(test, parts, full, audio, files)
            full.published_version = version
            full.save()
            test.full_material = full
            test.assembly_signature = signature
            test.assembly_state = "ready"
            test.assembly_error = ""
            test.save()
            AuditLog.objects.create(
                actor=test.owner, material=full, action="test.assemble_published_parts"
            )
    except Exception as exc:
        for file in files:
            file.delete(save=False)
        logger.exception("Full test assembly failed for %s", test_id)
        message = (
            " ".join(
                str(item)
                for item in (
                    exc.detail if isinstance(exc.detail, list) else [exc.detail]
                )
            )
            if isinstance(exc, ValidationError)
            else "Full test could not be assembled. Check the Part recordings and retry."
        )
        ListeningTest.objects.filter(pk=test_id).update(
            assembly_state="failed", assembly_error=message, updated_at=timezone.now()
        )
