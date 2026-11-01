from unittest.mock import patch

from django.core.cache import caches
from django.core.files.storage import FileSystemStorage
from django.test import RequestFactory

from exams.pdf_layout import isolated_pdf_page
from tests.test_exams import original_pdf


def test_pdf_cache_invalidates_on_file_change(tmp_path):
    from types import SimpleNamespace
    caches['pdf_pages'].clear()
    storage = FileSystemStorage(location=tmp_path)
    name = storage.save('paper.pdf', original_pdf(texts=['First page']))
    class StoredFile:
        def __init__(self):
            self.name = name
            self.storage = storage
        @property
        def size(self):
            return storage.size(name)
        def open(self, mode):
            return storage.open(name, mode)
    file = StoredFile()
    document = SimpleNamespace(pk=9001, page_count=1, file=file)
    request = RequestFactory().get('/')
    first = isolated_pdf_page(document, 1, request)
    old_etag = first['ETag']
    with patch('exams.pdf_layout.PdfReader', side_effect=AssertionError('Reparsed')):
        assert isolated_pdf_page(document, 1, request).content == first.content
    # Simulate replacement even though normal uploads use a fresh immutable UUID.
    (tmp_path / name).write_bytes(original_pdf(texts=['Replacement page with new content']).read())
    conditional = RequestFactory().get('/', HTTP_IF_NONE_MATCH=old_etag)
    second = isolated_pdf_page(document, 1, conditional)
    assert second.status_code == 200 and second['ETag'] != old_etag
    assert second.content != first.content
    caches['pdf_pages'].clear()
