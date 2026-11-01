import io
import json
import re

import pypdfium2 as pdfium
from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from exams.services import normalize

from .access import require_reading_study, timed_full_attempts
from .models import ReadingAttempt, ReadingPaper, ReadingVersion
from .serializers import (
    AnswersInput,
    FigureInput,
    PaperInput,
    PublishInput,
    StartInput,
    VersionInput,
)


def editable(user, paper):
    return user.can_edit and (
        user.is_superuser
        or user.is_staff
        or user.role == "admin"
        or paper.owner_id == user.pk
    )


def require_editor(user, paper=None):
    if not user.can_edit or (paper and not editable(user, paper)):
        raise PermissionDenied("Only authorized editors can manage this Reading paper.")


def figure_response(version, index):
    figures = version.content.get("figures", [])
    if not 0 <= int(index) < len(figures):
        from rest_framework.exceptions import NotFound

        raise NotFound("Figure not found.")
    validator = FigureInput(data=figures[int(index)])
    validator.is_valid(raise_exception=True)
    figure = validator.validated_data
    if (
        figure["page"] not in version.source_pages
        or figure["page"] in version.key_pages
    ):
        raise PermissionDenied("Figure is outside approved passage pages.")
    with version.source.open("rb") as stream:
        data = stream.read(50 * 1024 * 1024 + 1)
    with pdfium.PdfDocument(data) as pdf:
        pg = pdf[figure["page"] - 1]
        bitmap = pg.render(scale=min(2, 2000 / max(pg.get_size())))
        try:
            image = bitmap.to_pil()
            x, y, width, height = figure["crop"]
            left, top = round(x * image.width), round(y * image.height)
            right, bottom = (
                round((x + width) * image.width),
                round((y + height) * image.height),
            )
            if right <= left or bottom <= top:
                raise ValidationError("Figure crop is too small to render.")
            output = io.BytesIO()
            image.crop((left, top, right, bottom)).save(output, format="PNG")
        finally:
            bitmap.close()
            pg.close()
    response = HttpResponse(output.getvalue(), content_type="image/png")
    response["Cache-Control"] = "private, no-store"
    return response


def version_data(version, editor=False):
    data = {
        "id": version.pk,
        "content": version.content,
        "published_at": version.published_at,
    }
    if editor:
        data.update(
            keys=version.keys,
            source_name=version.source_name,
            license=version.license,
            rights_confirmed=version.rights_confirmed,
            source_pages=version.source_pages,
            key_pages=version.key_pages,
            review_notes=version.review_notes,
        )
    return data


def paper_data(paper, detail=False, user=None):
    editor = user is not None and editable(user, paper)
    version = paper.versions.first() if editor else paper.published_version
    data = {
        "id": paper.pk,
        "book": paper.book,
        "test": paper.test,
        "passage": paper.passage,
        "title": version.content["title"] if version else "",
        "published_version": paper.published_version_id,
        "question_count": sum(len(g["questions"]) for g in version.content["groups"])
        if version
        else 0,
        "can_edit": editor,
        "full_available": getattr(paper, "full_available", False),
    }
    if detail and version:
        data["version"] = version_data(version, editor)
    return data


def save_version(request, paper):
    raw = request.data.get("payload", request.data)
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except (TypeError, ValueError):
            raise ValidationError("Invalid JSON payload.")
    validator = VersionInput(data=raw)
    validator.is_valid(raise_exception=True)
    data = validator.validated_data
    source = request.FILES.get("source")
    previous = paper.versions.first()
    if source:
        if source.size > 50 * 1024 * 1024:
            raise ValidationError("Source PDF must be at most 50 MB.")
        blob = source.read()
        try:
            with pdfium.PdfDocument(blob) as pdf:
                pages = len(pdf)
        except Exception:
            raise ValidationError("Provide a readable source PDF.")
        source.seek(0)
    elif previous:
        source = previous.source.name
        with previous.source.open("rb") as stream:
            blob = stream.read(50 * 1024 * 1024 + 1)
        with pdfium.PdfDocument(blob) as pdf:
            pages = len(pdf)
    else:
        raise ValidationError("Upload the original source PDF.")
    if max(data["source_pages"] + data["key_pages"]) > pages:
        raise ValidationError("Source page is outside the PDF.")
    return ReadingVersion.objects.create(paper=paper, source=source, **data)


class ReadingPaperViewSet(viewsets.GenericViewSet):
    serializer_class = PaperInput

    def get_queryset(self):
        qs = ReadingPaper.objects.select_related("published_version")
        if self.request.query_params.get("owned") == "true":
            require_editor(self.request.user)
            return qs.filter(owner=self.request.user)
        user = self.request.user
        if user.can_edit:
            if user.is_superuser or user.is_staff or user.role == "admin":
                return qs
            return qs.filter(Q(published_version__isnull=False) | Q(owner=user))
        return qs.filter(published_version__isnull=False)

    def list(self, request):
        page = self.paginate_queryset(self.get_queryset())
        siblings = {}
        for p in ReadingPaper.objects.filter(
            published_version__isnull=False
        ).select_related("published_version"):
            siblings.setdefault((p.owner_id, p.book, p.test), []).append(p)
        ready = set()
        for identity, papers in siblings.items():
            papers.sort(key=lambda p: p.passage)
            if [p.passage for p in papers] == [1, 2, 3] and [
                int(n) for p in papers for n in questions(p.published_version)
            ] == list(range(1, 41)):
                ready.add(identity)
        for p in page:
            p.full_available = (p.owner_id, p.book, p.test) in ready
        return self.get_paginated_response(
            [paper_data(p, user=request.user) for p in page]
        )

    @transaction.atomic
    def create(self, request):
        require_editor(request.user)
        raw = request.data.get("metadata", {})
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except ValueError:
                raise ValidationError("Invalid paper metadata.")
        validator = PaperInput(data=raw)
        validator.is_valid(raise_exception=True)
        if ReadingPaper.objects.filter(
            owner=request.user, **validator.validated_data
        ).exists():
            raise ValidationError(
                "This passage already exists. Save a new version on its existing paper."
            )
        paper = ReadingPaper.objects.create(
            owner=request.user, **validator.validated_data
        )
        save_version(request, paper)
        return Response(paper_data(paper, True, request.user), status=201)

    def retrieve(self, request, pk=None):
        paper = self.get_object()
        require_reading_study(request.user, paper)
        return Response(paper_data(paper, True, request.user))

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def versions(self, request, pk=None):
        paper = self.get_object()
        require_editor(request.user, paper)
        ReadingPaper.objects.select_for_update().get(pk=paper.pk)
        version = save_version(request, paper)
        return Response(version_data(version, True), status=201)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def publish(self, request, pk=None):
        paper = self.get_object()
        require_editor(request.user, paper)
        validator = PublishInput(data=request.data)
        validator.is_valid(raise_exception=True)
        if not validator.validated_data["confirm_review"]:
            raise ValidationError(
                "Compare the complete passage, questions and keys against the source PDF before confirming."
            )
        paper = ReadingPaper.objects.select_for_update().get(pk=paper.pk)
        version = get_object_or_404(
            ReadingVersion, pk=validator.validated_data["version"], paper=paper
        )
        if (
            not version.rights_confirmed
            or not version.license
            or not version.review_notes.strip()
        ):
            raise ValidationError(
                "Confirm source permission, license and record the source comparison in review notes."
            )
        # Revalidate content and keys at the publication boundary.
        check = VersionInput(
            data=version_data(version, True) | {"content": version.content}
        )
        check.is_valid(raise_exception=True)
        if not version.published_at:
            version.published_at = timezone.now()
            version.reviewed_by = request.user
            version.save(update_fields=["published_at", "reviewed_by"])
        paper.published_version = version
        paper.save(update_fields=["published_version"])
        return Response(paper_data(paper, True, request.user))

    @action(detail=True, methods=["get"], url_path=r"source-pages/(?P<page>\d+)")
    def source_page(self, request, pk=None, page=None):
        paper = self.get_object()
        require_editor(request.user, paper)
        require_reading_study(request.user, paper)
        try:
            version_id = int(request.query_params.get("version", ""))
        except (TypeError, ValueError):
            raise ValidationError("Select a valid source version.")
        version = get_object_or_404(ReadingVersion, paper=paper, pk=version_id)
        number = int(page)
        if number not in version.source_pages + version.key_pages:
            raise PermissionDenied("This page is outside this passage review.")
        with version.source.open("rb") as stream:
            data = stream.read(50 * 1024 * 1024 + 1)
        with pdfium.PdfDocument(data) as pdf:
            pg = pdf[number - 1]
            bitmap = pg.render(scale=min(1.5, 1800 / max(pg.get_size())))
            output = io.BytesIO()
            bitmap.to_pil().save(output, format="PNG")
            bitmap.close()
            pg.close()
        response = HttpResponse(output.getvalue(), content_type="image/png")
        response["Cache-Control"] = "private, no-store"
        return response

    @action(detail=True, methods=["get"], url_path=r"figures/(?P<index>\d+)")
    def figure(self, request, pk=None, index=None):
        paper = self.get_object()
        require_editor(request.user, paper)
        require_reading_study(request.user, paper)
        try:
            version_id = int(request.query_params.get("version", ""))
        except (TypeError, ValueError):
            raise ValidationError("Select a valid figure version.")
        version = get_object_or_404(ReadingVersion, paper=paper, pk=version_id)
        return figure_response(version, index)


def questions(version):
    return {
        str(q["number"]): (q, group)
        for group in version.content["groups"]
        for q in group["questions"]
    }


def answer_correct(answer, accepted, q, group):
    if group["kind"] in ["true_false", "yes_no", "choice", "headings", "matching"]:
        return answer.strip().casefold() in [x.strip().casefold() for x in accepted]
    tokens = answer.split()
    word_count = sum(
        not re.fullmatch(
            r"\d+(?:[.,]\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve",
            t.casefold(),
        )
        for t in tokens
    )
    number_count = len(tokens) - word_count
    if q["allow_number"]:
        valid_length = word_count <= q["max_words"] and number_count <= 1
    else:
        valid_length = len(tokens) <= q["max_words"]
    return valid_length and normalize(answer) in [normalize(x) for x in accepted]


def score_version(version, answers):
    """Score source-defined groups; unordered groups award each choice only once."""
    results = []
    for group in version.content["groups"]:
        seen = set()
        text_pools = {
            number: index
            for index, pool in enumerate(group.get("unordered_sets", []))
            for number in pool
        }
        used_text = {}
        for q in group["questions"]:
            number = str(q["number"])
            answer = answers.get(number, "")
            accepted = version.keys[number]
            if group["kind"] == "multiple_choice":
                normalized = answer.strip().casefold()
                correct = (
                    normalized in {key.casefold() for key in accepted}
                    and normalized not in seen
                )
                seen.add(normalized)
            else:
                correct = answer_correct(answer, accepted, q, group)
                if q["number"] in text_pools:
                    used = used_text.setdefault(text_pools[q["number"]], set())
                    normalized = normalize(answer)
                    correct = correct and normalized not in used
                    if correct:
                        used.add(normalized)
            results.append(
                {
                    "number": q["number"],
                    "answer": answer,
                    "accepted_answers": accepted,
                    "correct": correct,
                }
            )
    return results


def attempt_data(attempt):
    data = {
        "id": attempt.pk,
        "paper": attempt.paper_id,
        "version": version_data(attempt.version),
        "book": attempt.paper.book,
        "test": attempt.paper.test,
        "passage": attempt.paper.passage,
        "answers": attempt.answers,
        "submitted_at": attempt.submitted_at,
        "score": attempt.score,
        "total": len(questions(attempt.version)),
    }
    if attempt.submitted_at:
        data["results"] = attempt.results
    return data


class ReadingAttemptViewSet(viewsets.GenericViewSet):
    serializer_class = AnswersInput

    @action(detail=True, methods=["get", "post", "delete"])
    @transaction.atomic
    def share(self, request, pk=None):
        from .sharing import share_response

        attempt = get_object_or_404(self.get_queryset().select_for_update(), pk=pk)
        return share_response(request, attempt)

    def get_queryset(self):
        qs = ReadingAttempt.objects.filter(user=self.request.user).select_related(
            "version", "paper"
        )
        for active in timed_full_attempts(self.request.user):
            qs = qs.exclude(
                paper__owner_id=active.owner_id,
                paper__book=active.book,
                paper__test=active.test,
            )
        return qs

    def retrieve(self, request, pk=None):
        return Response(attempt_data(self.get_object()))

    @action(detail=True, methods=["get"], url_path=r"figures/(?P<index>\d+)")
    def figure(self, request, pk=None, index=None):
        return figure_response(self.get_object().version, index)

    def list(self, request):
        page = self.paginate_queryset(self.get_queryset())
        return self.get_paginated_response(
            [
                {
                    "id": a.pk,
                    "paper": a.paper_id,
                    "title": a.version.content["title"],
                    "book": a.paper.book,
                    "test": a.paper.test,
                    "passage": a.paper.passage,
                    "timed": False,
                    "total": len(questions(a.version)),
                    "created_at": a.created_at,
                    "score": a.score,
                    "submitted_at": a.submitted_at,
                }
                for a in page
            ]
        )

    @transaction.atomic
    def create(self, request):
        validator = StartInput(data=request.data)
        validator.is_valid(raise_exception=True)
        paper = get_object_or_404(
            ReadingPaper.objects.select_for_update(),
            pk=validator.validated_data["paper"],
            published_version__isnull=False,
        )
        require_reading_study(request.user, paper)
        attempt, created = ReadingAttempt.objects.get_or_create(
            user=request.user,
            paper=paper,
            submitted_at__isnull=True,
            defaults={"version_id": paper.published_version_id},
        )
        return Response(attempt_data(attempt), status=201 if created else 200)

    @transaction.atomic
    def partial_update(self, request, pk=None):
        attempt = get_object_or_404(self.get_queryset().select_for_update(), pk=pk)
        if attempt.submitted_at:
            raise ValidationError("Submitted answers cannot be changed.")
        validator = AnswersInput(data=request.data)
        validator.is_valid(raise_exception=True)
        answers = validator.validated_data["answers"]
        allowed = questions(attempt.version)
        if set(answers) - set(allowed):
            raise ValidationError("Unknown question number.")
        for number, answer in answers.items():
            _, group = allowed[number]
            choices = {
                "true_false": ["TRUE", "FALSE", "NOT GIVEN"],
                "yes_no": ["YES", "NO", "NOT GIVEN"],
            }.get(
                group["kind"],
                group["options"]
                if group["kind"]
                in {"choice", "multiple_choice", "headings", "matching", "completion"}
                else None,
            )
            if answer and choices and answer not in choices:
                raise ValidationError("Choose one of the supplied options.")
        attempt.answers = attempt.answers | answers
        attempt.save(update_fields=["answers", "updated_at"])
        return Response(attempt_data(attempt))

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def submit(self, request, pk=None):
        attempt = get_object_or_404(self.get_queryset().select_for_update(), pk=pk)
        if not attempt.submitted_at:
            results = score_version(attempt.version, attempt.answers)
            attempt.results = results
            attempt.score = sum(r["correct"] for r in results)
            attempt.submitted_at = timezone.now()
            attempt.save(
                update_fields=["results", "score", "submitted_at", "updated_at"]
            )
        return Response(attempt_data(attempt))
