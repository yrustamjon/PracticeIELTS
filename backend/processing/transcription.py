"""Local speech recognition. No transcript is generated without running an actual model."""

import hashlib
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Callable, Protocol

from django.conf import settings


class SpeechError(Exception):
    code = "speech_processing_failed"
    public_message = "The speech service could not process this audio. Your upload is saved; retry or ask your administrator."


class ModelUnavailable(SpeechError):
    code = "model_unavailable"
    public_message = "The speech model is unavailable. Your audio is saved. Ask your administrator to prepare the speech service, then retry."


class NoSpeech(SpeechError):
    code = "no_speech"
    public_message = (
        "No clear English speech was found. Check the recording and try again."
    )


class ReferenceMismatch(SpeechError):
    code = "reference_mismatch"
    public_message = "The supplied transcript could not be aligned reliably to this audio. Check that it matches the recording, or retry without a reference."


@dataclass(frozen=True)
class SpeechResult:
    words: list[dict]
    provider: str


class TranscriptionService(Protocol):
    def transcribe(self, path: str, stage: Callable[[str], None]) -> SpeechResult: ...


@lru_cache(maxsize=1)
def load_model():
    import onnxruntime

    onnxruntime.disable_telemetry_events()
    from faster_whisper import WhisperModel
    from faster_whisper.utils import download_model

    try:
        directory = (
            settings.WHISPER_MODEL
            if Path(settings.WHISPER_MODEL).is_dir()
            else download_model(
                settings.WHISPER_MODEL,
                cache_dir=str(settings.WHISPER_CACHE_DIR),
                revision=settings.WHISPER_MODEL_REVISION,
                local_files_only=settings.WHISPER_LOCAL_ONLY,
            )
        )
        weights = Path(directory) / "model.bin"
        expected = weights.resolve().name
        if re.fullmatch(r"[0-9a-f]{64}", expected):
            with weights.open("rb") as file:
                if hashlib.file_digest(file, "sha256").hexdigest() != expected:
                    raise ValueError(
                        "The model artifact failed its published content hash check."
                    )
        return WhisperModel(
            directory,
            device="cpu",
            compute_type="int8",
            cpu_threads=settings.WHISPER_THREADS,
            num_workers=1,
            download_root=str(settings.WHISPER_CACHE_DIR),
            local_files_only=settings.WHISPER_LOCAL_ONLY,
        )
    except Exception as exc:
        raise ModelUnavailable() from exc


class FasterWhisperService:
    def transcribe(self, path, stage):
        stage("loading_model")
        model = load_model()
        stage("transcribing")
        segments, _ = model.transcribe(
            path,
            language="en",
            word_timestamps=True,
            vad_filter=True,
            beam_size=5,
            condition_on_previous_text=False,
        )
        words = []
        for segment in segments:
            for word in segment.words or []:
                text = word.word.strip()
                if text and word.end > word.start:
                    words.append(
                        {
                            "word": text,
                            "start_ms": round(word.start * 1000),
                            "end_ms": round(word.end * 1000),
                            "probability": round(word.probability, 4),
                        }
                    )
        if not words:
            raise NoSpeech()
        return SpeechResult(
            words=words,
            provider="faster-whisper:"
            + settings.WHISPER_MODEL
            + "@"
            + str(settings.WHISPER_MODEL_REVISION or "configured"),
        )
