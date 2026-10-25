import io
import wave
from unittest.mock import patch

import pytest
from django.core.files.base import ContentFile
from django.utils import timezone
from pypdf import PdfReader
from rest_framework.test import APIClient

from accounts.models import User
from exams.models import AnswerKey, Question, QuestionDocument, QuestionSet
from learning.models import (
    AudioAsset,
    Category,
    ListeningTest,
    Material,
    Segment,
    TranscriptVersion,
)
from learning.models import TestPart as ListeningPart
from learning.test_assembly import build_full_test, queue_assembly
from tests.test_exams import original_pdf

pytestmark = pytest.mark.django_db


@pytest.fixture
def book(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    teacher = User.objects.create_user(username="hierarchy-teacher", role="teacher")
    student = User.objects.create_user(username="hierarchy-student")
    source = Category.objects.create(name="Original collection")
    category = Category.objects.create(name="Original book", parent=source)
    test = ListeningTest.objects.create(
        title="Test 1", category=category, owner=teacher
    )
    return teacher, student, test


def recording():
    out = io.BytesIO()
    with wave.open(out, "wb") as w:
        w.setparams((1, 2, 16000, 0, "NONE", "not compressed"))
        w.writeframes(b"\0\0" * 16000)
    return out.getvalue()


def add_part(book, n, presentation="text", publish=True):
    owner, _, test = book
    m = Material.objects.create(
        title=f"Part {n}",
        category=test.category,
        owner=owner,
        source="Original",
        license="Author permission",
        rights_confirmed=True,
    )
    a = AudioAsset.objects.create(
        material=m,
        file=ContentFile(recording(), name="part.wav"),
        duration_ms=1000,
        mime_type="audio/wav",
        size=len(recording()),
    )
    v = TranscriptVersion.objects.create(
        material=m, audio=a, published_at=timezone.now() if publish else None
    )
    Segment.objects.create(
        version=v,
        position=0,
        text="The door is open.",
        start_ms=0,
        end_ms=900,
        words=[{"word": "door", "start_ms": 200, "end_ms": 400}],
    )
    doc = None
    if presentation == "pdf":
        doc = QuestionDocument.objects.create(
            material=m, file=original_pdf(), page_count=2
        )
    qs = QuestionSet.objects.create(
        material=m,
        audio=a,
        document=doc,
        document_pages=[1] if doc else [],
        presentation=presentation,
        sections=[{"part": n, "html": "<p>Door: {{1}}</p>"}]
        if presentation == "html"
        else [],
        published_at=timezone.now() if publish else None,
    )
    q = Question.objects.create(
        question_set=qs,
        number=1,
        part=n,
        type="short_answer",
        prompt="The door is ____.",
        context={
            "pdf_field": {"page": 1, "x": 0.2, "y": 0.3, "width": 0.2, "height": 0.03}
        }
        if doc
        else {},
    )
    AnswerKey.objects.create(question=q, accepted_answers=["open"])
    if publish:
        m.published_version = v
        m.published_questions = qs
        m.save()
    ListeningPart.objects.create(test=test, number=n, material=m)
    return m


def client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def test_hierarchy_visibility_and_editor_ownership(book):
    teacher, student, test = book
    other = User.objects.create_user(username="other-editor", role="teacher")
    draft = add_part(book, 1, publish=False)
    c = client(student)
    assert c.get("/api/v1/listening-tests/").data["count"] == 0
    assert (
        c.post(
            "/api/v1/listening-tests/", {"title": "X", "category": test.category_id}
        ).status_code
        == 403
    )
    draft.published_version = draft.versions.first()
    draft.save()
    response = c.get(f"/api/v1/listening-tests/{test.pk}/")
    assert response.status_code == 200 and len(response.data["parts"]) == 1
    add_part(book, 2, publish=False)
    assert len(c.get(f"/api/v1/listening-tests/{test.pk}/").data["parts"]) == 1
    assert (
        client(other)
        .post(f"/api/v1/listening-tests/{test.pk}/parts/", {"number": 3})
        .status_code
        == 403
    )
    assert (
        client(other)
        .patch(f"/api/v1/listening-tests/{test.pk}/", {"title": "stolen"})
        .status_code
        == 403
    )
    own = client(teacher)
    assert (
        own.post(f"/api/v1/listening-tests/{test.pk}/parts/", {"number": 5}).status_code
        == 400
    )
    for _ in range(2):
        assert (
            own.post(
                f"/api/v1/listening-tests/{test.pk}/parts/", {"number": 3}
            ).status_code
            == 200
        )
    assert test.parts.filter(number=3).count() == 1
    assert own.get("/api/v1/materials/?standalone=true").data["count"] == 0


@pytest.mark.parametrize("presentation", ["text", "html", "pdf"])
def test_full_test_builds_real_audio_versions_questions_and_private_pages(
    book, presentation
):
    for n in range(1, 5):
        add_part(book, n, presentation)
    test = book[2]
    build_full_test(test.pk)
    test.refresh_from_db()
    assert test.assembly_state == "ready", test.assembly_error
    full = test.full_material
    assert full.published_version.audio.duration_ms == 4000
    with full.published_version.audio.file.open("rb") as f:
        with wave.open(f) as w:
            assert w.getnframes() == 64000
    segments = list(full.published_version.segments.all())
    assert [s.start_ms for s in segments] == [0, 1000, 2000, 3000]
    assert segments[3].words[0]["start_ms"] == 3200
    qs = full.published_questions
    assert list(qs.questions.values_list("number", "part")) == [
        (1, 1),
        (2, 2),
        (3, 3),
        (4, 4),
    ]
    if presentation == "html":
        assert qs.sections[3] == {"part": 4, "html": "<p>Door: {{4}}</p>"}
    if presentation == "pdf":
        assert qs.document.page_count == 4
        with qs.document.file.open("rb") as f:
            reader = PdfReader(f)
            assert len(reader.pages) == 4
            assert all(
                "Private answer key" not in p.extract_text() for p in reader.pages
            )
        assert [q.context["pdf_field"]["page"] for q in qs.questions.all()] == [
            1,
            2,
            3,
            4,
        ]
    version = full.published_version_id
    opened = client(book[0]).post(f"/api/v1/listening-tests/{test.pk}/full-recording/")
    assert opened.status_code == 200 and opened.data["full_source"] == "assembled"
    test.refresh_from_db()
    assert test.assembly_signature
    build_full_test(test.pk)
    test.refresh_from_db()
    assert test.full_material.published_version_id == version
    c = client(book[1])
    attempt = c.post("/api/v1/mock-attempts/", {"material": full.pk, "timing": "timed"})
    assert attempt.status_code == 201
    assert len(attempt.data["questions"]) == 4
    assert all("answers" not in q for q in attempt.data["questions"])
    part = test.parts.first().material
    assert c.get(f"/api/v1/materials/{part.pk}/").status_code == 403
    assert (
        c.get(f"/api/v1/audio/{part.published_version.audio_id}/stream/").status_code
        == 403
    )
    if presentation == "pdf":
        assert (
            c.get(
                f"/api/v1/mock-attempts/{attempt.data['id']}/pdf-pages/5/"
            ).status_code
            == 403
        )
    c.patch(
        f"/api/v1/mock-attempts/{attempt.data['id']}/",
        {"answers": {str(n): "open" for n in range(1, 5)}},
        format="json",
    )
    scored = c.post(f"/api/v1/mock-attempts/{attempt.data['id']}/submit/")
    assert scored.data["score"] == 4
    # Rebuilding creates a new publication; an old attempt retains its own audio/set.
    latest = TranscriptVersion.objects.create(
        material=part, audio=part.published_version.audio, published_at=timezone.now()
    )
    Segment.objects.create(
        version=latest, position=0, text="A different sentence.", start_ms=0, end_ms=900
    )
    part.published_version = latest
    part.save()
    build_full_test(test.pk)
    test.refresh_from_db()
    assert test.full_material.published_version_id != version
    assert c.get(f"/api/v1/mock-attempts/{attempt.data['id']}/").data["score"] == 4


def test_worker_failure_is_visible_and_incomplete_tests_do_not_queue(book):
    test = book[2]
    with patch("learning.tasks.assemble_listening_test.delay") as delay:
        queue_assembly(test.pk)
        delay.assert_not_called()
        for n in range(1, 5):
            add_part(book, n)
        delay.side_effect = ConnectionError("unavailable")
        queue_assembly(test.pk)
    test.refresh_from_db()
    assert test.assembly_state == "failed" and "worker" in test.assembly_error


def test_explicit_retry_recovers_a_queued_full_test(book):
    for number in range(1, 5):
        add_part(book, number)
    test = book[2]
    test.assembly_state = "queued"
    test.save()
    with patch(
        "learning.tasks.assemble_listening_test.delay", side_effect=build_full_test
    ):
        response = client(book[0]).post(f"/api/v1/listening-tests/{test.pk}/assemble/")
    assert response.status_code == 200
    test.refresh_from_db()
    assert test.assembly_state == "ready"
    assert test.full_material.published_questions.questions.count() == 4


def test_untimed_part_and_full_attempts_can_be_open_together(book):
    parts = [add_part(book, number) for number in range(1, 5)]
    build_full_test(book[2].pk)
    book[2].refresh_from_db()
    learner = client(book[1])
    for material in [parts[0], parts[1], book[2].full_material]:
        response = learner.post(
            "/api/v1/mock-attempts/", {"material": material.pk, "timing": "untimed"}
        )
        assert response.status_code == 201
    assert learner.get(f"/api/v1/materials/{parts[0].pk}/").status_code == 200


def test_timed_attempt_blocks_resuming_an_existing_untimed_sibling(book):
    first = add_part(book, 1, presentation="pdf")
    second = add_part(book, 2)
    learner = client(book[1])
    untimed = learner.post(
        "/api/v1/mock-attempts/", {"material": first.pk, "timing": "untimed"}
    )
    assert untimed.status_code == 201
    timed = learner.post(
        "/api/v1/mock-attempts/", {"material": second.pk, "timing": "timed"}
    )
    assert timed.status_code == 201
    path = f"/api/v1/mock-attempts/{untimed.data['id']}/"
    assert learner.get(path).status_code == 403
    assert learner.post(path + "start-audio/").status_code == 403
    assert learner.post(
        "/api/v1/mock-attempts/",
        {"material": first.pk, "timing": "untimed", "restart": True},
    ).status_code in (400, 403)
    from exams.models import MockAttempt

    assert MockAttempt.objects.get(pk=untimed.data["id"]).submitted_at is None
    assert learner.get(path + "pdf-pages/1/").status_code == 403
    assert (
        learner.patch(path, {"answers": {"1": "open"}}, format="json").status_code
        == 403
    )
    assert learner.post(
        "/api/v1/mock-attempts/", {"material": first.pk, "timing": "untimed"}
    ).status_code in (400, 403)
    learner.post(f"/api/v1/mock-attempts/{timed.data['id']}/submit/")
    assert learner.get(path).status_code == 200


def test_timed_attempt_hides_blocked_sibling_answers_and_history(book):
    first = add_part(book, 1, presentation="pdf")
    second = add_part(book, 2)
    learner = client(book[1])
    old = learner.post(
        "/api/v1/mock-attempts/", {"material": first.pk, "timing": "timed"}
    ).data
    learner.patch(
        f"/api/v1/mock-attempts/{old['id']}/", {"answers": {"1": "open"}}, format="json"
    )
    learner.post(f"/api/v1/mock-attempts/{old['id']}/submit/")
    untimed = learner.post(
        "/api/v1/mock-attempts/", {"material": first.pk, "timing": "untimed"}
    ).data
    learner.patch(
        f"/api/v1/mock-attempts/{untimed['id']}/",
        {"answers": {"1": "private-saved-answer"}},
        format="json",
    )
    timed = learner.post(
        "/api/v1/mock-attempts/", {"material": second.pk, "timing": "timed"}
    ).data
    listing = learner.get("/api/v1/mock-attempts/").data
    assert [attempt["id"] for attempt in listing["results"]] == [timed["id"]]
    assert "private-saved-answer" not in str(listing)
    assert learner.get(f"/api/v1/mock-attempts/{old['id']}/").status_code == 403
    assert (
        learner.get(f"/api/v1/mock-attempts/{old['id']}/pdf-pages/1/").status_code
        == 403
    )
    learner.post(f"/api/v1/mock-attempts/{timed['id']}/submit/")
    assert learner.get(f"/api/v1/mock-attempts/{old['id']}/").status_code == 200


def test_retry_does_not_rebuild_an_unchanged_ready_full_test(book):
    for number in range(1, 5):
        add_part(book, number)
    test = book[2]
    build_full_test(test.pk)
    test.refresh_from_db()
    version = test.full_material.published_version_id
    with patch(
        "learning.tasks.assemble_listening_test.delay", side_effect=build_full_test
    ):
        queue_assembly(test.pk, retry=True)
    test.refresh_from_db()
    assert test.assembly_state == "ready"
    assert test.full_material.published_version_id == version


def test_part_authoring_accepts_real_ielts_numbering_without_rewriting_history(book):
    material = add_part(book, 2)
    old = material.published_questions_id
    c = client(book[0])
    payload = {
        "presentation": "text",
        "questions": [
            {
                "number": 11,
                "part": 1,
                "type": "short_answer",
                "prompt": "The door is ____.",
                "max_words": 1,
                "answers": ["open"],
            }
        ],
    }
    response = c.put(
        f"/api/v1/materials/{material.pk}/questions/", payload, format="json"
    )
    assert response.status_code == 201
    assert response.data["questions"][0]["number"] == 11
    assert response.data["questions"][0]["part"] == 2
    assert QuestionSet.objects.get(pk=old).questions.get().number == 1
    assert (
        c.post(
            f"/api/v1/materials/{material.pk}/publish/",
            {"confirm_review": True},
            format="json",
        ).status_code
        == 200
    )
    learner = client(book[1])
    attempt = learner.post(
        "/api/v1/mock-attempts/", {"material": material.pk, "timing": "untimed"}
    )
    assert attempt.status_code == 201
    assert attempt.data["questions"][0]["number"] == 11
    learner.patch(
        f"/api/v1/mock-attempts/{attempt.data['id']}/",
        {"answers": {"11": "open"}},
        format="json",
    )
    assert (
        learner.post(f"/api/v1/mock-attempts/{attempt.data['id']}/submit/").data[
            "score"
        ]
        == 1
    )
    payload["questions"][0]["number"] = 12
    assert (
        c.put(
            f"/api/v1/materials/{material.pk}/questions/", payload, format="json"
        ).status_code
        == 400
    )


def test_direct_full_recording_is_editable_and_not_overwritten_by_part_publications(
    book,
):
    for n in range(1, 5):
        add_part(book, n)
    _, student, test = book
    assert (
        client(student)
        .post(f"/api/v1/listening-tests/{test.pk}/full-recording/")
        .status_code
        == 403
    )
    c = client(book[0])
    response = c.post(f"/api/v1/listening-tests/{test.pk}/full-recording/")
    assert response.status_code == 200 and response.data["full_source"] == "upload"
    m = Material.objects.get(pk=response.data["full"]["id"])
    m.source = "Original full recording"
    m.license = "Author permission"
    m.rights_confirmed = True
    m.save()
    AudioAsset.objects.create(
        material=m,
        file=ContentFile(recording(), name="full-upload.wav"),
        duration_ms=1000,
        mime_type="audio/wav",
        size=len(recording()),
    )
    assert (
        c.put(
            f"/api/v1/materials/{m.pk}/transcript/",
            {
                "segments": [
                    {
                        "text": "The door is open.",
                        "speaker": "",
                        "start_ms": 0,
                        "end_ms": 900,
                    }
                ]
            },
            format="json",
        ).status_code
        == 201
    )
    assert (
        c.post(
            f"/api/v1/materials/{m.pk}/publish/",
            {"confirm_review": True},
            format="json",
        ).status_code
        == 200
    )
    m.refresh_from_db()
    version = m.published_version_id
    with patch("learning.tasks.assemble_listening_test.delay") as delay:
        queue_assembly(test.pk)
        delay.assert_not_called()
    build_full_test(test.pk)
    m.refresh_from_db()
    assert m.published_version_id == version
    with patch("learning.tasks.assemble_listening_test.delay") as delay:
        assert c.post(f"/api/v1/listening-tests/{test.pk}/assemble/").status_code == 200
        delay.assert_called_once_with(test.pk)
    build_full_test(test.pk)
    test.refresh_from_db()
    m.refresh_from_db()
    assert test.assembly_state == "ready"
    assert test.assembly_signature
    assert m.published_version_id != version


def test_assembly_error_preserves_previous_publication_and_has_plain_editor_message(
    book,
):
    for n in range(1, 5):
        add_part(book, n)
    test = book[2]
    build_full_test(test.pk)
    test.refresh_from_db()
    original_version = test.full_material.published_version_id
    original_audio = test.full_material.published_version.audio.file.name
    part = test.parts.get(number=3).material
    replacement = QuestionSet.objects.create(
        material=part,
        audio=part.published_version.audio,
        presentation="html",
        sections=[{"part": 3, "html": "<p>The door is {{1}}</p>"}],
        published_at=timezone.now(),
    )
    question = Question.objects.create(
        question_set=replacement,
        number=1,
        part=3,
        type="short_answer",
        prompt="The door is ____.",
    )
    AnswerKey.objects.create(question=question, accepted_answers=["open"])
    part.published_questions = replacement
    part.save()
    build_full_test(test.pk)
    test.refresh_from_db()
    assert test.assembly_state == "failed"
    assert "same question presentation" in test.assembly_error
    assert "ErrorDetail" not in test.assembly_error
    assert test.full_material.published_version_id == original_version
    assert test.full_material.versions.count() == 1
    assert test.full_material.published_version.audio.file.storage.exists(
        original_audio
    )


def test_new_tests_require_a_volume_and_cannot_be_created_at_book_level(book):
    teacher, _, test = book
    c = client(teacher)
    root = test.category.parent
    response = c.post(
        "/api/v1/listening-tests/", {"title": "Wrong level", "category": root.pk}
    )
    assert response.status_code == 400
    assert "volume" in str(response.data["category"]).lower()
    assert not ListeningTest.objects.filter(title="Wrong level").exists()
    created = c.post(
        "/api/v1/listening-tests/", {"title": "Test 2", "category": test.category_id}
    )
    assert created.status_code == 201
    assert created.data["category"] == test.category_id
    assert (
        c.patch(
            f"/api/v1/listening-tests/{created.data['id']}/", {"category": root.pk}
        ).status_code
        == 400
    )


def test_existing_root_test_can_move_to_a_volume_without_losing_part_or_session_history(
    book,
):
    teacher, student, target = book
    legacy = ListeningTest.objects.create(
        title="Existing root test", category=target.category.parent, owner=teacher
    )
    material = add_part((teacher, student, legacy), 1)
    c = client(student)
    session = c.post(
        "/api/v1/sessions/", {"material": material.pk, "difficulty": "easy"}
    )
    assert session.status_code == 200
    sid = session.data["id"]
    c.patch(
        f"/api/v1/sessions/{sid}/",
        {"draft": "Saved before moving", "position": 0},
        format="json",
    )
    version = material.published_version_id
    part_id = legacy.parts.get().pk
    response = client(teacher).patch(
        f"/api/v1/listening-tests/{legacy.pk}/", {"category": target.category_id}
    )
    assert response.status_code == 200
    material.refresh_from_db()
    legacy.refresh_from_db()
    assert material.category_id == target.category_id
    assert legacy.category_id == target.category_id
    assert legacy.parts.get().pk == part_id
    assert material.published_version_id == version
    saved = c.get(f"/api/v1/sessions/{sid}/")
    assert saved.status_code == 200
    assert saved.data["drafts"]["0"] == "Saved before moving"
    assert saved.data["version"] == version
