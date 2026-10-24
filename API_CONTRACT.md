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
PUT materials/<id>/questions/ {presentation:"text"|"pdf"|"legacy_pdf" (default text),questions:[{number,part,type,prompt,instructions,options:[{key,text}],answers:[string|array],max_words,context?}],document?,document_pages:[],duration_seconds} validates and stores a new question set. Text sets require actual prompts, text tables and descriptions for map/diagram tasks; source document/page metadata is editor-only. Published question sets are immutable.
POST materials/<id>/publish/ {confirm_review:true} publishes transcript and compatible latest question set together; a material without questions offers dictation only.
POST mock-attempts/ {material,timing:"timed"|"untimed"} creates/resumes a pinned attempt. GET/PATCH mock-attempts/<id>/ loads/autosaves own answers; keys and transcripts are withheld before submission.
POST mock-attempts/<id>/start-audio/ issues a single-use short-lived audio ticket. GET mock-attempts/<id>/audio/ with the X-Exam-Audio ticket header serves original exam audio; generic study media/transcript endpoints are blocked for that student's active material.
POST mock-attempts/<id>/submit/ finalizes atomically and returns scored results/accepted answers. Timed expiry is enforced by the server; untimed has no deadline.
GET mock-attempts/<id>/document-pages/<page>/ is denied for text presentations. It remains limited to explicitly approved pages of pinned legacy_pdf attempts for historical API compatibility. The current student UI never renders PDF images, including for legacy sets. Full PDF/extracted text stay editor-only. Attempt responses include presentation; document_pages is empty for text sets.
GET materials/?mock_available=true filters to materials with a published question set before pagination.

### Original PDF layout (latest user clarification)
Question sets with presentation=pdf require a private document, nonempty approved document_pages and one valid context.pdf_field rectangle for every question. Coordinates must be finite normalized numbers, stay wholly inside the page, and reference an approved page. Text-only rules about copying map/table content do not apply to original-layout sets, because that content remains in the PDF.
GET question-documents/<id>/pdf-pages/<page>/ returns one isolated application/pdf page to its authorized editor.
GET mock-attempts/<id>/pdf-pages/<page>/ returns one isolated application/pdf page only for an owned attempt pinned to a pdf presentation and an approved page. Other pages are denied. Page annotations/actions and document-level collections are not copied into the isolated page. No complete source PDF URL or extracted answer-key text reaches the student.
Attempt question context includes the reviewed field rectangles; the existing answer API continues to autosave/score by question number. No raster PNG is used as the new exam page viewer.
