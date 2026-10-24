# PracticeIELTS project plan

Project → milestone → epic → task → subtask. Source: docs/MASTER_PROMPT.md. Listening first; Reading/Writing/Speaking remain future modules. UI follows the supplied navy/teal dashboard reference with PracticeIELTS branding.

## Milestones and dependency order
1. M1 Foundation: E1 reproducible infrastructure; E2 accounts and authorization; E3 dynamic categories/material drafts; E4 shared shell, authenticated dashboard and library. PostgreSQL/Redis/Compose for deployed development; SQLite explicitly permitted only for lightweight local tests.
2. M2 Dictation: E1 private original audio and manual versioned segments; E2 deterministic comparison; E3 resumable practice and persistent responses; E4 actual audio workspace. Depends on M1.
3. M3 Content intelligence: E1 Celery jobs/provider interfaces; E2 transcription/alignment; E3 waveform editor, undo/redo, review/publish. Depends on M2.
4. M4 Learning: E1 transcript study/notes; E2 saved mistakes; E3 activity and accuracy analytics. Depends on M2.
5. M5 Exams: E1 question authoring; E2 restricted timed attempts; E3 scoring/review. Depends on M1/M2; never reuse unrestricted playback for exam sessions.
6. M6 Optional integrations: Telegram import, additional providers and teacher assignment. Depends on stable M3. Future language modules out of scope.

## Architecture and entities
See ARCHITECTURE.md and API_CONTRACT.md. Every task in TASKS.md defines dependencies, acceptance and verification; implement in that order and update only after tests. M1/M2 form the first functional vertical increment, not a claim of the entire roadmap being complete.

## Risks and assumptions
- Empty repository: no legacy data or contracts.
- No external storage/AI credentials supplied. Private filesystem storage supports local development; S3 is configurable. Providers must never fabricate transcriptions.
- No licensed IELTS content supplied: no copyrighted assets or misleading Cambridge content will be seeded.
- Docker daemon and browsers may not be available. Record actual results; never substitute SQLite checks for verified PostgreSQL checks.
- AI alignment, complete exam question types, and production operations require later verified increments.

## Validation
Backend permission, hierarchy cycle, publication, answer normalization, ownership, version stability and resume tests. Frontend build/type checking, component tests, and browser integration. Critical E2E: staff creates category/material → uploads real audio → authors segments → publishes → student practises → checks answer → navigates away → resumes. Use original synthesized/test audio only.

## Revised real-app execution
The user approved moving the prototype workflow into Django/React: a teacher uploads a mock audio once, optionally supplies a reference transcript, and uploads typed questions or a PDF. Audio must produce real word timestamps and automatic dictation (easy chunk + word count; medium single sentence without count; hard consecutive 2–3 sentences without count). The same material serves timed or untimed question-based Mock. No separate practice authoring is required. Review/publish remains mandatory. Reading/Writing/Speaking stay future-only for both roles. Execute REAL-01 → REAL-02 → REAL-03; save verified increments to main.

Default transcription is local faster-whisper on CPU (int8, bounded threads), avoiding paid API requirements. The public model download requires Hugging Face access; existing environment has no transcription credentials or model cache. Reference text is preserved and aligned to recognized word anchors; low-confidence or unaligned text must be flagged, never replaced with proportional fake timestamps. PDF text extraction is not a promise of automatic reliable exam/answer parsing; teacher review and question controls remain necessary.
