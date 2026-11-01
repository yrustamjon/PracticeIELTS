import copy
import importlib.util
from pathlib import Path
import tempfile
import unittest

from pypdf import PdfReader, PdfWriter

spec = importlib.util.spec_from_file_location('reading_sources', Path(__file__).parents[1] / 'prepare-reading-sources.py')
sources = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sources)


class ReadingSourceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.pdf = self.root / 'original.pdf'
        writer = PdfWriter()
        for i in range(4):
            writer.add_blank_page(width=400 + i * 10, height=600)
        with self.pdf.open('wb') as stream:
            writer.write(stream)
        self.mapping = {'book': 'Original synthetic test book', 'tests': [
            {'test': 1, 'key_pages': [4], 'passages': [
                {'passage': 1, 'questions': [1, 13], 'pages': [1]},
                {'passage': 2, 'questions': [14, 26], 'pages': [2]},
                {'passage': 3, 'questions': [27, 40], 'pages': [3]}]}]}

    def test_prepares_answer_free_full_paper_and_ordered_passages(self):
        out = self.root / 'out'
        result = sources.prepare(self.pdf, self.mapping, out)
        self.assertEqual(len(result['files']), 5)
        full = PdfReader(out / 'Test_1/Full_Reading_Mock.pdf')
        self.assertEqual([float(p.mediabox.width) for p in full.pages], [400, 410, 420])
        self.assertEqual(len(PdfReader(out / 'Test_1/Answer_Key_PRIVATE.pdf').pages), 1)
        self.assertTrue(all(f['pixel_verified'] for f in result['files']))
        self.assertEqual(result['state'], 'source_files_prepared_not_published')

    def test_answer_key_overlap_missing_pages_and_overwrite_rejected(self):
        for kind in ['key', 'missing', 'coverage']:
            mapping = copy.deepcopy(self.mapping)
            if kind == 'key':
                mapping['tests'][0]['key_pages'] = [1]
            elif kind == 'missing':
                mapping['tests'][0]['passages'][0]['pages'] = [20]
            else:
                mapping['tests'][0]['passages'][1]['questions'] = [15, 26]
            with self.assertRaises(ValueError):
                sources.prepare(self.pdf, mapping, self.root / kind)
        out = self.root / 'existing'
        out.mkdir()
        with self.assertRaises(FileExistsError):
            sources.prepare(self.pdf, self.mapping, out)


if __name__ == '__main__':
    unittest.main()
