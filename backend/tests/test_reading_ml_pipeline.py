"""Real Reading extraction and the explicitly deferred optional model transport."""

from types import SimpleNamespace

import pytest
from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from reading.ml.pipeline import run_ocr_pipeline
from reading.ml.provider import ReadingMLError, capabilities
from reading.ml.source import extract_pages, original_images


class SourceFile:
    def __init__(self, path):
        self.path = path

    def open(self, mode):
        return self.path.open(mode)


def text_pdf(path, count=2):
    writer = PdfWriter()
    for n in range(count):
        page = writer.add_blank_page(width=600, height=800)
        font = DictionaryObject(
            {
                NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"),
                NameObject("/BaseFont"): NameObject("/Helvetica"),
            }
        )
        page[NameObject("/Resources")] = DictionaryObject(
            {
                NameObject("/Font"): DictionaryObject(
                    {NameObject("/F1"): writer._add_object(font)}
                )
            }
        )
        content = DecodedStreamObject()
        content.set_data(
            f"BT /F1 12 Tf 20 700 Td (Original fixture page {n + 1}. This is complete source text for a reading extraction test with enough characters for direct text extraction.) Tj ET".encode()
        )
        page[NameObject("/Contents")] = writer._add_object(content)
    with path.open("wb") as file:
        writer.write(file)
    return SourceFile(path)


def test_text_extraction_accounts_for_every_page_and_ocr_mode_never_calls_model(
    tmp_path, monkeypatch
):
    source = text_pdf(tmp_path / "original.pdf", 3)
    monkeypatch.setattr(
        "reading.ml.pipeline.ReadingModelProvider",
        lambda: pytest.fail("OCR-only must not contact or require a model"),
    )
    progress = []
    output = run_ocr_pipeline(
        SimpleNamespace(source=source),
        lambda stage, details: progress.append((stage, details)),
    )
    assert len(output["extracted_pages"]) == 3
    assert [x["page"] for x in output["extracted_pages"]] == [1, 2, 3]
    assert all(
        x["method"] == "text" and "Original fixture page" in x["text"]
        for x in output["extracted_pages"]
    )
    assert output["candidates"] == [] and output["findings"] == []
    assert output["metrics"]["processing_mode"] == "ocr_only"
    assert output["metrics"]["model_calls"] == 0
    assert output["metrics"]["independent_review_completed"] is False
    assert output["metrics"]["human_source_review_required"] is True
    assert progress[-1][1] == {"pages_done": 3, "pages_total": 3}
    images = original_images(source, [2])
    assert images[0][0] == 2 and images[0][1].startswith("data:image/jpeg;base64,")


def test_actual_tesseract_reads_scanned_page(tmp_path):
    import shutil

    if not shutil.which("tesseract"):
        pytest.skip("Tesseract binary not installed")
    image = Image.new("RGB", (1500, 700), "white")
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 42)
    ImageDraw.Draw(image).text(
        (70, 90),
        "Original Reading Fixture\nThe pavilion provides shade for visitors.",
        fill="black",
        font=font,
        spacing=20,
    )
    path = tmp_path / "scan.pdf"
    image.save(path, format="PDF")
    pages, findings = extract_pages(SourceFile(path))
    assert len(pages) == 1 and pages[0]["method"] == "ocr"
    assert "pavilion" in pages[0]["text"].lower()
    assert not findings


def test_unreadable_page_is_a_blocking_source_issue_not_a_guessed_question(
    tmp_path, monkeypatch
):
    writer = PdfWriter()
    writer.add_blank_page(width=300, height=400)
    path = tmp_path / "blank.pdf"
    with path.open("wb") as stream:
        writer.write(stream)
    monkeypatch.setattr("reading.ml.source.shutil.which", lambda _: None)
    result = run_ocr_pipeline(SimpleNamespace(source=SourceFile(path)))
    assert result["candidates"] == []
    assert result["extracted_pages"][0]["text"] == ""
    assert result["extracted_pages"][0]["warnings"]
    assert all(
        f["severity"] == "error" and f["resolved"] is False and f["source_pages"] == [1]
        for f in result["findings"]
    )


def test_pdf_bounds_and_invalid_page_evidence_fail_honestly(tmp_path):
    source = text_pdf(tmp_path / "source.pdf", 1)
    with pytest.raises(ReadingMLError) as error:
        original_images(source, [2])
    assert error.value.code == "invalid_page_evidence"
    bad = tmp_path / "bad.pdf"
    bad.write_bytes(b"not a PDF")
    with pytest.raises(ReadingMLError) as error:
        extract_pages(SourceFile(bad))
    assert error.value.code == "invalid_source_pdf"


def test_optional_model_provider_has_no_default_or_credential_leaking_configuration(
    monkeypatch,
):
    for key in [
        "READING_ML_BASE_URL",
        "READING_ML_MODEL",
        "READING_ML_REVIEW_MODEL",
        "READING_ML_API_KEY",
    ]:
        monkeypatch.delenv(key, raising=False)
    assert capabilities()["available"] is False
    monkeypatch.setenv("READING_ML_BASE_URL", "https://secret:password@example.com/v1")
    monkeypatch.setenv("READING_ML_MODEL", "configured-model")
    assert capabilities()["available"] is False
    assert "secret" not in str(capabilities()) and "password" not in str(capabilities())


@pytest.mark.django_db
def test_worker_persists_real_extraction_and_duplicate_delivery_is_noop(
    tmp_path, settings
):
    from django.core.files import File

    from accounts.models import User
    from reading.models import ReadingImportJob, ReadingVersion
    from reading.tasks import process_reading_import

    settings.MEDIA_ROOT = tmp_path / "media"
    source = text_pdf(tmp_path / "worker-source.pdf", 2)
    user = User.objects.create_user(username="reading_ocr_worker", role="teacher")
    with source.open("rb") as file:
        job = ReadingImportJob.objects.create(
            owner=user,
            source=File(file, name="source.pdf"),
            source_name="Original worker fixture",
            source_digest="a" * 64,
            source_page_count=2,
            license="CC0",
            rights_confirmed=True,
        )
    process_reading_import.run(job.pk)
    job.refresh_from_db()
    assert job.state == "needs_review" and job.attempts == 1
    assert len(job.extracted_pages) == 2
    assert job.metrics["processing_mode"] == "ocr_only"
    assert (
        job.metrics["model_calls"] == 0
        and job.metrics["independent_review_completed"] is False
    )
    assert job.candidates == [] and ReadingVersion.objects.count() == 0
    process_reading_import.run(job.pk)
    job.refresh_from_db()
    assert job.attempts == 1
