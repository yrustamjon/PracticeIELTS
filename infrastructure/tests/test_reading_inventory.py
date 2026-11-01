"""Inventory must remain bounded and reusable without approving extracted content."""
import hashlib
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace

import pytest
from pypdf import PdfWriter

spec = importlib.util.spec_from_file_location(
    'reading_inventory', Path(__file__).parents[1] / 'inventory-reading-headers.py'
)
inventory = importlib.util.module_from_spec(spec)
spec.loader.exec_module(inventory)


def test_inventory_batch_limit_resume_and_source_identity(tmp_path, monkeypatch):
    source = tmp_path / 'original.pdf'
    writer = PdfWriter()
    for _ in range(3):
        writer.add_blank_page(width=300, height=400)
    with source.open('wb') as stream:
        writer.write(stream)
    manifest = tmp_path / 'manifest.json'
    manifest.write_text(json.dumps([{
        'volume': 11, 'path': str(source),
        'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    }]))
    output = tmp_path / 'inventory'
    monkeypatch.setattr('sys.argv', ['inventory', '--manifest', str(manifest), '--output', str(output), '--batch-size', '2'])
    calls = []

    def ocr(*args, **kwargs):
        calls.append(args)
        return SimpleNamespace(stdout='READING PASSAGE 1')

    monkeypatch.setattr(inventory.subprocess, 'run', ocr)
    inventory.main()
    first = (output / 'volume-11/001.json').read_bytes()
    assert len(calls) == 2
    assert len(list((output / 'volume-11').glob('*.json'))) == 2
    assert not list(output.rglob('*.png'))
    inventory.main()
    assert len(calls) == 3
    assert (output / 'volume-11/001.json').read_bytes() == first
    report = json.loads((output / 'inventory.json').read_text())[0]
    assert report['inventoried'] == [1, 2, 3]
    assert len(report['heading_candidates']) == 3
    assert report['review_status'].startswith('Unreviewed')
    source.write_bytes(source.read_bytes() + b'\nchanged')
    with pytest.raises(ValueError, match='Source hash changed'):
        inventory.main()
