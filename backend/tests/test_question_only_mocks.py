"""Question-only publication must preserve security, scoring and version history."""

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from exams.models import MockAttempt
from learning.models import Category, ListeningTest, Material
from learning.models import TestPart as ListeningPart

pytestmark = pytest.mark.django_db


@pytest.fixture
def paper():
    editor = User.objects.create_user(username="question_editor", role="teacher")
    student = User.objects.create_user(username="question_student")
    root = Category.objects.create(name="Original papers")
    volume = Category.objects.create(name="Volume", parent=root)
    material = Material.objects.create(
        title="Question only",
        owner=editor,
        category=volume,
        source="Original test fixture",
        license="CC0",
        rights_confirmed=True,
    )
    test = ListeningTest.objects.create(title="Test 1", owner=editor, category=volume)
    ListeningPart.objects.create(test=test, material=material, number=1)
    client = APIClient()
    client.force_authenticate(editor)
    group = {"numbers": [1, 2], "order_matters": False, "distinct": True}
    payload = {
        "questions": [
            {
                "number": n,
                "part": 1,
                "type": "short_answer",
                "prompt": "Choose a letter from A to D.",
                "max_words": 1,
                "answers": ["A", "C"],
                "context": {"answer_group": group},
            }
            for n in [1, 2]
        ],
        "duration_seconds": 60,
    }
    return client, editor, student, material, test, payload


def save_and_publish(paper):
    client, _, _, material, _, payload = paper
    r = client.put(
        f"/api/v1/materials/{material.pk}/questions/", payload, format="json"
    )
    assert r.status_code == 201, r.data
    r = client.post(
        f"/api/v1/materials/{material.pk}/publish-questions/",
        {"confirm_review": True},
        format="json",
    )
    assert r.status_code == 200, r.data
    assert r.data["practice_available"] is False
    return r


def test_question_only_paper_resume_score_and_private_keys(paper):
    client, _, student, m, test, _ = paper
    save_and_publish(paper)
    client.force_authenticate(student)
    r = client.get(f"/api/v1/listening-tests/{test.pk}/")
    assert r.status_code == 200
    assert r.data["parts"][0]["status"] == "published"
    assert r.data["parts"][0]["audio_available"] is False
    r = client.get(f"/api/v1/materials/{m.pk}/")
    assert r.status_code == 200 and r.data["audio"] is None
    assert r.data["segments"] == []
    r = client.post("/api/v1/mock-attempts/", {"material": m.pk, "timing": "untimed"})
    assert r.status_code == 201, r.data
    assert r.data["audio_available"] is False
    assert all("answers" not in q for q in r.data["questions"])
    pk = r.data["id"]
    assert MockAttempt.objects.get(pk=pk).version_id is None
    assert client.post(f"/api/v1/mock-attempts/{pk}/start-audio/").status_code == 400
    assert client.get(f"/api/v1/mock-attempts/{pk}/audio/").status_code == 403
    assert (
        client.post(
            "/api/v1/sessions/", {"material": m.pk, "difficulty": "easy"}
        ).status_code
        == 404
    )
    r = client.patch(
        f"/api/v1/mock-attempts/{pk}/", {"answers": {"1": "C", "2": "A"}}, format="json"
    )
    assert r.status_code == 200
    assert client.get(f"/api/v1/mock-attempts/{pk}/").data["answers"] == {
        "1": "C",
        "2": "A",
    }
    r = client.post(f"/api/v1/mock-attempts/{pk}/submit/")
    assert r.status_code == 200 and r.data["score"] == 2
    assert r.data["results"][0]["accepted_answers"] == ["A", "C"]


def test_question_only_publication_requires_review_rights_and_ownership(paper):
    client, _, student, m, _, payload = paper
    assert (
        client.put(
            f"/api/v1/materials/{m.pk}/questions/", payload, format="json"
        ).status_code
        == 201
    )
    assert (
        client.post(f"/api/v1/materials/{m.pk}/publish-questions/", {}).status_code
        == 400
    )
    m.rights_confirmed = False
    m.save()
    assert (
        client.post(
            f"/api/v1/materials/{m.pk}/publish-questions/",
            {"confirm_review": True},
            format="json",
        ).status_code
        == 400
    )
    outsider = User.objects.create_user(username="another_editor", role="teacher")
    for user in [student, outsider]:
        client.force_authenticate(user)
        assert client.post(
            f"/api/v1/materials/{m.pk}/publish-questions/",
            {"confirm_review": True},
            format="json",
        ).status_code in [403, 404]
    client.force_authenticate(student)
    assert client.get(f"/api/v1/materials/{m.pk}/").status_code == 404
    assert (
        client.post(
            "/api/v1/mock-attempts/", {"material": m.pk, "timing": "untimed"}
        ).status_code
        == 404
    )


def test_question_only_attempt_pins_old_paper_and_timed_expiry(paper):
    client, editor, student, m, _, payload = paper
    save_and_publish(paper)
    client.force_authenticate(student)
    r = client.post("/api/v1/mock-attempts/", {"material": m.pk, "timing": "timed"})
    assert r.status_code == 201, r.data
    attempt = MockAttempt.objects.get(pk=r.data["id"])
    old = attempt.question_set_id
    client.patch(
        f"/api/v1/mock-attempts/{attempt.pk}/",
        {"answers": {"1": "A", "2": "A"}},
        format="json",
    )
    client.force_authenticate(editor)
    payload["questions"][0]["prompt"] = "Revised question"
    save_and_publish(paper)
    m.refresh_from_db()
    assert m.published_questions_id != old
    attempt.deadline = timezone.now()
    attempt.save(update_fields=["deadline"])
    client.force_authenticate(student)
    r = client.get(f"/api/v1/mock-attempts/{attempt.pk}/")
    assert r.status_code == 200 and r.data["submitted_at"]
    assert r.data["score"] == 1
    assert r.data["questions"][0]["prompt"] == "Choose a letter from A to D."
    other = User.objects.create_user(username="other_student")
    client.force_authenticate(other)
    assert client.get(f"/api/v1/mock-attempts/{attempt.pk}/").status_code == 404


def test_full_question_only_assembly_is_idempotent_and_remaps_group_slots(paper):
    import copy

    from exams.models import QuestionSet
    from exams.serializers import QuestionSetInput
    from exams.services import publish_question_set, save_question_set
    from learning.test_assembly import publish_question_only_full

    client, editor, student, m, test, payload = paper
    save_and_publish(paper)
    with pytest.raises(Exception):
        publish_question_only_full(test.pk, student, True)
    with pytest.raises(Exception):
        publish_question_only_full(test.pk, editor, True)
    for part in [2, 3, 4]:
        target = Material.objects.create(
            title=f"Part {part}",
            category=m.category,
            owner=editor,
            source="Original",
            license="CC0",
            rights_confirmed=True,
        )
        ListeningPart.objects.create(test=test, material=target, number=part)
        data = copy.deepcopy(payload)
        for q in data["questions"]:
            q["part"] = part
        validator = QuestionSetInput(data=data)
        validator.is_valid(raise_exception=True)
        save_question_set(target, validator.validated_data, editor)
        publish_question_set(target, editor, True)
    full = publish_question_only_full(test.pk, editor, True)
    assert full.published_version_id is None
    assert full.published_questions.questions.count() == 8
    assert full.published_questions.audio_id is None
    count = QuestionSet.objects.count()
    assert publish_question_only_full(test.pk, editor, True).pk == full.pk
    assert QuestionSet.objects.count() == count
    client.force_authenticate(student)
    r = client.post(
        "/api/v1/mock-attempts/", {"material": full.pk, "timing": "untimed"}
    )
    assert r.status_code == 201, r.data
    assert [q["context"]["answer_group"]["numbers"] for q in r.data["questions"]][
        ::2
    ] == [[1, 2], [3, 4], [5, 6], [7, 8]]


def test_question_only_publication_preserves_numbered_part_slots(paper):
    client, _, student, material, _, payload = paper
    part = ListeningPart.objects.get(material=material)
    part.number = 4
    part.save(update_fields=["number"])
    for question in payload["questions"]:
        question["number"] += 30
        question["part"] = 4
        question["context"]["answer_group"]["numbers"] = [31, 32]
    save_and_publish(paper)
    client.force_authenticate(student)
    response = client.post(
        "/api/v1/mock-attempts/", {"material": material.pk, "timing": "untimed"}
    )
    assert response.status_code == 201, response.data
    assert [q["number"] for q in response.data["questions"]] == [31, 32]
    assert all(q["part"] == 4 for q in response.data["questions"])


def original_audio():
    import io
    import wave
    from django.core.files.uploadedfile import SimpleUploadedFile

    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as output:
        output.setparams((1, 2, 8000, 0, "NONE", "not compressed"))
        output.writeframes(b"\x00\x00" * 16000)
    return SimpleUploadedFile(
        "original.wav", buffer.getvalue(), content_type="audio/wav"
    )


def test_real_mock_audio_without_transcript_preserves_old_audio_free_attempt(
    paper, settings, tmp_path
):
    from exams.audio_import import attach_mock_audio
    from exams.models import QuestionSet
    from learning.models import AudioAsset

    settings.MEDIA_ROOT = tmp_path
    client, editor, student, material, _, _ = paper
    save_and_publish(paper)
    client.force_authenticate(student)
    old = client.post(
        "/api/v1/mock-attempts/", {"material": material.pk, "timing": "untimed"}
    )
    old_id = old.data["id"]
    client.post(f"/api/v1/mock-attempts/{old_id}/submit/")
    qs, created = attach_mock_audio(
        material.pk, original_audio(), editor, "original-fixture-1"
    )
    assert created and qs.audio_id
    assert not material.versions.exists()
    assert (
        client.get(f"/api/v1/mock-attempts/{old_id}/").data["audio_available"] is False
    )
    again, created = attach_mock_audio(
        material.pk, original_audio(), editor, "original-fixture-1"
    )
    assert not created and again.pk == qs.pk
    assert AudioAsset.objects.filter(material=material).count() == 1
    assert QuestionSet.objects.filter(material=material).count() == 2
    fresh = client.post(
        "/api/v1/mock-attempts/", {"material": material.pk, "timing": "untimed"}
    )
    assert fresh.status_code == 201 and fresh.data["audio_available"] is True
    pk = fresh.data["id"]
    assert MockAttempt.objects.get(pk=pk).version_id is None
    ticket = client.post(f"/api/v1/mock-attempts/{pk}/start-audio/")
    assert ticket.status_code == 200 and ticket.data["duration_ms"] == 2000
    media = client.get(
        f"/api/v1/mock-attempts/{pk}/audio/",
        HTTP_X_EXAM_AUDIO=ticket.data["ticket"],
        HTTP_RANGE="bytes=0-15",
    )
    assert media.status_code == 206
    assert len(b"".join(media.streaming_content)) == 16
    assert (
        client.post(
            "/api/v1/sessions/", {"material": material.pk, "difficulty": "easy"}
        ).status_code
        == 404
    )
    client.force_authenticate(student)
    with pytest.raises(Exception):
        attach_mock_audio(material.pk, original_audio(), student, "forbidden")
