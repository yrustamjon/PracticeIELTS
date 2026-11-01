# Reading source preparation

The supplied Cambridge 10 full-book PDF is the current source. No book content,
question text or answer key is committed to Git. The page map contains locations
only. General Training, Listening and Writing pages are excluded.

Private prepared files live at
`backend/media/cambridge_documents/Reading/Cambridge_10/`:

| Folder | Passage 1 | Passage 2 | Passage 3 | Private key |
| --- | --- | --- | --- | --- |
| Test_1 | PDF 18–21 | PDF 22–25 | PDF 26–30 | PDF 153 |
| Test_2 | PDF 42–45 | PDF 46–49 | PDF 50–54 | PDF 155 |
| Test_3 | PDF 65–68 | PDF 69–72 | PDF 73–77 | PDF 157 |
| Test_4 | PDF 89–92 | PDF 93–97 | PDF 98–101 | PDF 159 |

Each test has `Full_Reading_Mock.pdf`, three `Passage_N.pdf` files and
`Answer_Key_PRIVATE.pdf`. The Full papers contain only the passage/question
pages. Keys stay in separate private files. `MANIFEST.json` records original
page numbers, sizes, SHA256 hashes and page rendering comparisons. All 108
output pages (including repeated passage pages in Full files) matched the
original PDF pixel for pixel at scale 1. Page locations were compared against
the original book contact sheets. This validates source-file completeness and
layout preservation; it does not validate a native transcription or scoring.

Reproduce into a new private directory:

```sh
backend/.venv/bin/python infrastructure/prepare-reading-sources.py \
  --source /private/path/Cambridge-IELTS-10-Ebook.pdf \
  --map infrastructure/reading-cambridge10-map.json \
  --output /private/new-directory/Cambridge_10
```

The command refuses overwrites, overlapping passage/key pages, incomplete
question ranges and out-of-bounds pages. It does not create database records or
publish anything. Existing Reading source files and version pins remain intact.

Interactive status: only Cambridge 10 Test 1 Passage 1 was previously published.
These PDF files do **not** add 4 interactive Full Reading Mocks. The remaining
11 passages need native question authoring and source/key review, including
headings/matching support where required. Full timed Reading also needs its own
persisted attempt behavior. Do not route these files through Listening merely
to make them appear in the catalogue. No deployment was performed.

## Media maintenance

`infrastructure/media-maintenance.py` inventories all current and historical
audio, question documents, Reading versions and Reading import-job sources.
It aborts on missing referenced files, unsafe paths, symlinks or unreadable
directories. Original `cambridge_documents/` and `cambridge_audio/` archives
are always preserved, including source PDFs without a current DB reference.
Recent uploads (less than one hour old) are retained.

Audit by default; `--quarantine` moves old unreferenced files only from
`originals/`, `question-documents/` and `reading-sources/` to an explicitly
selected directory outside media. Use while upload/processing is idle. The
final step rechecks database references under a write lock and compares file
hashes. Atomic same-filesystem moves and `RESTORE.json` preserve recoverability.
It never deletes a database record or permanently deletes media.

The 2026-10-28 run moved one unreferenced 100,116-byte Reading PDF to
`backups/media-quarantine-20261028/`. The receipt contains its original path and
hash. All 532 database-referenced files remained present. Post-audit found no
additional eligible files. Most media disk usage is referenced audio, not
disposable duplicates.

The local nightly-backup code now includes Reading version/import sources in
both snapshots and missing-file health checks. Its 24 infrastructure tests
(including preparation and cleanup safety checks) passed. No remote backup or
installed service update is claimed by this work.

## Resumable header inventory

`infrastructure/inventory-reading-headers.py --manifest PRIVATE_MANIFEST --output PRIVATE_OUTPUT --batch-size 20 --volume 11`
validates the original SHA256 and processes at most20 new pages per invocation.
It uses PDF text when available, otherwise a top40% header OCR; each page has
atomic JSON evidence. Temporary page images are removed after OCR. Repeating
resumes without changing completed evidence. The inventory identifies candidates
only: compare full original pages/questions/keys before native import. Keep all
outputs private under ignored backups or /tmp. Regression coverage verifies batch
limits, resume, temporary-image cleanup and changed-source rejection.
