"""Manual review regressions; the timing fixture uses original PCM silence."""

import io
import wave

import pytest
from django.core.files.base import ContentFile
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from learning.models import AudioAsset, Category, Material, Segment, TranscriptVersion

pytestmark = pytest.mark.django_db


@pytest.fixture
def review(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    teacher = User.objects.create_user(username="review-teacher", role="teacher")
    category = Category.objects.create(name="Original review")
    material = Material.objects.create(
        title="Original timing fixture",
        category=category,
        owner=teacher,
        source="Original PCM fixture",
        license="Author permission",
        rights_confirmed=True,
    )
    out = io.BytesIO()
    with wave.open(out, "wb") as w:
        w.setparams((1, 2, 1000, 0, "NONE", "not compressed"))
        w.writeframes(b"\0\0" * 454947)
    audio = AudioAsset.objects.create(
        material=material,
        file=ContentFile(out.getvalue(), name="original.wav"),
        duration_ms=454947,
        mime_type="audio/wav",
        size=len(out.getvalue()),
    )
    version = TranscriptVersion.objects.create(
        material=material, audio=audio, published_at=timezone.now()
    )
    for i in range(49):
        start = i * 9000
        Segment.objects.create(
            version=version,
            position=i,
            text=f"word{i + 1}",
            start_ms=start,
            end_ms=454947 if i == 48 else start + 8000,
            words=[
                {
                    "word": f"word{i + 1}",
                    "start_ms": start + 100,
                    "end_ms": start + 600,
                    "probability": 0.99,
                }
            ],
            confidence=0.99,
        )
    material.published_version = version
    material.save()
    client = APIClient()
    client.force_authenticate(teacher)
    payload = client.get(f"/api/v1/materials/{material.pk}/").data["segments"]
    return client, material, version, [dict(s) for s in payload]


def test_segment_50_error_explains_empty_row_and_never_mutates_publication(review):
    c, m, version, rows = review
    rows.append({"text": "", "speaker": "", "start_ms": 454947, "end_ms": 454947})
    response = c.put(
        f"/api/v1/materials/{m.pk}/transcript/", {"segments": rows}, format="json"
    )
    assert response.status_code == 400
    assert "Segment 50" in str(response.data["segments"]) and "empty" in str(
        response.data["segments"]
    )
    assert m.versions.count() == 1 and version.segments.count() == 49
    rows.pop()
    rows[20]["text"] = "Corrected sentence text"
    saved = c.put(
        f"/api/v1/materials/{m.pk}/transcript/", {"segments": rows}, format="json"
    )
    assert saved.status_code == 201
    assert (
        TranscriptVersion.objects.get(pk=saved.data["version_id"])
        .segments.get(position=20)
        .text
        == "Corrected sentence text"
    )
    m.refresh_from_db()
    assert m.published_version_id == version.pk


@pytest.mark.parametrize("include_ids", [True, False])
def test_deleting_a_middle_row_preserves_all_other_word_anchors(review, include_ids):
    c, m, version, rows = review
    rows.pop(10)
    if not include_ids:
        for s in rows:
            s.pop("id", None)
    saved = c.put(
        f"/api/v1/materials/{m.pk}/transcript/", {"segments": rows}, format="json"
    )
    assert saved.status_code == 201
    latest = TranscriptVersion.objects.get(pk=saved.data["version_id"])
    assert latest.segments.count() == 48
    assert latest.segments.get(position=10).text == "word12"
    assert (
        latest.segments.get(position=10).words
        == version.segments.get(position=11).words
    )
    assert all(s.words for s in latest.segments.all())
    assert version.segments.count() == 49


@pytest.mark.parametrize(
    "changes,reason",
    [
        ({"text": "   "}, "empty"),
        ({"start_ms": 432000.5}, "whole milliseconds"),
        ({"end_ms": True}, "whole milliseconds"),
        ({"start_ms": 423000}, "overlaps"),
        ({"end_ms": 454948}, "recording's end"),
        ({"end_ms": 432000}, "later than start"),
    ],
)
def test_review_errors_identify_the_actual_timing_or_text_problem(
    review, changes, reason
):
    c, m, _, rows = review
    rows[-1].update(changes)
    response = c.put(
        f"/api/v1/materials/{m.pk}/transcript/", {"segments": rows}, format="json"
    )
    assert response.status_code == 400
    assert "Segment 49" in str(response.data["segments"]) and reason in str(
        response.data["segments"]
    )
    assert m.versions.count() == 1
