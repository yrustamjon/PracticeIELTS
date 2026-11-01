"""Bounded local PDF text/OCR evidence; original page images remain authoritative."""

import base64
import io
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

import pypdfium2 as pdfium

from .provider import ReadingMLError

MAX_PAGES = 200
MAX_FILE_BYTES = 50 * 1024 * 1024


def _page_image(page, longest=1800):
    bitmap = page.render(scale=min(2.2, longest / max(page.get_size())))
    try:
        image = bitmap.to_pil()
        output = io.BytesIO()
        image.convert("RGB").save(output, format="JPEG", quality=85)
        return output.getvalue()
    finally:
        bitmap.close()


def extract_pages(file, progress=None):
    with file.open("rb") as stream:
        data = stream.read(MAX_FILE_BYTES + 1)
    if len(data) > MAX_FILE_BYTES:
        raise ReadingMLError("source_too_large", "Source PDF must be at most 50 MB.")
    findings, pages = [], []
    try:
        pdf = pdfium.PdfDocument(data)
    except Exception:
        raise ReadingMLError(
            "invalid_source_pdf", "The source PDF cannot be read."
        ) from None
    with pdf:
        if not 1 <= len(pdf) <= MAX_PAGES:
            raise ReadingMLError(
                "source_page_limit", "Provide a PDF containing between 1 and 200 pages."
            )
        for index in range(len(pdf)):
            number = index + 1
            if progress:
                progress(
                    "extracting_source", {"pages_done": index, "pages_total": len(pdf)}
                )
            page = pdf[index]
            try:
                textpage = page.get_textpage()
                try:
                    text = textpage.get_text_range().strip()
                finally:
                    textpage.close()
                method = "text"
                if len("".join(text.split())) < 70:
                    method = "ocr"
                    if not shutil.which("tesseract"):
                        findings.append(
                            {
                                "message": "OCR is unavailable for this scanned/empty page.",
                                "source_pages": [number],
                            }
                        )
                        text = ""
                    else:
                        with tempfile.TemporaryDirectory(
                            prefix="reading-ocr-"
                        ) as temporary:
                            path = Path(temporary) / "page.jpg"
                            path.write_bytes(_page_image(page, 2200))
                            try:
                                result = subprocess.run(
                                    [
                                        "tesseract",
                                        str(path),
                                        "stdout",
                                        "-l",
                                        "eng",
                                        "--psm",
                                        "3",
                                    ],
                                    stdout=subprocess.PIPE,
                                    stderr=subprocess.DEVNULL,
                                    timeout=90,
                                    check=True,
                                    env={**os.environ, "OMP_THREAD_LIMIT": "1"},
                                )
                                text = result.stdout.decode(
                                    "utf-8", errors="replace"
                                ).strip()
                            except (subprocess.SubprocessError, OSError):
                                text = ""
                                findings.append(
                                    {
                                        "message": "OCR failed or timed out on this page. Compare the original page.",
                                        "source_pages": [number],
                                    }
                                )
                if len(text) > 30000:
                    raise ReadingMLError(
                        "source_page_too_dense",
                        "A source page exceeds the supported text size. Split or review this PDF separately.",
                    )
                if not text:
                    findings.append(
                        {
                            "message": "This page has no readable text; confirm whether it is intentionally blank or contains an image/diagram.",
                            "source_pages": [number],
                        }
                    )
                pages.append({"page": number, "text": text, "method": method})
            finally:
                page.close()
    if progress:
        progress(
            "extracting_source", {"pages_done": len(pages), "pages_total": len(pages)}
        )
    return pages, findings


def original_images(file, page_numbers):
    """Bound source-image requests without keeping all book bitmaps in memory."""
    numbers = sorted(set(page_numbers))
    if len(numbers) > 12:
        raise ReadingMLError(
            "passage_page_limit",
            "A detected passage needs more than 12 source/key pages. Split or review it separately.",
        )
    with file.open("rb") as stream:
        data = stream.read(MAX_FILE_BYTES + 1)
    with pdfium.PdfDocument(data) as pdf:
        output = []
        for number in numbers:
            if (
                not isinstance(number, int)
                or isinstance(number, bool)
                or not 1 <= number <= len(pdf)
            ):
                raise ReadingMLError(
                    "invalid_page_evidence",
                    "A model referenced a page outside the source PDF.",
                )
            page = pdf[number - 1]
            try:
                output.append(
                    (
                        number,
                        "data:image/jpeg;base64,"
                        + base64.b64encode(_page_image(page)).decode("ascii"),
                    )
                )
            finally:
                page.close()
    return output
