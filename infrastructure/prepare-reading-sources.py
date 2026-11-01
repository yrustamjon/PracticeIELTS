#!/usr/bin/env python3
"""Prepare private, answer-free Reading papers from an explicitly mapped source.

This makes source files, not reviewed native questions or published app records.
Page numbers in the map are one-based original PDF pages.
"""
import argparse
import hashlib
import json
from pathlib import Path

import pypdfium2 as pdfium
from pypdf import PdfReader, PdfWriter


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def prepare(source, mapping, output):
    source, output = Path(source), Path(output)
    reader = PdfReader(source)
    tests = mapping['tests']
    if not tests or len({t['test'] for t in tests}) != len(tests):
        raise ValueError('Provide unique tests.')
    all_source_pages = set()
    all_key_pages = {n for t in tests for n in t['key_pages']}
    for test in tests:
        if test['test'] < 1 or len(test['passages']) != 3:
            raise ValueError('Each test requires three passages.')
        if [p['passage'] for p in test['passages']] != [1, 2, 3]:
            raise ValueError('Order passages 1, 2, 3.')
        if [p['questions'] for p in test['passages']] != [[1, 13], [14, 26], [27, 40]]:
            raise ValueError('Verify complete question coverage 1–40.')
        for passage in test['passages']:
            pages = passage['pages']
            if not pages or pages != list(range(pages[0], pages[-1] + 1)):
                raise ValueError('Each passage requires ordered consecutive pages.')
            if all_source_pages.intersection(pages) or all_key_pages.intersection(pages):
                raise ValueError('Overlapping passage pages or answer-key exposure.')
            all_source_pages.update(pages)
    for n in all_source_pages | all_key_pages:
        if isinstance(n, bool) or not isinstance(n, int) or not 1 <= n <= len(reader.pages):
            raise ValueError('Page outside original PDF.')
    if not all_key_pages or any(not t['key_pages'] for t in tests):
        raise ValueError('Each test requires separate key evidence.')
    # Refuse overwrites, including a partially prepared earlier run.
    output.mkdir(mode=0o700, parents=True, exist_ok=False)
    manifest = {'format': 1, 'book': mapping['book'], 'source_name': source.name,
                'source_sha256': sha256(source), 'source_pages': len(reader.pages),
                'state': 'source_files_prepared_not_published', 'files': []}
    with pdfium.PdfDocument(str(source)) as original:
        def emit(relative, numbers, role, test, passage=None, questions=None):
            target = output / relative
            target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            writer = PdfWriter()
            for number in numbers:
                writer.add_page(reader.pages[number - 1])
            with target.open('xb') as stream:
                writer.write(stream)
            target.chmod(0o600)
            # Pixel comparison catches dropped/reordered images, crops or fonts.
            with pdfium.PdfDocument(str(target)) as result:
                if len(result) != len(numbers):
                    raise RuntimeError('Output page count mismatch.')
                for index, number in enumerate(numbers):
                    a, b = original[number - 1], result[index]
                    try:
                        if a.get_size() != b.get_size():
                            raise RuntimeError('Output page dimensions changed.')
                        x, y = a.render(scale=1), b.render(scale=1)
                        try:
                            if x.to_pil().tobytes() != y.to_pil().tobytes():
                                raise RuntimeError('Output differs from original page.')
                        finally:
                            x.close()
                            y.close()
                    finally:
                        a.close()
                        b.close()
            manifest['files'].append({'path': relative, 'role': role, 'test': test,
                                      'passage': passage, 'questions': questions,
                                      'original_pages': numbers, 'bytes': target.stat().st_size,
                                      'sha256': sha256(target), 'pixel_verified': True})
        for test in tests:
            folder = f"Test_{test['test']}"
            numbers = [n for p in test['passages'] for n in p['pages']]
            emit(f'{folder}/Full_Reading_Mock.pdf', numbers, 'full_mock', test['test'], questions=[1, 40])
            for p in test['passages']:
                emit(f"{folder}/Passage_{p['passage']}.pdf", p['pages'], 'passage', test['test'], p['passage'], p['questions'])
            emit(f'{folder}/Answer_Key_PRIVATE.pdf', test['key_pages'], 'private_key', test['test'])
    (output / 'MANIFEST.json').write_text(json.dumps(manifest, indent=2) + '\n')
    (output / 'MANIFEST.json').chmod(0o600)
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True)
    parser.add_argument('--map', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    result = prepare(args.source, json.loads(Path(args.map).read_text()), args.output)
    print(json.dumps({'book': result['book'], 'files': len(result['files']), 'pixel_verified': True, 'output': args.output}))
