"""Original blank PDFs only: approved crop bounds, pinning and exam authorization."""

import io
from copy import deepcopy

import pytest
from PIL import Image

from reading.serializers import VersionInput
from tests.test_reading import publish, reading  # noqa: F401
from tests.test_reading_full import full, start  # noqa: F401

pytestmark = pytest.mark.django_db


def figure():
    return {
        "page": 1,
        "crop": [0.1, 0.2, 0.3, 0.4],
        "alt": "Original test diagram",
        "after_paragraph": 1,
    }


@pytest.mark.parametrize(
    "change",
    [
        {"page": 3},
        {"page": 4},
        {"crop": [0, 0, 0, 1]},
        {"crop": [0.8, 0, 0.3, 1]},
        {"crop": [0, -0.1, 0.5, 0.5]},
        {"crop": [float("nan"), 0, 0.5, 0.5]},
        {"after_paragraph": 2},
        {"alt": ""},
    ],
)
def test_figure_rejects_keys_outside_pages_invalid_geometry_and_unlabelled_content(
    reading,  # noqa: F811
    change,
):
    payload = deepcopy(reading[-1])
    payload["content"]["figures"] = [figure() | change]
    assert not VersionInput(data=payload).is_valid()


def test_passage_figure_is_private_cropped_and_pinned(reading):  # noqa: F811
    c, teacher, student, other, paper, payload = reading
    base = f"/api/v1/reading-papers/{paper['id']}/"
    payload = deepcopy(payload)
    payload["content"]["figures"] = [figure()]
    response = c.post(base + "versions/", payload, format="json")
    assert response.status_code == 201, response.data
    version = response.data["id"]
    assert c.get(base + f"figures/0/?version={version}").status_code == 200
    assert (
        c.post(
            base + "publish/", {"version": version, "confirm_review": True}
        ).status_code
        == 200
    )
    c.force_authenticate(student)
    attempt = c.post("/api/v1/reading-attempts/", {"paper": paper["id"]}).data
    url = f"/api/v1/reading-attempts/{attempt['id']}/figures/0/"
    response = c.get(url)
    assert response.status_code == 200
    assert response["Cache-Control"] == "private, no-store"
    # Source fixture is 300x400 points; rendering scale2 and normalized crop.
    assert Image.open(io.BytesIO(response.content)).size == (180, 320)
    assert c.get(url.replace("/figures/0/", "/figures/1/")).status_code == 404
    assert c.get(base + f"figures/0/?version={version}").status_code == 403
    c.force_authenticate(other)
    assert c.get(url).status_code == 404
    c.force_authenticate(teacher)
    payload["content"]["figures"] = []
    new = c.post(base + "versions/", payload, format="json").data["id"]
    assert (
        c.post(base + "publish/", {"version": new, "confirm_review": True}).status_code
        == 200
    )
    c.force_authenticate(student)
    assert c.get(url).status_code == 200


def test_full_figures_follow_owned_pins_and_timed_sibling_guards(full):  # noqa: F811
    c, teacher, student, other, papers = full
    # Fixture-only data setup: add approved figures before creating any attempts.
    for paper in papers:
        v = paper.published_version
        v.content["figures"] = [figure()]
        v.save(update_fields=["content"])
    previous = start(full, timed=False)
    oldurl = f"/api/v1/reading-full-attempts/{previous['id']}/figures/3/0/"
    assert c.get(oldurl).status_code == 200
    c.force_authenticate(teacher)
    own_timed = start(full, timed=True)
    editor_url = f"/api/v1/reading-papers/{papers[2].pk}/figures/0/?version={papers[2].published_version_id}"
    assert c.get(editor_url).status_code == 403
    assert (
        c.post(f"/api/v1/reading-full-attempts/{own_timed['id']}/submit/").status_code
        == 200
    )
    assert c.get(editor_url).status_code == 200
    c.force_authenticate(student)
    timed = start(full, timed=True)
    url = f"/api/v1/reading-full-attempts/{timed['id']}/figures/3/0/"
    assert c.get(url).status_code == 200
    assert c.get(oldurl).status_code == 403
    c.force_authenticate(other)
    assert c.get(url).status_code == 404
    c.force_authenticate(student)
    assert (
        c.post(f"/api/v1/reading-full-attempts/{timed['id']}/submit/").status_code
        == 200
    )
    assert c.get(oldurl).status_code == 200


@pytest.mark.parametrize("indices", [[1], [0, 0]])
def test_question_figures_require_distinct_existing_source_figures(reading, indices):  # noqa: F811
    payload = deepcopy(reading[-1])
    payload["content"]["figures"] = [figure()]
    payload["content"]["groups"][0]["figure_indices"] = indices
    assert not VersionInput(data=payload).is_valid()
