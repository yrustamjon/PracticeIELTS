from copy import deepcopy
from datetime import timedelta

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone

from reading.models import ReadingFullAttempt, ReadingPaper, ReadingVersion
from reading.serializers import VersionInput
from tests.test_reading import reading  # noqa: F401

pytestmark = pytest.mark.django_db


@pytest.fixture
def full(reading):  # noqa: F811
    client, teacher, student, other, original, payload = reading
    source = ReadingVersion.objects.get(pk=original["version"]["id"]).source.name
    papers = []
    for passage, start, end in [(1, 1, 13), (2, 14, 26), (3, 27, 40)]:
        paper, _ = ReadingPaper.objects.get_or_create(
            owner=teacher, book="Original", test=1, passage=passage
        )
        version = deepcopy(payload)
        version["content"]["title"] = f"Original passage {passage}"
        version["content"]["groups"] = [
            {
                "title": f"Questions {start}–{end}",
                "instructions": "ONE WORD ONLY.",
                "kind": "short_answer",
                "questions": [
                    {"number": n, "prompt": f"Fixture question {n}"}
                    for n in range(start, end + 1)
                ],
            }
        ]
        version["keys"] = {str(n): ["shelter"] for n in range(start, end + 1)}
        validator = VersionInput(data=version)
        validator.is_valid(raise_exception=True)
        paper.published_version = ReadingVersion.objects.create(
            paper=paper,
            source=source,
            published_at=timezone.now(),
            reviewed_by=teacher,
            **validator.validated_data,
        )
        paper.save(update_fields=["published_version"])
        papers.append(paper)
    client.force_authenticate(student)
    return client, teacher, student, other, papers


def start(full, timed=True):
    c, _, _, _, papers = full
    response = c.post(
        "/api/v1/reading-full-attempts/",
        {"paper": papers[2].pk, "timed": timed},
        format="json",
    )
    assert response.status_code == 201, response.data
    return response.data


def test_full_summaries_owned_private_and_timed_history_guard(full):
    c, _, student, other, _ = full
    old = start(full, timed=False)
    c.post(f"/api/v1/reading-full-attempts/{old['id']}/submit/")
    active = start(full)
    response = c.get("/api/v1/reading-full-attempts/")
    assert response.status_code == 200
    rows = response.data["results"]
    assert [r["id"] for r in rows] == [active["id"]]
    assert rows[0]["total"] == 40 and rows[0]["timed"] is True
    assert not {"answers", "results", "version", "passages", "keys"} & rows[0].keys()
    c.force_authenticate(other)
    assert c.get("/api/v1/reading-full-attempts/").data["results"] == []
    c.force_authenticate(student)
    a = ReadingFullAttempt.objects.get(pk=active["id"])
    a.deadline = timezone.now() - timedelta(seconds=1)
    a.save(update_fields=["deadline"])
    rows = c.get("/api/v1/reading-full-attempts/").data["results"]
    assert len(rows) == 2 and all(r["submitted_at"] for r in rows)
    a.refresh_from_db()
    assert a.submitted_at and a.score == 0


def test_full_requires_complete_ordered_reviewed_publications(full):
    c, _, _, _, papers = full
    papers[2].published_version = None
    papers[2].save()
    assert (
        c.post(
            "/api/v1/reading-full-attempts/", {"paper": papers[0].pk}, format="json"
        ).status_code
        == 400
    )
    version = papers[2].versions.first()
    version.content["groups"][0]["questions"][0]["number"] = 26
    version.save()
    papers[2].published_version = version
    papers[2].save()
    assert (
        c.post(
            "/api/v1/reading-full-attempts/", {"paper": papers[0].pk}, format="json"
        ).status_code
        == 400
    )


def test_full_resume_partial_save_ownership_scoring_and_version_pins(full):
    c, teacher, student, other, papers = full
    a = start(full, timed=False)
    url = f"/api/v1/reading-full-attempts/{a['id']}/"
    assert len(a["passages"]) == 3 and a["total"] == 40 and a["deadline"] is None
    assert "results" not in a
    for p in a["passages"]:
        assert "keys" not in p["version"] and "source_pages" not in p["version"]
    assert c.patch(url, {"answers": {"41": "x"}}, format="json").status_code == 400
    assert (
        c.patch(
            url,
            {"answers": {"1": "shelter", "14": "shelter", "40": "incorrect"}},
            format="json",
        ).status_code
        == 200
    )
    assert (
        c.post(
            "/api/v1/reading-full-attempts/",
            {"paper": papers[0].pk, "timed": False},
            format="json",
        ).data["id"]
        == a["id"]
    )
    assert c.get(url).data["answers"]["14"] == "shelter"
    c.force_authenticate(other)
    assert c.get(url).status_code == 404
    assert c.patch(url, {"answers": {"1": "x"}}, format="json").status_code == 404
    assert c.post(url + "submit/").status_code == 404
    old = papers[0].published_version
    revised = ReadingVersion.objects.get(pk=old.pk)
    revised.pk = None
    revised.keys = dict(revised.keys, **{"1": ["changed"]})
    revised.save()
    papers[0].published_version = revised
    papers[0].save()
    c.force_authenticate(student)
    result = c.post(url + "submit/")
    assert result.data["score"] == 2 and len(result.data["results"]) == 40
    assert result.data["passages"][0]["version"]["id"] == old.pk
    assert result.data["results"][0]["accepted_answers"] == ["shelter"]
    assert c.post(url + "submit/").data["score"] == 2
    assert c.patch(url, {"answers": {"1": "changed"}}, format="json").status_code == 400
    new = start(full, timed=False)
    assert new["id"] != a["id"] and new["passages"][0]["version"]["id"] == revised.pk


@pytest.mark.parametrize("trigger", ["get", "patch", "submit"])
def test_full_deadline_is_server_enforced_and_late_answers_do_not_score(full, trigger):
    c, _, _, _, _ = full
    a = start(full)
    url = f"/api/v1/reading-full-attempts/{a['id']}/"
    assert c.patch(url, {"answers": {"1": "shelter"}}, format="json").status_code == 200
    deadline = timezone.now() - timedelta(seconds=2)
    ReadingFullAttempt.objects.filter(pk=a["id"]).update(deadline=deadline)
    if trigger == "get":
        c.get(url)
    elif trigger == "submit":
        c.post(url + "submit/")
    else:
        r = c.patch(url, {"answers": {"14": "shelter"}}, format="json")
        assert r.status_code == 400
    saved = ReadingFullAttempt.objects.get(pk=a["id"])
    assert saved.score == 1 and saved.submitted_at == deadline
    assert saved.answers == {"1": "shelter"}
    assert c.get(url).data["score"] == 1


def test_full_timed_mode_blocks_sibling_practice_and_results(full):
    c, _, _, _, papers = full
    practice = c.post("/api/v1/reading-attempts/", {"paper": papers[0].pk}).data
    untimed = start(full, timed=False)
    timed = start(full)
    assert c.get(f"/api/v1/reading-attempts/{practice['id']}/").status_code == 404
    assert (
        c.post("/api/v1/reading-attempts/", {"paper": papers[1].pk}).status_code == 403
    )
    assert c.get(f"/api/v1/reading-full-attempts/{untimed['id']}/").status_code == 403
    assert (
        c.post(f"/api/v1/reading-full-attempts/{timed['id']}/submit/").status_code
        == 200
    )
    assert c.get(f"/api/v1/reading-attempts/{practice['id']}/").status_code == 200
    assert c.get(f"/api/v1/reading-full-attempts/{untimed['id']}/").status_code == 200


def test_full_database_constraints_and_catalogue_readiness(full):
    c, teacher, student, _, papers = full
    catalogue = c.get("/api/v1/reading-papers/").data["results"]
    assert all(p["full_available"] for p in catalogue)
    a = start(full)
    saved = ReadingFullAttempt.objects.get(pk=a["id"])
    saved.pk = None
    with pytest.raises(IntegrityError), transaction.atomic():
        saved.save()
    saved.timed = False
    with pytest.raises(IntegrityError), transaction.atomic():
        saved.save()
    papers[2].published_version = None
    papers[2].save()
    catalogue = c.get("/api/v1/reading-papers/").data["results"]
    assert not any(p["full_available"] for p in catalogue)


def test_timed_full_hides_earlier_submitted_results_and_editor_review(full):
    c, teacher, student, _, papers = full
    old = start(full)
    old_url = f"/api/v1/reading-full-attempts/{old['id']}/"
    assert c.post(old_url + "submit/").status_code == 200
    practice = c.post("/api/v1/reading-attempts/", {"paper": papers[0].pk}).data
    practice_url = f"/api/v1/reading-attempts/{practice['id']}/"
    assert c.post(practice_url + "submit/").status_code == 200
    current = start(full)
    for method in ["get", "patch", "post"]:
        target = old_url + "submit/" if method == "post" else old_url
        assert getattr(c, method)(target).status_code == 403
    assert c.get(practice_url).status_code == 404
    assert c.get("/api/v1/reading-attempts/").data["results"] == []
    assert c.get(f"/api/v1/reading-papers/{papers[0].pk}/").status_code == 403
    assert (
        c.post(f"/api/v1/reading-full-attempts/{current['id']}/submit/").status_code
        == 200
    )
    assert c.get(old_url).status_code == 200
    assert c.get(practice_url).status_code == 200
    # Editors taking their own exam must not retrieve private keys via review.
    c.force_authenticate(teacher)
    editor_attempt = start(full)
    paper = papers[0]
    assert c.get(f"/api/v1/reading-papers/{paper.pk}/").status_code == 403
    page = paper.published_version.source_pages[0]
    assert (
        c.get(
            f"/api/v1/reading-papers/{paper.pk}/source-pages/{page}/?version={paper.published_version_id}"
        ).status_code
        == 403
    )
    assert (
        c.post(
            f"/api/v1/reading-full-attempts/{editor_attempt['id']}/submit/"
        ).status_code
        == 200
    )
    assert c.get(f"/api/v1/reading-papers/{paper.pk}/").status_code == 200


@pytest.mark.parametrize("full_mode", [False, True])
@pytest.mark.parametrize(
    ("answers", "expected"),
    [
        ({"1": "A", "2": "C"}, 2),
        ({"1": "C", "2": "A"}, 2),
        ({"1": "A", "2": "A"}, 1),
        ({"1": "", "2": "C"}, 1),
        ({"1": "B", "2": "B"}, 0),
    ],
)
def test_unordered_distinct_answers_score_once_in_passage_and_full(
    full, full_mode, answers, expected
):
    c, _, _, _, papers = full
    old = papers[0].published_version
    payload = {
        "content": deepcopy(old.content),
        "keys": deepcopy(old.keys),
        "source_name": old.source_name,
        "license": old.license,
        "rights_confirmed": old.rights_confirmed,
        "source_pages": old.source_pages,
        "key_pages": old.key_pages,
        "review_notes": old.review_notes,
    }
    original = payload["content"]["groups"][0]
    original["questions"] = original["questions"][2:]
    payload["content"]["groups"].insert(
        0,
        {
            "title": "Questions 1–2",
            "kind": "multiple_choice",
            "text": "Which TWO features were found?",
            "instructions": "Choose TWO letters in either order.",
            "options": ["A", "B", "C"],
            "option_labels": {"A": "A roof", "B": "A bell", "C": "A wall"},
            "questions": [{"number": 1}, {"number": 2}],
        },
    )
    payload["keys"].update({"1": ["A", "C"], "2": ["A", "C"]})
    validator = VersionInput(data=payload)
    assert validator.is_valid(), validator.errors
    revised = ReadingVersion.objects.create(
        paper=papers[0],
        source=old.source.name,
        published_at=timezone.now(),
        reviewed_by=old.reviewed_by,
        **validator.validated_data,
    )
    papers[0].published_version = revised
    papers[0].save(update_fields=["published_version"])
    endpoint = "reading-full-attempts" if full_mode else "reading-attempts"
    r = c.post(
        f"/api/v1/{endpoint}/", {"paper": papers[0].pk, "timed": False}, format="json"
    )
    assert r.status_code == 201
    assert "results" not in r.data
    url = f"/api/v1/{endpoint}/{r.data['id']}/"
    assert c.patch(url, {"answers": {"1": "Z"}}, format="json").status_code == 400
    assert c.patch(url, {"answers": answers}, format="json").status_code == 200
    assert c.get(url).data["answers"] == answers
    result = c.post(url + "submit/")
    assert result.data["score"] == expected
    assert sum(row["correct"] for row in result.data["results"][:2]) == expected
    assert c.post(url + "submit/").data["score"] == expected
    assert c.patch(url, {"answers": {"1": "C"}}, format="json").status_code == 400
    for invalid in [
        {"1": ["A", "A"], "2": ["A", "A"]},
        {"1": ["A", "C"], "2": ["A", "B"]},
        {"1": ["A"], "2": ["A"]},
    ]:
        payload["keys"].update(invalid)
        assert not VersionInput(data=payload).is_valid()


@pytest.mark.parametrize("full_mode", [False, True])
@pytest.mark.parametrize("answers,expected", [
    ({"1": "SNOW", "2": "rain"}, 2),
    ({"1": "rain", "2": " RAIN! "}, 1),
    ({"1": "rain rain", "2": "snow"}, 1),
])
def test_source_unordered_text_slots_keep_word_limits_and_score_once(
    full, full_mode, answers, expected
):
    c, _, _, _, papers = full
    old = papers[0].published_version
    payload = {name: deepcopy(getattr(old, name)) for name in [
        "content", "keys", "source_name", "license", "rights_confirmed",
        "source_pages", "key_pages", "review_notes",
    ]}
    payload["content"]["groups"][0]["questions"] = payload["content"]["groups"][0]["questions"][2:]
    group = {
        "title": "Original unordered note blanks", "kind": "completion",
        "instructions": "ONE WORD ONLY.", "text": "Weather: {{1}} and {{2}}.",
        "questions": [{"number": 1}, {"number": 2}], "unordered_sets": [[1, 2]],
    }
    payload["content"]["groups"].insert(0, group)
    payload["keys"].update({"1": ["rain", "snow"], "2": ["rain", "snow"]})
    validator = VersionInput(data=payload)
    assert validator.is_valid(), validator.errors
    revised = ReadingVersion.objects.create(
        paper=papers[0], source=old.source.name, published_at=timezone.now(),
        reviewed_by=old.reviewed_by, **validator.validated_data,
    )
    papers[0].published_version = revised
    papers[0].save(update_fields=["published_version"])
    endpoint = "reading-full-attempts" if full_mode else "reading-attempts"
    a = c.post(f"/api/v1/{endpoint}/", {"paper": papers[0].pk, "timed": False}, format="json").data
    url = f"/api/v1/{endpoint}/{a['id']}/"
    assert c.patch(url, {"answers": answers}, format="json").status_code == 200
    submitted = c.post(url + "submit/")
    assert submitted.data["score"] == expected
    assert sum(r["correct"] for r in submitted.data["results"][:2]) == expected
    assert c.post(url + "submit/").data["score"] == expected
    old.refresh_from_db()
    assert not any(g.get("unordered_sets") for g in old.content["groups"])
    for invalid in [[[1, 1]], [[1, 3]], [[1, 2], [1, 2]]]:
        group["unordered_sets"] = invalid
        assert not VersionInput(data=payload).is_valid()
    group["unordered_sets"] = [[1, 2]]
    for invalid in [["rain"], ["rain", "RAIN!"], ["rain", "cloud"]]:
        payload["keys"]["2"] = invalid
        assert not VersionInput(data=payload).is_valid()
    payload["keys"].update({"1": ["rain", "!"], "2": ["rain", "!"]})
    assert not VersionInput(data=payload).is_valid()
