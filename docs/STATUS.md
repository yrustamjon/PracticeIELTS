# PracticeIELTS — current handoff

## Latest real-application increment
Implemented in backend/ and frontend/ (not only demo/): audio-only uploads queue durable Celery jobs; a real local faster-whisper CPU model produces transcript/word timestamps; optional TXT/PDF reference text uses reviewed recognized-word anchors. Generated versions require teacher review before publication. Easy displays word count and uses anchored chunks; Medium is one sentence without count; Hard plays up to three sentences. Legacy session grouping is preserved through a versioned migration.

The same material now has normalized, versioned exam question sets: multiple choice/multi-select, matching, form/note/table/sentence completion, short answer, maps and diagrams. Private question PDFs are extracted for editors and rendered to PNG; only explicitly approved pages reach students. PDF quick setup uses teacher-provided answer keys; it does not invent questions or answers. Both timed and untimed mocks save/resume answers, enforce deadlines only for timed attempts, score deterministically, and expose keys after submission. Single-use audio tickets and active-exam study-route guards are implemented. Reading/Writing/Speaking are future placeholders for both roles.

The content studio now uploads audio + optional transcript, shows real job stages/errors, accepts typed questions or PDF, reviews generated segments, and publishes Mock + Practice together. No per-sentence timestamps are required in the normal workflow. Advanced manual recovery remains available. Root .env is loaded consistently by plain Django/Celery commands. Setup is portable to Mac cache/CA paths; Node 24.15+ and PyAV 15.1.0 compatibility are pinned.

## Final verification
- **50 PostgreSQL backend tests passed** in one run with RUN_SPEECH_TESTS=1 and WHISPER_LOCAL_ONLY=true. This includes real base.en audio-only transcription, authoritative-reference preservation/alignment, automatic grouping and publication, plus pipeline failures/permissions, all question types, PDF extraction/rendering/page privacy, timed expiry, untimed persistence, version pinning, legacy grouping and bounded comparison.
- **3 Vitest tests passed**; React TypeScript/production build passed.
- **2 browser tests passed** with the real Django server, PostgreSQL, Redis and Celery worker:
  1. Real upload processing succeeded; an explicitly authored manual transcript fixture then verifies private PDF/question creation, publication, dictation checking/resume/refresh, untimed no-timer flow, single-start audio, 100% scoring, timed expiry/50% score and responsive layout.
  2. Strict audio-only upload with **no manual transcript, reference or timestamps** reaches real worker success; generated sentences appear, teacher reviews/publishes, student plays Easy and checks the actual recognized reference at 100%; Medium/Hard grouping and hidden word count are verified. No stub speech provider is used in this browser test.
- Django checks, strict OpenAPI (--fail-on-warn), migration drift and Ruff passed. No failed/skipped tests in the final full backend run.
- PREPARE_SPEECH_MODEL=1 bash infrastructure/setup.sh passed after setup already existed: frozen dependencies, project-local npm cache, PostgreSQL/Redis startup, migrations/checks, production build and pinned model preparation are repeatable.
- Real original 49-second MP3 transcription ran with tiny.en and base.en. Weight content hashes were verified; base.en is default at revision 3d3d5dee26484f91867d81cb899cfcf72b96be6c. The sample comparison was 93% normalized word accuracy, a single fixture rather than a general guarantee; teacher review remains required.
- Earlier model failures were diagnosed and fixed: Hub/CDN network requirements include the actual us.aws.cdn.hf.co host; the supported HTTPS downloader preserves TLS; PyAV 15.1.0 restores metadata_errors compatibility with the speech provider. No HF token or paid transcription key was needed.
- Browser fixtures cleaned up their disposable accounts/materials/audio/PDFs. Screenshots are ignored under frontend/test-results. No production material or default accounts are seeded.

## Saved cloud configuration
install_script now runs PREPARE_SPEECH_MODEL=1 bash infrastructure/setup.sh. start_skill records the real worker/model cache, three-service startup, current tests, existing-checkout guidance and product boundaries. Required Hub/CDN domains are saved in the network draft. Draft persistence is confirmed; publication/restoration in a new task is not claimed. Review/save the environment settings and publish through the product to preserve the prepared environment.

## Remaining product limitations
- Reference alignment is recognized-word anchoring with explicit unknown timestamps and review flags, not a full phoneme forced aligner. Waveform split/merge/undo/redo remains future work.
- PDFs can display scanned pages but no automatic OCR or reliable arbitrary exam/answer-key inference is claimed; teacher authoring and page selection are required.
- Single-use media delivery is not DRM; received bytes can be retained by a determined client. Exam audio currently loads an authenticated blob; leaving/reloading does not grant a new start.
- S3 configuration exists but no external bucket smoke test was run. Vocabulary notes, saved/resolved mistake workflow, richer analytics, Telegram, production hardening and broad accessibility/browser audits remain pending.
- No copyrighted IELTS assets, outside-site scraping, default passwords, deployment, or environment publication were performed. Source demo/ remains a separate local interface prototype.

## Continuation
The requested real upload-once → automatic Practice and typed/PDF timed/untimed Mock increment is implemented and verified. Read AGENTS.md and TASKS.md for follow-up work: M3-04 phoneme forced alignment, M3-03 waveform editing, M4 vocabulary/resolved mistakes/analytics and later optional integrations. Preserve historical transcript/question versions and user work. Push verified increments directly to main as authorized; no force pushes or deployment.

## 2026-10-24 question authoring support
- Material 3 has audio, a two-page PDF and a completed transcript, but no saved question set. A PUT `/api/v1/materials/3/questions/` returned HTTP 400 with an 80-byte response. The backend's `max_words` validation for an accepted answer longer than its configured limit reproduces exactly that response size; the request body was not captured, so the affected question remains unconfirmed.
- Frontend API errors now show nested question number and field instead of `[object Object]`. The regression test failed before the change and passed after it; the full frontend suite passed (4 tests), production build passed, and `git diff --check` passed.
- The user corrected Question 9's word-limit validation and saved the set. Verified material 3 has question set 1 with 10 persisted questions; it is not published yet. Next action: review the generated transcript/audio and explicitly publish the material when ready.

## Latest requested open task — PDF layout with inline inputs (2026-10-24)
The user wants the student Mock to resemble the uploaded IELTS question PDF page by page, preserving headings, instructions, notes, tables and spacing, with writable inputs placed at the numbered answer blanks. The current application still renders PDF pages as PNG beside separate question controls; it does not meet this request. REAL-02A is **Pending** and is the final item requested in this conversation, alongside other pre-existing Pending roadmap tasks. The approved approach is documented in docs/superpowers/specs/2026-10-24-pdf-question-inputs-design.md with a future implementation plan. A partial separate-input conversion was explored and then removed because it did not meet the clarified requirement. No PDF-layout implementation is claimed or published. Next action: implement and verify PDF page geometry, private page rendering, teacher position review and inline student inputs; then update task evidence.
