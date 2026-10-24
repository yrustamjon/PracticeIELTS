import io
import wave
from datetime import timedelta

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject
from rest_framework.test import APIClient

from accounts.models import User
from exams.models import MockAttempt
from learning.models import (
    AudioAsset,
    Category,
    Material,
    Segment,
    TranscriptVersion,
)

pytestmark = pytest.mark.django_db


def original_pdf(pages=2, encrypted=False):
    writer = PdfWriter()
    for n in range(pages):
        page = writer.add_blank_page(600, 800)
        font = DictionaryObject(
            {
                NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"),
                NameObject("/BaseFont"): NameObject("/Helvetica"),
            }
        )
        page[NameObject("/Resources")] = DictionaryObject(
            {
                NameObject("/Font"): DictionaryObject(
                    {NameObject("/F1"): writer._add_object(font)}
                )
            }
        )
        content = DecodedStreamObject()
        text = (
            "Question paper: 1. The tour starts at the central ____."
            if n == 0
            else "Private answer key: 1. station"
        )
        content.set_data(f"BT /F1 14 Tf 40 750 Td ({text}) Tj ET".encode())
        page[NameObject("/Contents")] = writer._add_object(content)
    if encrypted:
        writer.encrypt("test-password")
    output = io.BytesIO()
    writer.write(output)
    return SimpleUploadedFile(
        "original-questions.pdf", output.getvalue(), content_type="application/pdf"
    )


def choice(kind="short_answer", number=1):
    q = {
        "number": number,
        "part": 1,
        "type": kind,
        "prompt": "The tour starts at the central ____.",
        "instructions": "ONE WORD",
        "answers": ["station"],
        "max_words": 1,
        "options": [],
        "context": {},
    }
    if kind in ("multiple_choice", "matching"):
        q.update(
            prompt="Choose the meeting place.",
            options=[
                {"key": "A", "text": "Station"},
                {"key": "B", "text": "Library"},
                {"key": "C", "text": "Park"},
            ],
            answers=["A"],
        )
    if kind == "table_completion":
        q["context"] = {"table": [["Time", "Place"], ["9am", "____"]]}
    return q


@pytest.fixture
def exam_data(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    teacher = User.objects.create_user(username="exam_teacher", role="teacher")
    student = User.objects.create_user(username="exam_student")
    other = User.objects.create_user(username="exam_other")
    editor = User.objects.create_user(username="exam_other_editor", role="teacher")
    category = Category.objects.create(name="Original exam fixtures")
    material = Material.objects.create(
        title="Original listening exam",
        owner=teacher,
        category=category,
        source="Own fixture",
        license="CC0",
        rights_confirmed=True,
    )
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(8000)
        wav.writeframes(b"\0\0" * 16000)
    asset = AudioAsset.objects.create(
        material=material,
        file=SimpleUploadedFile("audio.wav", buffer.getvalue()),
        duration_ms=2000,
        mime_type="audio/wav",
        size=len(buffer.getvalue()),
    )
    version = TranscriptVersion.objects.create(material=material, audio=asset)
    Segment.objects.create(
        version=version,
        position=0,
        text="The tour starts at the central station.",
        start_ms=0,
        end_ms=1900,
    )
    client = APIClient()
    client.force_authenticate(teacher)
    return client, teacher, student, other, editor, material, version


def publish(data, questions=None, **options):
    client, teacher, student, other, editor, m, v = data
    client.force_authenticate(teacher)
    payload = {"questions": questions or [choice()], "duration_seconds": 60, **options}
    response = client.put(
        f"/api/v1/materials/{m.pk}/questions/", payload, format="json"
    )
    assert response.status_code == 201, response.data
    response = client.post(
        f"/api/v1/materials/{m.pk}/publish/", {"confirm_review": True}, format="json"
    )
    assert response.status_code == 200, response.data
    m.refresh_from_db()
    return m.published_questions


def start(data, timing="untimed"):
    client, teacher, student, _, _, m, _ = data
    client.force_authenticate(student)
    response = client.post(
        "/api/v1/mock-attempts/", {"material": m.pk, "timing": timing}, format="json"
    )
    assert response.status_code == 201, response.data
    return response.data


@pytest.mark.parametrize(
    "kind",
    [
        "multiple_choice",
        "matching",
        "form_completion",
        "note_completion",
        "table_completion",
        "sentence_completion",
        "short_answer",
        "map_label",
        "diagram_label",
    ],
)
def test_real_question_types_and_private_keys(exam_data, kind):
    client, *_ = exam_data
    options = {}
    if kind in ("map_label", "diagram_label"):
        doc = client.post(
            f"/api/v1/materials/{exam_data[5].pk}/question-document/",
            {"file": original_pdf()},
            format="multipart",
        )
        assert doc.status_code == 201
        options = {"document": doc.data["id"], "document_pages": [1]}
    publish(exam_data, [choice(kind)], **options)
    a = start(exam_data)
    assert "answers" not in a["questions"][0] and a["deadline"] is None
    assert "accepted_answers" not in str(a)
    answer = "A" if kind in ("multiple_choice", "matching") else "station"
    saved = client.patch(
        f"/api/v1/mock-attempts/{a['id']}/", {"answers": {"1": answer}}, format="json"
    )
    assert saved.status_code == 200
    submitted = client.post(
        f"/api/v1/mock-attempts/{a['id']}/submit/", {}, format="json"
    )
    assert submitted.status_code == 200 and submitted.data["score"] == 1
    assert submitted.data["results"][0]["accepted_answers"]


def test_active_exam_blocks_all_study_routes_and_cross_user_access(exam_data):
    client, teacher, student, other, editor, m, v = exam_data
    publish(exam_data)
    client.force_authenticate(student)
    s = client.post(
        "/api/v1/sessions/", {"material": m.pk, "difficulty": "easy"}, format="json"
    ).data
    client.post(
        f"/api/v1/sessions/{s['id']}/check/", {"answer": "wrong"}, format="json"
    )
    a = start(exam_data)
    assert client.get(f"/api/v1/materials/{m.pk}/").status_code == 403
    assert client.get(f"/api/v1/audio/{v.audio_id}/stream/").status_code == 403
    assert (
        client.get(f"/api/v1/sessions/{s['id']}/hint/?reveal=true").status_code == 403
    )
    assert (
        client.post(
            f"/api/v1/sessions/{s['id']}/check/", {"answer": "anything"}, format="json"
        ).status_code
        == 403
    )
    assert client.get("/api/v1/responses/").data["results"] == []
    assert client.get(f"/api/v1/materials/{m.pk}/questions/").status_code == 403
    client.force_authenticate(other)
    for suffix in ["", "start-audio/", "submit/"]:
        r = (
            client.get(f"/api/v1/mock-attempts/{a['id']}/{suffix}")
            if suffix == ""
            else client.post(
                f"/api/v1/mock-attempts/{a['id']}/{suffix}", {}, format="json"
            )
        )
        assert r.status_code == 404
    client.force_authenticate(student)
    client.post(f"/api/v1/mock-attempts/{a['id']}/submit/")
    assert client.get(f"/api/v1/materials/{m.pk}/").status_code == 200
    assert client.get(f"/api/v1/audio/{v.audio_id}/stream/").status_code == 200


def test_timed_expiry_scores_saved_answers_and_rejects_late_changes(exam_data):
    client, *_ = exam_data
    publish(exam_data)
    a = start(exam_data, "timed")
    path = f"/api/v1/mock-attempts/{a['id']}/"
    assert a["deadline"] is not None
    client.patch(path, {"answers": {"1": "station"}}, format="json")
    MockAttempt.objects.filter(pk=a["id"]).update(
        deadline=timezone.now() - timedelta(seconds=1)
    )
    assert (
        client.patch(path, {"answers": {"1": "wrong"}}, format="json").status_code
        == 400
    )
    ended = client.get(path).data
    assert (
        ended["submitted_at"]
        and ended["score"] == 1
        and ended["answers"]["1"] == "station"
    )
    assert client.post(path + "start-audio/").status_code == 403


def test_untimed_survives_elapsed_days_and_resume(exam_data, monkeypatch):
    publish(exam_data)
    a = start(exam_data)
    client = exam_data[0]
    path = f"/api/v1/mock-attempts/{a['id']}/"
    future = timezone.now() + timedelta(days=20)
    monkeypatch.setattr("django.utils.timezone.now", lambda: future)
    assert (
        client.patch(path, {"answers": {"1": "station"}}, format="json").status_code
        == 200
    )
    assert client.get(path).data["submitted_at"] is None
    resumed = client.post(
        "/api/v1/mock-attempts/",
        {"material": exam_data[5].pk, "timing": "untimed"},
        format="json",
    )
    assert resumed.status_code == 200 and resumed.data["id"] == a["id"]
    assert (
        resumed.data["answers"]["1"] == "station" and resumed.data["deadline"] is None
    )


def test_audio_delivery_is_owned_and_single_use(exam_data):
    publish(exam_data)
    a = start(exam_data)
    client = exam_data[0]
    path = f"/api/v1/mock-attempts/{a['id']}/"
    assert client.get(path + "audio/").status_code == 403
    ticket = client.post(path + "start-audio/").data
    assert client.post(path + "start-audio/").status_code == 403
    response = client.get(ticket["url"], HTTP_X_EXAM_AUDIO=ticket["ticket"])
    assert response.status_code == 200 and b"".join(
        response.streaming_content
    ).startswith(b"RIFF")
    assert response["Accept-Ranges"] == "none"
    assert (
        client.get(ticket["url"], HTTP_X_EXAM_AUDIO=ticket["ticket"]).status_code == 403
    )


def test_private_pdf_extraction_preview_and_only_selected_student_pages(exam_data):
    client, teacher, student, other, editor, m, _ = exam_data
    r = client.post(
        f"/api/v1/materials/{m.pk}/question-document/",
        {"file": original_pdf()},
        format="multipart",
    )
    assert r.status_code == 201 and r.data["page_count"] == 2
    assert "Private answer key" in r.data["extracted_text"]
    document = r.data["id"]
    page = client.get(f"/api/v1/question-documents/{document}/pages/1/")
    assert page.status_code == 200 and page.content.startswith(b"\x89PNG")
    publish(exam_data, document=document, document_pages=[1])
    a = start(exam_data)
    assert (
        client.get(f"/api/v1/question-documents/{document}/pages/1/").status_code == 403
    )
    assert (
        client.get(f"/api/v1/mock-attempts/{a['id']}/document-pages/1/").status_code
        == 200
    )
    assert (
        client.get(f"/api/v1/mock-attempts/{a['id']}/document-pages/2/").status_code
        == 403
    )
    assert client.get(f"/api/v1/materials/{m.pk}/question-document/").status_code == 403
    assert "Private answer key" not in str(
        client.get(f"/api/v1/mock-attempts/{a['id']}/").data
    )
    client.force_authenticate(editor)
    assert (
        client.get(f"/api/v1/question-documents/{document}/pages/1/").status_code == 403
    )


def test_invalid_and_encrypted_pdfs_rejected(exam_data):
    client, *_ = exam_data
    path = f"/api/v1/materials/{exam_data[5].pk}/question-document/"
    for file in [
        SimpleUploadedFile("bad.pdf", b"bad"),
        original_pdf(encrypted=True),
        original_pdf(pages=51),
    ]:
        assert client.post(path, {"file": file}, format="multipart").status_code == 400


def test_question_validation_and_ownership(exam_data):
    client, teacher, student, other, editor, m, _ = exam_data
    path = f"/api/v1/materials/{m.pk}/questions/"
    bad = choice("multiple_choice")
    bad["answers"] = ["Z"]
    assert client.put(path, {"questions": [bad]}, format="json").status_code == 400
    assert (
        client.put(path, {"questions": [choice(number=2)]}, format="json").status_code
        == 400
    )
    assert (
        client.put(path, {"questions": [choice(), choice()]}, format="json").status_code
        == 400
    )
    assert (
        client.put(
            path, {"questions": [choice("map_label")]}, format="json"
        ).status_code
        == 400
    )
    client.force_authenticate(student)
    assert client.put(path, {"questions": [choice()]}, format="json").status_code == 403
    client.force_authenticate(editor)
    assert client.get(path).status_code in (403, 404)


def test_question_versions_pin_history_and_score_multi_selection(exam_data):
    client, teacher, student, other, editor, m, v = exam_data
    q = choice("multiple_choice")
    q["answers"] = [["A", "C"]]
    first = publish(exam_data, [q])
    a = start(exam_data)
    client.force_authenticate(teacher)
    q["answers"] = [["A", "B"]]
    second = publish(exam_data, [q])
    assert first.pk != second.pk
    client.force_authenticate(student)
    path = f"/api/v1/mock-attempts/{a['id']}/"
    client.patch(path, {"answers": {"1": ["C", "A"]}}, format="json")
    result = client.post(path + "submit/").data
    assert result["score"] == 1 and result["questions"][0]["answers"] == [["A", "C"]]
    attempt = MockAttempt.objects.get(pk=a["id"])
    assert attempt.question_set_id == first.pk
    assert client.patch(path, {"answers": {"1": "A"}}, format="json").status_code == 400


def test_no_published_questions_means_no_mock(exam_data):
    client, teacher, student, other, editor, m, v = exam_data
    client.post(f"/api/v1/materials/{m.pk}/publish/")
    client.force_authenticate(student)
    assert (
        client.post(
            "/api/v1/mock-attempts/",
            {"material": m.pk, "timing": "untimed"},
            format="json",
        ).status_code
        == 404
    )
