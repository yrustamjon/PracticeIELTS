"""Bounded plain-text/PDF transcript intake. Uploaded PDFs are never executed."""

import io

from pypdf import PdfReader
from rest_framework.exceptions import ValidationError

MAX_TEXT = 100_000


def extract_pdf_text(data):
    if len(data) > 15 * 1024 * 1024 or not data.startswith(b"%PDF-"):
        raise ValidationError({"file": "Upload a valid PDF smaller than 15 MB."})
    try:
        reader = PdfReader(io.BytesIO(data), strict=True)
        if reader.is_encrypted:
            raise ValueError("encrypted")
        if not 1 <= len(reader.pages) <= 50:
            raise ValueError("page count")
        texts = []
        for page in reader.pages:
            text = page.extract_text() or ""
            texts.append(text)
            if sum(map(len, texts)) > MAX_TEXT:
                raise ValueError("text size")
        return "\n\n".join(texts).strip(), len(reader.pages)
    except Exception as exc:
        raise ValidationError(
            {
                "file": "The PDF could not be read. Use an unencrypted PDF with up to 50 pages."
            }
        ) from exc


def reference_from_request(request):
    text = request.data.get("reference_text", "")
    if not isinstance(text, str) or len(text) > MAX_TEXT:
        raise ValidationError(
            {"reference_text": "Use a transcript of up to 100,000 characters."}
        )
    upload = request.FILES.get("reference_file")
    if upload:
        if upload.size > 15 * 1024 * 1024:
            raise ValidationError(
                {"reference_file": "Transcript files must be smaller than 15 MB."}
            )
        data = upload.read()
        name = upload.name.lower()
        if name.endswith(".pdf"):
            extracted, _ = extract_pdf_text(data)
            if not extracted:
                raise ValidationError(
                    {
                        "reference_file": "This PDF has no selectable text. Paste the transcript or upload a UTF-8 text file."
                    }
                )
        elif name.endswith(".txt"):
            try:
                extracted = data.decode("utf-8-sig")
            except UnicodeDecodeError as exc:
                raise ValidationError(
                    {"reference_file": "Use a UTF-8 text file or a text-based PDF."}
                ) from exc
        else:
            raise ValidationError({"reference_file": "Use a TXT or PDF transcript."})
        if len(extracted) > MAX_TEXT:
            raise ValidationError({"reference_file": "Transcript is too long."})
        if text.strip() and text.strip() != extracted.strip():
            raise ValidationError(
                {"reference_text": "Supply the reference as text or a file, not both."}
            )
        text = extracted
    return text.strip()
