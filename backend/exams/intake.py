"""Conservative, editor-only drafts from numbered selectable PDF text.

This is not OCR or a layout/answer-key inference engine. Complex papers need
teacher editing; no source PDF text is automatically attached to student context.
"""

import io
import re

from pypdf import PdfReader
from rest_framework.exceptions import ValidationError

from .pdf_layout import detect_pdf_blanks


def document_drafts(document, pages):
    if not pages or any(n < 1 or n > document.page_count for n in pages):
        raise ValidationError({"pages": "Select valid question pages first."})
    with document.file.open("rb") as source:
        reader = PdfReader(io.BytesIO(source.read(15 * 1024 * 1024 + 1)))
        texts = [
            (n, (reader.pages[n - 1].extract_text() or "")[:100_000])
            for n in sorted(set(pages))
        ]
    drafts = []
    warnings = [
        "Review every prompt, part, instruction, option and word limit. Enter your own answer key. Tables and complex layouts require manual editing."
    ]
    seen = set()
    part = 1
    instructions = ""
    for page, text in texts:
        sections = re.split(r"(?im)(?=^\s*(?:PART|SECTION)\s+[1-4]\b)", text)
        for section in sections:
            # Numbered headings must start a line or follow sentence-ending punctuation.
            # Inline numbered blanks without this structure are deliberately not guessed.
            blocks = re.split(r"(?:^|\n|(?<=[.!?:])\s+)(\d{1,3})[.)]\s+", section)
            heading = blocks[0]
            part_match = re.search(r"(?:PART|SECTION)\s+([1-4])\b", heading, re.I)
            if part_match:
                part = int(part_match[1])
            instruction_match = re.search(
                r"(?:NO MORE THAN[^\n.]+|ONE WORD[^\n.]*|CHOOSE[^\n.]+)", heading, re.I
            )
            if instruction_match:
                instructions = instruction_match[0][:500]
            limit_match = re.search(
                r"\b(ONE|TWO|THREE|FOUR|\d+) WORD", instructions, re.I
            )
            word_numbers = {"ONE": 1, "TWO": 2, "THREE": 3, "FOUR": 4}
            limit = 3
            if limit_match:
                token = limit_match[1].upper()
                limit = word_numbers.get(token, int(token) if token.isdigit() else 3)
            for i in range(1, len(blocks), 2):
                number = int(blocks[i])
                content = blocks[i + 1].strip()
                if not 1 <= number <= 100 or not content or number in seen:
                    warnings.append(
                        f"Page {page}: ambiguous or repeated number {number}; add it manually."
                    )
                    continue
                seen.add(number)
                options = []
                prompt_lines = []
                for line in content.splitlines():
                    option = re.match(r"^\s*([A-H])[.)]\s+(.+)$", line)
                    if option:
                        options.append({"key": option[1], "text": option[2][:1000]})
                    elif options:
                        options[-1]["text"] = (
                            options[-1]["text"] + " " + line.strip()
                        )[:1000]
                    else:
                        prompt_lines.append(line)
                prompt = "\n".join(prompt_lines).strip()[:5000]
                if not prompt:
                    warnings.append(
                        f"Question {number}: add a question prompt manually."
                    )
                drafts.append(
                    {
                        "number": number,
                        "part": part,
                        "type": "multiple_choice"
                        if len(options) >= 2
                        else "short_answer",
                        "prompt": prompt,
                        "instructions": instructions,
                        "options": options if len(options) >= 2 else [],
                        "max_words": max(1, min(20, limit)),
                        "context": {},
                        "answers": [],
                        "source_page": page,
                    }
                )
    fields, inline_drafts, layout_warnings = detect_pdf_blanks(document, pages)
    by_number = {q["number"]: q for q in drafts}
    for n, q in inline_drafts.items():
        if n not in by_number:
            by_number[n] = q
    for n, field in fields.items():
        if n in by_number:
            by_number[n]["context"]["pdf_field"] = field
    drafts = list(by_number.values())
    warnings.extend(layout_warnings)
    warnings.append(
        "Review each answer field on the original PDF. Missing or incorrect positions can be drawn manually; scanned pages need manual fields and questions."
    )
    if not drafts:
        warnings.append(
            "No reliable numbered questions found. Type the questions below; scanned PDFs need manual transcription."
        )
    return {
        "questions": sorted(drafts, key=lambda q: q["number"]),
        "source_text": "\n\n".join(f"Page {n}\n{text}" for n, text in texts)[:100_000],
        "warnings": warnings,
    }
