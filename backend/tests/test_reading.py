import io
import json

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction
from pypdf import PdfWriter
from rest_framework.test import APIClient

from accounts.models import User
from reading.models import ReadingAttempt, ReadingVersion

pytestmark = pytest.mark.django_db


@pytest.fixture
def reading(tmp_path, settings):
    settings.MEDIA_ROOT = tmp_path
    teacher = User.objects.create_user(username="reading_editor", role="teacher")
    student = User.objects.create_user(username="reading_student")
    other = User.objects.create_user(username="reading_other")
    writer = PdfWriter()
    for _ in range(3):
        writer.add_blank_page(width=300, height=400)
    stream = io.BytesIO()
    writer.write(stream)
    content = {
        "title": "Original reading fixture",
        "instructions": "Read and answer all three questions.",
        "paragraphs": [
            {"text": "A pavilion protects a visitor. Four sides surround the well."}
        ],
        "groups": [
            {
                "title": "Questions 1–2",
                "instructions": "TRUE if supported; FALSE if contradicted; NOT GIVEN if absent.",
                "kind": "true_false",
                "questions": [
                    {"number": 1, "prompt": "A pavilion offers protection."},
                    {"number": 2, "prompt": "The pavilion is green."},
                ],
            },
            {
                "title": "Question 3",
                "instructions": "ONE WORD AND/OR A NUMBER.",
                "kind": "table",
                "headers": ["Place", "Features"],
                "rows": [["Well", "Steps on {{3}}"]],
                "questions": [{"number": 3, "allow_number": True, "max_words": 1}],
            },
        ],
    }
    payload = {
        "content": content,
        "keys": {"1": ["TRUE"], "2": ["NOT GIVEN"], "3": ["4 sides", "four sides"]},
        "source_name": "Original fixture PDF",
        "license": "CC0",
        "rights_confirmed": True,
        "source_pages": [1, 2],
        "key_pages": [3],
        "review_notes": "Compared all fixture paragraphs, questions, table cells and keys.",
    }
    client = APIClient()
    client.force_authenticate(teacher)
    r = client.post(
        "/api/v1/reading-papers/",
        {
            "metadata": json.dumps({"book": "Original", "test": 1, "passage": 1}),
            "payload": json.dumps(payload),
            "source": SimpleUploadedFile(
                "source.pdf", stream.getvalue(), content_type="application/pdf"
            ),
        },
        format="multipart",
    )
    assert r.status_code == 201, r.data
    return client, teacher, student, other, r.data, payload


def publish(reading):
    c, _, _, _, p, _ = reading
    r = c.post(
        f"/api/v1/reading-papers/{p['id']}/publish/",
        {"version": p["version"]["id"], "confirm_review": True},
        format="json",
    )
    assert r.status_code == 200, r.data


def test_reading_draft_permissions_keys_and_review_gate(reading):
    c, teacher, student, other, p, payload = reading
    base = f"/api/v1/reading-papers/{p['id']}/"
    c.force_authenticate(student)
    assert c.get(base).status_code == 404
    assert c.post("/api/v1/reading-attempts/", {"paper": p["id"]}).status_code == 404
    assert c.get("/api/v1/reading-papers/?owned=true").status_code == 403
    c.force_authenticate(teacher)
    assert (
        c.post(
            base + "publish/",
            {"version": p["version"]["id"], "confirm_review": False},
            format="json",
        ).status_code
        == 400
    )
    assert (
        c.get(base + f"source-pages/3/?version={p['version']['id']}").status_code == 200
    )
    assert (
        c.get(base + f"source-pages/4/?version={p['version']['id']}").status_code == 403
    )
    publish(reading)
    c.force_authenticate(student)
    r = c.get(base)
    assert r.status_code == 200
    assert "keys" not in r.data["version"] and "source_pages" not in r.data["version"]
    assert (
        c.get(base + f"source-pages/3/?version={p['version']['id']}").status_code == 403
    )
    assert c.post(base + "versions/", payload, format="json").status_code == 403
    assert (
        c.post(
            base + "publish/",
            {"version": p["version"]["id"], "confirm_review": True},
            format="json",
        ).status_code
        == 403
    )
    c.force_authenticate(
        User.objects.create_user(username="unrelated_editor", role="teacher")
    )
    assert c.post(base + "versions/", payload, format="json").status_code == 403
    c.force_authenticate(None)
    assert c.get(base).status_code == 401


def test_reading_resume_scoring_ownership_and_immutability(reading):
    c, teacher, student, other, p, payload = reading
    publish(reading)
    c.force_authenticate(student)
    r = c.post("/api/v1/reading-attempts/", {"paper": p["id"]})
    assert r.status_code == 201
    a = r.data
    url = f"/api/v1/reading-attempts/{a['id']}/"
    assert "results" not in a and "keys" not in a["version"]
    assert c.patch(url, {"answers": {"40": "bad"}}, format="json").status_code == 400
    assert c.patch(url, {"answers": {"1": "INVALID"}}, format="json").status_code == 400
    assert (
        c.patch(
            url, {"answers": {"1": "TRUE", "3": "4 sides"}}, format="json"
        ).status_code
        == 200
    )
    assert c.post("/api/v1/reading-attempts/", {"paper": p["id"]}).data["id"] == a["id"]
    assert c.get(url).data["answers"]["3"] == "4 sides"
    c.force_authenticate(other)
    assert c.get(url).status_code == 404
    assert c.post(url + "submit/").status_code == 404
    c.force_authenticate(teacher)
    payload["content"]["title"] = "A new revision"
    payload["keys"]["1"] = ["FALSE"]
    v = c.post(f"/api/v1/reading-papers/{p['id']}/versions/", payload, format="json")
    assert v.status_code == 201, v.data
    assert (
        c.post(
            f"/api/v1/reading-papers/{p['id']}/publish/",
            {"version": v.data["id"], "confirm_review": True},
            format="json",
        ).status_code
        == 200
    )
    c.force_authenticate(student)
    assert c.get(url).data["version"]["id"] == p["version"]["id"]
    r = c.post(url + "submit/")
    assert r.data["score"] == 2
    assert r.data["results"][1]["accepted_answers"] == ["NOT GIVEN"]
    assert c.post(url + "submit/").data["score"] == 2
    assert c.patch(url, {"answers": {"2": "TRUE"}}, format="json").status_code == 400
    new = c.post("/api/v1/reading-attempts/", {"paper": p["id"]})
    assert new.data["version"]["id"] == v.data["id"] and new.data["id"] != a["id"]
    assert ReadingVersion.objects.get(pk=p["version"]["id"]).keys["1"] == ["TRUE"]


def test_reading_validation_limits_and_database_constraints(reading):
    c, _, student, _, p, payload = reading
    base = f"/api/v1/reading-papers/{p['id']}/"
    payload["content"]["groups"][1]["rows"] = [["Well", "Missing marker"]]
    assert c.post(base + "versions/", payload, format="json").status_code == 400
    payload["content"]["groups"][1]["rows"] = [["Well", "{{3}}"]]
    payload["key_pages"] = [100]
    assert c.post(base + "versions/", payload, format="json").status_code == 400
    payload["key_pages"] = [3]
    payload["keys"]["99"] = ["secret"]
    assert c.post(base + "versions/", payload, format="json").status_code == 400
    publish(reading)
    c.force_authenticate(student)
    a = c.post("/api/v1/reading-attempts/", {"paper": p["id"]}).data
    with pytest.raises(IntegrityError), transaction.atomic():
        ReadingAttempt.objects.create(
            user=student, paper_id=p["id"], version_id=a["version"]["id"]
        )
    c.patch(
        f"/api/v1/reading-attempts/{a['id']}/",
        {"answers": {"3": "4 extra sides"}},
        format="json",
    )
    assert c.post(f"/api/v1/reading-attempts/{a['id']}/submit/").data["score"] == 0


@pytest.mark.parametrize("kind", ["headings", "matching"])
def test_reading_labelled_options_persist_score_and_remain_version_pinned(
    reading, kind
):
    c, teacher, student, _, paper, payload = reading
    group = payload["content"]["groups"][0]
    group.update(
        kind=kind,
        options=["i", "iv"],
        option_labels={"i": "Shelter", "iv": "A boundary"},
    )
    payload["keys"].update({"1": ["iv"], "2": ["i"]})
    base = f"/api/v1/reading-papers/{paper['id']}/"
    v = c.post(base + "versions/", payload, format="json")
    assert v.status_code == 201, v.data
    assert (
        c.post(
            base + "publish/",
            {"version": v.data["id"], "confirm_review": True},
            format="json",
        ).status_code
        == 200
    )
    c.force_authenticate(student)
    a = c.post("/api/v1/reading-attempts/", {"paper": paper["id"]}).data
    url = f"/api/v1/reading-attempts/{a['id']}/"
    assert a["version"]["content"]["groups"][0]["option_labels"]["iv"] == "A boundary"
    assert "keys" not in a["version"]
    assert (
        c.patch(url, {"answers": {"1": "A boundary"}}, format="json").status_code == 400
    )
    assert (
        c.patch(
            url, {"answers": {"1": "iv", "2": "i", "3": "four sides"}}, format="json"
        ).status_code
        == 200
    )
    assert c.get(url).data["answers"]["1"] == "iv"
    c.force_authenticate(teacher)
    payload["keys"]["1"] = ["i"]
    replacement = c.post(base + "versions/", payload, format="json")
    assert replacement.status_code == 201
    assert (
        c.post(
            base + "publish/",
            {"version": replacement.data["id"], "confirm_review": True},
            format="json",
        ).status_code
        == 200
    )
    c.force_authenticate(student)
    result = c.post(url + "submit/")
    assert result.data["score"] == 3
    assert result.data["version"]["id"] == v.data["id"]
    assert c.patch(url, {"answers": {"1": "i"}}, format="json").status_code == 400


@pytest.mark.parametrize(
    "invalid",
    [
        {"options": ["i", "i"], "option_labels": {"i": "Same"}},
        {"options": ["i", "ii"], "option_labels": {"i": "Missing second"}},
        {"options": ["i"], "option_labels": {"i": "First", "ii": "Unknown"}},
        {"options": [], "option_labels": {}},
    ],
)
def test_reading_heading_source_options_are_complete(reading, invalid):
    c, _, _, _, paper, payload = reading
    payload["content"]["groups"][0].update(kind="headings", **invalid)
    payload["keys"].update({"1": ["i"], "2": ["i"]})
    assert (
        c.post(
            f"/api/v1/reading-papers/{paper['id']}/versions/", payload, format="json"
        ).status_code
        == 400
    )


def test_reading_heading_key_must_be_a_source_code(reading):
    c, _, _, _, paper, payload = reading
    payload["content"]["groups"][0].update(
        kind="headings", options=["i"], option_labels={"i": "Shelter"}
    )
    payload["keys"].update({"1": ["Shelter"], "2": ["i"]})
    assert (
        c.post(
            f"/api/v1/reading-papers/{paper['id']}/versions/", payload, format="json"
        ).status_code
        == 400
    )


def test_reading_completion_preserves_inline_number_binding_and_rejects_missing_markers(reading):
    c, _, student, _, paper, payload = reading
    group = payload['content']['groups'][0]
    group.update(kind='completion', text='A {{1}} offers shelter.\nA {{2}} marks a boundary.')
    payload['keys'].update({'1':['roof'], '2':['fence']})
    base = f"/api/v1/reading-papers/{paper['id']}/"
    version = c.post(base + 'versions/', payload, format='json')
    assert version.status_code == 201, version.data
    assert c.post(base + 'publish/', {'version':version.data['id'], 'confirm_review':True}, format='json').status_code == 200
    group['text'] = 'Missing second answer {{1}}'
    assert c.post(base + 'versions/', payload, format='json').status_code == 400
    c.force_authenticate(student)
    a = c.post('/api/v1/reading-attempts/', {'paper':paper['id']}).data
    url = f"/api/v1/reading-attempts/{a['id']}/"
    assert c.patch(url, {'answers':{'1':'roof','2':'fence'}}, format='json').status_code == 200
    assert c.post(url+'submit/').data['score'] == 2
