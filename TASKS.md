## SHARED-PRACTICE-SORT-01 — Completed live (2026-10-31)
Teacher-facing public practice now sorts by cumulative mistake count across ALL attempts descending, including corrected exercises; ties by original exercise number. Total mistakes shown per exercise; global ordering applied before ten-exercise pagination. Preserves anonymous credential-free access, 15-second refresh, checked-only corrections and ten-exercise pagination. 11 focused tests and frontend build passed. Actual disposable live practice verified anonymous overview/history, first/latest retry data, pagination, refresh state, 1440/390/320 no overflow and no page errors; revoked link404/no-store verified, probe cleaned. Frontend-only assets-first/atomic index rollout; no backend/content change. Rollback /home/PracticeIELTS/backups/before-shared-practice-sort-20261031.

## SHARED-PRACTICE-POLISH-01 — Completed live (2026-10-31)
Public Listening practice: compact navy/teal overview with Part/level and actual progress, collapsed Batafsil exercises and per-exercise retry/correction history. Preserves anonymous credential-free access, 15-second refresh, checked-only corrections and ten-exercise pagination. 10 focused tests and frontend build passed. Actual disposable live practice verified anonymous overview/history, first/latest retry data, pagination, refresh state, 1440/390/320 no overflow and no page errors; revoked link404/no-store verified, probe cleaned. Frontend-only assets-first/atomic index rollout; no backend/content change. Rollback /home/PracticeIELTS/backups/before-shared-practice-polish-20261031.

## HIGHLIGHT-POLISH-01 — Completed live (2026-10-31)
User confirmed highlight works but disliked design; requested completion of all pending review work and live rollout. Replaced yellow banner with compact navy/teal toolbar and repaired PDF button widths/height/wrapping, including responsive rows and selected drawing mode. Cleared remaining Ruff import/fixture warnings; two normal-hasher pinned/private review audio tests passed. Final frontend build and actual Reading/Listening Mock→review text/area persistence, drawing, both layouts, real audio playback/pause, desktop/mobile no overflow/button text clipping checks passed. Probe removed. Frontend assets first/atomic index, no API restart; no migrations/content changes. Rollback /home/PracticeIELTS/backups/before-highlight-polish-20261031T105212Z. Earlier usage-limit rejection is resolved; all requested review/audio/highlight/layout work is live.

## REVIEW-CONTROLS-01 — Completed live (2026-10-31)
Restored Listening review recording using pinned question-set audio URL via existing authorized playback/Range stream, only exposed after submission. Active exam one-play rules unchanged. Review highlight storage now matches original attempt/Part/Passage keys; exclude feedback markers from text offsets and preserve selection on touch. Listening heading/PDF toolbar retain original text ordering so stored offsets align. Returned PDF Stacked/Side by side and added Reading review pane layout controls. Normal-hasher pinned/submission/ownership/private Range test passed; build and actual Mock→review highlight persistence, both layouts, real Listening audio currentTime/play/pause, desktop/mobile no-overflow passed. Disposable probes removed. No schema/content changes; API restarted. Rollback /home/PracticeIELTS/backups/before-review-controls-20261031T104147Z.

## RESULT-SHARE-DIALOG-01 — Completed live (2026-10-31)
Moved Listening/Reading share panels into native modal dialogs opened by Share beside Review Mock. Existing link creation/share/revocation retained; Escape/close/backdrop and trigger-focus restoration supported, responsive centered scrollable dialog. Single-passage Reading share also opens dialog. Build and actual-site Reading/Listening1440/390 adjacency/hidden-default/open/link/revoke-create/Escape/close/focus/no-overflow passed. Disposable probes removed. Frontend-only; rollback /home/PracticeIELTS/backups/before-share-dialog-20261031T103341Z.

## RESULT-DETAILS-01 — Completed live (2026-10-31)
Owned Listening/Reading Full and public share pages now lead with score/percentage/test metadata. Checked answers are collapsed under Batafsil. Opening/reopening defaults to first source Part/Passage; tabs show only selected group. Review Mock stays separate on owned results. Public pages use existing immutable snapshot group metadata and reveal no private review/source. Single Reading passage details also collapsed. Build and eight actual-site desktop/mobile owned/public checks passed for collapsed default/first tab/group filtering/reopen; probes removed. Frontend-only release, rollback /home/PracticeIELTS/backups/before-result-details-20261031T103144Z.

## MOCK-REVIEW-TOOLTIP-01 — Completed live (2026-10-31)
Wrong answer inputs are red and correct inputs green. Correct-answer popup only for wrong answers on hover/focus/touch; Escape/outside/scroll dismiss. Body portal with fixed positioning and maximum z-index prevents pane clipping and overlap behind other inputs. Removed permanent inline feedback boxes; no edit/score mutation. Build and real Reading/Listening desktop1440/mobile390 color/hover-touch/portal/focus/Escape checks passed; seeded one correct Reading response verifies green/no-popup. Disposable probes removed. Rollback /home/PracticeIELTS/backups/before-review-tooltip-20261031T102617Z.

## MOCK-INLINE-REVIEW-01 — Completed live (2026-10-31)
Review now places correct answer/status below each saved input using context only in review; removed separate answer sidebar/list. Listening PDF review uses the same per-Part page selection as Mock. Native/HTML/PDF/Reading controls receive feedback without allowing mutations. Build and actual submitted Reading/Listening desktop/mobile review/input feedback/Part2 number filtering/reload/read-only/no mutation checks passed. Probe removed. Backup /home/PracticeIELTS/backups/before-inline-review-20261031T101843Z.

## MOCK-REVIEW-01 — Completed live (2026-10-31)
Results now link to read-only Review Mock: original Listening HTML/native/PDF questions with Part tabs; pinned Reading passages/questions with passage tabs; saved answers and checked answers beside paper. Per-row Review opens relevant Part/passage; back/result/history context retained. Review query survives reload. Build and live submitted Reading/Listening desktop1440/mobile390 review/reload/tabs/no editable fields/no mutation requests passed. Probe removed; frontend-only/no API restart/content changes. Backup /home/PracticeIELTS/backups/before-mock-review-20261031T100747Z.

## MOCK-HIGHLIGHT-01 — Completed live (2026-10-31)
Root cause: no highlight implementation existed. Added shared CSS Highlight API tools for Reading passage/questions and Listening question text; selection→Highlight, clear, local device persistence by attempt/passage, React-safe ranges and control exclusion. Build and real Reading Full/Listening selection/highlight/reload/clear passed. Probe removed. Frontend-only/no API restart/content changes. Backup /home/PracticeIELTS/backups/before-mock-highlight-20261031T093057Z.

## READING-CATEGORY-01 — Completed live (2026-10-30)
Reading root now shows collection/category cards before books, preserving explicit collection/book/test URLs. Root previously rendered books directly. Final build and actual-site student category→books→tests at1440/390 with category reload passed; probe removed. Frontend-only, no API restart/content changes. Rollback /home/PracticeIELTS/backups/before-reading-category-20261030T091745Z.

## READING-ADMIN-VISIBILITY-01 — Completed live (2026-10-29)
Root cause: administrator catalogue always sent owned=true, hiding60 existing shared Reading papers from administrators with no authored papers. Admin/superuser now use server-authorized shared catalogue; teacher retains owned=true. Query cache scoped by identity/access. Build passed; disposable ordinary admin with no papers verified Cambridge books/tests at1440/390. Probe removed; frontend-only release, no restart/content mutation. Rollback /home/PracticeIELTS/backups/before-reading-admin-visibility-20261029T121452Z.

## SELF-PROFILE-01 — Completed and verified live (2026-10-29)
Administrator and student own-profile pages now share the refreshed account card/avatar/role/status/email/workspace design, with role-appropriate content/progress shortcut. Account security shows a compact Change password action; current/new/confirmation fields open only in a native dialog with Escape/close and focus restoration. Existing authenticated password endpoint/token update retained.
Final TypeScript/Vite build passed. Actual-site disposable student and admin checked at1440/390/320: identity, no default visible profile inputs, password dialog/current-password field, Escape-close and no horizontal overflow. Six browser checks passed and probe accounts/tokens/audit events removed. Initial browser probe counted the global search field; selector narrowed to account fields and all six checks passed on retry. Frontend-only release; no API restart/migration/content changes. Rollback frontend and touched source files retained in backups/before-self-profile-*; live-receipt.json and role/width screenshots saved there. No commit/push.

## AUTH-BLOCK-01 — Completed and verified live (2026-10-29)
Inactive users entering their correct password now receive403 with the clear login error: “Your account has been blocked. Please contact the administrator.” Wrong passwords and unknown usernames retain generic401 errors. Blocked login creates no access token/refresh cookie or successful sign-in audit event. The existing login error component renders the API detail; no frontend changes required. CSRF and throttling remain enforced.

Verification:6 focused normal-hasher backend tests passed (51.22s), covering the new notice/incorrect credentials/no token issuance/re-enable/CSRF plus existing account block/password/session rotation and auth/refresh checks. Relevant Ruff and Django system checks passed. Real isolated-stage and actual-site1440/390 login forms showed the blocked notice with no token/session and no overflow/page errors; wrong-password UI remained generic; unblocking restored normal browser login. Disposable probe users/tokens were removed in finally cleanup.

User-authorized backend-only rollout, no migration/content/frontend changes. Consistent DB integrity/foreign-key backup and prior source retained at `backups/before-blocked-login-20261029T114542Z/`. API restarted while retaining the previously deployed Reading implementation; parallel pending Reading source restored byte-for-byte. API/worker/nginx active. Final receipt `/tmp/blocked-login-deploy-receipt.json`; logs/browser receipts/screenshots in rollback `evidence/`. No commit/push. Persistent session `tmux attach -t practiceielts-admin-profile`.

## ADMIN-DESIGN-02 — Completed and verified live (2026-10-29)
Redesigned both administrator directory and individual profile. The directory uses whole-row links, initial avatars and role/status badges; Add remains a separate native modal. Profiles use a compact identity/banner/contact/joined card with password and block actions. Password fields are hidden by default and open in a labelled native dialog with confirmation, cancel/Escape, draft reset and focus restoration. Activity is a readable timeline with event names/icons/timestamps; search is collapsed by default. No invented metrics. Mobile identity stacks to retain username space and avoids inherited panel padding conflicts; secondary text contrast strengthened.

Verification:8 focused management/dashboard frontend tests passed using temporary verification config with15s async waits under host load; final TypeScript/Vite build passed. Actual isolated-stage and live desktop reset/old-password denial/new-password login/ordinary-admin permission denial/block/unblock/scoped readable logs passed. Both stage and final live1440/390/320 modal/list/profile reload, hidden default inputs, no overflow/page errors passed. Final live desktop password-dialog Escape/focus/draft reset and submit-close flow passed. Disposable live verification owner/editor, their logs and tokens removed in finally cleanup. Browser screenshots visually reviewed, with final mobile layout checked after stacking/spacing fixes.

Explicitly authorized frontend-only rollout; no backend restart, API/model/migration/content changes. Rollback: `backups/before-admin-design-20261029T112222Z/` (prior frontend and four touched source/test files). Assets installed before atomic index switch; old assets retained. Source edits remain uncommitted. Final receipt `/tmp/admin-redesign-deploy-receipt.json`; durable logs/receipts/live screenshots in rollback `evidence/`. Persistent session: `tmux attach -t practiceielts-admin-profile`.

## ADMIN-PROFILE-01 — Completed and verified live (2026-10-29)
Administrator management now shows only Add administrator and the account list. Native modal fields open from Add; linked reloadable profiles provide password reset/confirmation, account-scoped actor/target activity and block/unblock. Superuser-only APIs reject privilege changes and superuser mutations; existing own-password profile remains available. Password resets revoke old access/refresh tokens, blocks deny authenticated access and revoke refresh tokens; secrets never enter audit details.

Verification:10 administrator API tests passed with normal production hasher (361.20s); earlier temporary test-only MD5 suite10/10 also passed. New frontend3/3 and existing dashboard4/4 passed (dashboard needed a15s async wait under load); final TypeScript/Vite build, Django check, relevant Ruff and diff checks passed. Real isolated-stage1440/390/320 add/modal/Escape-focus/profile-reload/reset/login/block/unblock/scoped-log/privacy checks passed. Actual-site desktop full password/block workflow passed; final live1440/390/320 reload/modal-centering/controls/logs/no-overflow checks passed. First live320 check exposed long username overflow; inherited wrapping/min-width CSS fixed it, rebuilt/released, and targeted all-width live rerun passed. Disposable live accounts, their audit events and tokens were removed in finally cleanup.

Rollout explicitly authorized by user. Backup: `backups/before-admin-profiles-20261029T110343Z/`; consistent SQLite integrity/foreign-key checks passed; assets first/index atomic, API restarted, API/worker/nginx active. No migration/content/media mutation. Existing publication/attempt pins preserved. Pending unrelated Reading unordered-text sources were temporarily held at their previously deployed verified implementation during API boot, then restored byte-for-byte; unfinished Reading feature/content was not released. Coordinate future API restarts with the Reading worker until its separate release is verified. Source edits remain uncommitted. Durable receipts/logs/final screenshots are in the backup's `administrator-profile-evidence/`; `/tmp/admin-profile-deploy-receipt.json` records final acceptance. Persistent verification session: `tmux attach -t practiceielts-admin-profile`.

## MOCK-STREAM-01 — Progressive Mock recording
- Status: Completed (tested and deployed with explicit authorization)
- Scope: Native incremental audio with attempt-scoped HttpOnly authorization; retain timed single-delivery rules; untimed Range seeks.
- Verification: 34 exam tests with temporary fast test hasher; four native/security tests with normal settings; all 36 frontend tests passed across full run and isolated timeout retry; final production build and Django check; real throttled Chromium timed MP3 early playback. Live smoke passed.

# Tasks

## READING-MEDIA-01 — Reading source/mock preparation and media audit
- Status: In Progress (2026-10-28)
- Scope: inventory supplied Reading books; prepare passage/test source PDFs and reviewed import payloads in Listening-style book/test folders; validate source/question/key coverage. Audit all database file references before removing redundant media; preserve originals, historical versions and import manifests. No deployment.
- Completed substeps: Cambridge 10 source package contains 4 answer-free Full Reading Mock PDFs,12 passage PDFs and4 separate private key PDFs; all108 output-page renderings match original pages. Media cleanup quarantined one unreferenced100,116-byte PDF; post-audit532 referenced files present,0 missing,0 eligible leftovers. Backup code includes historical Reading/import sources. All24 infrastructure tests passed.
- Current follow-up: all11 remaining Cambridge10 native passages/keys are source-reviewed and all4 complete Full Mocks stage-browser verified; private source packages/media audit remain preserved. Full attempts and actual headings/matching/figures are implemented and tested. Continue remaining volumes under READING-CONTENT-21; current boundary is no deployment. See docs/READING_CONTENT_LEDGER.md.

## UI-READING-CLEANUP-01 — Coherent Listening and Reading navigation
- Status: Completed (2026-10-28; tested, user-authorized deployment and actual-site verification)
- Scope: remove redundant/decorative navigation, balance dashboard choices, Reading learner/admin collection → book → test → passage flow, persisted draft location and collision protection; preserve routes, permissions and saved answers.
- Evidence: backend190 passed/3 skipped; frontend93 passed; final build/check/migration drift/Ruff/diff passed;1440/390/320px fixture browser passed. User explicitly authorized live rollout afterward; deployed with DB/frontend backup and unchanged model counts.
- Live evidence: real two-page upload/Celery/Tesseract → Test2 saved draft → hierarchy/reopen/reload, admin1440/390/320px; real student13-field autosave/reload/mobile scroll/final13-of-13 score; private permissions, all44 Listening tests/audio and private-media smoke passed. Probe records/source cleaned, existing publication pins retained.
- Next: user refreshes the live site; additional Reading content stays in READING-10-02.

## READING-LEARNER-02 — Learner Reading flow and question layout
- Status: In Progress (explicit separate task requested by user, 2026-10-28)
- Scope: Preserve Library name and real Cambridge Listening/Reading book separation. Verify book/test/passage → passage/questions → saved answers/resume → explicit final submission → result/mistakes. Desktop independent panes, mobile retained tabs/scroll, accessible single question numbers and answer blanks for questions1–8. No private key/source exposure or historical-version rewriting.
- Acceptance: Native question controls correctly bound by number; no duplicate numbering or detached answer layout; autosave/manual Save & exit errors handled honestly; submitted answers immutable; actual desktop/phone verification and meaningful component/integration tests.
- Next: Review and test the existing learner flow in parallel with admin PDF upload/OCR; fix confirmed gaps before rollout.

## READING-PDF-02 — Administrator PDF upload and manual source-reviewed authoring
- Status: In Progress (2026-10-28; ML explicitly deferred by user)
- Scope: private PDF upload, persisted asynchronous text/Tesseract OCR jobs, native passage/question/table/key authoring, source comparison and explicit manual publication. Preserve Library naming, published versions and learner history. No API key/model required, no guessed keys or model-success claims.
- Acceptance: real upload→worker→source text→native editing→manual approval→learner workflow; owner permissions, errors/retry, source evidence, server schema/key/number checks, unresolved-source finding guard and historical-version pinning. Breadcrumbs must show location and meaningful clickable parents, preserving unsaved work.
- Evidence so far:12 focused Reading/API/OCR tests passed, including actual Tesseract extraction and worker idempotence; frontend focused tests under integration. No new live rollout claimed.
- Next: finish integrated administrator and learner browser workflows, final checks, authorized additive deployment and actual-site verification.

## READING-ML-01 — Model preparation and independent review
- Status: Deferred (explicit user instruction,2026-10-28)
- Scope when resumed: configurable real model preparation plus independent source-grounded review/correction; exception-focused review and measured automation.90% is a target, not an achieved result.
- Current boundary: optional transport/pipeline code is isolated and inactive. Active OCR worker makes zero model calls, requires complete human comparison and never auto-publishes. Model provisioning and real inference/evaluation remain future work.

## READING-10-01 — Cambridge 10 reviewed Reading workflow
- Status: Completed (first passage tested and deployed with explicit user authorization, 2026-10-28)
- Scope: One complete reviewed passage with structured continuous text, independent desktop panes/mobile tabs, persisted answers, server permissions, version-pinned scoring and administrator original-source comparison. Listening and historical attempts preserved.
- Source: User-supplied Cambridge-IELTS-10-Ebook.pdf, PDF18–21 / answer key153 (printed17–20 /152). Full 178-page scanned source retained privately; no copyrighted content committed as seed fixtures.
- Evidence: Final backend run 180 passed /3 skipped; frontend 69-test full run before navigation follow-up plus three focused Reading/navigation tests afterward; final TypeScript/build, Django check, migration drift, new-code Ruff and diff checks passed. Actual deployed desktop/390px Chromium verified Cambridge Listening/Reading book cards, all13 fields, complete five-row/four-column table, autosave/reload, retained phone scroll and persisted13/13 submission. Actual student API denies source/key access; all44 Listening tests retain176 Parts/44 Full recordings and historical model counts. See docs/STATUS.md.
- Product scope: Untimed Cambridge10 Test1 Passage1 only. Remaining passages and full timed Reading are subsequent work.

## READING-10-02 — Remaining Cambridge 10 Reading passages
- Status: Completed and verified live (2026-10-28; renewed explicit deployment authorization, original live Passage1 preserved)
- Dependencies: READING-10-01
- Evidence (2026-10-28 resumption): Test1 Passages2–3 source/key reviewed; complete Full passed isolated Chromium at1440/390/320px with40/40, save/resume, timing/privacy and immutable results. Test2 three native passages/40 questions visually reviewed and imported only in isolated stage; source-specific two-word/either-order scoring checked, Full browser passed1440/390/320px with40/40. Published Passage1 unchanged.
- Evidence follow-up: Tests3–4 all6 native passages/80 questions source-reviewed and isolated Full browser1440/390/320 passed40/40/save/resume/results/timing/privacy. Test3 original map retained via bounded private source crop. All4 Cambridge10 Full tests stage verified; later authorized rollout and actual-site verification completed all12 passages/4FullMocks.
- Final evidence: authorized Cambridge10–12 rollout35additivepassages,normalbackend228/frontend108/buildpassed,all12FullMocks real-site390px/eachbookfirsttest1440px40-of-40save/resume/security/figures andadmin1440/390passed. Original Passage1/version1 and allhistoricalpins preserved. Continue remaining28tests13–14/16–20; publish onlycompleteverifiedbooks.

## OPS-NIGHTLY-BACKUP — Nightly database/media backup to Google Drive
- Status: In Progress
- Scope: User authorized a backend worker to create nightly DB/media snapshots, upload each run into a new Drive folder, verify remote content, and remove temporary local files only after verification. Keep credentials out of archives and prevent overlapping runs.
- Next action: implement and test the unattended backup service/timer; verify durable Drive authorization before enabling uploads or claiming operational success.

## MOCK-CONTENT-21 — Reviewed Cambridge question-only Mocks through volume 21
- Status: Completed (Listening questions and real Mock audio verified live, 2026-10-28)
- Scope (2026-10-27): User clarified audio is unavailable for new imports. Use prepared question/key PDFs in Drive / for PracticeIELTS; Cambridge 15 may be omitted. Publish verified Part and Full question-only Mocks without fabricated recordings/transcripts. Existing recordings, publications and attempt history must be preserved. Reading Cambridge 10 remains a subsequent increment sourced from / cambridge books.
- Acceptance: Nullable, version-pinned question-only attempts; explicit audio-unavailable state; authorized publication and private source/keys; reviewed numbering, answer groups and keys; persisted answers/scoring; verified live rollout explicitly requested by user.
- Evidence (2026-10-28): All 176 Parts / 44 Full Mocks have published audio. Actual-site student API, desktop/phone playback, PDF answer save/reload, scoring and private-media checks passed; all 96 new Part originals match source SHA256. Consistent local DB/media backup plus application source saved and verified; restored database integrity/foreign keys passed. See docs/STATUS.md. Automatic Practice transcription/review and Reading Cambridge 10 remain separate subsequent work. Drive upload is pending credentials.

## SHARE-01 — Share Mock results
- Status: Completed
- Scope: Share submitted Mock scores through native sharing, clipboard, or selectable text; exclude private answers and authenticated URLs.
- Verification (2026-10-27): Four focused component tests passed after fixing cross-realm cancellation handling; final TypeScript/production build, Django check and diff check passed. Initial broad run: 39 passed, one cancellation failure; that failure was fixed and all four focused tests then passed. No final full-suite or browser pass claimed. No deployment.

## AUDIO-STREAM-01 — Progressive private study audio
- Status: Completed (tested and deployed with explicit authorization)
- Scope: Native Range playback with scoped HttpOnly study-media authorization, buffered/loading feedback and retry; preserve exam ticket behavior.
- Verification: 53 fast backend tests, two normal-hasher security tests, 36 frontend tests, TypeScript/build/check/strict schema; throttled real Django/Chromium early playback and unbuffered seek passed in isolation and on actual live MP3.

## WORKSPACE-01 — Separate learner and administrator navigation
- Status: Completed (tested and deployed with existing authorization)
- Scope: Profile menu workspace switch, separate navigation/editor affordances, rightmost mobile Profile link, preserve server permissions.
- Verification: 36 frontend tests, final isolated TypeScript/build, six preview and four deployed-front-end Chromium workflows passed; existing live private-media/library smoke passed.

## MOBILE-SCROLL-01 — Shared content touch scrolling
- Status: Completed (tested and deployed with explicit authorization)
- Scope: Keep PDF touch scrolling available by default; explicit answer-field placement mode; allow vertical scroll chaining from PDF, book hierarchy, transcript review, practice exercises and resume lists.
- Verification: 36 frontend tests, isolated TypeScript/build, 13 distinct Chromium workflows across two runs; both touch workflows passed again against deployed frontend. Private audio/PDF/library smoke passed.

## MEDIA-CACHE-01 — Private audio/PDF reuse
- Status: Completed (deployed and live Chromium revalidation verified, 2026-10-27)
- Scope: Browser conditional caching after authorization; bounded PDF extraction cache; preserve timed-exam audio rules.
- Verification: 51 learning/exam tests passed with normal password hashing; 67 hierarchy/learning/exam tests passed with temporary test-only MD5 hasher; file replacement/cache test passed; ticket no-store check passed. Django check and diff check passed. No deployment.

## PERF-01 — Admin hierarchy response time
- Status: Completed (deployed with explicit authorization, 2026-10-27)
- Scope: Remove repeated Part/question queries in the test hierarchy; enable compression and fingerprinted asset caching in the nginx template. Keep mobile admin follow-up pending.
- Verification: 16 hierarchy tests passed, including exactly two read queries and zero serialization queries for four Parts plus Full; Django check and isolated nginx configuration validation passed. No deployment.

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

## Content review / CONTENT-01 — Audit Cambridge 10 Downloads sheets and prepare PDFs
- Status: Completed
- Request: Inspect the latest Cambridge 10 sheets in Downloads for correctness before preparing PDFs.
- Acceptance: Compare all five Markdown sheets against the user's local book; identify mismatched sections and missing keys/figures; preserve originals; prepare source-faithful Listening question and separate answer-key PDFs outside Git. No application import or publication.
- Verification: Review all 16 section mappings; reopen generated PDFs and verify page counts, original page/image contents, dimensions, ordering and separate key pages; record provenance and next action.
- Evidence (2026-10-25): All five recent Markdown sheets contain material differences from the local book; no sheet is approved for import. Prepared six private PDFs in `backend/media/cambridge_documents/Cambridge_10`: 30-page combined Listening questions, four per-test question PDFs (7/8/7/8 pages), and a separate four-page Listening key. All 64 output pages across the six PDFs render pixel-identically to their 34 unique source pages; PDF contents/images/dimensions, Test/Part bookmarks and all eight ZIP members verified. Originals are hash-verified unchanged. Scanned source limitations and all 16 section discrepancies are documented in the output folder. No application code, database, audio, transcripts or publication state changed.

## Content import / CONTENT-02 — Cambridge 10 Test 1, Parts 1–4
- Status: Completed
- Request: Import the four Parts using the verified source PDF and keys; limit writes to question documents, question sets, questions/options/keys and their audit records.
- Acceptance: Four private Part PDFs and four unpublished question sets with 40 numbered questions, source keys, word limits and reviewed field geometry; preserve existing materials/publications and all unrelated records. Record any existing scoring limitation without changing application behavior.
- Verification: Serializer validation; PDF image/geometry checks; persisted readback against prepared data; owner/student authorization checks; transaction rollback on failure; repeat execution must not duplicate records.
- Evidence (2026-10-25): Imported four draft sets (IDs 2–5), documents 4–7, into existing materials 6–9; ten questions per Part, 40 total. All prompts/options/keys/limits/rectangles read back equal to prepared source-reviewed data. All seven PDF page/field previews reviewed; 29 owner/student/anonymous and isolated-page checks passed. A SQL write guard restricted writes to the six question/document/audit tables, inside one atomic transaction; original material rows remained identical. Repeat import created zero rows/writes and retained the same IDs. Django check passed on the configured local SQLite database. Private payloads/PDFs/receipt are ignored under `backend/media/cambridge_documents/Cambridge_10/Test_1`. Publication remains pending: questions 11–12 preserve source either-order/distinct-group metadata, but the current independent-question scorer does not enforce distinctness. Default exam timing also needs editorial review. No product code or unrelated content changed.

## Mock / UX-09 — Free untimed playback and recoverable Full assembly
- Status: Completed
- Request: No-time-limit Mock must allow replay, seeking and returning without locking playback; published Parts must produce a usable Full test.
- Acceptance: Reusable owned playback for untimed attempts; pause/replay/seek/speed controls and saved-answer resume; untimed Parts/Full do not lock one another; timed attempts retain restrictions across sibling routes; retry queued assembly safely and restore the current stuck Full build without modifying its source Parts.
- Verification: Reproduce failures before fixes; server/frontend regressions; existing suites/build; real-browser return/replay and Full workflow; inspect current Full readiness.
- Evidence (2026-10-25): Server regressions reproduced six original failures, then passed with timed-only locking, renewable untimed tickets and queued retry. Review additionally found history/restart bypasses and redundant ready rebuilds; all reproduced and fixed. Regular backend suite passed 86 tests (one opt-in speech test skipped). Client suite/build passed; targeted browser return/replay/seek/speed/answer-resume passed. Replaced the outdated idle local worker, which registered only the old task, with `practiceielts-current@localhost`; retried the published Cambridge 10 Test 1 build. Full material 92 is ready/published with 40 questions, preserving source Part publications. See STATUS for the separate optional speech-fixture environment failure.

## Practice / UX-10 — Fully visible editor with page scrolling
- Status: Completed
- Request: Show the full Listen and write editor/feedback without an internal scroll area; scroll the whole page when needed.
- Acceptance: Editor expands with its content; no clipping or nested editor scrollbar; normal document scrolling; exercise pagination and responsive controls still work.
- Verification: Browser geometry with long feedback and small/large viewports; relevant frontend suite/build.
- Evidence (2026-10-25): Browser RED measured 1590px content clipped into a 174px editor. Removed nested editor height/scroll caps, retained exercise pagination, and made textarea fit its text and viewport changes. Targeted browser GREEN verified long feedback, textarea visibility after 1280→390px resize, document scrolling and saved navigation. Final client suite passed 34 tests; production build passed.

## Admin / UX-11 — Stable layout across hierarchy and Part editing
- Status: Completed
- Request: Keep the same page width and book hierarchy/sidebar appearance when opening a Part or navigating to another admin level.
- Acceptance: Consistent header/workflow, sidebar width/position and content alignment across volume/test/Part pages; retain sibling navigation and active path; no new clipping or narrow editor cap.
- Verification: Desktop/mobile browser navigation geometry and sibling visibility regressions; existing client checks.
- Evidence (2026-10-25): RED reproduced a 252px heading shift on entering Part 1. Grouped editors now share the volume/test header, workflow and sidebar/content grid; removed the 1000px editor cap and navigation-dependent sibling filtering. The approved-book browser flow passed with geometry equality across six hierarchy/Part views at 1600px, sibling book/volume/test visibility, full editor width and 390px overflow checks. Final client tests/build and diff check passed. Concurrent user changes were preserved.

## Practice / EASY-TIMING-01 — Admin timing corrections during Easy Practice
- Status: Completed
- Request: Let an administrator change the current Easy exercise's playback start/end directly while practising.
- Scope: Admin/staff only; authenticated server checks; editable seconds with preview; persisted Easy timing revisions pinned by sessions; keep published transcripts, other difficulties, existing student sessions and unrelated user edits intact.
- Verification: Permission and mode rejection, exact chunk persistence, input/boundary validation, revision conflicts, student history/resume, component interaction and production build.
- Evidence (2026-10-25, local SQLite): 109 passed, 1 skipped; 35 passed; 1 live browser workflow passed; production typecheck/build, Django check, migration drift check, strict OpenAPI, Ruff and diff checks passed. Migration 0006 is applied locally.

## OPS-01 — Local database and referenced-file backup
- Status: Completed
- Scope: consistent SQLite snapshot and all database FileField references, lossless archive, checksums and restore instructions; exclude unrelated media/cache/dependencies.
- Verification: database integrity, foreign keys and archive member checksums.
- Evidence: backups/PracticeIELTS_20261026T033213Z.zip; 87 referenced files plus consistent database; 621,966,763 input bytes → 461,614,870 ZIP bytes. Every archived file SHA-256 verified; extracted SQLite integrity_check=ok and foreign_key_check empty. Restore notes/manifest included.

## CONTENT-03 — Import prepared Cambridge 11–14 question/key PDFs from Drive
- Status: Completed (draft import; publication review remains)
- Scope: verify source PDF questions/keys and Cambridge 12 numbering; create missing Part question drafts through existing validation/services; preserve existing publications and unrelated records.
- Verification: source mapping, complete question/key counts, import idempotence and private document access.
- Evidence: 64 draft sets, 640 keys, 104 private PDF pages; all source embedded images byte-identical, render checks passed (minor watermark antialias differences allowed for Cambridge 14). Added answer columns without changing original question regions. Import replay: 0 new sets / 0 database writes. 23 unordered answer pairs flagged because existing scorer does not enforce distinctness.

## EXAM-PAIR-01 — Distinct unordered answer-pair scoring
- Status: In Progress
- Scope: score grouped answers once per distinct valid response; consistent total and per-question results; validate group metadata and preserve groups when assembling Full tests.
- Acceptance: A/C and C/A score 2, A/B and A/A score 1, B/D score 0; unrelated questions and historical submissions preserved.


## Operations / RESTORE-8080 — Restore supplied backup and serve on port 8080
- Status: Completed
- Acceptance: verify archive checksums, restore database and private media without replacing source edits, check database integrity, start connected app on port 8080 and verify HTTP/API access.

- Evidence (2026-10-26): nginx :8080 → dedicated Django :8001; systemd API/worker/nginx active. Django check passed. Live HTTP verified SPA routes, 98 authenticated materials, anonymous denial, exact 1024-byte private audio range and private PDF. Restored archive verification records 263 files and database integrity/foreign-key checks OK.

## Operations / CSRF-8080 — Public-origin authentication
- Status: Completed
- Scope: configure exact public HTTP origin for CSRF verification and verify valid/invalid origins through nginx.
- Evidence: cookie/token POST with public Origin reaches credentials validation (401 for nonexistent probe); untrusted Origin remains rejected (403).

## Operations / LOGIN-WRITE-01 — Restored database service permissions
- Status: Completed
- Scope: fix service database write permission causing login 500; reproduce and verify using www-data.
- Evidence: reproduced readonly SQLite error as www-data, fixed mode 0660; real HTTP login/refresh/profile/logout passed as service user; disposable account removed.

## Repair / MEDIA-01 — PDF worker delivery and Practice audio loading
- Status: In Progress
- Dependencies: RESTORE-8080
- Acceptance: Serve PDF module workers with JavaScript MIME; verify private PDF/audio delivery; make long Practice audio downloads measurable and retryable; preserve publications and responses.
- Verification: HTTP MIME/private media checks, frontend tests/build, Django checks. Record browser limitations honestly.
- Evidence: Django check, TypeScript, isolated production build and all 36 frontend tests passed. Scoped nginx MIME fix and audio progress/retry deployed on 2026-10-27 with explicit user authorization. Live worker MIME is application/javascript; authenticated private PDF/audio HTTP checks passed. Actual browser rendering/audible playback confirmation remains pending (Chromium unavailable). See docs/STATUS.md.


## Interface / MOBILE-01 — Comfortable phone layouts
- Status: Completed
- Scope: responsive student/admin screens, readable type and touch targets, phone navigation, accessible drawer, Practice audio controls and mobile exam layout; preserve persisted behavior and desktop layouts.
- Verification: frontend tests/typecheck/build and real-browser phone/tablet checks when available.
- Evidence (2026-10-27): 36 frontend tests, TypeScript/production build and four Chromium layout workflows passed (320/390/760px plus desktop). Final deployed build also passed the 320px Chromium workflow through nginx :8080 using isolated API fixtures. Dashboard/Practice/admin screenshots reviewed; diff check passed.


## MOBILE-02 — Admin studio phone usability
- Status: Completed
- Dependencies: MOBILE-01
- Acceptance: collapsible book navigation on phones; readable authoring forms, reachable setup steps and touch controls; preserve desktop layout and persisted API behavior.
- Verification: frontend suite/build and Chromium phone admin workflows.
- Evidence (2026-10-27): 36 frontend tests and isolated production build passed; 11 Chromium workflows passed at 320/390/760px and desktop, including authoring/hierarchy/settings. No deployment.

## ACCESS-01 — Super admin, delegated admins, password and activity settings
- Status: Completed
- Dependencies: accounts and admin content studio
- Acceptance: existing Django superusers manage ordinary admins; only superusers delete content; ordinary admins cannot grant privileges or read audit history; users can change their own password with current-password verification; superuser can paginate/filter actual admin audit events in responsive settings.
- Verification: API authorization, password/session invalidation, persisted audit and frontend settings/browser tests; no deployment or live account changes.
- Evidence (2026-10-27): full SQLite suite 146 passed / 1 opt-in speech test skipped using a test-only fast hasher; all nine new security tests also passed with the normal application hasher (8 + 1 targeted runs). Frontend 36 tests, 11 Chromium workflows, TypeScript/build, Django checks/migration drift and strict OpenAPI validation passed. Learning migration 0007 is ready but not applied live. See docs/STATUS.md.

### MOBILE-02 / ACCESS-01 rollout (2026-10-27)
- Status: Completed
- Authorization: user explicitly requested “chiqar”.
- Scope: backed-up live migration 0007, matching frontend, API/worker restart and real HTTP/browser smoke checks; retain published content and account passwords.
- Evidence: live SQLite backup + frontend rollback copy in backups/before-admin-20261027T075602Z; migration 0007 applied as www-data; matching frontend installed assets-first/index-last; API/worker restarted and all services active. Real HTTP superuser/ordinary-admin permissions, anonymous denial, private audio range/PDF, login/refresh/logout and real-backend mobile Chromium checks passed. Probe users removed; existing accounts/passwords and content retained.

## SHARE-02 — Public detailed Mock result links
- Status: Completed (deployed with explicit authorization, 2026-10-27)
- Scope: Owner-created, revocable unguessable links with a persisted submitted-result snapshot, book/test context and per-question answers/corrections; anonymous read-only page; no private media.
- Verification: 35 exam API tests passed; three new public-link frontend tests and four sharing tests passed. Broad frontend run: 39/40 passed, unrelated timing timeout passed all seven tests on isolated rerun. Production build, Django/migration/diff checks passed. Live real API + anonymous Chromium desktop/390px result/answers/revocation and existing private-media smoke passed.

## SHARE-03 — Simple copy feedback
- Status: Completed (deployed, 2026-10-27)
- Scope: Remove manual-copy fields; automatic clipboard fallback and concise truthful status; deploy under existing rollout authorization.
- Evidence: Eight focused frontend tests, isolated production build and diff check passed; live frontend Chromium with API fixtures verified actual legacy copy fallback, Nusxalandi status, no textarea and 390px layout.

## MOCK-HISTORY-01 — Completed Mock history
- Status: Completed (deployed with explicit authorization, 2026-10-27)
- Scope: Paginated owner-only submitted-attempt summaries and visible Mock History navigation; reopen results/share, newest first, loading/error/empty states.
- Evidence: 36 exam backend tests, 11 focused frontend tests, isolated production build, Django/diff checks passed; live DB count/order/ownership and Chromium Mock Tests → history → saved results → history at 1280/390px passed; existing private-media smoke passed.

## MOCK-HISTORY-UI-01 — Refine history presentation
- Status: Completed (deployed, 2026-10-27)
- Scope: Consistent padding, aligned headings, compact responsive result cards, clear score/date/timing, scoped styles; preserve real history and pagination.
- Evidence: Three history component tests passed on isolated rerun; production build/diff check passed; live actual-data Chromium navigation and 390px/1280px overflow checks passed; mobile screenshot reviewed.

## RESULT-NAV-01 — Result page breadcrumbs and back links
- Status: Completed (deployed, 2026-10-27)
- Scope: Consistent location trail/back links on Mock history, owner results and public results; preserve history page when returning from a result.
- Evidence: Six focused frontend tests, production build/diff check and live real-data Chromium desktop/390px navigation, breadcrumb and page-2 return passed.

## ADMIN-USERS-01 — User directory and learning statistics
- Status: Completed (deployed under existing authorization, 2026-10-27)
- Scope: Read-only paginated searchable user directory for active administrators/superusers; role/status, persisted learning counts and real platform overview; teacher/student denial. Responsive admin page with breadcrumbs.
- Evidence: 11 backend account/directory tests, three frontend tests, production build, Django/migration/Ruff/diff checks passed. Final live DB counts/permissions/search and Chromium at 1280/390/320px passed, including single-row admin navigation and compact search assertions.

## ADMIN-DASHBOARD-01 — Separate administrator landing page
- Status: Completed (deployed, 2026-10-27)
- Scope: /admin overview/dashboard; distinct Content library, Users & statistics, superuser management and Profile destinations; preserve legacy content deep links and hierarchy workflow; responsive navigation and real metrics.
- Evidence: Seven frontend dashboard/directory tests, final build/diff check and live actual-data Chromium at 1280/390/320px passed, including separate Content/Users/Management/Profile, legacy redirects and five mobile tabs.

## PRACTICE-TIMING-02 — Medium and Hard timing corrections
- Status: Completed (deployed, 2026-10-27)
- Scope: Admin per-exercise audio windows in Easy, Medium and Hard; separate difficulty-scoped revision snapshots; retain published transcripts, student history and saved answers; full mode remains unchanged.
- Evidence: 25 timing tests passed with normal settings; 46 timing/learning tests passed with temporary fast hasher; eight final timing frontend tests and production build/checks passed. Initial live Medium save race reproduced in a failing regression, fixed by serializing timing/autosave writes. Final three live browser workflows all passed with preview/reload/answers/history preservation and fixture cleanup.
- UI clarification: authorized admins see Adjust timing directly beneath audio on ordinary Practice routes; no workspace switch needed. Final build deployed; permission remains server-enforced.

## PRACTICE-SHARE-01 — Share completed practice and Mock results across every mode
- Status: Completed (deployed with explicit authorization, 2026-10-27)
- Scope: Owner-created/revocable public snapshot for each completed Easy/Medium/Hard/Full dictation session or submitted Part/Full Mock independently; responsive public result pages with clear book/test/Part/difficulty context, latest checked answers/corrections and accuracy; no other sessions or media.

- Verification (2026-10-27): 66 learning/exam API tests (SQLite/test-only MD5), 64 frontend tests, production build, Django/migration/diff checks passed. 15 anonymous Chromium workflows with API fixtures at 320/390/1280px passed. All four practice difficulties on Part/Full materials, Part/Full Mock, ownership, immutable snapshots and revocation covered. No deployment.

- Live verification: migration 0009 applied, backup before-practice-share-20261027T154053Z; real Easy/Medium/Hard/Full completion/share/anonymous API/revocation passed, with 12 actual-backend Chromium checks at 320/390/1280px. Disposable learner data removed. Existing private-media/library smoke passed.

## PRACTICE-SHARE-02 — Live links for unfinished practice
- Status: In Progress
- Scope: Create a session link before completion; expose only latest checked answers, live progress and accurate completion state; refresh public pages automatically; retain per-session scope/revocation and Mock snapshots.

## PRACTICE-SHARE-03 — Attempt counts and paginated shared answers
- Status: Completed (deployed with explicit authorization, 2026-10-27)
- Scope: Show persisted Check Answer counts, first/latest accuracy and collapsible mistake history per exercise; paginate public answers in groups of ten while retaining live summary updates and existing links. No deployment.

- Verification: 29 learning tests passed before mistake-history addition; final eight Part/Full × difficulty public-sharing tests passed with chronological history/count/permission/revocation assertions. Ten frontend share tests including retry mistakes and pagination passed; TypeScript/isolated production build and Django check passed. SQLite and test-only MD5 hasher for backend tests. No deployment.

- PRACTICE-SHARE-03 rollout: backup before-share-attempts-20261027T173433Z; real anonymous API and Chromium at 390/1280px passed three-attempt history, mistakes, ten-row pagination/back/reload and revocation; disposable learner cleaned. Existing private-media/library smoke passed.

## PRACTICE-SHARE-04 — Show mistakes directly
- Status: Completed (deployed, 2026-10-27)
- Scope: Remove full answer/correct-token comparison from public practice cards; show mistake history by attempt directly.

- Verification: ten focused frontend tests, TypeScript/isolated build and diff check passed. Live disposable-learner Chromium at 390/1280px passed visible per-attempt mistakes without opening details, absent full answer list, pagination/reload and revocation.

## PRACTICE-SHARE-05 — Style attempt mistakes
- Status: Completed (deployed, 2026-10-27)
- Scope: Responsive navy/teal attempt cards with readable error corrections and explicit missing/extra labels.

- Evidence: ten frontend tests, build/diff check; actual-backend Chromium at 320/390/1280px passed history visibility, pagination/reload, overflow and page-error checks; 390px screenshot reviewed. Disposable learner removed.

## READING-CONTENT-21 — Complete Reading library through Cambridge 21
- Status: In Progress (2026-10-28; user explicitly reiterated complete Listening-style flow)
- Scope: Cambridge 10–14 and 16–21 only; skip 15 by explicit user instruction. Inventory supplied Drive originals, review passage/question/key coverage, prepare native content and all four tests/three passages per volume, and persisted Full Reading Mocks. Existing Listening and Reading history stays pinned. Latest user authorizes finished-book deployment after completing current volume.
- Source evidence: supplied Drive folder contains all eleven requested volumes; originals downloaded and PDF-readable, with SHA256/page manifests privately staged. Cambridge 20 supplied 73-page revision has no Reading key pages; requested the original key/source from the user rather than inventing answers.
- Current local evidence: Cambridge10/11 all8 tests and Cambridge12 all4 (source5–8),480 genuine reviewed questions, pass isolated Full Chromium1440/390/320 save/resume/40-of-40/timing/privacy checks. Cambridge21 all4 historical live verified. No new deployment.
- Next: finish authorized10–12 rollback/deployment and actual-site acceptance, then remaining28 tests in13–14/16–20. Cambridge20 needs independently located genuine keys matched to supplied revision; no inference. Do not claim source PDF preparation alone fills the student library.

## READING-FULL-01 — Persisted Full Reading Mock
- Status: Completed (2026-10-28; authorized deployment and actual-site verification)
- Scope: three reviewed passages from one owner/book/test, exact 1–40 numbering, pinned versions, owned timed/untimed attempts, persisted answers and server scoring/deadline. Incomplete tests cannot start. No deployment.

### READING-FULL-01 initial verification (historical, 2026-10-28)
- Initial stage evidence below predates the successful authorized rollout recorded in STATUS; current status is Completed.
- Evidence:23 normal-hasher Reading/API tests; full backend206 passed/3 skipped using temporary test-only MD5;32 focused Reading frontend tests; actual isolated-stage Chromium1440/390/320px all40 answers/save/reload/resume/final40-of-40, timer, sibling-study restriction and immutable result passed. Migration drift and Django check passed. Infrastructure25 passed.
- Security: blocked generic paper detail and editor source/key review during own timed Full; prior submitted timed/passage results guarded.
- Content ledger: docs/READING_CONTENT_LEDGER.md, all44 tests. Cambridge21 Test1 reviewed and stage verified. Test2 newly source reviewed privately; multiple-answer semantics required before import. Remaining library work stays In Progress.
- Historical rollout: actual-site receipt for all4 Cambridge21 Full tests and admin workflow is /tmp/practiceielts-reading-c21-complete-live-receipt.json, backed by backups/before-reading-c21-complete-20261028T104830Z/. Current boundary is no deployment.

## READING-MULTIPLE-01 — Source-defined unordered multiple answers
- Status: Completed (historical authorized rollout and actual-site verification, 2026-10-28)
- Trigger: supplied Cambridge21 Test2 questions20–21 require two letters in either order.
- Scope: shared source prompt, complete options, numbered answer slots, strict identical distinct key sets, order-independent scoring with duplicate-credit prevention in both passage and Full, editor controls and persisted learner controls. Preserve prior publications/results.
- Acceptance: both orders score correctly; duplicates/partial/wrong answers score honestly; invalid source key groups rejected; native source tables retain blank cells/captions; stage and live browser save/resume/result verified before publishing Test2.

## READING-MOCK-FLOW-01 — Same Mock workflow as Listening
- Status: Completed (historical authorized rollout and actual-site verification, 2026-10-28)
- Scope: remove redundant top Listening/Reading switcher from learner/admin pages. Match Reading Full Mock timing selection, focused exam shell, question/passage navigation, final submission and separate scored result view to the existing Listening Mock workflow. Apply the same flow for administrators taking a Mock. Preserve source review, server security, autosave/resume, version pins and all content work.
- Acceptance: timed/untimed choice → Start/Resume → native Reading panes with common exam controls and numbered navigation → save before exit/submission → read-only result route/reload, working desktop/phone and admin entry; focused/full tests and browser verification before rollout.

- Historical verification for READING-MULTIPLE-01/READING-MOCK-FLOW-01: final frontend105/105, backend216 passed/3 skipped (temporary fast hasher),33 focused normal-hasher Reading tests; stage and actual-site Cambridge21 Tests1–4 save/resume/results and admin Preview Mock passed. See STATUS rollout/acceptance checkpoints and durable receipt. No new deployment in this resumption.

## READING-FIGURES-01 — Private source figures in native passages
- Status: Completed locally/stage (2026-10-28; no deployment)
- Trigger: Cambridge10 Test3 Passage3 includes a labelled Pacific map; preserve actual source geometry.
- Scope: reviewed bounded crops from passage pages only, accessible alternate text, immutable version-pinned figure delivery in passage/Full attempts, owner permissions and timed-study restrictions. No full source/key exposure or deployment.
- Evidence:49 Reading/import/ML/Full/figure backend tests passed; final10 figure tests include owner-editor timed denial/restoration. Frontend106/106 full suite/build passed. Original Test3 map crop visually compared, authenticated image loaded/alt checked through real1440/390/320 Full browser. Check/migration drift/Ruff/diff passed. No deployment.

## READING-OPTIONS-01 — Visible source options and short answer selectors
- Status: Completed and verified live (2026-10-28)
- Scope: display complete labelled A/B/C or roman-numbered source options above answer controls; answer selectors show only short source codes, including paragraph/headings matching. Persisted answer values/keys unchanged.
- Evidence: frontend108passed/build; threewidthstage40/40/visible-option/code-onlyassertions; all12livelearnerFullMocks40/40 andadmin1440/390passed. Phone screenshot reviewed; previousdeployedfrontendbackedup. Stored codes and keys unchanged.

## READING-FLOW-03 — Match the Listening Mock learner flow
- Status: Completed and verified live (2026-10-29; explicit user deployment authorization).
- Scope: book/test → Full or passage selection → Full timed/untimed start/resume → existing saved question workspace → persisted results/history. Preserve short A/B source options, keys/privacy/old pins and all user edits. Individual passages retain supported untimed practice. Reading content authoring remains paused. No deployment requested for this change.
- Evidence: Full/passage selector, Full timed/untimed start/resume with mode-change confirmation, owned Full/passage result history and existing persisted question workspace connected. Backend229passed/3skip; frontend116 tests all observed passed (full114 plus two failed files15/15 isolated retry after load-related timeouts); finalbuild/check/drift/Ruff/diffpassed. Actual-site student1440/390/320 Full40/40 save/reload/resume/history/timed/privacy/immutable and admin1440/390 PreviewMock/save/submit/results passed; disposable probes cleaned. Rollback backups/before-reading-flow-20261029T051927Z/, final receipt retained. No migration/content changes or old-pin rewrites.

## READING-SHARE-01 — Reading passage and Full Mock result sharing
- Status: Completed and verified live (2026-10-29; omitted Listening-parity feature delivered).
- Scope: submitted-only owned share/revoke links for one passage and Full Mock, immutable public result snapshots, anonymous read-only result page; private source/full passage/identity excluded. Preserve previous publications/results. Follow existing Listening sharing semantics.
- Evidence: submitted-only owned passage/Full share/revoke, immutable random-token public snapshots and anonymous page delivered; reading0006 additive migration. Frontend120full+final16focusedpassed; backend232fullpassed/3skip plus one anonymous-throttle test isolated by test IP and sharing4/4retry passed (all233 observed passed). Real-site1440/390 passage13/13+Full40/40 share/create/reload/anonymous/no-store/private-source exclusion/revoke404 passed; disposable probes cleaned. API/worker/nginxactive; old publications/attempt pins/Listening shares retained. Rollback backups/before-reading-share-20261029T054825Z/.

## READING-TEXT-ORDER-01 — Source-defined either-order free-text blanks
- Status: Completed and verified live (2026-10-29, Cambridge14 complete-book release).
- Scope: validated unordered_sets of question numbers within free-text notes/table/answers; same distinct source-key pool, one mark per normalized answer, retain word limits; legacy content without explicit sets unchanged. No migration/source-key inference/historical-version updates.
- Evidence: reverse/duplicate-normalized/word-limit passage and Full integration/schema tests passed; all243backendcases covered240passed3skip/all123frontendpassed across bounded groups. Cambridge14all4stage1440/390/32040of40 and all4actualsiteFull/admin acceptance passed. Scorer released with complete14book, no migration/legacy version changes. Rollback backups/before-reading-book-14-20261029T122103Z/.

## VOCABULARY-50-01 — User-supplied IELTS English–Uzbek vocabulary
- Status: Completed (source parsed and frontend production build verified, 2026-11-06)
- Scope: Add the supplied 50-day, 1,000-entry vocabulary PDF to the learner site. Keep source entries as structured bundled JSON; make a responsive lesson with typed recall, answer reveal, self-rating, daily twenty-word sessions and a repeat queue; keep searchable dictionary as a secondary mode. Store study marks locally and provide the original PDF download. Do not claim official IELTS questions or server-side progress persistence.
- Acceptance: 50 days and 20 unique entries/day; every entry includes English headword, Uzbek translation, definition, near synonyms, collocations, word family and example; lesson opens with an explicit start screen, then presents one animated card at a time; learner recalls/enters each translation before seeing the answer, rates it, and can repeat flagged words; reachable from navigation/dashboard; usable by keyboard and responsive on phone and PC.
- Verification: PDF parser checked 1,000 unique words and all required fields across 50 days. Frontend TypeScript/Vite production builds passed using Node 24.22.2. The default system Node 18.19.1 is below package engines and cannot run the current Vite toolchain. No test suites run.
