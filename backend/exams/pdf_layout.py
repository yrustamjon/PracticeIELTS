"""Original-page delivery and reviewed answer-blank coordinates, without OCR."""

import io
import re

import pypdfium2 as pdfium
import pypdfium2.raw as raw
from django.http import HttpResponse
from pypdf import PdfReader, PdfWriter
from rest_framework.exceptions import ValidationError

BLANK = r"(?:[._\u2026\u00b7\uff3f][ \t]*){3,}|[_\uff3f]{2,}"
INLINE = re.compile(
    r"(?<!\d)(?:\((?P<paren>\d{1,3})\)|(?P<number>\d{1,3}))[.)]?[ \t]*(?P<blank>"
    + BLANK
    + r")"
)
HEADING = re.compile(r"(?:^|\n|(?<=[.!?:])\s+)(\d{1,3})[.)]\s+")


def detect_pdf_blanks(document, pages):
    fields, drafts, warnings, duplicates = {}, {}, [], set()
    with document.file.open("rb") as file:
        data = file.read(15 * 1024 * 1024 + 1)
    with pdfium.PdfDocument(data) as pdf:
        for number in sorted(set(pages)):
            page = pdf[number - 1]
            if page.get_rotation():
                warnings.append(
                    f"Page {number} is rotated; place its answer fields manually in the preview."
                )
                page.close()
                continue
            width, height = page.get_size()
            left, bottom, _, _ = page.get_bbox()
            textpage = page.get_textpage()
            count = textpage.count_chars()
            if count > 100_000:
                textpage.close()
                page.close()
                raise ValidationError({"file": "The PDF contains too much text."})
            # Keep a direct map to PDFium character indexes, including inserted
            # line breaks and excluded glyphs rather than assuming text offsets.
            chars, indexes = [], []
            for i in range(count):
                code = raw.FPDFText_GetUnicode(textpage, i)
                if code:
                    chars.append(chr(code))
                    indexes.append(i)
            text = "".join(chars)
            candidates = []
            for match in INLINE.finditer(text):
                n = int(match["paren"] or match["number"])
                candidates.append(
                    (
                        n,
                        match.start("blank"),
                        match.end("blank"),
                        match.start(),
                        match.end(),
                    )
                )
            headings = list(HEADING.finditer(text))
            for i, heading in enumerate(headings):
                n = int(heading[1])
                if any(c[0] == n for c in candidates):
                    continue
                end = headings[i + 1].start() if i + 1 < len(headings) else len(text)
                blank = re.search(BLANK, text[heading.end() : end])
                if blank:
                    start = heading.end() + blank.start()
                    candidates.append(
                        (n, start, heading.end() + blank.end(), heading.start(), end)
                    )
            for n, start, end, source_start, source_end in candidates:
                if not 1 <= n <= 100:
                    continue
                if n in fields:
                    duplicates.add(n)
                    continue
                boxes = [
                    textpage.get_charbox(indexes[i], loose=True)
                    for i in range(start, end)
                    if not text[i].isspace()
                ]
                if not boxes:
                    continue
                x0 = max(0, min(b[0] for b in boxes) - left)
                x1 = min(width, max(b[2] for b in boxes) - left)
                y0 = max(0, height - (max(b[3] for b in boxes) - bottom) - 1)
                y1 = min(height, height - (min(b[1] for b in boxes) - bottom) + 1)
                if x1 <= x0 or y1 <= y0:
                    continue
                fields[n] = {
                    "page": number,
                    "x": round(x0 / width, 6),
                    "y": round(y0 / height, 6),
                    "width": round((x1 - x0) / width, 6),
                    "height": round((y1 - y0) / height, 6),
                }
                line_start = text.rfind("\n", 0, source_start) + 1
                line_end = text.find("\n", source_end)
                if line_end < 0:
                    line_end = len(text)
                prompt = (text[line_start:start] + "____" + text[end:line_end]).strip()
                preceding = text[:source_start]
                parts = list(
                    re.finditer(r"(?:PART|SECTION)\s+([1-4])\b", preceding, re.I)
                )
                drafts[n] = {
                    "number": n,
                    "part": int(parts[-1][1]) if parts else min(4, (n - 1) // 10 + 1),
                    "type": "short_answer",
                    "prompt": prompt[:5000] or "____",
                    "instructions": "",
                    "options": [],
                    "max_words": 3,
                    "context": {},
                    "answers": [],
                    "source_page": number,
                }
            textpage.close()
            page.close()
    for n in duplicates:
        fields.pop(n, None)
        warnings.append(
            f"Question {n} has more than one possible blank; place its field manually."
        )
    return fields, drafts, warnings


def isolated_pdf_page(document, page):
    if not 1 <= page <= document.page_count:
        raise ValidationError({"page": "Page does not exist."})
    try:
        with document.file.open("rb") as source:
            reader = PdfReader(io.BytesIO(source.read(15 * 1024 * 1024 + 1)))
        writer = PdfWriter()
        writer.add_page(
            reader.pages[page - 1],
            excluded_keys=[
                "/Annots",
                "/AA",
                "/Metadata",
                "/PieceInfo",
                "/Thumb",
                "/AF",
            ],
        )
        output = io.BytesIO()
        writer.write(output)
    except Exception as exc:
        raise ValidationError(
            {"document": "This PDF page could not be opened."}
        ) from exc
    response = HttpResponse(output.getvalue(), content_type="application/pdf")
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response
