import json
from types import SimpleNamespace

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.exceptions import ValidationError

from learning.services.audio import inspect_audio


@pytest.mark.parametrize(
    "attached_pic,accepted", [(1, True), (0, False), (None, False)]
)
def test_album_art_is_not_a_moving_video(monkeypatch, attached_pic, accepted):
    streams = [
        {"codec_type": "audio"},
        {"codec_type": "video", "disposition": {"attached_pic": attached_pic}},
    ]
    monkeypatch.setattr(
        "learning.services.audio.subprocess.run",
        lambda *args, **kwargs: SimpleNamespace(
            stdout=json.dumps(
                {"format": {"duration": "501.318821"}, "streams": streams}
            )
        ),
    )
    upload = SimpleUploadedFile("original.m4a", b"Original media fixture")
    if accepted:
        assert inspect_audio(upload) == (501319, "audio/mp4")
        assert upload.tell() == 0
    else:
        with pytest.raises(ValidationError):
            inspect_audio(upload)
