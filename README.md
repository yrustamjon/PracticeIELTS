# PracticeIELTS

A listening-first IELTS learning platform: Django REST Framework, React/TypeScript and PostgreSQL. The interface follows the supplied dashboard reference: navy header, light sidebar, teal actions, restrained cards and responsive workspaces. All branding is PracticeIELTS.

## Current increment

Working accounts/JWT refresh, server-side student/teacher/admin permissions, dynamic nested collections, draft materials, validated private audio, manual timestamped transcript versions, publication gates, deterministic word comparison, difficulty-based dictation, autosave/resume, response-derived dashboard/activity and basic transcript playback/mistake history.

New accounts have honest empty states. No IELTS books, copyrighted recordings, fabricated user statistics or shared default accounts are seeded. Automatic transcription/alignment, waveform editing, vocabulary notes, resolved-mistake tracking and mock exams remain roadmap tasks. See TASKS.md and docs/STATUS.md for verification and limitations.

## Prerequisites

Python 3.12+, Node 24, npm, Docker Compose and FFmpeg/ffprobe. Debian/Ubuntu Chromium (`/usr/bin/chromium`) is used by the browser test; set CHROMIUM_PATH for another installed Chromium. Normal app use does not require Chromium.

```bash
bash infrastructure/setup.sh
```

The script creates a Python environment, installs pinned dependencies with npm ci, creates ignored local random development secrets only if .env does not exist, starts PostgreSQL/Redis, runs migrations and builds the frontend. Existing .env is preserved. If maintaining .env yourself, use .env.example and supply local secrets; never commit them. infrastructure/run.py loads .env without printing its values and selects PostgreSQL when POSTGRES_PASSWORD is set. DATABASE_URL takes precedence. SQLite is an explicit lightweight alternative when no database URL/password is configured (or USE_SQLITE=1 without DATABASE_URL).

In separate terminals, from the repository root:

```bash
python infrastructure/run.py backend/.venv/bin/python backend/manage.py runserver 0.0.0.0:8000
npm --prefix frontend run dev -- --port 5173
python infrastructure/run.py backend/.venv/bin/celery --workdir backend -A config worker --loglevel=info --concurrency=2
```

Vite proxies /api to Django. Use the React frontend for account registration. Create the first administrator interactively, with no built-in password:

```bash
python infrastructure/run.py backend/.venv/bin/python backend/manage.py createsuperuser
```

Superusers have content permissions through is_staff. Administrators can assign teacher/admin roles through Django Admin. A teacher may modify their own materials; staff/admin may manage all materials. Students cannot elevate roles through registration or API calls. The content studio supports collection create/edit/move/reorder/safe delete and material drafts → audio → manual transcript → review/publish.

## Checks

```bash
python infrastructure/run.py backend/.venv/bin/python backend/manage.py check
python infrastructure/run.py backend/.venv/bin/pytest backend/tests -q
python infrastructure/run.py backend/.venv/bin/python backend/manage.py spectacular --file /tmp/practiceielts-openapi.yaml --validate --fail-on-warn
npm --prefix frontend test -- --run
npm --prefix frontend run build
# With both servers running:
npm --prefix frontend run test:e2e
```

The browser test creates unique disposable teacher/student accounts and an original synthetic speech recording with FFmpeg flite; it never uses copyrighted audio. Test-generated data is labeled with a unique suffix and removed by the test cleanup hook. Browser screenshots/traces are ignored under frontend/test-results. Tests against a shared live database should be avoided; use an isolated development database. Pytest creates and destroys its own database.

## Configuration and security

JWT access tokens stay in memory; refresh cookies are HttpOnly, rotating and revocable. Cookie auth endpoints require CSRF. Production requires DEBUG=false, an explicit secret, TLS, secure hosts/origins and shared throttle/cache settings (see docs/DEPLOYMENT.md). Original audio remains private, with authenticated Range-capable streaming and validated duration. Browser audio currently fetches an authenticated blob before playback, so large files wait for download; streaming signed URLs are a later optimization.

Default development media is an ignored private backend/media directory. S3_BUCKET/S3_ENDPOINT_URL and AWS credentials enable django-storages S3, preserving signed/private object access. S3 integration needs credentials and has not been validated against an external bucket.

OpenAPI: /api/v1/schema/ and /api/v1/docs/ on the backend. Shared API contracts and architecture live at the repository root. Read AGENTS.md to continue the roadmap.

Docker builds mount the host CA bundle as a BuildKit secret to preserve TLS verification behind the cloud HTTPS proxy. BUILD_CA_BUNDLE can select a trusted PEM bundle on other hosts. No trust verification is disabled and no certificate is baked into the image.
