"""Validate manual corrections without guessing or moving audio boundaries."""

from rest_framework.exceptions import ValidationError


def validate_segment(segment, index, previous_end, duration):
    def fail(message):
        raise ValidationError({"segments": f"Segment {index + 1}: {message}"})

    if not isinstance(segment, dict):
        fail("Provide a sentence with start and end times.")
    text = segment.get("text")
    if not isinstance(text, str) or not text.strip():
        fail("Enter sentence text or remove this empty segment.")
    text = text.strip()
    if len(text) > 10000:
        fail("Keep sentence text below 10,001 characters.")
    speaker = segment.get("speaker", "")
    if not isinstance(speaker, str) or len(speaker.strip()) > 100:
        fail("Use a speaker name of at most 100 characters.")
    start, end = segment.get("start_ms"), segment.get("end_ms")
    if type(start) is not int or type(end) is not int:
        fail(
            "Start and end must be whole milliseconds; edit the timing in seconds using up to three decimal places."
        )
    if start < 0:
        fail("Start cannot be before 0 seconds.")
    if end <= start:
        fail(
            f"End must be later than start ({start / 1000:.3f} seconds). Adjust the timing or remove this segment."
        )
    if start < previous_end:
        fail(
            f"Start ({start / 1000:.3f}s) overlaps the previous sentence ending at {previous_end / 1000:.3f}s. Set start to at least {previous_end / 1000:.3f}s."
        )
    if end > duration:
        fail(
            f"End ({end / 1000:.3f}s) exceeds the recording's end ({duration / 1000:.3f}s). Adjust the end time."
        )
    return text, speaker.strip(), start, end
