# Implementation status — 2026-10-24

## Completed increment
M1 foundation and M2 manual-content/core dictation tasks have been implemented and verified. The complete product roadmap is not finished. The supplied dashboard reference informs the shared navy/teal visual shell, sidebar, search, cards, responsive dashboard, material library, dictation and admin studio. New users see zero/empty data, never fictional statistics.

Implemented: accounts with JWT and CSRF-protected rotating HttpOnly refresh cookies; server roles; teacher material ownership; arbitrary-depth collection create/edit/move/reorder/safe delete; licensing metadata; draft visibility; validated private original audio; Range delivery; immutable transcript versions; manual segmentation/review/publish; difficulty intervals; original-answer preservation; word alignment and normalization; accessible comparison statuses; queued autosave and route-exit flush; resume and refresh restoration. Basic transcript study, checked mistake history and response-derived analytics are useful early portions of M4, not completion of all M4 acceptance criteria.

## Validation evidence
- 19 backend pytest tests passed against actual PostgreSQL 16. The earlier 17-test baseline also passed against SQLite; final new regressions were verified on PostgreSQL.
- Django system checks and migration drift check passed.
- OpenAPI validation with --fail-on-warn passed without warnings.
- 3 Vitest tests passed (including concurrent refresh regression).
- React/TypeScript production build passed.
- Playwright: 1 full browser integration test passed. An authorized teacher creates a collection/material, uploads original synthetic speech, saves two timed segments and publishes. A separate student account browses the library, plays actual audio with segment stopping, checks an intentionally incorrect answer (75%), moves to segment two, autosaves, leaves, resumes and refreshes, checks a correct answer (100%), and sees derived accuracy (88%). Mobile navigation and no-horizontal-overflow assertions passed.
- Docker PostgreSQL and Redis are healthy. Redis ping and Celery inspect ping returned success.
- Backend Docker image built with TLS verification preserved using host CA build secret. Initial container build failed because the cloud proxy CA was absent; supported CA-bundle injection fixed it, without trusted-host flags or verification bypass.
- infrastructure/setup.sh was run successfully after dependencies already existed: npm ci, migrations, checks and build are repeatable.
- Browser screenshots were visually inspected. Screenshots and traces are ignored test artifacts under frontend/test-results. Disposable test accounts/content were cleaned up; no production accounts or materials were seeded.

## Saved cloud configuration
install_script runs infrastructure/setup.sh. start_skill records service startup, working directory, required readiness checks and existing-checkout guidance. The draft save is confirmed; the user must review/save it in environment settings and publish the prepared environment. No publication or deployment is claimed, nor restoration in a fresh task.

## Limitations / pending work
- Next task: M3-01 asynchronous audio processing interfaces, persistent job states, idempotency and real worker integration. The Celery worker is configured and reachable, but has no transcription tasks yet.
- M3 transcription/alignment providers and waveform split/merge/undo/redo editor are pending. Manual text/timing is the supported current method.
- M4 vocabulary notes, saved difficult sentences, resolved-mistake workflow, duration accounting and broader learning history remain pending.
- M5 mock question types, timed exam restrictions and scoring are pending; UI explicitly labels availability and offers current dictation practice.
- M6 Telegram and extra providers remain optional and pending. Reading/Writing/Speaking remain future modules.
- S3 configuration is available but not tested against an external bucket. Development uses private local storage. Browser playback initially downloads an authenticated blob; large-file progressive playback remains an optimization.
- Collections currently have text metadata; image uploads/tags and advanced assignment/audit management UI are pending enhancements. Desktop sidebar is fixed; mobile navigation collapses into a drawer.
- Production deployment hardening and cross-browser/accessibility audits remain outstanding (docs/DEPLOYMENT.md). No external credentials are required for the currently verified workflow.

## Continuation
Read AGENTS.md and TASKS.md. Start M3-01, mark it In Progress and verify before marking Completed. Do not replace the manual workflow with simulated AI output. Preserve transcript versions and student response history. Push coherent verified increments directly to main as authorized, without force pushes or deployment.
