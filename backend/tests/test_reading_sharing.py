import json

import pytest
from django.db import IntegrityError, transaction

from reading.models import SharedReadingResult
from tests.test_reading import reading  # noqa: F401
from tests.test_reading_full import full  # noqa: F401

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("full_mode", [False, True])
def test_reading_share_owned_submitted_snapshot_and_revoke(full, full_mode):  # noqa: F811
    c, _, student, other, papers = full
    c.defaults["REMOTE_ADDR"] = "192.0.2.12" if full_mode else "192.0.2.11"
    endpoint = "reading-full-attempts" if full_mode else "reading-attempts"
    response = c.post(f"/api/v1/{endpoint}/", {"paper": papers[0].pk, "timed": False}, format="json")
    assert response.status_code == 201
    attempt = response.data
    share = f"/api/v1/{endpoint}/{attempt['id']}/share/"
    assert c.post(share).status_code == 400
    c.force_authenticate(other)
    assert c.post(share).status_code == 404
    c.force_authenticate(student)
    numbers = range(1, 41 if full_mode else 14)
    c.patch(f"/api/v1/{endpoint}/{attempt['id']}/", {"answers": {str(n): "shelter" for n in numbers}}, format="json")
    submitted = c.post(f"/api/v1/{endpoint}/{attempt['id']}/submit/").data
    assert c.get(share).data == {"token": None}
    made = c.post(share)
    assert made.status_code == 200
    token = made.data["token"]
    assert c.post(share).data["token"] == token
    c.force_authenticate(None)
    assert c.get(share).status_code in (401, 403)
    public = c.get(f"/api/v1/shared-reading-results/{token}/")
    assert public.status_code == 200
    assert public.data["score"] == submitted["score"] == (40 if full_mode else 13)
    assert public.data["passage"] == (0 if full_mode else 1)
    assert len(public.data["results"]) == (40 if full_mode else 13)
    assert public["Cache-Control"] == "no-store"
    assert public["X-Robots-Tag"] == "noindex, nofollow"
    assert not {"user", "username", "email", "source", "paragraphs", "version", "keys"} & public.data.keys()
    assert "A roof provides shelter." not in json.dumps(public.data)
    c.force_authenticate(other)
    assert c.delete(share).status_code == 404
    c.force_authenticate(student)
    assert c.delete(share).status_code == 204
    c.force_authenticate(None)
    assert c.get(f"/api/v1/shared-reading-results/{token}/").status_code == 404
    c.force_authenticate(student)
    assert c.post(share).data["token"] != token


def test_reading_share_respects_active_timed_full_guard(full):  # noqa: F811
    c, _, _, _, papers = full
    a = c.post("/api/v1/reading-attempts/", {"paper": papers[0].pk}, format="json").data
    c.post(f"/api/v1/reading-attempts/{a['id']}/submit/")
    old = c.post("/api/v1/reading-full-attempts/", {"paper": papers[0].pk, "timed": False}, format="json").data
    c.post(f"/api/v1/reading-full-attempts/{old['id']}/submit/")
    c.post("/api/v1/reading-full-attempts/", {"paper": papers[0].pk, "timed": True}, format="json")
    assert c.post(f"/api/v1/reading-attempts/{a['id']}/share/").status_code == 404
    assert c.post(f"/api/v1/reading-full-attempts/{old['id']}/share/").status_code == 403


def test_shared_reading_requires_exactly_one_attempt():
    with transaction.atomic(), pytest.raises(IntegrityError):
        SharedReadingResult.objects.create(snapshot={})
