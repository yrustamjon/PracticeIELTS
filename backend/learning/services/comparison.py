"""Deterministic Levenshtein word alignment. Never changes the submitted answer."""

import re
import unicodedata
from difflib import SequenceMatcher


def words(text, options=None):
    options = options or {}
    text = unicodedata.normalize("NFKC", text).replace("’", "'")
    if options.get("capitalization", True):
        text = text.casefold()
    if options.get("contractions", False):
        for short, long in {
            "can't": "cannot",
            "don't": "do not",
            "i'm": "i am",
            "it's": "it is",
            "won't": "will not",
        }.items():
            text = text.replace(short, long)
    if options.get("numbers", False):
        for n, word in enumerate(
            [
                "zero",
                "one",
                "two",
                "three",
                "four",
                "five",
                "six",
                "seven",
                "eight",
                "nine",
                "ten",
            ]
        ):
            text = re.sub(r"\b" + word + r"\b", str(n), text)
    if options.get("punctuation", True):
        text = re.sub(r"[^\w\s']", " ", text)
    if not options.get("whitespace", True):
        return re.findall(r"\s+|[^\s]+", text)
    return text.split()


def compare(reference, answer, options=None):
    expected, actual = words(reference, options), words(answer, options)
    rows = [[0] * (len(actual) + 1) for _ in range(len(expected) + 1)]
    for i in range(len(expected) + 1):
        rows[i][0] = i
    for j in range(len(actual) + 1):
        rows[0][j] = j
    for i, a in enumerate(expected, 1):
        for j, b in enumerate(actual, 1):
            rows[i][j] = min(
                rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (a != b)
            )
    i, j = len(expected), len(actual)
    tokens = []
    while i or j:
        if (
            i
            and j
            and rows[i][j] == rows[i - 1][j - 1] + (expected[i - 1] != actual[j - 1])
        ):
            a, b = expected[i - 1], actual[j - 1]
            kind = "correct" if a == b else "incorrect"
            reason = (
                None
                if a == b
                else (
                    "word-order"
                    if b in expected
                    else "spelling"
                    if SequenceMatcher(None, a, b).ratio() >= 0.6
                    else "word"
                )
            )
            tokens.append(
                {"status": kind, "expected": a, "actual": b, "reason": reason}
            )
            i -= 1
            j -= 1
        elif i and rows[i][j] == rows[i - 1][j] + 1:
            tokens.append(
                {
                    "status": "missing",
                    "expected": expected[i - 1],
                    "actual": "",
                    "reason": "missing",
                }
            )
            i -= 1
        else:
            tokens.append(
                {
                    "status": "extra",
                    "expected": "",
                    "actual": actual[j - 1],
                    "reason": "extra",
                }
            )
            j -= 1
    tokens.reverse()
    correct = sum(t["status"] == "correct" for t in tokens)
    return {
        "tokens": tokens,
        "accuracy": round(
            100 * max(0, 1 - rows[-1][-1] / max(len(expected), len(actual), 1))
        ),
        "correct_words": correct,
        "total_words": len(expected),
        "reference": reference,
    }


def groups(session):
    segments = list(session.version.segments.all())
    size = {"easy": 1, "medium": 3, "hard": 6, "full": len(segments) or 1}[
        session.difficulty
    ]
    return [
        {
            "start_ms": 0 if session.difficulty == "full" else chunk[0].start_ms,
            "end_ms": session.version.audio.duration_ms
            if session.difficulty == "full"
            else chunk[-1].end_ms,
            "text": " ".join(s.text for s in chunk),
            "speaker": chunk[0].speaker,
        }
        for index in range(0, len(segments), size)
        if (chunk := segments[index : index + size])
    ]
