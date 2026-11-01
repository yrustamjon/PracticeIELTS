import importlib.util
import os
from pathlib import Path
import sqlite3
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('media_maintenance', Path(__file__).parents[1] / 'media-maintenance.py')
media = importlib.util.module_from_spec(spec)
spec.loader.exec_module(media)


class MediaMaintenanceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name) / 'media'
        self.root.mkdir()
        self.db = sqlite3.connect(':memory:')
        self.addCleanup(self.db.close)
        for table, field in media.FIELDS.items():
            self.db.execute(f'CREATE TABLE {table} ({field} TEXT)')
        self.db.commit()

    def file(self, name, ref=None, fresh=False):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(name.encode())
        if not fresh:
            os.utime(path, (1, 1))
        if ref:
            self.db.execute(f'INSERT INTO {ref} VALUES (?)', (name,))
            self.db.commit()
        return path

    def test_preserves_all_historical_and_job_references_archives_and_fresh_uploads(self):
        for table, field in media.FIELDS.items():
            self.file(f'reading-sources/{table}.pdf', ref=table)
        self.file('cambridge_documents/original.pdf')
        self.file('cambridge_audio/original.mp3')
        self.file('originals/recent.mp3', fresh=True)
        self.file('question-documents/orphan.pdf')
        result = media.inventory(self.root, self.db)
        self.assertEqual(result['referenced_files'], 4)
        self.assertEqual([r['path'] for r in result['files'] if r['action'] == 'quarantine'], ['question-documents/orphan.pdf'])

    def test_quarantine_is_reversible_and_does_not_write_database(self):
        path = self.file('reading-sources/orphan.pdf')
        result = media.inventory(self.root, self.db)
        destination = self.root.parent / 'quarantine'
        moved = media.quarantine(self.root, self.db, result, destination)
        self.assertFalse(path.exists())
        self.assertEqual((destination / 'reading-sources/orphan.pdf').read_bytes(), b'reading-sources/orphan.pdf')
        self.assertEqual(moved['quarantined'], 1)
        self.assertTrue((destination / 'RESTORE.json').exists())
        self.assertEqual(media.references(self.db), set())

    def test_new_reference_after_audit_blocks_move(self):
        path = self.file('reading-sources/orphan.pdf')
        result = media.inventory(self.root, self.db)
        self.db.execute('INSERT INTO reading_readingimportjob VALUES (?)', ('reading-sources/orphan.pdf',))
        self.db.commit()
        with self.assertRaisesRegex(ValueError, 'reference changed'):
            media.quarantine(self.root, self.db, result, self.root.parent / 'quarantine')
        self.assertTrue(path.exists())

    def test_changed_file_after_audit_blocks_move(self):
        path = self.file('originals/orphan.mp3')
        result = media.inventory(self.root, self.db)
        path.write_bytes(b'new content')
        with self.assertRaisesRegex(ValueError, 'changed'):
            media.quarantine(self.root, self.db, result, self.root.parent / 'quarantine')
        self.assertTrue(path.exists())

    def test_missing_reference_symlink_and_traversal_abort(self):
        self.db.execute("INSERT INTO reading_readingversion VALUES ('reading-sources/missing.pdf')")
        with self.assertRaisesRegex(ValueError, 'Missing'):
            media.inventory(self.root, self.db)
        self.db.execute('DELETE FROM reading_readingversion')
        target = self.file('originals/source.mp3')
        link = self.root / 'originals/link.mp3'
        link.symlink_to(target)
        with self.assertRaisesRegex(ValueError, 'symlink'):
            media.inventory(self.root, self.db)
        link.unlink()
        self.db.execute("INSERT INTO reading_readingversion VALUES ('../private.pdf')")
        with self.assertRaisesRegex(ValueError, 'Unsafe'):
            media.inventory(self.root, self.db)

    def test_quarantine_inside_media_rejected(self):
        result = media.inventory(self.root, self.db)
        with self.assertRaisesRegex(ValueError, 'outside'):
            media.quarantine(self.root, self.db, result, self.root / 'quarantine')


if __name__ == '__main__':
    unittest.main()
