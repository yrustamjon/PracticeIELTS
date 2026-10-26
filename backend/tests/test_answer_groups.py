import pytest
from django.utils import timezone

from exams.models import AnswerKey, MockAttempt, Question
from tests.test_exams import choice, exam_data, publish, start
from tests.test_test_hierarchy import add_part, book

__all__ = ["exam_data", "book"]

pytestmark = pytest.mark.django_db


def paired(kind="short_answer", grouped=True):
    qs = [choice(kind, n) for n in (1, 2)]
    for q in qs:
        q["answers"] = ["A", "C"]
        if grouped:
            q["context"]["answer_group"] = {
                "numbers": [1, 2],
                "order_matters": False,
                "distinct": True,
            }
    return qs


@pytest.mark.parametrize(
    "answers,expected",
    [
        ({"1": "A", "2": "C"}, [True, True]),
        ({"1": "C", "2": "A"}, [True, True]),
        ({"1": "A", "2": "B"}, [True, False]),
        ({"1": "A", "2": "A"}, [True, False]),
        ({"1": " a ", "2": "A"}, [True, False]),
        ({"1": "C", "2": "c"}, [True, False]),
        ({"1": "B", "2": "D"}, [False, False]),
        ({"2": "C"}, [False, True]),
    ],
)
@pytest.mark.parametrize("kind", ["short_answer", "multiple_choice"])
def test_pair_results_and_total(exam_data, answers, expected, kind):
    publish(exam_data, paired(kind))
    attempt = start(exam_data)
    client = exam_data[0]
    response = client.patch(
        f"/api/v1/mock-attempts/{attempt['id']}/", {"answers": answers}, format="json"
    )
    assert response.status_code == 200, response.data
    for _ in range(2):
        result = client.post(f"/api/v1/mock-attempts/{attempt['id']}/submit/").data
        assert result["score"] == sum(expected)
        assert [r["correct"] for r in result["results"]] == expected


def test_ungrouped_equal_answers_count_twice(exam_data):
    publish(exam_data, paired(grouped=False))
    attempt = start(exam_data)
    client = exam_data[0]
    client.patch(
        f"/api/v1/mock-attempts/{attempt['id']}/",
        {"answers": {"1": "A", "2": "A"}},
        format="json",
    )
    assert (
        client.post(f"/api/v1/mock-attempts/{attempt['id']}/submit/").data["score"] == 2
    )


@pytest.mark.parametrize(
    "case",
    [
        "missing",
        "duplicate",
        "boolean",
        "mismatch",
        "cross_part",
        "keys",
        "extra_keys",
        "text_keys",
        "ordered",
    ],
)
def test_invalid_group_rejected(exam_data, case):
    qs = paired()
    g = qs[0]["context"]["answer_group"]
    if case == "missing":
        g["numbers"] = [1, 3]
    if case == "duplicate":
        g["numbers"] = [1, 1]
    if case == "boolean":
        g["numbers"] = [True, 2]
    if case == "mismatch":
        qs[1]["context"] = {}
    if case == "cross_part":
        qs[1]["part"] = 2
    if case == "keys":
        qs[1]["answers"] = ["A", "B"]
    if case == "extra_keys":
        for q in qs:
            q["answers"] = ["A", "B", "C"]
    if case == "text_keys":
        for q in qs:
            q["answers"] = ["cat", "cats"]
    if case == "ordered":
        g["order_matters"] = True
    response = exam_data[0].put(
        f"/api/v1/materials/{exam_data[5].pk}/questions/",
        {"questions": qs},
        format="json",
    )
    assert response.status_code == 400


def test_legacy_submission_keeps_score_and_results(exam_data):
    qs = publish(exam_data, paired())
    attempt = MockAttempt.objects.create(
        user=exam_data[2],
        material=exam_data[5],
        version=exam_data[6],
        question_set=qs,
        timing="untimed",
        answers={"1": "A", "2": "A"},
        score=2,
        total=2,
        submitted_at=timezone.now(),
    )
    exam_data[0].force_authenticate(exam_data[2])
    result = exam_data[0].get(f"/api/v1/mock-attempts/{attempt.pk}/").data
    assert result["score"] == 2
    assert [r["correct"] for r in result["results"]] == [True, True]


def test_full_assembly_remaps_groups(book):
    from learning.test_assembly import build_full_test

    for n in range(1, 5):
        material = add_part(book, n)
        qs = material.published_questions
        first = qs.questions.get(number=1)
        first.context = {
            "answer_group": {
                "numbers": [1, 2],
                "order_matters": False,
                "distinct": True,
            }
        }
        first.save()
        first.answer_key.accepted_answers = ["A", "C"]
        first.answer_key.save()
        second = Question.objects.create(
            question_set=qs,
            number=2,
            part=n,
            type="short_answer",
            prompt="Second letter",
            context=first.context,
        )
        AnswerKey.objects.create(question=second, accepted_answers=["A", "C"])
    test = book[2]
    test.assembly_state = "queued"
    test.save()
    build_full_test(test.pk)
    test.refresh_from_db()
    assert test.assembly_state == "ready", test.assembly_error
    questions = list(
        test.full_material.published_questions.questions.select_related("answer_key")
    )
    assert [q.context["answer_group"]["numbers"] for q in questions] == [
        [1, 2],
        [1, 2],
        [3, 4],
        [3, 4],
        [5, 6],
        [5, 6],
        [7, 8],
        [7, 8],
    ]
    from exams.services import score_questions

    assert (
        sum(
            score_questions(questions, {str(q.number): "A" for q in questions}).values()
        )
        == 4
    )
