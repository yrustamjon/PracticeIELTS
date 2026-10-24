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


def original_pdf(pages=2, encrypted=False, texts=None):
    writer = PdfWriter()
    for n in range(len(texts) if texts is not None else pages):
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
        if texts is not None:
            text = texts[n]
        commands = []
        for line in text.splitlines():
            escaped = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
            commands.append(f"({escaped}) Tj T*")
        content.set_data(
            ("BT /F1 14 Tf 18 TL 40 750 Td " + " ".join(commands) + " ET").encode()
        )
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
    if kind in ("map_label", "diagram_label"):
        q["context"] = {
            "body": "Walk north from the entrance. The station is on the left, beside the park."
        }
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


def test_material_exposes_only_published_part_question_counts(exam_data):
    client, teacher, student, _, _, material, _ = exam_data
    first = choice(number=1)
    third = {**choice(number=2), "part": 3}
    publish(exam_data, [first, third])
    draft = {**choice(number=1), "part": 2}
    assert client.put(
        f"/api/v1/materials/{material.pk}/questions/",
        {"questions": [draft], "duration_seconds": 60},
        format="json",
    ).status_code == 201
    client.force_authenticate(student)
    response = client.get(f"/api/v1/materials/{material.pk}/")
    assert response.status_code == 200
    assert response.data["part_question_counts"] == {"1": 1, "3": 1}


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
    publish(exam_data, document=document, document_pages=[1], presentation="legacy_pdf")
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
            path,
            {"questions": [choice("map_label")], "presentation": "legacy_pdf"},
            format="json",
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


def test_text_mock_keeps_pdf_editor_only_and_rejects_placeholder_prompts(exam_data):
    client, teacher, student, _, _, m, _ = exam_data
    doc = client.post(
        f"/api/v1/materials/{m.pk}/question-document/",
        {"file": original_pdf()},
        format="multipart",
    ).data["id"]
    qs = publish(exam_data, document=doc, document_pages=[1])
    assert qs.presentation == "text"
    attempt = start(exam_data)
    assert attempt["document_pages"] == []
    assert attempt["presentation"] == "text"
    assert "Private answer key" not in str(attempt)
    assert (
        client.get(
            f"/api/v1/mock-attempts/{attempt['id']}/document-pages/1/"
        ).status_code
        == 403
    )
    client.force_authenticate(teacher)
    bad = choice()
    bad["prompt"] = "Question 1 — answer using the question paper."
    r = client.put(
        f"/api/v1/materials/{m.pk}/questions/", {"questions": [bad]}, format="json"
    )
    assert r.status_code == 400 and "actual question text" in str(r.data)
    # The rejected edit does not mutate the published set or the student's version.
    assert list(qs.questions.values_list("prompt", flat=True)) == [choice()["prompt"]]


def test_pdf_text_drafts_only_selected_pages_and_authorized_editor(exam_data):
    client, teacher, student, other, editor, m, _ = exam_data
    doc = client.post(
        f"/api/v1/materials/{m.pk}/question-document/",
        {"file": original_pdf()},
        format="multipart",
    ).data["id"]
    path = f"/api/v1/materials/{m.pk}/question-drafts/"
    r = client.post(path, {"document": doc, "pages": [1]}, format="json")
    assert r.status_code == 200
    assert "Private answer key" not in str(r.data)
    assert r.data["questions"][0]["prompt"] == "The tour starts at the central ____."
    assert r.data["questions"][0]["answers"] == []
    assert r.data["warnings"]
    for pages in [[], [3], [0], ["not-a-page"]]:
        assert (
            client.post(
                path, {"document": doc, "pages": pages}, format="json"
            ).status_code
            == 400
        )
    assert (
        client.post(
            path, {"document": doc + 100, "pages": [1]}, format="json"
        ).status_code
        == 404
    )
    for user in (student, other, editor):
        client.force_authenticate(user)
        assert client.post(
            path, {"document": doc, "pages": [1]}, format="json"
        ).status_code in (403, 404)


def test_text_diagrams_and_tables_cannot_rely_on_pdf(exam_data):
    client, _, _, _, _, m, _ = exam_data
    doc = client.post(
        f"/api/v1/materials/{m.pk}/question-document/",
        {"file": original_pdf()},
        format="multipart",
    ).data["id"]
    for kind in ("map_label", "diagram_label", "table_completion"):
        q = choice(kind)
        q["context"] = {}
        r = client.put(
            f"/api/v1/materials/{m.pk}/questions/",
            {"questions": [q], "document": doc, "document_pages": [1]},
            format="json",
        )
        assert r.status_code == 400
    assert (
        client.put(
            f"/api/v1/materials/{m.pk}/questions/",
            {"questions": [choice("table_completion")]},
            format="json",
        ).status_code
        == 201
    )


def test_mock_filter_excludes_dictation_only_materials(exam_data):
    client, _, _, _, _, m, _ = exam_data
    # Publish only a transcript first.
    client.post(
        f"/api/v1/materials/{m.pk}/publish/", {"confirm_review": True}, format="json"
    )
    assert client.get("/api/v1/materials/?mock_available=true").data["count"] == 0
    publish(exam_data)
    assert client.get("/api/v1/materials/?mock_available=true").data["count"] == 1


def test_numbered_pdf_drafts_preserve_parts_options_and_skip_ambiguous_layout(
    exam_data,
):
    client, _, _, _, _, m, _ = exam_data
    pdf = original_pdf(
        texts=[
            "PART 1\nONE WORD\n1. The meeting is at the ____.\nPART 2\nCHOOSE ONE ANSWER\n2. Where is the entrance?\nA. North gate\nB. South gate",
            "Private answer key: 1. station 2. A",
        ]
    )
    doc = client.post(
        f"/api/v1/materials/{m.pk}/question-document/",
        {"file": pdf},
        format="multipart",
    ).data["id"]
    response = client.post(
        f"/api/v1/materials/{m.pk}/question-drafts/",
        {"document": doc, "pages": [1]},
        format="json",
    )
    assert response.status_code == 200
    first, second = response.data["questions"]
    assert first["part"] == 1 and first["instructions"] == "ONE WORD"
    assert second["part"] == 2 and second["type"] == "multiple_choice"
    assert second["options"] == [
        {"key": "A", "text": "North gate"},
        {"key": "B", "text": "South gate"},
    ]
    assert second["answers"] == [] and "Private answer key" not in str(response.data)
    # A scan or non-numbered text is never replaced with fabricated questions.
    doc = client.post(
        f"/api/v1/materials/{m.pk}/question-document/",
        {"file": original_pdf(texts=["Unnumbered question layout"])},
        format="multipart",
    ).data["id"]
    response = client.post(
        f"/api/v1/materials/{m.pk}/question-drafts/",
        {"document": doc, "pages": [1]},
        format="json",
    )
    assert response.data["questions"] == [] and response.data["warnings"]


def test_new_attempt_cannot_start_with_legacy_pdf_placeholder_but_history_is_preserved(
    exam_data,
):
    client, teacher, student, _, _, material, _ = exam_data
    q = choice()
    q["prompt"] = "Question 1 — answer using the question paper."
    old = publish(exam_data, [q], presentation="legacy_pdf")
    client.force_authenticate(student)
    r = client.post(
        "/api/v1/mock-attempts/",
        {"material": material.pk, "timing": "untimed"},
        format="json",
    )
    assert r.status_code == 400 and "updated text questions" in str(r.data)
    assert not MockAttempt.objects.filter(material=material).exists()
    client.force_authenticate(teacher)
    publish(exam_data)
    a = start(exam_data)
    assert a["questions"][0]["prompt"] == choice()["prompt"]
    assert old.questions.get().prompt == q["prompt"]


def test_pdf_inline_numbered_blanks_have_real_coordinates_and_keep_private_pages(
    exam_data,
):
    client, teacher, student, other, editor, m, _ = exam_data
    pdf = original_pdf(
        texts=[
            "Community workshop\nRegistration form\nWrite ONE WORD for each answer.\nName: 1 ....................\nDay: 2 ....................\nPlease arrive early.",
            "Schedule\nDetail        Answer\nRoom          3 ....................",
            "Private answer key: Alex Monday blue",
        ]
    )
    document = client.post(
        f"/api/v1/materials/{m.pk}/question-document/",
        {"file": pdf},
        format="multipart",
    ).data["id"]
    response = client.post(
        f"/api/v1/materials/{m.pk}/question-drafts/",
        {"document": document, "pages": [1, 2]},
        format="json",
    )
    assert response.status_code == 200
    drafts = response.data["questions"]
    assert [q["number"] for q in drafts] == [1, 2, 3]
    assert "Private answer key" not in str(response.data)
    for q, answer in zip(drafts, ["Alex", "Monday", "blue"], strict=True):
        box = q["context"]["pdf_field"]
        assert 0 < box["x"] < 1 and 0 < box["width"] < 0.6
        assert 0 < box["y"] < 1 and 0 < box["height"] < 0.1
        q["answers"] = [answer]
    publish(
        exam_data, drafts, presentation="pdf", document=document, document_pages=[1, 2]
    )
    attempt = start(exam_data)
    assert attempt["presentation"] == "pdf" and attempt["document_pages"] == [1, 2]
    path = f"/api/v1/mock-attempts/{attempt['id']}/pdf-pages/"
    for page, phrase in [(1, "Registration form"), (2, "Schedule")]:
        r = client.get(path + f"{page}/")
        assert r.status_code == 200 and r["Content-Type"] == "application/pdf"
        parsed = __import__("pypdf").PdfReader(io.BytesIO(r.content))
        assert len(parsed.pages) == 1 and phrase in parsed.pages[0].extract_text()
        assert "Private answer key" not in str([p.extract_text() for p in parsed.pages])
    assert client.get(path + "3/").status_code == 403
    client.force_authenticate(other)
    assert client.get(path + "1/").status_code == 404
    client.force_authenticate(editor)
    assert (
        client.get(f"/api/v1/question-documents/{document}/pdf-pages/1/").status_code
        == 403
    )
    client.force_authenticate(teacher)
    assert (
        client.get(f"/api/v1/question-documents/{document}/pdf-pages/1/").status_code
        == 200
    )
    drafts[0]["context"]["pdf_field"]["width"] = 2
    r = client.put(
        f"/api/v1/materials/{m.pk}/questions/",
        {
            "questions": drafts,
            "presentation": "pdf",
            "document": document,
            "document_pages": [1, 2],
        },
        format="json",
    )
    assert r.status_code == 400 and "dimensions" in str(r.data)


NATIVE_PAPER = """<html><head><script>const secretKey = "not for students";</script></head><body><div>Advertising</div>
<div id="part1"><p>Complete the notes. ONE WORD.</p><div class="gx-notes"><p class="gx-notes-title">Library visit</p><p class="gx-sec-title">Booking details</p><ul><li>Meeting point: <input data-question="1" type="text" value="PRIVATE" onfocus="alert(1)"></li><li>Room: <input data-question="2" type="text"></li></ul></div><script>alert('hidden key')</script></div>
<div id="part2"><h3>Choose the correct location.</h3><label><input type="radio" data-question="3" value="A">A Upstairs</label><label><input type="radio" data-question="3" value="B">B Downstairs</label><table><tr><th>Item</th><th>Place</th></tr><tr><td>Books</td><td><input data-question="4" type="text"></td></tr></table><img src="https://example.invalid/tracker.png"></div></body></html>"""


def test_html_import_native_notes_choices_and_table_are_inert_and_versioned(exam_data):
    client, teacher, student, _, _, m, _ = exam_data
    upload = SimpleUploadedFile(
        "native.html", NATIVE_PAPER.encode(), content_type="text/html"
    )
    response = client.post(
        f"/api/v1/materials/{m.pk}/question-html/", {"file": upload}, format="multipart"
    )
    assert response.status_code == 200
    data = response.data
    assert [q["number"] for q in data["questions"]] == [1, 2, 3, 4]
    assert all(q["answers"] == [] for q in data["questions"])
    markup = str(data["sections"])
    for secret in (
        "script",
        "onfocus",
        "PRIVATE",
        "Advertising",
        "secretKey",
        "http",
        "<img",
    ):
        assert secret not in markup
    assert "<h3>Library visit</h3>" in markup and "{{1}}" in markup
    assert "{{3:A}}" in markup and "<table>" in markup
    assert data["questions"][2]["options"][0]["text"] == "Upstairs"
    assert any("figures" in warning for warning in data["warnings"])
    for q, answer in zip(
        data["questions"], ["upstairs", "upstairs", "A", "upstairs"], strict=True
    ):
        q["answers"] = [answer]
    original = publish(
        exam_data, data["questions"], presentation="html", sections=data["sections"]
    )
    attempt = start(exam_data)
    assert attempt["sections"] == data["sections"] and attempt["document_pages"] == []
    assert "answers" not in attempt["questions"][0]
    client.force_authenticate(teacher)
    changed = [
        {**s, "html": s["html"].replace("Library visit", "A newer paper")}
        for s in data["sections"]
    ]
    publish(exam_data, data["questions"], presentation="html", sections=changed)
    client.force_authenticate(student)
    assert (
        client.get(f"/api/v1/mock-attempts/{attempt['id']}/").data["sections"]
        == original.sections
    )
    assert (
        client.patch(
            f"/api/v1/mock-attempts/{attempt['id']}/",
            {"answers": {"1": "upstairs", "2": "upstairs", "3": "A", "4": "upstairs"}},
            format="json",
        ).status_code
        == 200
    )
    assert (
        client.post(f"/api/v1/mock-attempts/{attempt['id']}/submit/").data["score"] == 4
    )


def test_html_paper_markers_and_import_permissions(exam_data):
    client, teacher, student, _, editor, m, _ = exam_data
    path = f"/api/v1/materials/{m.pk}/questions/"
    for html in ("<p>No answers here</p>", "{{2}}", "{{1}}{{1}}", "{{1:A}}"):
        r = client.put(
            path,
            {
                "questions": [choice()],
                "presentation": "html",
                "sections": [{"part": 1, "html": html}],
            },
            format="json",
        )
        assert r.status_code == 400
    client.force_authenticate(student)
    assert client.post(
        f"/api/v1/materials/{m.pk}/question-html/",
        {"file": SimpleUploadedFile("paper.html", NATIVE_PAPER.encode())},
        format="multipart",
    ).status_code in (403, 404)
    client.force_authenticate(editor)
    assert client.post(
        f"/api/v1/materials/{m.pk}/question-html/",
        {"file": SimpleUploadedFile("paper.html", NATIVE_PAPER.encode())},
        format="multipart",
    ).status_code in (403, 404)
