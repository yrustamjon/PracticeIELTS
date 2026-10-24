"""Create sentence/chunk boundaries from recognized word anchors, never proportional timing."""

import re
from difflib import SequenceMatcher

from learning.services.comparison import words as normalized_words

from .transcription import NoSpeech, ReferenceMismatch


def clean_words(words, duration_ms):
    clean = []
    warnings = []
    end = 0
    for word in words:
        start = max(end, int(word["start_ms"]))
        stop = min(duration_ms, int(word["end_ms"]))
        if stop <= start:
            warnings.append(
                "An overlapping or out-of-range word was discarded. Review the nearby sentence."
            )
            continue
        clean.append({**word, "start_ms": start, "end_ms": stop})
        end = stop
    if not clean:
        raise NoSpeech()
    return clean, list(dict.fromkeys(warnings))


def sentence_payload(text, words, needs_review=False):
    anchored = [
        w
        for w in words
        if w.get("start_ms") is not None and w.get("end_ms") is not None
    ]
    if not anchored:
        raise ReferenceMismatch()
    confidence = sum(w.get("probability", 0) for w in words) / max(len(words), 1)
    return {
        "text": text.strip(),
        "start_ms": anchored[0]["start_ms"],
        "end_ms": anchored[-1]["end_ms"],
        "words": words,
        "confidence": round(confidence, 4),
        "needs_review": needs_review or confidence < 0.7,
    }


def segment_recognition(words):
    sentences = []
    chunk = []
    for i, word in enumerate(words):
        chunk.append(word)
        pause = i + 1 < len(words) and words[i + 1]["start_ms"] - word["end_ms"] > 1000
        if (
            re.search(r'[.!?]["\u201d\u2019\']?$', word["word"])
            or pause
            or len(chunk) >= 35
        ):
            sentences.append(
                sentence_payload(" ".join(w["word"] for w in chunk), chunk)
            )
            chunk = []
    if chunk:
        sentences.append(sentence_payload(" ".join(w["word"] for w in chunk), chunk))
    return sentences


def align_reference(reference, recognized):
    """Preserve authoritative text and expose words lacking recognized anchors.

    This is word-anchor alignment against ASR, not a phoneme forced aligner.
    Unmatched words retain null timings and require editor review.
    """
    sentences = split_reference_sentences(reference)
    token_lists = [s.split() for s in sentences]
    reference_tokens = [word for sentence in token_lists for word in sentence]
    normalized_reference = [" ".join(normalized_words(w)) for w in reference_tokens]
    normalized_recognized = [" ".join(normalized_words(w["word"])) for w in recognized]
    match = SequenceMatcher(
        None, normalized_reference, normalized_recognized, autojunk=False
    )
    anchors = {}
    for block in match.get_matching_blocks():
        for offset in range(block.size):
            if normalized_reference[block.a + offset]:
                anchors[block.a + offset] = recognized[block.b + offset]
    if not reference_tokens or len(anchors) / len(reference_tokens) < 0.6:
        raise ReferenceMismatch()
    output = []
    index = 0
    for text, tokens in zip(sentences, token_lists):
        mapped = []
        missing = False
        for token in tokens:
            anchor = anchors.get(index)
            if anchor:
                mapped.append({**anchor, "word": token})
            else:
                mapped.append(
                    {"word": token, "start_ms": None, "end_ms": None, "probability": 0}
                )
                missing = True
            index += 1
        output.append(sentence_payload(text, mapped, missing))
    return output


def easy_chunks(sentence):
    """Use word timestamps for short playable chunks; preserve unaligned text as a sentence."""
    words = sentence.get("words", [])
    if not words or any(
        w.get("start_ms") is None or w.get("end_ms") is None for w in words
    ):
        return [sentence]
    output = []
    current = []
    for index, word in enumerate(words):
        current.append(word)
        remaining = len(words) - index - 1
        comma_boundary = len(current) >= 3 and bool(re.search(r"[,;:]$", word["word"]))
        if (len(current) >= 6 or comma_boundary) and remaining >= 3:
            output.append(
                sentence_payload(" ".join(w["word"] for w in current), current)
            )
            current = []
    if current:
        output.append(sentence_payload(" ".join(w["word"] for w in current), current))
    return output


def split_reference_sentences(text):
    """Split on sentence punctuation, preserving decimals and common title abbreviations."""
    output = []
    start = 0
    for match in re.finditer(r"(?<=[.!?])\s+", text):
        candidate = text[start : match.start()].strip()
        last = candidate.split()[-1] if candidate.split() else ""
        if last.lower() in {
            "mr.",
            "mrs.",
            "ms.",
            "dr.",
            "prof.",
            "st.",
            "e.g.",
            "i.e.",
        } or re.fullmatch(r"[A-Z]\.", last):
            continue
        if candidate:
            output.append(candidate)
        start = match.end()
    tail = text[start:].strip()
    if tail:
        output.append(tail)
    return output
