#!/usr/bin/env python3
"""Private, consistent SQLite/media snapshots with verified Google Drive delivery."""
import argparse
import datetime as dt
import fcntl
import hashlib
import json
import logging
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import zipfile

LOG = logging.getLogger('practiceielts.backup')
MEDIA_FIELDS = {'learning_audioasset': 'file', 'exams_questiondocument': 'file',
                'reading_readingversion': 'source', 'reading_readingimportjob': 'source'}


def media_references(db):
    tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    names = set()
    for table, field in MEDIA_FIELDS.items():
        if table in tables:
            names.update(row[0] for row in db.execute(f'SELECT {field} FROM {table}') if row[0])
    return names


RESTORE = '''Stop API and worker before restoration. Verify archive SHA256 and every MANIFEST.json entry. Extract into a PRIVATE staging directory; never expose it through nginx. Run sqlite3 PRAGMA integrity_check on backend/db.sqlite3. Restore database and backend/media together, preserving originals/ and question-documents/ paths. Set owner www-data:www-data and restrictive permissions (directories 0700, files 0600). Use the matching application revision recorded in MANIFEST.json and provision environment secrets separately; secrets are deliberately absent. Restart services and run backups/verify-live.py. Keep the previous DB/media until functional verification succeeds. Do not run migrations against the only restored copy. PostgreSQL is not supported by this SQLite snapshot tool; it fails explicitly on another DB format.\n'''


def digest(path, algorithm='sha256'):
    h = hashlib.new(algorithm)
    with open(path, 'rb') as source:
        for chunk in iter(lambda: source.read(8 * 1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def snapshot(project, directory):
    """Back up online SQLite first, then only media referenced by that DB snapshot."""
    project, directory = Path(project), Path(directory)
    database = directory / 'db.sqlite3'
    with sqlite3.connect(f'file:{project / "backend/db.sqlite3"}?mode=ro', uri=True) as src:
        with sqlite3.connect(database) as dst:
            src.backup(dst, pages=256, sleep=0.1)
            if dst.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise RuntimeError('Snapshot database integrity check failed')
            names = media_references(dst)
    media_root = (project / 'backend/media').resolve()
    # Preserve original source PDFs even when no current QuestionDocument row uses them.
    source_documents = media_root / 'cambridge_documents'
    if source_documents.is_dir():
        for source in source_documents.rglob('*'):
            if source.is_symlink():
                raise RuntimeError('Unsafe symlink in source PDF archive')
            if source.is_file() and source.suffix.lower() == '.pdf':
                names.add(source.relative_to(media_root).as_posix())
    files = [('backend/db.sqlite3', database)]
    for name in sorted(names):
        relative = Path(name)
        if relative.is_absolute() or '..' in relative.parts or relative.parts[0] not in ('originals', 'cambridge_audio', 'question-documents', 'cambridge_documents', 'reading-sources'):
            raise RuntimeError('Unsafe media reference')
        source = media_root / relative
        if not source.is_file() or source.is_symlink() or media_root not in source.resolve().parents:
            raise RuntimeError('Missing or unsafe referenced media')
        files.append((f'backend/media/{relative.as_posix()}', source))
    required = sum(path.stat().st_size for _, path in files) + 256 * 1024 * 1024
    if shutil.disk_usage(directory).free < required:
        raise RuntimeError('Insufficient free space for verified snapshot')
    archive = directory / 'backup.zip'
    manifest = {'format': 1, 'created_at': dt.datetime.now(dt.timezone.utc).isoformat(), 'database': 'sqlite', 'files': []}
    try:
        status = subprocess.run(['git', '-C', str(project), 'status', '--porcelain'], capture_output=True, text=True, timeout=15, check=True)
        manifest['working_tree_dirty'] = bool(status.stdout.strip())
    except (OSError, subprocess.SubprocessError):
        manifest['working_tree_dirty'] = 'unknown'
    manifest['application_source_included'] = False
    head = project / '.git/HEAD'
    manifest['git_head'] = head.read_text().strip() if head.is_file() else 'unavailable'
    if manifest['git_head'].startswith('ref: '):
        ref = project / '.git' / manifest['git_head'][5:]
        if ref.is_file():
            manifest['git_head'] = ref.read_text().strip()
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_STORED, allowZip64=True) as out:
        for name, source in files:
            before = source.stat()
            sha = hashlib.sha256()
            with source.open('rb') as src, out.open(name, 'w', force_zip64=True) as target:
                for chunk in iter(lambda: src.read(8 * 1024 * 1024), b''):
                    sha.update(chunk)
                    target.write(chunk)
            after = source.stat()
            if (before.st_size, before.st_mtime_ns, before.st_ino) != (after.st_size, after.st_mtime_ns, after.st_ino):
                raise RuntimeError('Media changed during snapshot; retry next run')
            manifest['files'].append({'path': name, 'size': before.st_size, 'sha256': sha.hexdigest()})
        out.writestr('MANIFEST.json', json.dumps(manifest, indent=2))
        out.writestr('RESTORE.txt', RESTORE)
    with zipfile.ZipFile(archive) as check:
        if check.testzip() is not None:
            raise RuntimeError('Archive CRC verification failed')
        for entry in manifest['files']:
            h = hashlib.sha256()
            with check.open(entry['path']) as source:
                for chunk in iter(lambda: source.read(8 * 1024 * 1024), b''):
                    h.update(chunk)
            if h.hexdigest() != entry['sha256']:
                raise RuntimeError('Archive content verification failed')
    database.unlink()
    (directory / 'backup.zip.sha256').write_text(digest(archive) + '  backup.zip\n')
    return archive


class Drive:
    def __init__(self, credentials):
        path = Path(credentials)
        if path.stat().st_mode & 0o077:
            raise RuntimeError('Drive credential file must have mode 0600')
        secret = json.loads(path.read_text())
        self.folder = secret.get('folder_id')
        body = urllib.parse.urlencode({k: secret[k] for k in ('client_id', 'client_secret', 'refresh_token')} | {'grant_type': 'refresh_token'}).encode()
        request = urllib.request.Request('https://oauth2.googleapis.com/token', data=body)
        with urllib.request.urlopen(request, timeout=60) as response:
            self.token = json.load(response)['access_token']

    def request(self, url, data=None, method=None, headers=None):
        request = urllib.request.Request(url, data=data, method=method, headers={'Authorization': f'Bearer {self.token}', **(headers or {})})
        try:
            return urllib.request.urlopen(request, timeout=180)
        except urllib.error.HTTPError as error:
            if error.code == 308:
                return error
            raise RuntimeError(f'Drive request failed HTTP {error.code}') from None

    def ensure_private(self, folder):
        if not folder or not all(c.isalnum() or c in '_-' for c in folder):
            raise RuntimeError('A private Drive folder_id must be configured')
        page = ''
        while True:
            query = urllib.parse.urlencode({'fields': 'permissions(type),nextPageToken', 'supportsAllDrives': 'true', 'pageSize': '100', **({'pageToken': page} if page else {})})
            with self.request(f'https://www.googleapis.com/drive/v3/files/{folder}/permissions?{query}') as response:
                result = json.load(response)
            if any(item['type'] == 'anyone' for item in result['permissions']):
                raise RuntimeError('Refusing private database upload into publicly readable Drive folder')
            page = result.get('nextPageToken')
            if not page:
                break

    def metadata(self, data):
        with self.request('https://www.googleapis.com/drive/v3/files?fields=id&supportsAllDrives=true', json.dumps(data).encode(), headers={'Content-Type': 'application/json'}) as response:
            return json.load(response)['id']

    def upload(self, path, parent):
        size = path.stat().st_size
        with self.request('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id', json.dumps({'name': path.name, 'parents': [parent]}).encode(), headers={'Content-Type': 'application/json', 'X-Upload-Content-Length': str(size)}) as response:
            location = response.headers['Location']
        if not location.startswith('https://www.googleapis.com/'):
            raise RuntimeError('Unexpected Drive upload endpoint')
        with path.open('rb') as source:
            start = 0
            while start < size:
                chunk = source.read(8 * 1024 * 1024)
                end = start + len(chunk) - 1
                with self.request(location, chunk, 'PUT', {'Content-Type': 'application/octet-stream', 'Content-Range': f'bytes {start}-{end}/{size}'}) as response:
                    if end + 1 == size:
                        file_id = json.load(response)['id']
                    elif response.status != 308 or response.headers.get('Range') != f'bytes=0-{end}':
                        raise RuntimeError('Drive did not acknowledge complete chunk')
                start = end + 1
        with self.request(f'https://www.googleapis.com/drive/v3/files/{file_id}?fields=id,size,md5Checksum,parents&supportsAllDrives=true') as response:
            remote = json.load(response)
        if int(remote['size']) != size or remote['md5Checksum'] != digest(path, 'md5') or parent not in remote['parents']:
            raise RuntimeError('Drive uploaded file verification failed')
        return file_id


def deliver(directory, drive, parent, receipts):
    """Leave the entire pending run intact until BOTH remote objects are verified."""
    folder_file = directory / 'remote-folder.json'
    if folder_file.exists():
        folder = json.loads(folder_file.read_text())['id']
    else:
        folder = drive.metadata({'name': directory.name, 'mimeType': 'application/vnd.google-apps.folder', 'parents': [parent]})
        folder_file.write_text(json.dumps({'id': folder}))
    archive = directory / 'backup.zip'
    remote_id = drive.upload(archive, folder)
    drive.upload(directory / 'backup.zip.sha256', folder)
    receipt = {'run': directory.name, 'folder_id': folder, 'archive_id': remote_id, 'sha256': digest(archive), 'bytes': archive.stat().st_size, 'verified_at': dt.datetime.now(dt.timezone.utc).isoformat()}
    receipts.mkdir(exist_ok=True)
    (receipts / f'{directory.name}.json').write_text(json.dumps(receipt, indent=2))
    shutil.rmtree(directory)
    LOG.info('Verified remote backup; local run removed: %s', receipt['run'])


def run(args):
    os.umask(0o077)
    state = Path(args.state)
    state.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (state / 'lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        health = {'checked_at': dt.datetime.now(dt.timezone.utc).isoformat()}
        with sqlite3.connect(f'file:{Path(args.project) / "backend/db.sqlite3"}?mode=ro', uri=True) as db:
            health['database_quick_check'] = db.execute('PRAGMA quick_check').fetchone()[0]
            missing = 0
            for name in media_references(db):
                if not (Path(args.project) / 'backend/media' / name).is_file():
                    missing += 1
            health['missing_referenced_media'] = missing
        (state / 'health.json').write_text(json.dumps(health, indent=2))
        if health['database_quick_check'] != 'ok' or missing:
            raise RuntimeError('Scheduled database/media health check failed')
        drive = Drive(args.credentials)  # Fail before generating any large snapshot without auth.
        args.folder = args.folder or drive.folder
        drive.ensure_private(args.folder)
        pending = state / 'pending'
        pending.mkdir(exist_ok=True)
        for directory in sorted(pending.iterdir()):
            if directory.is_dir():
                if not (directory / 'backup.zip.sha256').exists():
                    # Incomplete runs have no complete snapshot; delete ONLY our staging data.
                    shutil.rmtree(directory)
                    continue
                deliver(directory, drive, args.folder, state / 'receipts')
        # A failed delivery raises before another snapshot is made; unuploaded data never accumulates.
        name = dt.datetime.now(dt.timezone.utc).strftime('PracticeIELTS_%Y%m%dT%H%M%S%fZ')
        directory = pending / name
        directory.mkdir()
        snapshot(args.project, directory)
        deliver(directory, drive, args.folder, state / 'receipts')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', default='/home/PracticeIELTS')
    parser.add_argument('--state', default='/var/lib/practiceielts-backup')
    parser.add_argument('--credentials', default='/etc/practiceielts/drive-backup.json')
    parser.add_argument('--folder', default=None, help='Private Drive parent folder; otherwise credentials.folder_id')
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    try:
        run(args)
    except Exception as error:
        # Never log HTTP responses, URLs or credential contents.
        LOG.error('Backup failed (%s). Pending snapshots retained; inspect service state.', type(error).__name__)
        raise SystemExit(1)
