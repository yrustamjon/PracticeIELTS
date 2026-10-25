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
- Status: Completed
- Subtasks / acceptance criteria: Separate audio/transcription/alignment/segmentation interfaces; Celery jobs, retries/idempotency/status.
- Verification: Worker integration tests with real Redis; provider failure tests.

- Evidence: PostgreSQL backend suite (49 tests including safety/legacy checks), strict OpenAPI validation, and the real-app browser PDF/Practice/timed/untimed flow. See docs/STATUS.md for ASR limitations and final verification.

## M3 / M3-E2 / M3-02 — Local transcription and reviewed reference alignment
- Description: Audio-only and authoritative text workflows; measurable status/errors and editable output.
- Milestone: M3
- Dependencies: M3-01
- Priority: High
- Status: Completed
- Subtasks / acceptance criteria: Audio-only and authoritative text workflows; measurable status/errors and editable output.
- Verification: Provider contract tests and licensed real-audio integration; external credentials if necessary.

- Evidence: Real local base.en audio-only/reference integration passed after model CDN access and PyAV compatibility were corrected. Word-anchor alignment is implemented; phoneme forced alignment is tracked separately below.

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
- Status: Completed
- Subtasks / acceptance criteria: Multiple choice, matching, all completion types, short answers, maps/diagrams and answer keys.
- Verification: Validation and authoring tests for every type.

- Evidence: PostgreSQL backend suite (49 tests including safety/legacy checks), strict OpenAPI validation, and the real-app browser PDF/Practice/timed/untimed flow. See docs/STATUS.md for ASR limitations and final verification.

## M5 / M5-E2 / M5-02 — Timed exam attempts
- Description: Server deadline and playback access; no hints or transcript before submission; autosave.
- Milestone: M5
- Dependencies: M5-01
- Priority: High
- Status: Completed
- Subtasks / acceptance criteria: Server deadline and playback access; no hints or transcript before submission; autosave.
- Verification: Security tests for replay, deadlines, answer-key leaks and repeated submissions.

- Evidence: PostgreSQL backend suite (49 tests including safety/legacy checks), strict OpenAPI validation, and the real-app browser PDF/Practice/timed/untimed flow. See docs/STATUS.md for ASR limitations and final verification.

## M5 / M5-E3 / M5-03 — Scoring and results
- Description: Deterministic scoring, result review and score history.
- Milestone: M5
- Dependencies: M5-02
- Priority: High
- Status: Completed
- Subtasks / acceptance criteria: Deterministic scoring, result review and score history.
- Verification: Scoring fixtures and end-to-end timed test.

- Evidence: PostgreSQL backend suite (49 tests including safety/legacy checks), strict OpenAPI validation, and the real-app browser PDF/Practice/timed/untimed flow. See docs/STATUS.md for ASR limitations and final verification.

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

## Demo / D1 / DEMO-01 — Standalone interface review
- Description: Add the requested HTML/CSS/JS demo under demo/ so it can be pulled and opened locally.
- Milestone: Interface review follow-up
- Dependencies: Existing verified standalone demo
- Priority: High
- Status: Completed
- Subtasks / acceptance criteria: Include original audio and all assets, document opening demo/index.html, preserve clear demo limitations and keep the main application behavior unchanged.
- Verification: Copy integrity, JavaScript syntax check and complete asset references; original demo browser validation covers admin publication, three difficulties, audio, resume, mock scoring and mobile layout.

## Real workflow / R1 / REAL-01 — Upload once, auto-create dictation
- Description: Real application audio upload queues local Whisper transcription; optional reference transcript; word timings create easy chunks, medium single sentences and hard 2–3 sentences. Staff review/publish retains original audio and versioned results.
- Milestone: M3 / revised workflow
- Dependencies: M3-01,M3-02
- Priority: Critical
- Status: Completed
- Subtasks / acceptance criteria: Async persisted jobs/status/retry; audio-only and reference modes; correct word-count visibility; simple connected admin upload/review UI. No fabricated timestamps or transcript.
- Verification: Worker integration with original speech, reference/word segmentation tests, API permissions and browser upload→publish→practice.

- Evidence: Real-model backend integration and strict audio-only browser test both passed without manual text/timestamps. All 50 backend / 3 frontend / 2 browser tests passed; setup/model preparation repeated successfully.

## Real workflow / R2 / REAL-02 — Questions and PDF intake
- Description: Teacher-friendly real-exam question forms, private PDF upload and rendering, extract selectable PDF text for review. Scans or ambiguous PDFs must not fabricate question/answer extraction.
- Milestone: M5 / revised workflow
- Dependencies: M3-01 (question/PDF work is independently verifiable while model download is blocked)
- Priority: High
- Status: Completed
- Subtasks / acceptance criteria: Question types/validation, explicit answer keys, PDF preview and extracted text, ownership and private media checks.
- Verification: PDF text/scan/invalid upload tests; question type permission and authoring tests.

- Evidence: PostgreSQL backend suite (49 tests including safety/legacy checks), strict OpenAPI validation, and the real-app browser PDF/Practice/timed/untimed flow. See docs/STATUS.md for ASR limitations and final verification.

## Real workflow / R3 / REAL-03 — Timed and untimed real mock
- Description: Same published material provides question-based Mock plus generated Practice; timed/untimed attempts, persistent answers, scoring and results.
- Milestone: M5 / revised workflow
- Dependencies: REAL-02
- Priority: High
- Status: Completed
- Subtasks / acceptance criteria: Server deadlines in timed mode only; version pinning and answer keys hidden before submission; exam media restrictions; PDF presentation and question controls; no full-exam claim for demo content.
- Verification: Deadline/untimed/resume/scoring/permission tests and browser exam flow.

- Evidence: PostgreSQL backend suite (49 tests including safety/legacy checks), strict OpenAPI validation, and the real-app browser PDF/Practice/timed/untimed flow. See docs/STATUS.md for ASR limitations and final verification.

## M3 / M3-E2 / M3-04 — Phoneme forced alignment provider
- Description: Add a true audio/reference phoneme aligner alongside the current recognized-word anchor alignment.
- Milestone: M3
- Dependencies: M3-02
- Priority: High
- Status: Pending
- Subtasks / acceptance criteria: Preserve authoritative text; return word timestamps and confidence; expose unalignable regions; replaceable provider; no fabricated proportional timing.
- Verification: Real audio/reference alignment fixtures including ASR mismatches and names, plus provider contract tests.

## Real workflow / R2 / REAL-02A — PDF layout with inline answer inputs
- Description: Render approved question-PDF pages in the original IELTS-style layout, including headings, instructions and tables, with real answer inputs at the numbered blanks. Do not show a static PNG beside a separate answer list as the final experience.
- Milestone: M5 / revised workflow
- Dependencies: REAL-02
- Priority: High
- Status: Superseded by UX-01 (explicit user clarification: no images inside Mock)
- Subtasks / acceptance criteria: Detect answer-blank positions in text PDFs; review and correct positions before publication; display approved pages with keyboard-accessible inline inputs and autosave; keep answer-key pages private and historical attempts unchanged; show an honest manual fallback for scans or ambiguous layouts.
- Verification: PDF geometry and page-isolation tests, teacher review and version tests, browser layout/keyboard/autosave flow on the original two-page fixture.
- Next action: Do not implement the historical PDF.js plan; follow the text-only UX-01 scope.

## Frontend / UX-01 — Simple navigation and text-based IELTS-style Mock
- Priority: Critical
- Status: Completed
- User clarification: No images anywhere inside Mock. This supersedes REAL-02A's pending PDF-layout approach; retain that historical plan as superseded.
- Acceptance: Focused exam layout; text/choice/table controls; question jump and review flags; timed/untimed/autosave preserved; PDF source stays editor-only with selected-page text drafts and teacher review; simpler responsive library and navigation; no invented content or answer keys.
- Verification: Backend PDF text-draft/privacy/version tests, frontend controls/import tests, build, real-browser author→student timed/untimed flows and mobile layout.

- Evidence (2026-10-24): 56 PostgreSQL backend tests including real ASR; 10 frontend tests; TypeScript/production build; 3 live-service browser flows including all nine formats across 40 questions/four parts and 390px phone layout; Django/migration drift/strict OpenAPI/Ruff/diff checks passed. Reviewed desktop/mobile screenshots. New migration preserves historical question sets; no user material rewritten or published.

## PDF / UX-02 — Original question PDF with interactive answer blanks
- Priority: Critical
- Status: Completed
- Latest user clarification: Reproduce the uploaded PDF one-to-one, preserving its complete text, headings, tables, fonts and placement. This supersedes the prior text-only interpretation for imported question papers.
- Acceptance: Render the original approved PDF page with real writable controls at numbered blanks; detect inline dotted/underscored fields using glyph boxes; teacher position review/manual drawing; one-page authenticated delivery; no unapproved key pages or historical version mutation; autosave/zoom/resume/scoring retained. Scans and ambiguous placements require manual setup, not invented geometry.
- Verification: Real PDF geometry/page-isolation/privacy tests; frontend existing text-mode compatibility; original two-page/ten-blank browser fixture with full headings, notes, table, entry, resize/zoom, resume and scoring.

- Evidence (2026-10-24): 57 PostgreSQL backend tests including actual local speech; 10 frontend tests; production typecheck/build; all 4 live-service Playwright workflows passed in one final run (44.5 seconds). New original PDF flow verifies 2 question pages/10 positioned blanks, preserved headings/notes/table, teacher drag correction, approved-page privacy, entry/autosave, page navigation, phone zoom, refresh and 100% scoring. Strict schema, checks, migration drift, Ruff and diff checks passed. Desktop/mobile screenshots reviewed; fixtures are original content.

## Mock / UX-03 — Native HTML exam matching the uploaded reference
- Priority: Critical
- Status: Completed
- Request: Match the attached standalone HTML mock: compact white header/audio, full native notes/form/table content with embedded fields, radio options and bottom part navigation.
- Acceptance: Persist versioned formatted question sections; render real native controls inside complete text; authorized script-free HTML draft import with teacher-entered keys; preserve timed/untimed, autosave, ownership and existing PDF/text attempts; no reference scripts, advertisements or remote tracking/media copied into the app.
- Verification: Template/import security and version tests; native controls unit tests; live native notes/radio/table author→publish→resume/score/browser/mobile flow; existing suites/build.

- Evidence (2026-10-24): Uploaded reference parsed to 4 parts/40 controls without executing source scripts or importing remote media. 59 backend tests, 14 frontend tests, production build, 5 browser flows (including native notes/radios/table import and phone resume/scoring), strict OpenAPI, Django check, migration drift, Ruff and diff checks passed. Desktop/phone native screenshots reviewed; committed test papers are original fixtures.

## Mock / UX-04 — Apply the reference paper layout to existing text attempts
- Priority: Critical
- Status: Completed
- User evidence: screenshot /mock/7 still shows individual SHORT ANSWER labels, repeated identical instructions, per-row Review tools and large gaps. UX-03 only covered imported HTML; existing text papers must also use the compact reference layout automatically.
- Acceptance: Group consecutive questions under one range/instruction; retain every stored prompt/context and working field; remove technical question-kind labels and per-question instruction duplication; compact native rows; keep navigation, review flags, saved answers and version pins; no re-import or database rewrite needed to change existing text presentation.
- Verification: Grouping/accessible-description/context regression tests; browser fixture matching the reported ten-question text case, plus existing mixed text, HTML, PDF, ASR and mobile workflows.

- Evidence (2026-10-24): 17 frontend tests, production typecheck/build, all 6 browser workflows passed (55.5 seconds), including the existing ten-question text attempt with one instruction, inline fields, compact vertical spacing, persisted answers and 20% scoring. Existing mixed text, HTML, original PDF and real audio-only processing flows still pass. Desktop/phone screenshots reviewed; Django check, Ruff on the fixture and diff checks passed. No production backend/schema changes.

## Mock / UX-05 — Fit the exam to smaller laptop screens
- Priority: High
- Status: Completed
- Request: The mock still appears too large and does not fit the user's screen.
- Acceptance: Smaller readable type/fields/spacing; compact toolbar and navigation; dedicated scrolling question area bounded by header/footer; no controls covered by fixed panels; ten short questions fit typical 1280×720 and 1366×768 laptop viewports; preserve native HTML/PDF/text interaction, autosave and mobile behavior.
- Verification: Browser viewport/geometry checks and screenshots at small laptop sizes, existing frontend suite/build and exam workflows.
- Additional requested scope: Remove all Question … · Review controls and the review counter from active Mock; shrink answered/Part/question navigation. Show a part's approved PDF pages together in order, with stacked scrolling and an optional two-column view. Fix the reported broken library/sidebar after exiting PDF Mock by removing global PDF.js viewer CSS and scoping only its text-layer styling.
- Verification extension: Multi-page/column PDF entry and answer persistence; PDF→Save & exit→normal library sidebar/heading viewport regression. Existing backend permissions and approved-page restrictions remain in place.

- Evidence (2026-10-24): 17 frontend tests, production build, all 6 browser workflows (55.7s), explicit 1280×720/1366×768 non-overlap/compact header/footer assertions, multi-page PDF stacked/column view and PDF-exit fixed/light sidebar regression passed. Screenshots reviewed; no production backend/schema changes.

## Design review / DEMO-02 — Separate standalone HTML proposals
- Status: Completed
- Request: Deliver separate HTML demos for nested books/tests, Full/Part mode selection, modern segmented admin and paginated/scrollable Practice; deliver each as soon as ready.
- Scope: Standalone review files under demo/review only. Existing frontend/backend behavior remains unchanged until the user agrees on the proposed flow/design. All sample content is explicitly demo data.
- Verification: Each file opens directly without npm/backend; interaction/browser and mobile checks; ZIP integrity; deliver individual files as completed.

- Evidence (2026-10-25): Five self-contained HTML proposals plus index/README delivered individually. Browser flows passed for nested navigation, mode selection, admin validation/full readiness, real embedded sample audio, Practice word alignment/paging/levels, and Mock persistence/scoring/timer expiry/exit. All six pages passed desktop and 390/360px overflow checks without external requests or JS errors. Inline syntax/local-link audit and seven-file ZIP integrity passed. Browser tests used localhost because managed Chromium blocks file URLs; files contain no external runtime dependencies.

## Design integration / UX-06 — Bring the approved HTML flow into the real app
- Status: Completed
- Request: Pull Git changes and implement the demonstrated library, test/part selector, segmented admin and compact paginated Practice.
- Acceptance: Persistent source → book → test hierarchy; individual Part authoring and study; Full test assembled from four reviewed/published Parts; clear loading/failure/readiness states; preserve existing standalone materials, immutable versions and permissions; actual API-backed UI matching the review demos; bounded Practice list/editor; passing relevant server, client and browser checks before pushing main.

- Evidence (2026-10-25): 68 PostgreSQL backend tests including real local ASR, 17 frontend tests, production build and all 8 browser workflows passed. Coverage includes ownership/draft visibility, real four-Part audio/word-offset assembly, text/HTML/PDF question copying, approved pages only, version pins, plain failure states preserving prior releases, direct Full authoring and preserved assembly mode on editor open, IELTS Part numbering, nested navigation, active-Mock resume, persisted paginated Practice and laptop/mobile geometry. Django/schema/migration drift/Ruff/diff checks passed.

## Admin / UX-07 — One clear Book → Volume → Test → Parts workflow
- Status: Completed
- Request: Opening Cambridge must show Cambridge 10 volumes rather than test creation. Show all four levels in the left hierarchy and keep one understandable workflow.
- Acceptance: Contextual book/volume/test creation; a single primary action per stage; volume cards inside a book; test cards only inside a volume; full book/volume/test/Part navigation retained during Part editing; root-level test creation rejected; existing test content/history preserved; regression checks and push main.
- Evidence (2026-10-25): Root/category validation and lossless legacy moves covered by server regressions. All 9 live browser workflows passed, including Book → Volume → Test → Parts, Part switching in the editor and all four Part links visible at 1280×720. Existing full assembly, student navigation, PDF/HTML/text Mock and paginated Practice still pass. Screenshots reviewed; no new migration.

## Review / UX-08 — Correct transcript editing validation and row removal
- Status: Completed
- Request: Fix review editing failing with “Segment 50 … non-overlapping integer timestamps within 454947 ms”.
- Acceptance: Empty/zero-length rows can be removed and restored; appending at audio end cannot create an impossible interval; precise inline and API validation identifies the field/row; unchanged word anchors survive row deletion/reordering; published versions remain immutable; regression checks and push.
- Confirmed follow-up: Keep the user's edited interval and automatically trim adjacent sentence edges with a 50ms gap, preserving larger pauses. Commit completed time entry on Enter/blur, support Undo, and warn when an adjustment would erase a neighbor rather than generating invalid times.
- Evidence (2026-10-25): 79 PostgreSQL backend tests including real ASR, 27 frontend tests, production typecheck/build and all 9 live-service browser workflows passed. Regressions cover the reported 454947ms/segment-50 case, row removal/Undo, preserved word anchors/publications, partial keyboard input, adjacent boundaries, timing-only Undo preserving text and persisted corrections after reload. Django check, migration drift, strict OpenAPI, Ruff and diff checks passed; screenshots reviewed.
