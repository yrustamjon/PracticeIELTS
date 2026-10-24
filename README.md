# PracticeIELTS

A listening-first IELTS platform built with Django REST Framework, React/TypeScript, PostgreSQL, Redis and Celery. One listening material provides exam questions and automatically generated Practice. The navy/teal UI follows the supplied dashboard reference.

## Real application workflow

1. Create a collection and a listening material in **Admin Panel**.
2. Save the title, source, license and permission confirmation.
3. Upload the audio once. The worker uses a real local faster-whisper model to transcribe it and produce word timestamps. An authoritative transcript is optional: paste it or upload UTF-8 TXT / text-based PDF.
4. Upload a question PDF, select its question pages and create editable answer fields. Keep original PDF layout enabled to preserve the complete paper; review every field position and answer key before saving/publishing. Text-only authoring remains optional.
5. Listen to generated sentences, correct recognition errors if necessary, confirm review and publish.
6. Students choose **Listening Mock** (timed or untimed), **Practice**, or **Transcript Study** from the same material. A material without exam questions offers Practice only.

Practice levels:

- **Easy:** short word-timed chunks or one sentence; expected word count is visible.
- **Medium:** one complete sentence; no word count.
- **Hard:** up to three consecutive sentences; no word count.

The original audio is preserved. Students cannot upload content or access editor APIs. Reading/Writing/Speaking are explicitly future modules for both roles. No copyrighted IELTS books/audio, fictional progress or default shared passwords are seeded.

## Local setup (Mac / Linux)

Prerequisites: Python 3.12, Node **24.15+** (tested 24.19.0; `.nvmrc`), FFmpeg/ffprobe and Docker Desktop/Compose. The first speech-model download needs Hugging Face access. No paid API key is needed.

```bash
bash infrastructure/setup.sh
# Optional: download the speech model now rather than on the first upload.
backend/.venv/bin/python backend/manage.py download_transcription_model
```

Setup installs frozen dependencies, preserves an existing `.env`, generates local development secrets only if missing, starts PostgreSQL/Redis, runs migrations and builds React. Cache paths are project-local and work on Mac. The app loads the root `.env` automatically without overriding injected runtime variables. With `POSTGRES_PASSWORD` set and no explicit `DATABASE_URL`, it selects local PostgreSQL. Without either, it uses SQLite for lightweight development; the cloud integration suite uses PostgreSQL.

Then use three terminals:

```bash
# Terminal 1 — backend, from the repository root
source backend/.venv/bin/activate
python backend/manage.py runserver
```

```bash
# Terminal 2 — frontend
cd frontend
npm run dev
```

```bash
# Terminal 3 — audio worker
cd backend
source .venv/bin/activate
celery -A config worker --loglevel=info --concurrency=1
```

Keep the worker running for automatic transcription. Vite proxies API requests to Django. Create a staff account interactively:

```bash
backend/.venv/bin/python backend/manage.py createsuperuser
```

Users register through React. Staff can assign teacher/admin roles in Django Admin. Teacher writes are limited to their own materials; staff/admin can manage all materials. Registration cannot elevate a student's role.

## Audio processing

`base.en` is the default local CPU/int8 model; `tiny.en` is available for lighter machines. Both use reviewed pinned model revisions, and downloaded LFS weights are checked against their content hash. The model cache is ignored under `backend/.cache/whisper`. Set `WHISPER_MODEL`, `WHISPER_THREADS`, optional `WHISPER_MODEL_REVISION` or `WHISPER_CACHE_DIR` in `.env`. Use `WHISPER_LOCAL_ONLY=true` on pre-provisioned/offline machines.

Jobs persist their queued/running/succeeded/failed state, stage, errors and result version. Repeated submissions are deduplicated; failed jobs can retry. Stale jobs cannot replace a newer recording/request. Published transcript versions and historical student sessions are preserved. Existing practice sessions retain their legacy grouping; new sessions use the revised difficulty rules.

Optional reference text uses recognized-word anchors. Unmatched words keep unknown timestamps and are flagged for review; the site never distributes fake proportional timestamps. This is **not a phoneme-level forced aligner**. Speech errors and low confidence require human review; full phoneme alignment and a waveform editor remain future enhancements.

The supported Hub HTTPS downloader is used behind proxies with TLS verification intact. Required download hosts include `huggingface.co` and its actual model CDN `us.aws.cdn.hf.co`; cloud settings also retain the Hub/Xet download domains. `av==15.1.0` is pinned because newer PyAV removed an API used by the installed speech provider.

## Existing text mocks use the compact paper automatically

Previously saved text question sets and active attempts now use the same compact question-paper layout as the reference. Consecutive questions with matching instructions share a Questions range and one instruction paragraph. Stored prompts/context and inline fields are retained; repeated technical question-type labels and per-row toolbars are removed. Review controls are in a collapsible section. Timer/Submit controls sit in the top toolbar so the paper starts directly below it. No re-import, data migration, republishing or answer reset is needed for this presentation correction.

This displays the content already saved in the question version. It does not reconstruct source headings or notes that a previous import never stored. Complete source-paper content still requires the formatted-section/PDF workflow below; no missing text is invented.

## Native HTML exam like the supplied reference

The listening workspace now uses a compact white header/audio toolbar, a full question paper and bottom Part navigation. Notes, forms and tables retain their complete text with native answer fields embedded in place; radio/checkbox choices stay beside their option text. The current part expands its question numbers, while other parts show their actual question counts. Timed/untimed behavior, autosave, review flags and one-play audio restrictions remain enforced. Fullscreen is available from the exam toolbar; source controls that reveal keys/transcripts or unrestricted replay are not copied.

In Content Studio, upload **HTML question paper**. The importer recognizes `id="part1"` … `id="part4"` sections and `data-question="1"` … `"40"` text inputs, radio/checkbox options and select controls, including the format of the user's reference. It creates editable sections and question drafts. Review all content and enter each answer key, then save and explicitly publish. Existing keys for matching question numbers are preserved rather than read from source scripts. In the formatted-paper editor, `{{1}}` marks an answer blank; `{{3:A}}` inserts one option control. Backend validation requires every question/option marker to match its part and option labels.

Only an inert, limited set of formatting tags and table spans is saved. Source scripts, event handlers, embedded keys, styles, source header/footer promotions and remote images/media are omitted. The provided reference contains an externally hosted map; importing its text does not import that figure. Review missing-figure warnings and supply an authorized complete representation before publishing such questions. This feature imports the reference's question format; it does not automatically recreate arbitrary PDF layouts as HTML. Original PDF and text-only modes remain available below.

After pulling, apply the migration from **inside backend** with your activated environment: `python manage.py migrate`. Existing saved/published question sets remain pinned; upload/import and publish a new version to use the native paper format.

## Exam questions and PDFs

Upload the question PDF and keep **Original PDF layout with interactive answer blanks** enabled. The original page is rendered with PDF.js, keeping the headings, complete text, fonts, tables, graphics and spacing. HTML answer fields sit over the actual blanks; answers autosave through the normal exam API. The selectable text layer and zoom controls remain available. This is the original document with working fields, not a reconstruction from isolated extracted prompts.

Select only question pages, enter the answer key and choose **Create editable questions from PDF**. Text PDFs with numbered dotted/underscored blanks get suggested field positions from PDFium character boxes, including numbers embedded inside forms, notes and table rows. Review each blue rectangle on the original page. To change a position or cover a blank the detector missed, choose its question and drag a new rectangle over the answer area. Scans/rotated pages and ambiguous layouts require manual question/field setup; no OCR or universal automatic placement is claimed. Save is blocked until every question has a valid field on an approved page. Answer keys are never invented.

Only approved isolated single-page PDFs are served to the student, through their own pinned attempt. Unselected answer-key pages and the full source PDF remain private. Existing question sets and student answers are preserved; adopting the new layout creates a new version and requires explicit publication. An older saved text-only set does not automatically become a PDF exam after pulling code.

Text-only authoring is still available by disabling the original-layout option. It supports multiple choice/multi-select, matching, form/note/table/sentence completion and short answer without JSON; `____` / `{{answer}}` puts a field inline. Text-only map/diagram tasks require complete written context. Original-layout mode preserves the actual figure from the approved PDF instead.

Question sets are versioned. Attempts pin both the transcript/audio version and the published question set. Timed deadlines are server-enforced; untimed attempts have no deadline and never expire because of elapsed time. Draft answers autosave and resume. Submission scores accepted answer variants and makes the attempt read-only.

The exam UI starts audio once. A single-use server ticket delivers it, and study/transcript/hint endpoints for that student's active material are blocked until submission. Once bytes reach a browser, a determined client can record or retain them; this is not DRM or a secure proctoring system. Leaving/reloading stops playback and does not grant a second start. Large recordings currently download into an authenticated blob before playback.

## Interface and navigation

PDF.js font/CMap/codec assets are copied locally during `npm ci`, `npm run dev` and `npm run build`. The worker and assets are served from this application; no third-party viewer/CDN or credentials are required.

The navy/teal dashboard, library, practice and Content Studio share accessible focus states and responsive cards. Library mode filters open the selected Dictation, Mock or Transcript route directly; search, collection filters, clearing and pagination live in the URL. The mobile drawer closes with Escape. The editor has linked Details → Audio → Questions → Review → Publish steps. Active Mock uses its own compact header, with the general sidebar/search removed from the exam view.

After pulling this increment, apply the new version-preserving migration before starting the backend:

```bash
backend/.venv/bin/python backend/manage.py migrate
```

## Validation

```bash
backend/.venv/bin/python backend/manage.py check
RUN_SPEECH_TESTS=1 backend/.venv/bin/pytest backend/tests -q
backend/.venv/bin/python backend/manage.py spectacular --file /tmp/schema.yaml --validate --fail-on-warn
npm --prefix frontend test -- --run
npm --prefix frontend run build
# Both servers and the real worker must be running:
npm --prefix frontend run test:e2e
```

Prepare the model before the real-ASR tests. Without `RUN_SPEECH_TESTS=1`, the explicit real-model test is skipped; it is not a readiness claim. Test audio/text and PDFs are original fixtures. Browser fixtures clean up disposable accounts, materials and files. Screenshots/traces are ignored under `frontend/test-results`. See `docs/STATUS.md` for the actual outcomes, remaining limitations and next tasks.

## Standalone interface demo

The earlier standalone prototype remains under `demo/` for design review:

```bash
open demo/index.html
```

It needs no npm/Django. Its custom-audio timing is approximate and it has no real authentication or AI. The **real application is `frontend/` + `backend/`**, with the workflow above.

## Deployment

Use environment-managed secrets and private storage. Local media is ignored under `backend/media`; optional S3-compatible storage is configured through `.env.example` and has not been tested against an external bucket. Never expose storage credentials to React. Docker builds mount the host CA bundle as a BuildKit secret; TLS and artifact verification remain enabled. No deployment/publication is implied by pushing code.

Production hardening and operational requirements are in `docs/DEPLOYMENT.md`. API contracts, architecture, tasks and contributor instructions live at the repository root.
