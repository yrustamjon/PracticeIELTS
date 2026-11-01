"""Private Reading import jobs. Model results stay drafts until explicit review."""

import hashlib
import io
from pathlib import Path

import pypdfium2 as pdfium
from django.db import transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from learning.models import AuditLog

from .import_serializers import ApproveInput, ImportEditInput, ImportInput
from .models import ReadingImportJob, ReadingPaper, ReadingVersion
from .serializers import PaperInput, VersionInput
from .views import require_editor


def job_data(job):
    return {
        "id": job.pk,
        "source_name": job.source_name,
        "source_page_count": job.source_page_count,
        "book": job.book,
        "license": job.license,
        "rights_confirmed": job.rights_confirmed,
        "state": job.state,
        "stage": job.stage,
        "attempts": job.attempts,
        "progress": job.progress,
        "extracted_pages": job.extracted_pages,
        "candidates": job.candidates,
        "findings": job.findings,
        "metrics": job.metrics,
        "published_papers": job.published_papers,
        "error_code": job.error_code,
        "error_message": job.error_message,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
        "started_at": job.started_at,
        "finished_at": job.finished_at,
    }


def queue_import(job):
    from .tasks import process_reading_import

    try:
        process_reading_import.delay(job.pk)
    except Exception:
        # No exception payload: provider URLs, broker credentials and source data stay private.
        ReadingImportJob.objects.filter(pk=job.pk, state="queued").update(
            state="blocked",
            stage="queue_unavailable",
            error_code="queue_unavailable",
            error_message="Processing service is unavailable. Your PDF is saved; retry when the worker is ready.",
            updated_at=timezone.now(),
        )
    job.refresh_from_db()


def candidate_input(candidate, job):
    content = candidate.get("content")
    if isinstance(content, dict) and any(
        content.get(k) for k in ["images", "diagrams", "figures", "assets", "media"]
    ):
        raise ValidationError(
            "Required passage images/diagrams are not supported by this importer. Do not publish an incomplete text-only adaptation."
        )
    identity = PaperInput(
        data={
            k: candidate.get(k, job.book if k == "book" else None)
            for k in ["book", "test", "passage"]
        }
    )
    identity.is_valid(raise_exception=True)
    validator = VersionInput(
        data={
            "content": candidate.get("content"),
            "keys": candidate.get("keys"),
            "source_name": job.source_name,
            "license": job.license,
            "rights_confirmed": job.rights_confirmed,
            "source_pages": candidate.get("source_pages"),
            "key_pages": candidate.get("key_pages"),
            "review_notes": (
                "OCR-only preparation; administrator explicitly confirmed full manual source comparison."
                if job.metrics.get("processing_mode") == "ocr_only"
                else "Independent model review completed; administrator explicitly confirmed source comparison."
            ),
        }
    )
    validator.is_valid(raise_exception=True)
    data = validator.validated_data
    if max(data["source_pages"] + data["key_pages"]) > job.source_page_count:
        raise ValidationError("A candidate references a page outside the source PDF.")
    return identity.validated_data, data


class ReadingImportViewSet(viewsets.GenericViewSet):
    lookup_value_regex = r"\d+"
    serializer_class = ImportInput

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        require_editor(request.user)

    def get_queryset(self):
        qs = ReadingImportJob.objects.all()
        user = self.request.user
        if user.is_superuser or user.is_staff or user.role == "admin":
            return qs
        return qs.filter(owner=user)

    @action(detail=False, methods=["get"])
    def capabilities(self, request):
        return Response(
            {
                "available": True,
                "provider": "local_ocr",
                "model": "Tesseract OCR",
                "review_model": "",
                "reason": "PDF text extraction and OCR are available. Administrator review is required; ML review is deferred.",
                "mode": "ocr_only",
                "ml_available": False,
                "max_file_mb": 50,
                "max_pages": 200,
            }
        )

    def list(self, request):
        page = self.paginate_queryset(self.get_queryset())
        # Do not ship entire drafts/keys on the job listing.
        summaries = []
        for j in page:
            row = job_data(j)
            row.pop("candidates")
            row.pop("findings")
            row.pop("extracted_pages")
            row["candidate_count"] = len(j.candidates)
            row["locations"] = [
                {
                    "candidate_index": index,
                    "book": candidate.get("book") or j.book,
                    "test": candidate.get("test"),
                    "passage": candidate.get("passage"),
                    "title": (candidate.get("content") or {}).get("title", ""),
                }
                for index, candidate in enumerate(j.candidates)
            ]
            row["unresolved_count"] = sum(not f.get("resolved") for f in j.findings)
            summaries.append(row)
        return self.get_paginated_response(summaries)

    def create(self, request):
        validator = ImportInput(data=request.data)
        validator.is_valid(raise_exception=True)
        values = validator.validated_data
        source = values["source"]
        blob = source.read()
        if not blob.startswith(b"%PDF-"):
            raise ValidationError({"source": "Upload a readable PDF."})
        try:
            with pdfium.PdfDocument(blob) as pdf:
                count = len(pdf)
                if count < 1 or count > 200:
                    raise ValidationError(
                        {"source": "A Reading import supports 1–200 PDF pages."}
                    )
                # Check the first page, not just the PDF signature.
                page = pdf[0]
                if max(page.get_size()) > 20000:
                    raise ValidationError(
                        {"source": "PDF page dimensions are too large."}
                    )
                page.close()
        except ValidationError:
            raise
        except Exception:
            raise ValidationError(
                {"source": "The PDF is damaged or password-protected."}
            )
        source.seek(0)
        with transaction.atomic():
            # Per-owner lock bounds concurrent uploads without changing other content.
            type(request.user).objects.select_for_update().get(pk=request.user.pk)
            if (
                ReadingImportJob.objects.filter(
                    owner=request.user, state__in=["queued", "running"]
                ).count()
                >= 2
            ):
                raise ValidationError(
                    "Two imports are already processing. Wait for one to finish."
                )
            job = ReadingImportJob.objects.create(
                owner=request.user,
                source=source,
                source_name=Path(source.name).name[:250],
                source_digest=hashlib.sha256(blob).hexdigest(),
                source_page_count=count,
                book=values["book"],
                license=values["license"],
                rights_confirmed=values["rights_confirmed"],
            )
            AuditLog.objects.create(
                actor=request.user,
                action="reading.import.upload",
                details={"job": job.pk, "pages": count},
            )
        queue_import(job)
        return Response(job_data(job), status=201)

    def retrieve(self, request, pk=None):
        response = Response(job_data(self.get_object()))
        response["Cache-Control"] = "private, no-store"
        return response

    @action(detail=True, methods=["post"])
    def retry(self, request, pk=None):
        with transaction.atomic():
            job = get_object_or_404(self.get_queryset().select_for_update(), pk=pk)
            if job.state not in ["blocked", "failed"]:
                raise ValidationError("Only blocked or failed imports can be retried.")
            if job.published_papers:
                raise ValidationError(
                    "Published import results cannot be replaced by a retry."
                )
            job.state = "queued"
            job.stage = "queued"
            job.error_code = ""
            job.error_message = ""
            job.save(
                update_fields=[
                    "state",
                    "stage",
                    "error_code",
                    "error_message",
                    "updated_at",
                ]
            )
        queue_import(job)
        return Response(job_data(job))

    @transaction.atomic
    def partial_update(self, request, pk=None):
        job = get_object_or_404(self.get_queryset().select_for_update(), pk=pk)
        if job.state not in ["needs_review", "completed"]:
            raise ValidationError("Only a prepared import can be edited.")
        validator = ImportEditInput(data=request.data)
        validator.is_valid(raise_exception=True)
        changes = validator.validated_data
        if "candidates" in changes:
            candidates = changes["candidates"]
            if len(candidates) < len(job.candidates):
                raise ValidationError(
                    "Keep existing passages; correct their fields rather than removing them."
                )
            for row in job.published_papers:
                index = row["candidate_index"]
                if candidates[index] != job.candidates[index]:
                    raise ValidationError(
                        "A published candidate cannot be changed. Create a new import for revisions."
                    )
            if len(candidates) > len(job.candidates):
                job.state = "needs_review"
                job.finished_at = None
            job.candidates = candidates
        index = {f["id"]: f for f in job.findings}
        for resolution in changes.get("resolutions", []):
            finding = index.get(resolution["finding_id"])
            if finding is None:
                raise ValidationError("Unknown finding ID.")
            finding["resolved"] = True
            finding["resolution_note"] = resolution["resolution_note"]
            finding["resolved_by"] = request.user.pk
        job.save(
            update_fields=[
                "candidates",
                "findings",
                "state",
                "finished_at",
                "updated_at",
            ]
        )
        AuditLog.objects.create(
            actor=request.user,
            action="reading.import.edit",
            details={
                "job": job.pk,
                "resolution_count": len(changes.get("resolutions", [])),
            },
        )
        return Response(job_data(job))

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def approve(self, request, pk=None):
        job = get_object_or_404(self.get_queryset().select_for_update(), pk=pk)
        validator = ApproveInput(data=request.data)
        validator.is_valid(raise_exception=True)
        index = validator.validated_data["candidate_index"]
        if not validator.validated_data["confirm_review"]:
            raise ValidationError(
                "Explicitly confirm the source comparison before publishing."
            )
        for row in job.published_papers:
            if row["candidate_index"] == index:
                return Response({"paper": row["paper"], "version": row["version"]})
        if job.state != "needs_review":
            raise ValidationError("Complete source extraction before publication.")
        if job.metrics.get("processing_mode") == "ocr_only":
            if not validator.validated_data["confirm_manual_review"]:
                raise ValidationError(
                    "ML review is deferred. Explicitly confirm your complete manual source comparison."
                )
        elif not job.metrics.get("independent_review_completed"):
            raise ValidationError(
                "Complete independent model review before publication."
            )
        if not job.rights_confirmed:
            raise ValidationError("Source permission must be confirmed.")
        if index >= len(job.candidates):
            raise ValidationError("Unknown passage.")
        unresolved = [
            f
            for f in job.findings
            if f.get("candidate_index") in [None, index]
            and f.get("severity") == "error"
            and not f.get("resolved")
        ]
        if unresolved:
            raise ValidationError(
                {
                    "findings": "Resolve the blocking source/model findings before publication."
                }
            )
        identity, data = candidate_input(job.candidates[index], job)
        paper, created = ReadingPaper.objects.get_or_create(owner=job.owner, **identity)
        if not created:
            raise ValidationError(
                "This passage already exists in the selected book and test. Choose an unused passage number, or open the existing passage to create an explicit revision."
            )
        paper = ReadingPaper.objects.select_for_update().get(pk=paper.pk)
        version = ReadingVersion.objects.create(
            paper=paper,
            source=job.source.name,
            **data,
            published_at=timezone.now(),
            reviewed_by=request.user,
        )
        paper.published_version = version
        paper.save(update_fields=["published_version"])
        row = {"candidate_index": index, "paper": paper.pk, "version": version.pk}
        job.published_papers = [*job.published_papers, row]
        if len(job.published_papers) == len(job.candidates):
            job.state = "completed"
            job.stage = "published"
            job.finished_at = timezone.now()
        job.save(
            update_fields=[
                "published_papers",
                "state",
                "stage",
                "finished_at",
                "updated_at",
            ]
        )
        AuditLog.objects.create(
            actor=request.user,
            action="reading.import.publish",
            details={"job": job.pk, "paper": paper.pk, "version": version.pk},
        )
        return Response({"paper": paper.pk, "version": version.pk}, status=201)

    @action(detail=True, methods=["get"], url_path=r"source-pages/(?P<page>\d+)")
    def source_page(self, request, pk=None, page=None):
        job = self.get_object()
        number = int(page)
        if not 1 <= number <= job.source_page_count:
            raise ValidationError("This PDF page does not exist.")
        with job.source.open("rb") as stream:
            data = stream.read(50 * 1024 * 1024 + 1)
        with pdfium.PdfDocument(data) as pdf:
            pg = pdf[number - 1]
            bitmap = pg.render(scale=min(1.5, 1800 / max(pg.get_size())))
            out = io.BytesIO()
            bitmap.to_pil().save(out, format="PNG")
            bitmap.close()
            pg.close()
        response = HttpResponse(out.getvalue(), content_type="image/png")
        response["Cache-Control"] = "private, no-store"
        return response
