import hashlib
import hmac
import re
import secrets
import tempfile
from datetime import timedelta
from pathlib import Path

from django.db import transaction
from django.http import HttpResponse, StreamingHttpResponse
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from learning.models import AuditLog
from learning.services.comparison import words

from .answer_groups import answer_groups
from .models import AnswerKey, MockAttempt, Question, QuestionOption, QuestionSet


def normalize(answer):
    if isinstance(answer, list):
        return sorted(str(a).strip().casefold() for a in answer)
    return " ".join(words(str(answer)))


def publish_question_set(material, user, confirmed):
    """Publish reviewed questions independently of recordings or transcripts."""
    if not user.can_edit or not (user.is_staff or user.role == "admin" or material.owner_id == user.pk):
        raise PermissionDenied("Only authorized editors can publish questions.")
    if not confirmed:
        raise ValidationError({"detail": "Review the question paper and answer keys and explicitly confirm publication."})
    if not material.rights_confirmed or not material.source or not material.license:
        raise ValidationError({"detail": "Confirm permission and provide source and license before publishing."})
    with transaction.atomic():
        locked = type(material).objects.select_for_update().get(pk=material.pk)
        qs = locked.question_sets.first()
        if not qs:
            raise ValidationError({"detail": "Save reviewed questions before publishing."})
        from .serializers import QuestionSetInput

        payload = question_set_data(qs)
        from learning.models import TestPart

        assigned = TestPart.objects.filter(material=locked).values_list("number", flat=True).first()
        validator = QuestionSetInput(data=payload, context={"assigned_part": assigned})
        validator.is_valid(raise_exception=True)
        if locked.published_questions_id == qs.pk and qs.published_at:
            material.published_questions = qs
            return qs
        if not qs.published_at:
            qs.published_at = timezone.now()
            qs.save(update_fields=["published_at"])
        locked.published_questions = qs
        locked.save(update_fields=["published_questions", "updated_at"])
        AuditLog.objects.create(actor=user, material=locked, action="questions.publish")
    material.published_questions = qs
    return qs


def public_question(q, reveal=False):
    key = q.answer_key.accepted_answers
    selections = len(key[0]) if key and isinstance(key[0], list) else 1
    data = {
        "number": q.number,
        "part": q.part,
        "type": q.type,
        "prompt": q.prompt,
        "instructions": q.instructions,
        "options": [{"key": o.key, "text": o.text} for o in q.options.all()],
        "max_words": q.max_words,
        "context": q.context,
        "selections": selections,
    }
    if reveal:
        data["answers"] = key
    return data


def question_set_data(qs, reveal=True):
    if not qs:
        return None
    return {
        "id": qs.pk,
        "audio": qs.audio_id,
        "document": qs.document_id,
        "document_pages": qs.document_pages,
        "presentation": qs.presentation,
        "sections": qs.sections,
        "duration_seconds": qs.duration_seconds,
        "published_at": qs.published_at,
        "questions": [
            public_question(q, reveal)
            for q in qs.questions.select_related("answer_key").prefetch_related(
                "options"
            )
        ],
    }


def require_text_content(qs):
    """Do not start new image-free exams with unusable legacy PDF placeholders."""
    if qs.presentation in ("pdf", "html"):
        return
    missing = []
    for q in qs.questions.all():
        context = q.context if isinstance(q.context, dict) else {}
        if (
            "answer using the question paper" in q.prompt.lower()
            or (q.type in ("map_label", "diagram_label") and not context.get("body"))
            or (q.type == "table_completion" and not context.get("table"))
        ):
            missing.append(str(q.number))
    if missing:
        raise ValidationError(
            {
                "detail": "This mock needs updated text questions before a new attempt can start. Ask the teacher to add complete prompts, tables or descriptions for questions "
                + ", ".join(missing)
                + "."
            }
        )


def save_question_set(material, validated, user):
    audio = material.audio_assets.order_by("-id").first()
    previous = material.question_sets.filter(audio=audio).first()
    if not user.is_superuser and previous and len(validated["questions"]) < previous.questions.count():
        raise PermissionDenied("Only the super administrator can remove saved questions.")
    document_id = validated.get("document")
    document = None
    if document_id:
        document = material.question_documents.filter(pk=document_id).first()
        if not document:
            raise ValidationError(
                {"document": "Choose a document belonging to this material."}
            )
    pages = sorted(set(validated.get("document_pages", [])))
    if pages and not document:
        raise ValidationError(
            {"document_pages": "Select a PDF before choosing its pages."}
        )
    if document and (
        (not pages and validated["presentation"] == "legacy_pdf")
        or (pages and max(pages) > document.page_count)
    ):
        raise ValidationError(
            {
                "document_pages": "Select the question pages students may view; omit answer-key pages."
            }
        )
    from learning.models import TestPart

    assigned = TestPart.objects.filter(material=material).first()
    if assigned:
        validated = __import__("copy").deepcopy(validated)
        for question in validated["questions"]:
            question["part"] = assigned.number
        for section in validated["sections"]:
            section["part"] = assigned.number
    with transaction.atomic():
        qs = QuestionSet.objects.create(
            material=material,
            audio=audio,
            document=document,
            document_pages=pages,
            presentation=validated["presentation"],
            sections=validated["sections"],
            duration_seconds=validated["duration_seconds"],
        )
        for data in validated["questions"]:
            data = dict(data)
            options = data.pop("options")
            answers = data.pop("answers")
            q = Question.objects.create(question_set=qs, **data)
            QuestionOption.objects.bulk_create(
                [QuestionOption(question=q, **option) for option in options]
            )
            AnswerKey.objects.create(question=q, accepted_answers=answers)
        AuditLog.objects.create(
            actor=user, material=material, action="questions.version"
        )
    return qs


def score_question(question, answer):
    if not isinstance(answer, (str, list)) or (
        isinstance(answer, list) and any(not isinstance(x, str) for x in answer)
    ):
        return False
    if isinstance(answer, list) and len(set(map(str.casefold, answer))) != len(answer):
        return False
    if (
        question.type not in ("multiple_choice", "matching")
        and len(str(answer).strip().split()) > question.max_words
    ):
        return False
    return any(
        normalize(answer) == normalize(expected)
        for expected in question.answer_key.accepted_answers
    )


def score_questions(questions, answers):
    """Credit a valid letter once per group, assigning ties to the lower slot."""
    results = {
        q.number: score_question(q, answers.get(str(q.number), "")) for q in questions
    }
    groups = answer_groups(
        [
            {
                "number": q.number,
                "part": q.part,
                "context": q.context,
                "answers": q.answer_key.accepted_answers,
            }
            for q in questions
        ]
    )
    for numbers in groups:
        credited = set()
        for number in numbers:
            if results[number]:
                letter = normalize(answers[str(number)])
                results[number] = letter not in credited
                credited.add(letter)
    return results


def finalize_attempt(attempt_id, user=None):
    with transaction.atomic():
        attempt = (
            MockAttempt.objects.select_for_update()
            .select_related("question_set")
            .get(pk=attempt_id)
        )
        if user and attempt.user_id != user.pk:
            raise PermissionDenied()
        if attempt.submitted_at:
            return attempt
        questions = list(attempt.question_set.questions.select_related("answer_key"))
        attempt.total = len(questions)
        attempt.score = sum(score_questions(questions, attempt.answers).values())
        attempt.scoring_version = 2
        attempt.submitted_at = timezone.now()
        attempt.save()
        return attempt


def expire_if_needed(attempt):
    if (
        not attempt.submitted_at
        and attempt.deadline
        and timezone.now() >= attempt.deadline
    ):
        return finalize_attempt(attempt.pk)
    return attempt


def active_material_ids(user):
    # Finalize expired timed attempts before applying study restrictions.
    expired = MockAttempt.objects.filter(
        user=user, submitted_at__isnull=True, deadline__lte=timezone.now()
    )
    for pk in expired.values_list("pk", flat=True):
        finalize_attempt(pk)
    from django.db.models import Q

    from learning.models import ListeningTest, TestPart

    active = set(
        MockAttempt.objects.filter(
            user=user, submitted_at__isnull=True, timing="timed"
        ).values_list("material_id", flat=True)
    )
    tests = ListeningTest.objects.filter(
        Q(full_material_id__in=active) | Q(parts__material_id__in=active)
    )
    ids = list(tests.values_list("pk", flat=True))
    active.update(
        tests.exclude(full_material=None).values_list("full_material_id", flat=True)
    )
    active.update(
        TestPart.objects.filter(test_id__in=ids).values_list("material_id", flat=True)
    )
    return active


def guard_study(user, material_id):
    if (
        user.is_authenticated
        and not user.can_edit
        and material_id in active_material_ids(user)
    ):
        raise PermissionDenied(
            "Submit your active mock before opening this material in Practice or Transcript Study."
        )


def attempt_data(attempt):
    attempt = expire_if_needed(attempt)
    qs = attempt.question_set
    questions = list(
        qs.questions.select_related("answer_key").prefetch_related("options")
    )
    from learning.models import TestPart

    assigned = (
        TestPart.objects.filter(material_id=attempt.material_id)
        .values_list("number", flat=True)
        .first()
    )
    submitted = bool(attempt.submitted_at)
    data = {
        "id": attempt.pk,
        "material": attempt.material_id,
        "title": attempt.material.title,
        "timing": attempt.timing,
        "started_at": attempt.started_at,
        "deadline": attempt.deadline,
        "server_now": timezone.now(),
        "submitted_at": attempt.submitted_at,
        "answers": attempt.answers,
        "audio_started": bool(attempt.audio_started_at),
        "audio_available": bool(qs.audio_id),
        "review_audio_url": f"/api/v1/audio/{qs.audio_id}/stream/" if submitted and qs.audio_id else None,
        "questions": [
            {
                **public_question(q, submitted),
                **({"part": assigned} if assigned else {}),
            }
            for q in questions
        ],
        "document_pages": qs.document_pages
        if qs.document_id and qs.presentation in ("pdf", "legacy_pdf")
        else [],
        "presentation": qs.presentation,
        "score": attempt.score,
        "sections": [{**s, "part": assigned} for s in qs.sections]
        if assigned
        else qs.sections,
        "total": len(questions),
    }
    if submitted:
        correctness = (
            score_questions(questions, attempt.answers)
            if attempt.scoring_version >= 2
            else {
                q.number: score_question(q, attempt.answers.get(str(q.number), ""))
                for q in questions
            }
        )
        data["results"] = [
            {
                "number": q.number,
                "correct": correctness[q.number],
                "answer": attempt.answers.get(str(q.number), ""),
                "accepted_answers": q.answer_key.accepted_answers,
            }
            for q in questions
        ]
    return data


def issue_audio_ticket(attempt):
    with transaction.atomic():
        attempt = MockAttempt.objects.select_for_update().get(pk=attempt.pk)
        if not attempt.question_set.audio_id:
            raise ValidationError({"detail": "Audio is not available for this question-only Mock."})
        if attempt.submitted_at or (
            attempt.deadline and attempt.deadline <= timezone.now()
        ):
            raise PermissionDenied("This attempt has ended.")
        if attempt.timing == "timed" and attempt.audio_started_at:
            raise PermissionDenied("Exam audio can be started once for this attempt.")
        token = secrets.token_urlsafe(32)
        attempt.audio_ticket_hash = hashlib.sha256(token.encode()).hexdigest()
        attempt.audio_ticket_expires = timezone.now() + (timedelta(hours=24) if attempt.timing == "untimed" else timedelta(minutes=2))
        attempt.audio_started_at = timezone.now()
        attempt.save()
        return token


def exam_audio_response(attempt, token, range_header=None):
    digest = hashlib.sha256(token.encode()).hexdigest()
    with transaction.atomic():
        attempt = (
            MockAttempt.objects.select_for_update()
            .select_related("version__audio")
            .get(pk=attempt.pk)
        )
        if not attempt.question_set.audio_id:
            raise PermissionDenied("Audio is not available for this question-only Mock.")
        if attempt.submitted_at or (
            attempt.deadline and attempt.deadline <= timezone.now()
        ):
            raise PermissionDenied("This attempt has ended.")
        if (
            not attempt.audio_ticket_hash
            or not hmac.compare_digest(digest, attempt.audio_ticket_hash)
            or not attempt.audio_ticket_expires
            or attempt.audio_ticket_expires < timezone.now()
        ):
            raise PermissionDenied("The exam audio ticket is invalid or expired.")
        if attempt.timing == "timed" and attempt.audio_consumed_at:
            raise PermissionDenied("The exam audio has already been delivered.")
        if not attempt.audio_consumed_at:
            attempt.audio_consumed_at = timezone.now()
            attempt.save(update_fields=["audio_consumed_at"])
        audio = attempt.question_set.audio

    start, end, status = 0, audio.size - 1, 200
    if attempt.timing == "untimed" and range_header:
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header)
        if not match or not any(match.groups()):
            return HttpResponse(status=416, headers={"Content-Range": f"bytes */{audio.size}", "Cache-Control": "private, no-store"})
        left, right = match.groups()
        if not left:
            start = max(0, audio.size - int(right))
        else:
            start = int(left)
            end = min(end, int(right)) if right else end
        if start > end or start >= audio.size:
            return HttpResponse(status=416, headers={"Content-Range": f"bytes */{audio.size}", "Cache-Control": "private, no-store"})
        status = 206

    def stream():
        with audio.file.open("rb") as file:
            file.seek(start)
            remaining = end - start + 1
            while remaining:
                chunk = file.read(min(65536, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk

    response = StreamingHttpResponse(stream(), status=status, content_type=audio.mime_type)
    response["Content-Length"] = str(end - start + 1)
    response["Cache-Control"] = "private, no-store"
    response["Accept-Ranges"] = "bytes" if attempt.timing == "untimed" else "none"
    response["X-Content-Type-Options"] = "nosniff"
    response["X-Accel-Buffering"] = "no"
    if status == 206:
        response["Content-Range"] = f"bytes {start}-{end}/{audio.size}"

    return response


def render_document_page(document, page_number):
    if not 1 <= page_number <= document.page_count:
        raise ValidationError({"page": "Page does not exist."})
    import pypdfium2 as pdfium

    try:
        with tempfile.TemporaryDirectory(prefix="practiceielts-pdf-") as directory:
            path = Path(directory) / "questions.pdf"
            with document.file.open("rb") as source, path.open("wb") as target:
                while chunk := source.read(65536):
                    target.write(chunk)
            with pdfium.PdfDocument(str(path)) as pdf:
                page = pdf[page_number - 1]
                width, height = page.get_size()
                if width <= 0 or height <= 0 or width * height > 12_000_000:
                    raise ValueError("page dimensions")
                scale = min(1.5, 1800 / max(width, height))
                bitmap = page.render(scale=scale)
                import io

                buffer = io.BytesIO()
                bitmap.to_pil().save(buffer, format="PNG")
                bitmap.close()
                page.close()
    except Exception as exc:
        raise ValidationError(
            {"document": "This PDF page could not be displayed."}
        ) from exc
    response = HttpResponse(buffer.getvalue(), content_type="image/png")
    response["Cache-Control"] = "private, no-store"
    return response
