# Tasks

Read PROJECT_PLAN.md before implementing. Each entry is Project PracticeIELTS → Milestone → Epic → Task; subtasks are the acceptance steps.

## M1 / M1-E1 / M1-01 — Reproducible monorepo infrastructure
- Description: Install pinned dependencies; configure Django/React, Compose PostgreSQL/Redis/worker, env example.
- Milestone: M1
- Dependencies: None
- Priority: Critical
- Status: Completed
- Subtasks / acceptance criteria: Install pinned dependencies; configure Django/React, Compose PostgreSQL/Redis/worker, env example.
- Verification: Django checks, frontend production build, Compose configuration; run services when supported.

- Evidence (2026-10-24): PostgreSQL pytest suite, Django checks/migration drift check, strict OpenAPI validation, frontend typecheck/production build, Vitest, and Playwright teacher→student flow passed. See docs/STATUS.md for exact counts and scope.

## M1 / M1-E2 / M1-02 — Accounts, JWT and server roles
- Description: Custom user; registration always student; login/refresh/profile; staff-only writes.
- Milestone: M1
- Dependencies: M1-01
- Priority: Critical
- Status: Completed
- Subtasks / acceptance criteria: Custom user; registration always student; login/refresh/profile; staff-only writes.
- Verification: API tests reject anonymous/incorrect roles and validate login/refresh.

- Evidence (2026-10-24): PostgreSQL pytest suite, Django checks/migration drift check, strict OpenAPI validation, frontend typecheck/production build, Vitest, and Playwright teacher→student flow passed. See docs/STATUS.md for exact counts and scope.

## M1 / M1-E3 / M1-03 — Dynamic category tree
- Description: Create/edit/move/order/description; prevent cycles and destructive deletion.
- Milestone: M1
- Dependencies: M1-02
- Priority: Critical
- Status: Completed
- Subtasks / acceptance criteria: Create/edit/move/order/description; prevent cycles and destructive deletion.
- Verification: API tests for cycles, student writes, protected references.

- Evidence (2026-10-24): PostgreSQL pytest suite, Django checks/migration drift check, strict OpenAPI validation, frontend typecheck/production build, Vitest, and Playwright teacher→student flow passed. See docs/STATUS.md for exact counts and scope.

## M1 / M1-E3 / M1-04 — Material drafts and visibility
- Description: Metadata and licensing; unpublished content visible only to authorized editors.
- Milestone: M1
- Dependencies: M1-03
- Priority: Critical
- Status: Completed
- Subtasks / acceptance criteria: Metadata and licensing; unpublished content visible only to authorized editors.
- Verification: Draft visibility and permission tests.

- Evidence (2026-10-24): PostgreSQL pytest suite, Django checks/migration drift check, strict OpenAPI validation, frontend typecheck/production build, Vitest, and Playwright teacher→student flow passed. See docs/STATUS.md for exact counts and scope.

## M1 / M1-E4 / M1-05 — Reference design shell and real dashboard
- Description: Responsive navy header, sidebar, teal cards; search, routes, empty states and real API stats.
- Milestone: M1
- Dependencies: M1-04
- Priority: High
- Status: Completed
- Subtasks / acceptance criteria: Responsive navy header, sidebar, teal cards; search, routes, empty states and real API stats.
- Verification: Typecheck/build and browser navigation/empty dashboard test.

- Evidence (2026-10-24): PostgreSQL pytest suite, Django checks/migration drift check, strict OpenAPI validation, frontend typecheck/production build, Vitest, and Playwright teacher→student flow passed. See docs/STATUS.md for exact counts and scope.

## M2 / M2-E1 / M2-01 — Validated private original audio
- Description: Upload validates decoded audio, duration and size; authenticated range streaming.
- Milestone: M2
- Dependencies: M1-04
- Priority: Critical
- Status: Completed
- Subtasks / acceptance criteria: Upload validates decoded audio, duration and size; authenticated range streaming.
- Verification: Upload invalid data rejected; authorized media/range tests.

- Evidence (2026-10-24): PostgreSQL pytest suite, Django checks/migration drift check, strict OpenAPI validation, frontend typecheck/production build, Vitest, and Playwright teacher→student flow passed. See docs/STATUS.md for exact counts and scope.

## M2 / M2-E1 / M2-02 — Versioned manual transcript publishing
- Description: Manual segments with speaker/start/end; publish only validated content and rights metadata.
- Milestone: M2
- Dependencies: M2-01
- Priority: Critical
- Status: Completed
- Subtasks / acceptance criteria: Manual segments with speaker/start/end; publish only validated content and rights metadata.
- Verification: Invalid timestamps and publication checks; historical versions unchanged.

- Evidence (2026-10-24): PostgreSQL pytest suite, Django checks/migration drift check, strict OpenAPI validation, frontend typecheck/production build, Vitest, and Playwright teacher→student flow passed. See docs/STATUS.md for exact counts and scope.

## M2 / M2-E2 / M2-03 — Deterministic word comparison
- Description: Word edit alignment; correct/missing/extra/incorrect labels; configurable normalization; originals retained.
- Milestone: M2
- Dependencies: M2-02
- Priority: Critical
- Status: Completed
- Subtasks / acceptance criteria: Word edit alignment; correct/missing/extra/incorrect labels; configurable normalization; originals retained.
- Verification: Unit tests for punctuation, missing, extra, spelling and word order.

- Evidence (2026-10-24): PostgreSQL pytest suite, Django checks/migration drift check, strict OpenAPI validation, frontend typecheck/production build, Vitest, and Playwright teacher→student flow passed. See docs/STATUS.md for exact counts and scope.

## M2 / M2-E3 / M2-04 — Practice persistence and resume
- Description: Session version/difficulty/current segment; autosave answer; checks and progress; ownership enforced.
- Milestone: M2
- Dependencies: M2-03
- Priority: Critical
- Status: Completed
- Subtasks / acceptance criteria: Session version/difficulty/current segment; autosave answer; checks and progress; ownership enforced.
- Verification: Integration tests for resume, ownership and repeat checks.

- Evidence (2026-10-24): PostgreSQL pytest suite, Django checks/migration drift check, strict OpenAPI validation, frontend typecheck/production build, Vitest, and Playwright teacher→student flow passed. See docs/STATUS.md for exact counts and scope.

## M2 / M2-E4 / M2-05 — Integrated audio dictation workspace
- Description: Easy/medium/hard/full intervals; seek, speed, volume, keyboard; editor/hints/check/retry and resume.
- Milestone: M2
- Dependencies: M2-04,M1-05
- Priority: High
- Status: Completed
- Subtasks / acceptance criteria: Easy/medium/hard/full intervals; seek, speed, volume, keyboard; editor/hints/check/retry and resume.
- Verification: Browser critical flow using original audio fixture.

- Evidence (2026-10-24): PostgreSQL pytest suite, Django checks/migration drift check, strict OpenAPI validation, frontend typecheck/production build, Vitest, and Playwright teacher→student flow passed. See docs/STATUS.md for exact counts and scope.

## M3 / M3-E1 / M3-01 — Asynchronous processing foundation
- Description: Separate audio/transcription/alignment/segmentation interfaces; Celery jobs, retries/idempotency/status.
- Milestone: M3
- Dependencies: M2-02
- Priority: High
- Status: Pending
- Subtasks / acceptance criteria: Separate audio/transcription/alignment/segmentation interfaces; Celery jobs, retries/idempotency/status.
- Verification: Worker integration tests with real Redis; provider failure tests.

## M3 / M3-E2 / M3-02 — Transcription and forced alignment providers
- Description: Audio-only and authoritative text workflows; measurable status/errors and editable output.
- Milestone: M3
- Dependencies: M3-01
- Priority: High
- Status: Pending
- Subtasks / acceptance criteria: Audio-only and authoritative text workflows; measurable status/errors and editable output.
- Verification: Provider contract tests and licensed real-audio integration; external credentials if necessary.

## M3 / M3-E3 / M3-03 — Visual transcript editor
- Description: Waveform/timeline, split/merge, timestamp drag, undo/redo, autosave, preview and approval.
- Milestone: M3
- Dependencies: M3-02
- Priority: High
- Status: Pending
- Subtasks / acceptance criteria: Waveform/timeline, split/merge, timestamp drag, undo/redo, autosave, preview and approval.
- Verification: Browser editor and version integrity tests.

## M4 / M4-E1 / M4-01 — Transcript study and vocabulary
- Description: Click/play sentence, active highlight, notes and difficult sentence persistence.
- Milestone: M4
- Dependencies: M2-05
- Priority: High
- Status: Pending
- Subtasks / acceptance criteria: Click/play sentence, active highlight, notes and difficult sentence persistence.
- Verification: API and browser tests.

## M4 / M4-E2 / M4-02 — Mistake review
- Description: Persistent mistakes, retry/review/resolution, original response and version.
- Milestone: M4
- Dependencies: M2-04
- Priority: High
- Status: Pending
- Subtasks / acceptance criteria: Persistent mistakes, retry/review/resolution, original response and version.
- Verification: Ownership and review workflow tests.

## M4 / M4-E3 / M4-03 — Progress analytics
- Description: Weekly activity, accuracy, completed groups, duration, repeats and history without fabricated data.
- Milestone: M4
- Dependencies: M2-04
- Priority: High
- Status: Pending
- Subtasks / acceptance criteria: Weekly activity, accuracy, completed groups, duration, repeats and history without fabricated data.
- Verification: Aggregate tests and browser real-data checks.

## M5 / M5-E1 / M5-01 — Question model and authoring
- Description: Multiple choice, matching, all completion types, short answers, maps/diagrams and answer keys.
- Milestone: M5
- Dependencies: M1-04
- Priority: High
- Status: Pending
- Subtasks / acceptance criteria: Multiple choice, matching, all completion types, short answers, maps/diagrams and answer keys.
- Verification: Validation and authoring tests for every type.

## M5 / M5-E2 / M5-02 — Timed exam attempts
- Description: Server deadline and playback access; no hints or transcript before submission; autosave.
- Milestone: M5
- Dependencies: M5-01
- Priority: High
- Status: Pending
- Subtasks / acceptance criteria: Server deadline and playback access; no hints or transcript before submission; autosave.
- Verification: Security tests for replay, deadlines, answer-key leaks and repeated submissions.

## M5 / M5-E3 / M5-03 — Scoring and results
- Description: Deterministic scoring, result review and score history.
- Milestone: M5
- Dependencies: M5-02
- Priority: High
- Status: Pending
- Subtasks / acceptance criteria: Deterministic scoring, result review and score history.
- Verification: Scoring fixtures and end-to-end timed test.

## M6 / M6-E1 / M6-01 — Optional Telegram import
- Description: Authorized teacher bot import copies to primary private storage; no token/URL leaks.
- Milestone: M6
- Dependencies: M3-03
- Priority: Low
- Status: Pending
- Subtasks / acceptance criteria: Authorized teacher bot import copies to primary private storage; no token/URL leaks.
- Verification: Bot auth and provider integration tests.

## M6 / M6-E2 / M6-02 — Additional providers and teacher scopes
- Description: Replaceable providers, assigned editors, audit monitoring and role management.
- Milestone: M6
- Dependencies: M3-03
- Priority: Low
- Status: Pending
- Subtasks / acceptance criteria: Replaceable providers, assigned editors, audit monitoring and role management.
- Verification: Provider contract and role boundary tests.
