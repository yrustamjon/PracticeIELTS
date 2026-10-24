import json
import subprocess
import tempfile
from pathlib import Path

from rest_framework.exceptions import ValidationError


def inspect_audio(upload):
    ext = Path(upload.name).suffix.lower()
    if ext not in {".mp3", ".wav", ".m4a", ".ogg", ".flac"}:
        raise ValidationError({"file": "Use MP3, WAV, M4A, OGG or FLAC."})
    if not 0 < upload.size <= 100 * 1024 * 1024:
        raise ValidationError({"file": "Audio must be between 1 byte and 100 MB."})
    with tempfile.NamedTemporaryFile(suffix=ext) as tmp:
        for chunk in upload.chunks():
            tmp.write(chunk)
        tmp.flush()
        try:
            result = subprocess.run(
                [
                    "ffprobe",
                    "-v",
                    "error",
                    "-show_entries",
                    "format=duration:stream=codec_type",
                    "-of",
                    "json",
                    tmp.name,
                ],
                capture_output=True,
                timeout=20,
                check=True,
            )
            metadata = json.loads(result.stdout)
            duration = round(float(metadata["format"]["duration"]) * 1000)
            if (
                duration <= 0
                or not any(s["codec_type"] == "audio" for s in metadata["streams"])
                or any(s["codec_type"] == "video" for s in metadata["streams"])
            ):
                raise ValueError()
        except (subprocess.SubprocessError, ValueError, KeyError):
            raise ValidationError({"file": "The file is not valid supported audio."})
    upload.seek(0)
    mime = {
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".m4a": "audio/mp4",
        ".ogg": "audio/ogg",
        ".flac": "audio/flac",
    }[ext]
    return duration, mime
