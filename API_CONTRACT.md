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
