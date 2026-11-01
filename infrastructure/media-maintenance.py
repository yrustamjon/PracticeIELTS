#!/usr/bin/env python3
"""Audit private local media; quarantine old unreferenced uploads reversibly.

Original Cambridge archives and manifests are always retained. References from
every historical asset/version/import row are protected, not just publications.
Use while upload/processing is idle. Never follows symlinks or rewrites the DB.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import time

FIELDS = {'learning_audioasset': 'file', 'exams_questiondocument': 'file',
          'reading_readingversion': 'source', 'reading_readingimportjob': 'source'}
MANAGED = {'originals', 'question-documents', 'reading-sources'}


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(block)
    return value.hexdigest()


def references(db):
    tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if not {'learning_audioasset', 'exams_questiondocument'}.issubset(tables):
        raise ValueError('Not a PracticeIELTS database.')
    names = set()
    for table, field in FIELDS.items():
        if table in tables:
            names.update(r[0] for r in db.execute(f'SELECT {field} FROM {table}') if r[0])
    for name in names:
        p = Path(name)
        if p.is_absolute() or '..' in p.parts or str(p) != name:
            raise ValueError('Unsafe database media reference.')
    return names


def inventory(root, db, min_age=3600):
    root = Path(root).resolve()
    refs = references(db)
    files = {}
    for folder, dirs, names in os.walk(root, followlinks=False, onerror=lambda e: (_ for _ in ()).throw(e)):
        for item in [*dirs, *names]:
            if (Path(folder) / item).is_symlink():
                raise ValueError('Media contains a symlink; audit manually.')
        for name in names:
            p = Path(folder) / name
            files[p.relative_to(root).as_posix()] = p
    missing = sorted(refs - files.keys())
    if missing:
        raise ValueError(f'Missing {len(missing)} database-referenced files; abort cleanup.')
    rows = []
    for name, path in sorted(files.items()):
        stat = path.stat()
        managed = Path(name).parts[0] in MANAGED
        eligible = name not in refs and managed and time.time() - stat.st_mtime >= min_age
        rows.append({'path': name, 'bytes': stat.st_size, 'referenced': name in refs,
                     'action': 'quarantine' if eligible else 'retain',
                     'sha256': digest(path) if eligible else None})
    return {'format': 1, 'referenced_files': len(refs), 'missing': [], 'files': rows,
            'quarantine_files': sum(r['action'] == 'quarantine' for r in rows),
            'quarantine_bytes': sum(r['bytes'] for r in rows if r['action'] == 'quarantine')}


def quarantine(root, db, report, destination):
    root, destination = Path(root).resolve(), Path(destination).resolve()
    if destination == root or root in destination.parents:
        raise ValueError('Quarantine must be outside media.')
    destination.mkdir(parents=True, exist_ok=False, mode=0o700)
    receipt = destination / 'RESTORE.json'
    moved = []
    # Serialize database writes during the final reference check and file moves.
    db.execute('BEGIN IMMEDIATE')
    try:
        refs = references(db)
        candidates = [r for r in report['files'] if r['action'] == 'quarantine']
        for row in candidates:
            relative = Path(row['path'])
            if relative.is_absolute() or '..' in relative.parts or relative.parts[0] not in MANAGED:
                raise ValueError('Unsafe quarantine path.')
            source = root / relative
            if row['path'] in refs or source.is_symlink() or root not in source.resolve().parents:
                raise ValueError('Media reference changed; audit again.')
            if digest(source) != row['sha256']:
                raise ValueError('Media changed; audit again.')
        def write_receipt():
            temporary = destination / 'RESTORE.json.tmp'
            temporary.write_text(json.dumps({'media_root': str(root), 'files': candidates,
                                             'moved': moved, 'restore': 'Stop uploads/workers. Verify SHA256. Move each quarantined file to media_root/path without overwriting.'}, indent=2) + '\n')
            temporary.chmod(0o600)
            temporary.replace(receipt)
        write_receipt()
        for row in candidates:
            source, target = root / row['path'], destination / row['path']
            target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            # Same-filesystem atomic rename: no partial file and no deleted copy.
            source.rename(target)
            moved.append(row['path'])
            write_receipt()
    finally:
        db.rollback()
    return {'quarantined': len(moved), 'bytes': sum(r['bytes'] for r in candidates), 'receipt': str(receipt)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', default=str(Path(__file__).resolve().parents[1]))
    parser.add_argument('--report', required=True)
    parser.add_argument('--quarantine')
    args = parser.parse_args()
    os.umask(0o077)
    project = Path(args.project).resolve()
    media = project / 'backend/media'
    mode = 'rw' if args.quarantine else 'ro'
    with sqlite3.connect(f'file:{project / "backend/db.sqlite3"}?mode={mode}', uri=True) as db:
        result = inventory(media, db)
        Path(args.report).write_text(json.dumps(result, indent=2) + '\n')
        print(json.dumps({k: v for k, v in result.items() if k != 'files'}))
        if args.quarantine:
            print(json.dumps(quarantine(media, db, result, args.quarantine)))
