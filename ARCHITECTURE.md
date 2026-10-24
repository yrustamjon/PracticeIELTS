# Architecture
React/TypeScript/Vite + Router + TanStack Query + Zustand + Tailwind frontend → /api/v1 → Django REST Framework → PostgreSQL. Redis brokers Celery; FFmpeg validates audio. Private local storage for development; S3-compatible storage configurable for deployment. Never expose object-store credentials. Browser uses same-origin Vite API proxy; JWT short-lived access tokens in memory, HttpOnly refresh cookie. Authorization enforced by DRF.

Backend modules: accounts (custom user/role); learning (categories, material metadata, versioned transcripts, audio, sessions, responses, audit); services (audio validation and deterministic comparison); future processing/mock_tests/integrations stay separate. Frontend: app shell/routes, reusable UI, feature pages, API client/auth store. This initial bounded learning module can be split by domain as complexity increases.

Relationships: User → PracticeSession → immutable TranscriptVersion → TranscriptSegment. Material → Category (arbitrary self parent, cycles forbidden), AudioAsset and TranscriptVersion. StudentResponse references session/version and stores raw answer and comparison. Staff writes emit AuditLog. Published versions are immutable; edits produce a new version. LearningProgress derives from persisted checked responses rather than a second source of truth. MistakeRecord/notes, jobs and exams are later milestones.

Audio stays original: segment windows in milliseconds, no per-sentence duplicate files. Validate file via ffprobe without shell interpolation; authenticated streamed Range delivery. Publish is gated on rights metadata, audio and validated non-overlapping segments. Exam playback must be a separate future restricted authorization path.

Future entities: ProcessingJob, Question/QuestionOption/AnswerKey, MockTestAttempt, MistakeRecord and VocabularyNote. Full transcript/word alignment is async; low-confidence results require editor review.


## Real ingest and exam extension
`processing` owns durable ProcessingJob records, real faster-whisper transcription, separate AlignmentService and timestamp-driven segmentation. A successful job produces a new immutable TranscriptVersion and Segment.words; it never publishes itself. ASR/reference errors and unmatched anchors are visible for review. Word-level timings drive Easy chunks; Medium uses one sentence, Hard uses at most three. PracticeSession.grouping_version preserves historical grouping semantics.

`exams` owns private QuestionDocument, immutable QuestionSet versions, normalized Question/QuestionOption/AnswerKey and MockAttempt. The material's published transcript and question-set pointers move together on approval. Attempt answers, deadlines and score are persisted, keys are omitted before submission, and raw PDF/extracted text stay editor-only. Student PDF endpoints render only pages approved in the pinned question set. Active exams block the same material's generic study, hints and media routes. Exam audio uses an owned, single-use ticket and the original recording.

PDF intake can show scanned pages but does not invent question structures or keys. Authoring supports typed questions or numbered answer fields backed by a reviewed PDF. Timed/untimed choice is a property of the attempt, not duplicate materials. UI uses the same navy/teal shell across library, content studio, Practice, PDF exam and results. Reading/Writing/Speaking remain read-only future placeholders.
