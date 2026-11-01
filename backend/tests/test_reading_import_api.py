import copy
import io
from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from pypdf import PdfWriter
from rest_framework.test import APIClient

from accounts.models import User
from reading.models import ReadingImportJob, ReadingVersion

pytestmark = pytest.mark.django_db


@pytest.fixture
def importing(tmp_path, settings):
    settings.MEDIA_ROOT = tmp_path
    teacher = User.objects.create_user(username="pdf_editor", role="teacher")
    student = User.objects.create_user(username="pdf_student")
    other = User.objects.create_user(username="pdf_other", role="teacher")
    c = APIClient()
    c.force_authenticate(teacher)
    w = PdfWriter()
    w.add_blank_page(width=400, height=500)
    w.add_blank_page(width=400, height=500)
    out = io.BytesIO()
    w.write(out)

    def upload():
        return c.post(
            "/api/v1/reading-imports/",
            {
                "source": SimpleUploadedFile(
                    "original.pdf", out.getvalue(), content_type="application/pdf"
                ),
                "book": "Original",
                "license": "CC0",
                "rights_confirmed": "true",
            },
            format="multipart",
        )

    with patch("reading.tasks.process_reading_import.delay"):
        r = upload()
    assert r.status_code == 201, r.data
    candidate = {
        "book": "Original",
        "test": 1,
        "passage": 1,
        "content": {
            "title": "Original test passage",
            "subtitle": "",
            "instructions": "Answer ONE WORD ONLY.",
            "paragraphs": [{"label": "", "text": "A roof provides shade."}],
            "groups": [
                {
                    "title": "Question 1",
                    "instructions": "ONE WORD ONLY.",
                    "kind": "short_answer",
                    "questions": [
                        {"number": 1, "prompt": "What provides shade?", "max_words": 1}
                    ],
                }
            ],
        },
        "keys": {"1": ["roof"]},
        "source_pages": [1],
        "key_pages": [2],
    }
    j = ReadingImportJob.objects.get(pk=r.data["id"])
    j.state = "needs_review"
    j.stage = "ready_for_review"
    j.metrics = {
        "processing_mode": "ocr_only",
        "model_calls": 0,
        "independent_review_completed": False,
    }
    j.extracted_pages = [
        {"page": 1, "text": "Original fixture", "method": "text", "warnings": []}
    ]
    j.save()
    return c, teacher, student, other, j, candidate, upload


def test_upload_permissions_private_source_and_actual_queue_errors(importing):
    c, teacher, student, other, j, _, upload = importing
    base = f"/api/v1/reading-imports/{j.pk}/"
    assert c.get(base + "source-pages/1/").status_code == 200
    assert c.get(base + "source-pages/3/").status_code == 400
    assert "source" not in c.get(base).data
    assert c.get("/api/v1/reading-imports/capabilities/").data["mode"] == "ocr_only"
    c.force_authenticate(student)
    assert c.get(base).status_code == 403
    assert c.get(base + "source-pages/1/").status_code == 403
    c.force_authenticate(other)
    assert c.get(base).status_code == 404
    c.force_authenticate(teacher)
    with patch(
        "reading.tasks.process_reading_import.delay",
        side_effect=ConnectionError("private URL must not be exposed"),
    ):
        response = upload()
    assert response.status_code == 201 and response.data["state"] == "blocked"
    assert response.data["error_code"] == "queue_unavailable"
    assert "private URL" not in str(response.data)
    with patch("reading.tasks.process_reading_import.delay") as delay:
        assert (
            c.post(f"/api/v1/reading-imports/{response.data['id']}/retry/").data[
                "state"
            ]
            == "queued"
        )
        delay.assert_called_once()
    c.force_authenticate(None)
    assert c.get(base).status_code == 401


def test_manual_authoring_requires_full_review_and_resolved_source_errors(importing):
    c, _, student, _, j, candidate, _ = importing
    url = f"/api/v1/reading-imports/{j.pk}/"
    assert c.patch(url, {"candidates": [candidate]}, format="json").status_code == 200
    listing = c.get("/api/v1/reading-imports/").data["results"][0]
    assert listing["locations"] == [{
        "candidate_index": 0, "book": "Original", "test": 1, "passage": 1,
        "title": "Original test passage",
    }]
    assert "candidates" not in listing and "keys" not in str(listing["locations"])
    j.findings = [
        {
            "id": "source-low-confidence",
            "candidate_index": 0,
            "stage": "extract",
            "severity": "error",
            "message": "Compare original source.",
            "source_pages": [1],
            "resolved": False,
        }
    ]
    j.save(update_fields=["findings"])
    approve = {
        "candidate_index": 0,
        "confirm_review": True,
        "confirm_manual_review": True,
    }
    assert (
        c.post(
            url + "approve/", {**approve, "confirm_manual_review": False}, format="json"
        ).status_code
        == 400
    )
    assert c.post(url + "approve/", approve, format="json").status_code == 400
    assert (
        c.patch(url, {"findings": []}, format="json").data["findings"][0]["resolved"]
        is False
    )
    assert (
        c.patch(
            url,
            {
                "resolutions": [
                    {
                        "finding_id": "source-low-confidence",
                        "resolution_note": "Compared original text and corrected it.",
                    }
                ]
            },
            format="json",
        ).status_code
        == 200
    )
    r = c.post(url + "approve/", approve, format="json")
    assert r.status_code == 201, r.data
    assert c.post(url + "approve/", approve, format="json").data == r.data
    v = ReadingVersion.objects.get(pk=r.data["version"])
    assert "OCR-only" in v.review_notes
    assert ReadingImportJob.objects.get(pk=j.pk).metrics["model_calls"] == 0
    c.force_authenticate(student)
    a = c.post("/api/v1/reading-attempts/", {"paper": r.data["paper"]}).data
    assert "keys" not in a["version"]
    assert (
        c.patch(
            f"/api/v1/reading-attempts/{a['id']}/",
            {"answers": {"1": "roof"}},
            format="json",
        ).status_code
        == 200
    )
    assert c.post(f"/api/v1/reading-attempts/{a['id']}/submit/").data["score"] == 1


def test_approval_revalidates_and_does_not_rewrite_published_candidates(importing):
    c, _, _, _, j, candidate, _ = importing
    url = f"/api/v1/reading-imports/{j.pk}/"
    broken = copy.deepcopy(candidate)
    broken["keys"] = {}
    c.patch(url, {"candidates": [broken]}, format="json")
    approve = {
        "candidate_index": 0,
        "confirm_review": True,
        "confirm_manual_review": True,
    }
    assert c.post(url + "approve/", approve, format="json").status_code == 400
    c.patch(url, {"candidates": [candidate]}, format="json")
    r = c.post(url + "approve/", approve, format="json")
    assert r.status_code == 201
    replacement = copy.deepcopy(candidate)
    replacement["content"]["title"] = "Changed published content"
    assert c.patch(url, {"candidates": [replacement]}, format="json").status_code == 400
    added = copy.deepcopy(candidate)
    added["passage"] = 2
    assert (
        c.patch(url, {"candidates": [candidate, added]}, format="json").status_code
        == 200
    )
    assert (
        ReadingVersion.objects.get(pk=r.data["version"]).content["title"]
        == "Original test passage"
    )
    assert (
        c.post(
            url + "approve/", {**approve, "candidate_index": 1}, format="json"
        ).status_code
        == 201
    )


def test_import_cannot_replace_an_existing_passage_identity(importing):
    c, _, _, _, j, candidate, _ = importing
    url = f"/api/v1/reading-imports/{j.pk}/"
    c.patch(url, {"candidates": [candidate]}, format="json")
    approve = {"candidate_index": 0, "confirm_review": True, "confirm_manual_review": True}
    first = c.post(url + "approve/", approve, format="json")
    assert first.status_code == 201
    duplicate = copy.deepcopy(candidate)
    duplicate["content"]["title"] = "Accidental duplicate"
    assert c.patch(url, {"candidates": [candidate, duplicate]}, format="json").status_code == 200
    rejected = c.post(url + "approve/", {**approve, "candidate_index": 1}, format="json")
    assert rejected.status_code == 400
    assert "already exists" in str(rejected.data)
    assert ReadingVersion.objects.filter(paper_id=first.data["paper"]).count() == 1
