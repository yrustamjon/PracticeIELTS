# API contract v1
Base /api/v1/, JSON, authenticated unless specified. Errors: DRF field/detail errors. Lists paginated using count/next/previous/results. IDs integers. Times milliseconds. Dates ISO 8601 UTC.

POST auth/register/ {username,email,password} → user (student only)
POST auth/login/ {username,password} → {access,user}; sets HttpOnly refresh cookie
POST auth/refresh/ → {access}; rotates refresh cookie (CSRF required)
POST auth/logout/ → 204; invalidates refresh and clears cookie
GET auth/csrf/ initializes CSRF cookie; GET auth/me/ → user
GET categories/?search=; staff POST/PATCH/DELETE categories/<id>/ {name,parent,description,position}
GET materials/?search=&category=; staff POST/PATCH materials/<id>/ {title,category,description,source,license,rights_confirmed}
POST materials/<id>/audio/ multipart {file} → audio metadata
PUT materials/<id>/transcript/ {segments:[{text,speaker,start_ms,end_ms}]} → new draft version
POST materials/<id>/publish/ → published material; requires validated audio, transcript and rights
GET materials/<id>/ → material + permitted transcript/audio metadata
GET audio/<id>/stream/ → private audio bytes; Range supported
GET/POST sessions/ {material,difficulty:easy|medium|hard|full} → session pinned to version, grouped intervals
GET/PATCH sessions/<id>/ {position,draft} → autosave/resume own session
POST sessions/<id>/check/ {answer,position,normalization?} → deterministic word alignment/accuracy, stores original response
GET progress/ → response-derived counts/accuracy/weekly activity/resume/recent materials
GET responses/?mistakes=true → own checked answers and corrections
GET schema/ and docs/ → OpenAPI schema and documentation

Students never see drafts; anonymous users never see private media; staff permissions enforced by API. Mock sessions will not use these unrestricted transcript endpoints.

## Real workflow extension
POST materials/<id>/audio/ multipart file + optional reference_text/reference_file automatically queues audio processing; returns audio plus job metadata. Reference files accept UTF-8 TXT or text-based PDF.
POST materials/<id>/process/ {reference_text?,force?} schedules a new idempotent processing job for latest audio; an optional authoritative text can be supplied.
GET materials/<id>/processing/ returns the latest authorized job status/stage/error/result version; never leaks another editor's private job.
Successful processing stores word-timed immutable transcript versions; admin reviews then publishes once for both Practice and Mock.
Easy playback groups may include word_count. Medium is exactly one sentence and hard at most three consecutive sentences; no word count is returned in medium/hard.
Question/PDF/exam contracts follow below.

### Question/PDF/exam contract
POST materials/<id>/question-document/ multipart file: private PDF, extracted text/status and teacher page-preview URLs. Text/answers are editor-only.
GET materials/<id>/questions/ returns latest editable question version to authorized teachers.
POST materials/<id>/question-drafts/ {document,pages:[1,...]} → editor-only {questions,source_text,warnings}. Only selected pages are read; numbered text/line-labelled options produce editable drafts. Numbered dotted/underscored blanks add context.pdf_field={page,x,y,width,height}, normalized top-left coordinates from real PDF glyph boxes. All positions require review. No answer keys or arbitrary PDF layout are inferred. Empty drafts require manual transcription. Ownership and page bounds are enforced.
PUT materials/<id>/questions/ {presentation:"text"|"html"|"pdf"|"legacy_pdf" (default text),questions:[{number,part,type,prompt,instructions,options:[{key,text}],answers:[string|array],max_words,context?}],document?,document_pages:[],duration_seconds} validates and stores a new question set. Text sets require actual prompts, text tables and descriptions for map/diagram tasks; source document/page metadata is editor-only. Published question sets are immutable.
POST materials/<id>/publish/ {confirm_review:true} publishes transcript and compatible latest question set together; a material without questions offers dictation only.
POST mock-attempts/ {material,timing:"timed"|"untimed"} creates/resumes a pinned attempt. GET/PATCH mock-attempts/<id>/ loads/autosaves own answers; keys and transcripts are withheld before submission.
POST mock-attempts/<id>/start-audio/ issues an owned short-lived ticket. Timed attempts allow one start and one delivery; untimed attempts can obtain fresh tickets and repeat delivery for replay, retry or return. GET mock-attempts/<id>/audio/ requires the X-Exam-Audio ticket header in both modes. Active timed attempts block generic study routes and other attempts/history in the same test; untimed attempts alone impose no sibling/study lock.
POST mock-attempts/<id>/submit/ finalizes atomically and returns scored results/accepted answers. Timed expiry is enforced by the server; untimed has no deadline.
GET mock-attempts/<id>/document-pages/<page>/ is denied for text presentations. It remains limited to explicitly approved pages of pinned legacy_pdf attempts for historical API compatibility. The current student UI never renders PDF images, including for legacy sets. Full PDF/extracted text stay editor-only. Attempt responses include presentation; document_pages is empty for text sets.
GET materials/?mock_available=true filters to materials with a published question set before pagination.

### Original PDF layout (latest user clarification)
Question sets with presentation=pdf require a private document, nonempty approved document_pages and one valid context.pdf_field rectangle for every question. Coordinates must be finite normalized numbers, stay wholly inside the page, and reference an approved page. Text-only rules about copying map/table content do not apply to original-layout sets, because that content remains in the PDF.
GET question-documents/<id>/pdf-pages/<page>/ returns one isolated application/pdf page to its authorized editor.
GET mock-attempts/<id>/pdf-pages/<page>/ returns one isolated application/pdf page only for an owned attempt pinned to a pdf presentation and an approved page. Other pages are denied. Page annotations/actions and document-level collections are not copied into the isolated page. No complete source PDF URL or extracted answer-key text reaches the student.
Attempt question context includes the reviewed field rectangles; the existing answer API continues to autosave/score by question number. No raster PNG is used as the new exam page viewer.

### Native HTML question sections
POST materials/<id>/question-html/ multipart file (.html/.htm, UTF-8, <=1 MB), authorized editor only, returns {sections:[{part,html}],questions,warnings}. Question groups are extracted only from part1–part4 content containers. Controls become numbered markers; source scripts, styles, prefilled text values, hidden script keys, handlers and remote media are not used. Keys must be supplied/reviewed separately.
PUT materials/<id>/questions/ accepts presentation=html and sections:[{part,html}]. Markup is sanitized again server-side; the bounded allowlist retains native notes/lists/tables. Markers {{n}} and {{n:A}} must match existing questions/options in the same part; duplicates/missing questions/incomplete option controls are rejected. Existing scoring and answer-save endpoints are unchanged. Attempt responses include the sections from the pinned immutable question set. Frontend rendering recreates allowed React elements/controls and does not insert raw source HTML.

### Book/test hierarchy and per-Part authoring

`Category.parent` represents source → book (and optional additional collection levels). Existing independent materials are retained.

- `GET/POST listening-tests/`, `GET/PATCH listening-tests/<id>/`: `{title,category}`; owner-bound writes. List supports `category`, `search`, `page`, `page_size` (max 100), and teacher `owned=true`. Students see tests with at least one published Part or Full recording; private Part drafts are omitted.
- A test response includes `parts:[{number,id,title,status,mock_available,question_count}]`, `full` (same material summary or null), `full_source` (`upload` or `assembled`), `assembly_state`, and an editor-only `assembly_error`. Counts refer to published question sets, not unfinished drafts.
- `POST listening-tests/<id>/parts/ {number:1..4, material?:id}` creates/opens a Part draft or attaches an owned independent single-part material. Part numbers and material membership are unique; a recording cannot belong to multiple Parts/tests. Manage each Part through the existing material audio/transcript/questions/publication endpoints.
- `POST listening-tests/<id>/full-recording/ {material?:id}` creates/opens a Full material, optionally attaching an owned independent Full recording. Opening an existing editor leaves assembly/publication unchanged; uploading a replacement or explicitly publishing the Full material makes it directly authored.
- `POST listening-tests/<id>/assemble/` explicitly queues/retries assembly of four published Part transcripts. Publishing the fourth Part queues this automatically unless the Full recording is directly authored. Direct recordings remain independent until explicit assembly is requested.
- Assembly joins decoded whole Part recordings into one WAV and offsets actual segment/word timestamps. It creates new immutable transcript and question versions, renumbers question/HTML controls, and concatenates only approved PDF pages while rebasing answer rectangles. Matching presentation is required for question assembly. A missing Part question set yields Full Practice without Full Mock. Existing attempts/sessions keep their original version/audio/set pins.
- Saving questions on a linked Part assigns their part number from the test card. Such sets accept consecutive numbering from 1 or the IELTS start for that Part (11/21/31). Existing independent full papers still require numbering from 1.
- `GET materials/?standalone=true` excludes linked Part and Full records for independent-material views. Material metadata adds `test_part:{test,number}|null` and `full_test:id|null`; the UI uses these to return to the enclosing test.
- Active timed Mock guards cover the assembled material and every sibling Part, including existing untimed attempts and submitted history. A rejected blocked restart preserves the saved attempt. Untimed Parts and Full attempts can remain open together; one active attempt per material and mode-switch restart confirmation still apply. Owned answer/ticket/private-page checks remain enforced.

### Admin hierarchy correction

A test's `category` must be a leaf volume inside a book (`parent` is set and the category has no children). `POST listening-tests/` and category changes through PATCH validate this server-side. Opening a root book is a volume-list operation, not test creation.

Existing root-level tests remain readable and their Part/history endpoints remain valid. Owners can PATCH such a test to an existing volume. This moves the classification of its linked Part/Full materials together; material IDs and pinned transcript/question/session versions do not change. New creation and moves to root/nonleaf book categories are rejected.

### Transcript review validation

`PUT materials/<id>/transcript/` accepts optional existing segment `id` along with `text`, `speaker`, `start_ms`, and `end_ms`. Times must be integer milliseconds, nonnegative, positive-length, nonoverlapping and within the current audio. A 400 response under `segments` names the one-based row and specific text/timing correction; empty sentences must be removed or completed.

Existing IDs are resolved only against the prior version of this material and the same audio. Older clients without IDs can preserve word anchors by an unchanged interval. Removing/reordering rows does not change the identity of other sentences; changed timing invalidates obsolete anchors. The endpoint saves a new version and does not mutate published transcripts. Adjacent 50ms-gap adjustments are explicit client-side review edits submitted together, never a silent server modification.

## Easy Practice timing corrections

GET/POST sessions responses also include timing_revision (integer or null) and can_edit_timing (boolean). Only an active administrator (role admin or Django staff), using their own Easy session for the currently published transcript, receives edit capability.

PATCH sessions/<id>/timing/ {position,start_ms,end_ms,revision} → updated session. All non-null values are strict integers; revision is the current timing_revision, including explicit null for original timing. Reject nonpositive/out-of-audio intervals and overlap with adjacent exercises. The endpoint creates an immutable timing snapshot and advances only the editing admin's session, retaining drafts, checked responses and position. Future Easy starts use the newest snapshot; existing other sessions stay pinned. Other difficulties and published/unpublished transcript content are untouched. A no-op save returns the current session without a new revision.

Errors: 401 unauthenticated; 403 non-admin; 404 another user's session; 400 unsupported difficulty or invalid input/interval; 409 stale timing or a newer transcript publication (reopen the latest Easy Practice from its material). No neighboring interval is silently trimmed. Preview may include adjacent audio, but persisted windows cannot overlap.

## Super administrator and profile settings

Django `is_superuser` is the super administrator authority; public registration remains student-only. Auth responses add read-only `is_superuser` and `can_delete`. Ordinary delegated admins have `role=admin`, `is_staff=false`, `is_superuser=false`: they can author content but cannot access account administration, the audit API or DELETE actions. Only a superuser may remove saved transcript rows or reduce a saved question set for the same audio. Corrections still create new immutable versions. Existing material/test deletion endpoints remain unavailable; category deletion keeps protected-child/content checks.

- `POST auth/password/ {current_password,new_password}` verifies the current password and Django password rules, returns a fresh `{access,user}` and refresh cookie, and revokes earlier access/refresh tokens. Available to all authenticated users; password input is never logged. Clients must replace their in-memory access token.
- `GET admin/accounts/?page=&page_size=&search=` lists administrator/staff/superuser accounts, superuser only. `POST admin/accounts/ {username,email?,password}` creates an ordinary admin; privilege flags and other fields are rejected. No password/hash is returned.
- `GET admin/activity/?page=&page_size=&actor=&action=&search=` returns newest-first persisted audit events, superuser only. Fields: `id,actor,username,action,material,material_title,details,created_at`. Bounded pagination; no audit mutation endpoint. Generic successful editor API mutations record method/path/status without request bodies or query strings, alongside existing domain audit events. Successful editor sign-ins, administrator creation and password changes have explicit events. Older events retain their original information.

When rolling out the password-revocation setting, existing JWTs without the password fingerprint require a fresh sign-in. Apply learning migration `0007_auditlog_details` before restarting backend/worker processes. Never apply a live migration or deploy this change without rollout authorization.

### Private media conditional caching
Study `GET audio/<id>/stream/` and approved `GET .../pdf-pages/<page>/` responses expose ETag and `Cache-Control: private, no-cache, must-revalidate`, varying on Authorization/Cookie. Clients may retain bytes but must validate with the server before reuse. Matching If-None-Match returns 304 only after current authorization, approved-page and applicable active-exam checks. New file metadata changes the validator. Exam ticket audio retains private/no-store and single-delivery rules. No public/shared media caching is enabled.

### Progressive study audio
POST audio/<id>/playback/ (Bearer JWT required) validates current study access and returns {url,expires_in:600}; sets a signed HttpOnly SameSite=Strict study_audio cookie scoped to /api/v1/audio/. Native audio may GET the existing stream URL with this cookie and Range headers. This cookie authenticates only study audio GETs, not general APIs or exam ticket audio. Every request still checks publication/editor access and active timed-exam restrictions before caching or streaming. Password changes and inactive users invalidate grants; logout and identity changes clear the browser cookie. Frontend renews active grants before expiration and provides retry. Original Bearer stream requests remain supported. Native buffering can start playback before the complete file is downloaded; exam audio retains its existing ticket/no-store/single-delivery contract.


## Progressive Mock audio (MOCK-STREAM-01)
POST /api/v1/mock-attempts/<id>/start-audio/ retains Bearer/owner authorization and returns url, ticket, duration_ms and ticket_expires_seconds. It additionally sets an HttpOnly SameSite=Strict signed exam_audio cookie scoped to that attempt's audio URL. Native GET audio accepts that cookie only on the audio action; other APIs require normal authentication. Cookie validates active user, attempt ID and current password session hash. Existing Bearer + X-Exam-Audio callers remain supported. Timed tickets expire in 120 seconds and retain atomic single delivery, no Range/restart; an already open response streams incrementally. Untimed grants expire in 24 hours, permit repeated delivery and single byte ranges (206/416), and are invalidated by a new grant. Every request enforces ownership, submission/deadline and applicable study guards. Responses remain private/no-store and disable nginx response buffering. No ticket appears in URLs.

## Mock result sharing
The browser shares a text summary from the existing owner-authorized submitted `mock-attempts/<id>/` response: material title, timing mode, raw score and percentage. No new API, public result URL, answer keys, media or account information is shared. Native sharing falls back to automatic clipboard copying, including a legacy browser copy fallback; concise status replaces manual-copy fields.

## Public detailed Mock results
GET/POST/DELETE mock-attempts/<id>/share/ (owner only): get current {token|null}, create/reuse snapshot {token}, revoke link (204). Only submitted attempts may be shared. GET shared-results/<uuid>/ is anonymous read-only and returns the explicit saved summary, category path, test/Part labels, timing, submission date and per-question prompt/options/student answer/accepted answers/correctness. No user identifiers, private media or document endpoints. Missing/revoked tokens return 404; responses are no-store/noindex.

GET mock-attempts/history/?page=1 → paginated owner-only submitted attempt summaries {id,title,category_name,timing,submitted_at,score,total}. Ten per page, newest submission first; timed-study restrictions filter blocked materials exactly as existing attempt listing. No answers/keys/media in summaries.

## Administrator user directory
GET admin/users/?search=&role=student|teacher|admin&page=1 returns 20-per-page safe user fields (id,username,email,role,is_active,is_superuser,date_joined), practice_sessions,checked_answers,completed_mocks,mock_score_percent,last_learning_at. GET admin/users/overview/ returns total_users,students,active_accounts,learning_users_7d,completed_mocks,checked_answers,mock_score_percent. Learning activity derives from session/response/attempt timestamps; mock percentage is weighted stored score/total for submitted scored attempts. Active admins/superusers only; read-only, no passwords/tokens/answers. auth user includes can_view_users capability; server permission remains authoritative.

Practice timing extension: sessions/<id>/timing/ PATCH supports Easy, Medium and Hard administrator sessions. Timing revision selection is scoped by transcript version, grouping version and difficulty; full remains read-only. Existing Easy revisions retain their scope. Published content and historical session playback are preserved.

GET/POST/DELETE sessions/<id>/share/: owner-only share status/create/revoke. POST requires every exercise checked; snapshots only latest checked responses for this pinned session. GET shared-practice-results/<uuid>/ is anonymous read-only and shows category/book/test/Part, difficulty, average exercise accuracy and per-exercise checked answer/reference/comparison. No private IDs/account information/media or other difficulties/Parts. Unknown/revoked token 404; no-store/noindex.

Practice sharing supports every difficulty (easy/medium/hard/full) on Part, Full test and standalone materials. Each session has its own token/snapshot. Repeated POST reuses the saved snapshot; revoke and recreate to capture later checked answers. Submitted Mock sharing remains independent per Part/Full attempt.


## Live practice sharing (supersedes frozen practice snapshot semantics)
GET/POST/DELETE sessions/<id>/share/ remain owner-only. POST is allowed before any checked answer and returns/reuses the same session token. GET shared-practice-results/<uuid>/ now derives the latest checked responses for that pinned session on every request, including existing links. Fields add checked_count, status (in_progress|completed); exercise_count is total exercises, accuracy is null until the first check, completed_at is null until all exercises have checked responses. Unchecked drafts/reference text are omitted. Checked corrections remain visible. Public page polls every 15 seconds while visible, supports manual refresh, and stops polling on errors. Revocation remains immediate; public data remains no-store/noindex. Mock result snapshots are unchanged.

### Shared practice retry history
Public practice result rows additionally expose `attempt_count` (persisted Check Answer submissions, not audio replays), `first_accuracy` and chronological `attempts`: `{number, accuracy, mistakes: [{status, expected, actual}]}`. Mistakes project only incorrect/missing/extra comparison tokens; correct tokens and private identifiers are excluded from history. Latest answer/comparison and overall latest-answer accuracy remain unchanged. Public UI renders ten checked exercises per page using `?page=`, preserves the page during polling, and clamps invalid/out-of-range pages. Pagination is client-side; the API still returns all checked rows. History is collapsible beneath each answer.

Public practice presentation now displays mistake history directly per attempt and omits the full latest answer/reference/token list. API projection remains unchanged.

## Question-only Mocks (MOCK-CONTENT-21)
`QuestionSet.audio` and `MockAttempt.version` may be null. Saving reviewed questions no longer requires a recording. Editor-only `POST /api/v1/materials/{id}/publish-questions/` requires `confirm_review: true`, source/license/permission metadata and a valid saved question set. It publishes questions independently, preserving existing transcript publications. Learner material/test visibility includes published question-only papers; `practice_available` is false without a published transcript. Test summaries and attempts expose `audio_available`; false means no start-audio action is available. Existing attempts remain pinned to their question set and optional transcript version; adding audio does not retroactively enable it on a question-only attempt. Keys remain hidden until submission and PDF access remains attempt-scoped to approved pages.

## Reading passage increment (READING-10-01)
Separate /api/v1/reading-papers/ and /reading-attempts/ APIs preserve Listening behavior. ReadingPaper is an owner-bound book/test/passage identity; append-only ReadingVersion contains structured paragraphs, question groups/table cells, private keys and source-PDF/page references. A published pointer changes only after explicit comparison/review confirmation. Attempts pin a published version.
GET reading-papers/ lists published summaries (editors may request owned=true drafts); POST creates an editor-owned draft with source PDF. GET reading-papers/{id}/ returns published content (owned editor receives latest draft and private review metadata). POST {id}/versions/ saves a new draft; POST {id}/publish/ {version,confirm_review:true} publishes only a reviewed version with source/license/rights confirmation. GET {id}/source-pages/{page}/?version=id is editor-only, returning a source page image. No source files/keys go to learners.
POST reading-attempts/ {paper} creates/resumes one active owned attempt; GET/PATCH {id}/ loads/saves validated partial answers; POST {id}/submit/ atomically scores saved answers and reveals accepted answers. Submitted attempts cannot change; later publication does not change pinned attempts. This increment is untimed passage practice, not a full timed Reading examination.

## Reading administrator hierarchy summaries (2026-10-28)

`GET /api/v1/reading-imports/` retains editor/owner authorization and adds `locations`: `{candidate_index, book, test, passage, title}` for saved candidates. This summary excludes passage bodies, answer keys and source paths; existing `published_papers` distinguishes saved drafts from publications. Clients follow pagination before deriving book/test choices.

`POST /api/v1/reading-imports/{id}/approve/` rejects an identity `(owner, book, test, passage)` that already exists with HTTP 400. Repeating approval of the same candidate remains idempotent. Explicit revisions use the existing paper version/review endpoints, preserving historical version pins.


### Reading headings and matching (2026-10-28)

Reading question groups additionally accept `kind: "headings" | "matching"`.
`options` contains unique source answer codes (for example `i`, `iv`, or `A`),
and optional `option_labels` maps those codes to full source text. Headings
require a complete label for every code; unknown labels, duplicate options and
keys outside the supplied codes are rejected. Learners see the labels but save
codes. Matching may use bare paragraph letters or labelled features. The same
publication review, private-key, attempt ownership and immutable-version rules
apply. Existing `choice` payloads without labels remain compatible.

### Full Reading attempts

`POST /api/v1/reading-full-attempts/ {paper, timed:true|false}` uses a published
passage ID to identify its owner/book/test. All three passages must be published
and their question numbers must cover exactly 1–40 in passage order. Returns
201 for a new attempt or 200 for an existing active attempt of the same mode.
Each attempt pins all three versions; later publication cannot alter it.
`GET/PATCH {id}/`, `POST {id}/submit/` use existing answer/result contracts,
with `passages:[{passage,version}]`, `timed`, `deadline`, and `server_time`.
Timed attempts expire after 60 minutes. Retrieval, save and submission finalize
expired attempts using only previously persisted answers; late writes are
rejected. Before final submission, source metadata, keys and results are private.
Active timed Full attempts block sibling passage/untimed result access.

Timed Full study guards also apply to generic Reading paper detail and editor-only
source-page review. An editor taking a timed Full cannot use those review routes
to inspect the keys. Earlier submitted passage and Full results from the same
owner/book/test remain blocked until the active timed Full is submitted or expires.

### Reading unordered multiple answers

`kind: "multiple_choice"` represents source instructions to choose multiple
letters in any order. `text` preserves the shared source prompt; `questions`
contains2–10 consecutive numbered answer slots; `options` and complete
`option_labels` preserve every source choice. Each slot's private key list must
contain the same distinct accepted codes, exactly one per required answer.
Save one code per slot using the existing answers map. Final passage/Full scoring
accepts either order and awards each correct code at most once within its group;
repeating a correct code cannot earn duplicate credit. Submitted historical
results are not recalculated. Table groups may retain blank headers/cells and
use `text` for the original caption.

## Reading source figures (local increment; not deployed)
Reading content may include up to10 reviewed `figures`: `{page, crop:[x,y,width,height], alt, after_paragraph}`. Crop coordinates are normalized from the top-left of the original PDF page. Positive finite dimensions must fit within the page; figure pages must be approved passage pages and cannot be private key pages. Position0 precedes the first paragraph; positionN follows paragraphN. Alternate text is required. Figures remain within immutable content versions.
Authenticated PNG routes: `GET /api/v1/reading-attempts/{id}/figures/{index}/`; `GET /api/v1/reading-full-attempts/{id}/figures/{passage}/{index}/` (passage1–3, index0-based); editor-only `GET /api/v1/reading-papers/{id}/figures/{index}/?version={version}`. Learner routes use only the owned attempt’s pinned versions, never a caller-selected page/crop or current publication. Full timed restrictions also block other attempts’ figures; the active attempt can access its own figures. Editor figure review follows timed study guards. Responses contain only the approved crop and use private,no-store. Invalid figures/pages/ownership fail with normal API errors. No source PDF/key URL is exposed.

Question groups may provide `figure_indices` referencing the version’s `content.figures` list. Each reference must exist and may occur in only one group. Referenced diagrams render within that group instead of duplicating them in the article; figure route authorization and version pins remain identical. Groups without references retain their prior presentation.

### Reading learner selection and history (2026-10-29)
GET reading-full-attempts/ returns paginated owned metadata only: id,paper,book,test,passage=0,title,timed,score,total,submitted_at,created_at. Elapsed timed attempts finalize before listing. An active timed exam hides sibling practice/completed history for that owner/book/test; no passage content, answers, keys or source links are returned. GET reading-attempts/ additionally includes book,test,passage,timed=false,total,created_at for owned, study-permitted passage history. Existing POST start/resume and immutable submission contracts are retained. Individual passage practice remains untimed; Full mocks support timed60minutes/untimed.

### Reading result sharing (2026-10-29)
GET/POST/DELETE reading-attempts/<id>/share/ and reading-full-attempts/<id>/share/ are owned and respect timed study guards. Submitted-only GET returns {token:null|string}; POST idempotently creates a random UUID-backed immutable result snapshot; DELETE revokes. GET shared-reading-results/<uuid:token>/ is anonymous read-only, no-store/noindex/no-referrer,404 when revoked/unknown. Snapshot contains book/test/passage, title, mode, actualscore/total/date, numbered answers/mistakes/correct answers/options; excludes account identity, source PDF, full passage text and private version/source metadata. New share after revocation uses a new token.


## Administrator profiles
Super administrator only: GET/PATCH `/api/v1/admin/accounts/{id}/` targets only administrator accounts. PATCH accepts `new_password` and/or `is_active`, rejects other fields and changes to super administrators. Password validation uses existing Django policy. Resets revoke existing access tokens via CHECK_REVOKE_TOKEN and blacklist refresh tokens; blocking rejects authenticated access and blacklists refresh tokens. Passwords never appear in responses or audit details. GET `/api/v1/admin/activity/?account={id}` includes activity by that account plus events targeting its `details.user_id`, preserving actor/search/pagination filters. No schema migration.


### Blocked login
POST `/api/v1/auth/login/`: a matching inactive account with a valid password returns403 and `detail: "Your account has been blocked. Please contact the administrator."`. Invalid credentials remain401 with the existing generic detail. No access/refresh tokens or refresh cookie are issued to a blocked account. CSRF and login throttling apply before credential checks; reactivated accounts can sign in normally.


### Submitted Mock review audio
Owned submitted Mock responses include review_audio_url for the audio pinned by that attempt question set; active/no-audio attempts return null. Existing authenticated audio playback/stream permits an unpublished Full recording only when the requesting user owns a submitted attempt pinning it; active-exam study guards still apply. No anonymous/share audio access or change to exam one-play rules.
