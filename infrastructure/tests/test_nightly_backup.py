import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
import zipfile
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('backup', Path(__file__).parents[1] / 'nightly-backup.py')
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class BackupTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.project = self.root / 'project'
        media = self.project / 'backend/media/originals'
        media.mkdir(parents=True)
        (media / 'audio.mp3').write_bytes(b'private historical recording')
        (media / 'unreferenced.secret').write_bytes(b'never include me')
        (self.project / '.env').write_text('SECRET=excluded')
        self.db = self.project / 'backend/db.sqlite3'
        with sqlite3.connect(self.db) as db:
            db.executescript('CREATE TABLE learning_audioasset (file TEXT); CREATE TABLE exams_questiondocument (file TEXT);')
            db.execute('INSERT INTO learning_audioasset VALUES (?)', ('originals/audio.mp3',))
        self.run = self.root / 'run'
        self.run.mkdir()

    def test_snapshot_contains_consistent_db_and_only_referenced_media(self):
        archive = backup.snapshot(self.project, self.run)
        with zipfile.ZipFile(archive) as z:
            self.assertEqual(set(z.namelist()), {'backend/db.sqlite3', 'backend/media/originals/audio.mp3', 'MANIFEST.json', 'RESTORE.txt'})
            manifest = json.loads(z.read('MANIFEST.json'))
            self.assertEqual(len(manifest['files']), 2)
        self.assertFalse((self.run / 'db.sqlite3').exists())
        self.assertTrue((self.run / 'backup.zip.sha256').exists())

    def test_original_unreferenced_source_pdfs_are_preserved(self):
        docs = self.project / 'backend/media/cambridge_documents/book'
        docs.mkdir(parents=True)
        (docs / 'source.pdf').write_bytes(b'original private source')
        (docs / 'telegram.session').write_bytes(b'secret excluded')
        archive = backup.snapshot(self.project, self.run)
        with zipfile.ZipFile(archive) as check:
            self.assertIn('backend/media/cambridge_documents/book/source.pdf', check.namelist())
            self.assertNotIn('backend/media/cambridge_documents/book/telegram.session', check.namelist())

    def test_referenced_legacy_cambridge_audio_is_preserved(self):
        media = self.project / 'backend/media/cambridge_audio/book'
        media.mkdir(parents=True)
        (media / 'part.mp3').write_bytes(b'legacy private recording')
        (media / 'unreferenced.mp3').write_bytes(b'excluded duplicate')
        with sqlite3.connect(self.db) as db:
            db.execute('INSERT INTO learning_audioasset VALUES (?)', ('cambridge_audio/book/part.mp3',))
        archive = backup.snapshot(self.project, self.run)
        with zipfile.ZipFile(archive) as check:
            self.assertEqual(check.read('backend/media/cambridge_audio/book/part.mp3'), b'legacy private recording')
            self.assertNotIn('backend/media/cambridge_audio/book/unreferenced.mp3', check.namelist())

    def test_missing_media_aborts(self):
        (self.project / 'backend/media/originals/audio.mp3').unlink()
        with self.assertRaisesRegex(RuntimeError, 'Missing'):
            backup.snapshot(self.project, self.run)
        self.assertFalse((self.run / 'backup.zip.sha256').exists())

    def test_reading_historical_versions_and_unpublished_import_sources_are_preserved(self):
        media = self.project / 'backend/media/reading-sources'
        media.mkdir()
        for name in ['published.pdf', 'historical.pdf', 'job.pdf', 'orphan.pdf']:
            (media / name).write_bytes(name.encode())
        with sqlite3.connect(self.db) as db:
            db.executescript('CREATE TABLE reading_readingversion (source TEXT); CREATE TABLE reading_readingimportjob (source TEXT);')
            db.executemany('INSERT INTO reading_readingversion VALUES (?)', [('reading-sources/published.pdf',), ('reading-sources/historical.pdf',)])
            db.execute('INSERT INTO reading_readingimportjob VALUES (?)', ('reading-sources/job.pdf',))
        archive = backup.snapshot(self.project, self.run)
        with zipfile.ZipFile(archive) as check:
            for name in ['published.pdf', 'historical.pdf', 'job.pdf']:
                self.assertIn(f'backend/media/reading-sources/{name}', check.namelist())
            self.assertNotIn('backend/media/reading-sources/orphan.pdf', check.namelist())

    def test_missing_reading_source_aborts_snapshot(self):
        with sqlite3.connect(self.db) as db:
            db.execute('CREATE TABLE reading_readingversion (source TEXT)')
            db.execute('INSERT INTO reading_readingversion VALUES (?)', ('reading-sources/missing.pdf',))
        with self.assertRaisesRegex(RuntimeError, 'Missing'):
            backup.snapshot(self.project, self.run)

    def test_path_traversal_rejected(self):
        with sqlite3.connect(self.db) as db:
            db.execute("UPDATE learning_audioasset SET file='../.env'")
        with self.assertRaisesRegex(RuntimeError, 'Unsafe'):
            backup.snapshot(self.project, self.run)

    def test_symlink_rejected(self):
        path = self.project / 'backend/media/originals/audio.mp3'
        path.unlink()
        path.symlink_to(self.project / '.env')
        with self.assertRaisesRegex(RuntimeError, 'unsafe'):
            backup.snapshot(self.project, self.run)

    def test_failed_upload_retains_complete_archive(self):
        backup.snapshot(self.project, self.run)
        class FailedDrive:
            def metadata(self, data): return 'folder'
            def upload(self, *args): raise RuntimeError('remote verification failed')
        with self.assertRaises(RuntimeError):
            backup.deliver(self.run, FailedDrive(), 'parent', self.root / 'receipts')
        self.assertTrue((self.run / 'backup.zip').exists())
        self.assertFalse((self.root / 'receipts').exists())

    def test_success_deletes_only_own_run_after_both_verifications(self):
        backup.snapshot(self.project, self.run)
        uploads = []
        class Drive:
            def metadata(self, data): return 'folder'
            def upload(self, path, parent):
                uploads.append(path.name)
                return 'remote-file'
        backup.deliver(self.run, Drive(), 'parent', self.root / 'receipts')
        self.assertEqual(uploads, ['backup.zip', 'backup.zip.sha256'])
        self.assertFalse(self.run.exists())
        self.assertTrue((self.root / 'receipts/run.json').exists())
        self.assertTrue(self.db.exists())
        self.assertTrue((self.project / 'backend/media/originals/audio.mp3').exists())

    def test_missing_auth_does_not_create_large_snapshot(self):
        args = type('Args', (), {'state': str(self.root / 'state'), 'credentials': str(self.root / 'absent'), 'project': str(self.project)})()
        with patch.object(backup, 'snapshot') as create:
            with self.assertRaises(FileNotFoundError):
                backup.run(args)
            create.assert_not_called()

    def test_public_parent_is_rejected_before_upload(self):
        from io import BytesIO
        drive = object.__new__(backup.Drive)
        drive.request = lambda *args, **kwargs: BytesIO(b'{"permissions":[{"type":"anyone"}]}')
        with self.assertRaisesRegex(RuntimeError, 'publicly'):
            drive.ensure_private('shared-folder')

    def test_public_parent_on_later_permissions_page_is_rejected(self):
        from io import BytesIO
        drive = object.__new__(backup.Drive)
        results = iter([b'{"permissions":[{"type":"user"}],"nextPageToken":"second"}', b'{"permissions":[{"type":"anyone"}]}'])
        urls = []
        def request(url):
            urls.append(url)
            return BytesIO(next(results))
        drive.request = request
        with self.assertRaisesRegex(RuntimeError, 'publicly'):
            drive.ensure_private('folder')
        self.assertIn('pageToken=second', urls[1])

    def test_private_destination_is_explicit(self):
        drive = object.__new__(backup.Drive)
        with self.assertRaisesRegex(RuntimeError, 'must be configured'):
            drive.ensure_private(None)

    def test_scheduled_check_records_missing_media_without_snapshot(self):
        (self.project / 'backend/media/originals/audio.mp3').unlink()
        args = type('Args', (), {'state': str(self.root / 'state'), 'project': str(self.project), 'credentials': str(self.root / 'absent')})()
        with self.assertRaisesRegex(RuntimeError, 'health check'):
            backup.run(args)
        health = json.loads((self.root / 'state/health.json').read_text())
        self.assertEqual(health['database_quick_check'], 'ok')
        self.assertEqual(health['missing_referenced_media'], 1)
        self.assertFalse((self.root / 'state/pending').exists())

    def test_second_small_upload_failure_also_preserves_archive(self):
        backup.snapshot(self.project, self.run)
        class Drive:
            def metadata(self, data): return 'folder'
            def upload(self, path, parent):
                if path.suffix == '.sha256': raise RuntimeError('checksum upload failed')
                return 'remote'
        with self.assertRaises(RuntimeError):
            backup.deliver(self.run, Drive(), 'parent', self.root / 'receipts')
        self.assertTrue((self.run / 'backup.zip').exists())


if __name__ == '__main__':
    unittest.main()
