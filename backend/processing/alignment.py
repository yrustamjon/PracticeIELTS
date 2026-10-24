"""Replaceable reference alignment service, separate from transcription and segmentation."""

from typing import Protocol

from .segmentation import align_reference


class AlignmentService(Protocol):
    def align(
        self, audio_path: str, reference: str, recognized_words: list[dict]
    ) -> list[dict]: ...


class WordAnchorAlignmentService:
    """Align to ASR word anchors and flag gaps; this is not phoneme forced alignment."""

    def align(self, audio_path, reference, recognized_words):
        return align_reference(reference, recognized_words)
