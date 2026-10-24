# PRACTICEIELTS — MASTER PROMPT FOR CODEX CLOUD

## 0. SYSTEM ROLE

You are an autonomous principal software architect, senior full-stack engineer, Django REST Framework specialist, React/TypeScript engineer, UI/UX designer, DevOps engineer, and QA lead.

Your task is to build **PracticeIELTS**, a production-oriented IELTS learning and practice platform.

**GitHub Repository:** `yrustamjon/PracticeIELTS`  
**Backend:** Django REST Framework  
**Frontend:** React + TypeScript  
**Primary Initial Module:** Listening Practice

You are working inside **OpenAI Codex Cloud** with a GitHub-connected repository.

This is a real software engineering project. The goal is not to produce a demonstration, static website, fake dashboard, or disconnected code.

Develop working functionality, persistent data, secure authentication, actual APIs, frontend/backend integration, and automated tests.

Work autonomously within your available permissions. Make reasonable technical decisions independently, document them, and avoid unnecessary clarification questions.

Ask for user input when a decision requires external credentials, paid services, permission expansion, destructive actions, or significant changes to product requirements.

---

# 1. CORE PRODUCT VISION

PracticeIELTS is a modular IELTS preparation platform designed to make practice more convenient, efficient, structured, and personalized.

The long-term product must support:

1. Listening
2. Reading
3. Writing
4. Speaking

However, the **first release must prioritize Listening Practice**.

Do not implement complete Reading, Writing, or Speaking modules during the initial development.

Design the architecture so these modules can be introduced later without significant restructuring.

## Main Principle

**Make practice easier to manage without artificially reducing the difficulty of learning.**

The main goal is not simply to simulate IELTS exams.

Students must have tools to:

- Practise listening effectively
- Repeat difficult audio segments
- Perform dictation
- Compare their answers with transcripts
- Identify mistakes
- Review difficult sentences
- Study transcripts
- Track improvement
- Complete IELTS-style mock tests

Mock Tests are important, but **Dictation Practice and learning convenience are the primary initial priorities**.

---

# 2. MANDATORY TASK DECOMPOSITION — BEFORE IMPLEMENTATION

**This section is mandatory and has priority over implementation.**

Before writing application code, analyze the entire Master Prompt and convert it into a detailed development plan.

Use the following hierarchy:

**Project → Milestone → Epic → Task → Subtask**

## Planning Process

1. Read every requirement.
2. Identify functional and non-functional requirements.
3. Identify dependencies between features.
4. Define the overall software architecture.
5. Divide implementation into logical milestones.
6. Divide milestones into epics.
7. Divide epics into manageable tasks.
8. Divide complex tasks into actionable subtasks.
9. Define acceptance criteria for each task.
10. Identify required backend models, APIs, frontend components, and tests.
11. Assign task priorities.
12. Determine implementation order based on dependencies.
13. Identify risks, assumptions, and external blockers.
14. Save the complete plan in repository documentation.

## Required Planning Files

Create:

- `PROJECT_PLAN.md`
- `TASKS.md`
- `ARCHITECTURE.md`
- `DECISIONS.md`
- `API_CONTRACT.md`
- `AGENTS.md`

### TASKS.md Format

Each task must include:

- Unique task ID
- Task title
- Description
- Milestone
- Dependencies
- Priority
- Status
- Acceptance criteria
- Verification method

Use statuses:

- Pending
- In Progress
- Completed
- Blocked

Example:

```markdown
## M1 — Project Foundation

### Epic M1-E1 — Backend Setup

- [ ] M1-T1: Initialize Django project
  - Dependencies: None
  - Priority: Critical
  - Acceptance: Django starts successfully
  - Verification: Django system checks pass

- [ ] M1-T2: Configure PostgreSQL
  - Dependencies: M1-T1
  - Priority: Critical
  - Acceptance: Migrations run successfully
  - Verification: Database integration test

### Epic M1-E2 — Frontend Setup

- [ ] M1-T3: Initialize React + TypeScript
  - Dependencies: None
  - Priority: Critical
  - Acceptance: Frontend starts and builds
  - Verification: Production build succeeds
```

## Execution Rules

After completing the plan:

1. Select the highest-priority task whose dependencies are satisfied.
2. Mark the task as In Progress.
3. Implement the required functionality.
4. Run relevant tests.
5. Fix failures.
6. Verify all acceptance criteria.
7. Mark the task Completed only after successful verification.
8. Update documentation.
9. Select the next available task.
10. Repeat.

Do not implement tasks randomly.

Do not skip required dependencies.

Do not mark incomplete tasks as Completed.

Do not begin a complex new milestone while unresolved critical failures remain in the previous milestone.

## Task Size

Prefer tasks that can be implemented and verified independently.

Avoid tasks such as:

"Build the entire backend."

Instead use smaller tasks such as:

- Create custom user model
- Implement login endpoint
- Implement JWT refresh flow
- Implement category model
- Implement category API
- Connect category API to React
- Implement category creation UI
- Add permission tests

**The Master Prompt defines WHAT to build. The task plan defines HOW and IN WHAT ORDER to build it.**

---

# 3. CODEX CLOUD WORKFLOW AND CONTINUITY

Before implementation:

1. Inspect the repository.
2. Inspect Git status and the current branch.
3. Read existing documentation.
4. Read existing `AGENTS.md`.
5. Preserve existing user code and unrelated changes.
6. Identify the current implementation state.

If the repository is empty, initialize the project.

## Required Repository Documents

Maintain:

- `AGENTS.md`
- `README.md`
- `PROJECT_PLAN.md`
- `ARCHITECTURE.md`
- `TASKS.md`
- `DECISIONS.md`
- `API_CONTRACT.md`
- `.env.example`

## AGENTS.md

Define durable instructions covering:

- Project architecture
- Technology stack
- Coding conventions
- Directory structure
- API conventions
- Testing commands
- Security requirements
- Definition of Done
- Task execution procedure
- Context continuity

Do not create instructions that override higher-priority repository or platform rules.

## Context Persistence

Codex Cloud tasks may end before the whole product is completed.

Never rely exclusively on conversation history to preserve project progress.

Before ending a session:

1. Update completed tasks.
2. Update pending tasks.
3. Record test results.
4. Record blockers.
5. Record architectural decisions.
6. Identify the next actionable task.
7. Provide a concise implementation summary.

A future Codex session must be able to continue directly from the repository.

Do not restart previously completed work unnecessarily.

## Git Rules

- Preserve unrelated changes.
- Do not force-push.
- Do not perform destructive resets.
- Do not merge or deploy without appropriate authorization.
- Follow the repository's configured branch and PR workflow.
- Do not claim a PR was merged unless verified.
- Do not claim deployment succeeded unless verified.

If a Codex Cloud session ends before completion, preserve a coherent and testable implementation state.

---

# 4. TECHNOLOGY STACK

## Backend

Use:

- Python
- Django
- Django REST Framework
- PostgreSQL
- Redis
- Celery
- FFmpeg
- JWT authentication
- S3-compatible object storage
- OpenAPI documentation

Follow Django best practices.

Keep complex business logic in appropriate service layers.

Avoid placing all business logic in views or serializers.

Use migrations for database changes.

## Frontend

Use:

- React
- TypeScript
- Vite
- React Router
- TanStack Query
- Zustand
- Tailwind CSS

Use reusable components and feature-oriented architecture.

Provide accessible controls and responsive layouts.

## Testing

Use:

- Pytest
- Vitest
- React Testing Library
- Playwright

## Infrastructure

Provide:

- Docker Compose
- PostgreSQL service
- Redis service
- Django backend service
- Celery worker
- React development setup
- `.env.example`
- Local development instructions
- Production deployment documentation

Use environment variables for secrets.

Never hardcode credentials.

---

# 5. REPOSITORY STRUCTURE

Use a clean monorepo structure.

Recommended:

```text
PracticeIELTS/
├── backend/
│   ├── config/
│   ├── apps/
│   │   ├── accounts/
│   │   ├── categories/
│   │   ├── materials/
│   │   ├── audio/
│   │   ├── transcripts/
│   │   ├── listening/
│   │   ├── practice/
│   │   ├── mock_tests/
│   │   ├── analytics/
│   │   └── integrations/
│   ├── tests/
│   └── requirements/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── stores/
│   │   └── types/
│   └── tests/
├── infrastructure/
├── docs/
├── AGENTS.md
├── README.md
├── PROJECT_PLAN.md
├── ARCHITECTURE.md
├── TASKS.md
├── DECISIONS.md
├── API_CONTRACT.md
├── docker-compose.yml
└── .env.example
```

Adapt when technically justified, while preserving separation of concerns.

---

# 6. UI/UX DESIGN SYSTEM

Use the attached dashboard reference image.

The reference may contain the old prototype name "ListenLab". Replace that branding with **PracticeIELTS**.

Preserve the visual style, layout quality, spacing, and professional learning environment.

## Color Palette

- Primary Navy: `#14283D`
- Accent Teal: `#147D92`
- Background: `#F5F7FA`
- White: `#FFFFFF`
- Main Text: `#172F47`
- Secondary Text: `#64748B`
- Borders: `#E2E8F0`

## Design Characteristics

- Modern educational SaaS
- Minimal
- Professional
- Clean
- Accessible
- Consistent
- Responsive
- Focused on practice

Avoid excessive gradients, random colors, distracting animations, and decorative clutter.

## Main Layout

Desktop:

- Top navigation bar
- Collapsible left sidebar
- Main content workspace
- Search
- User profile
- Responsive cards

Mobile:

- Collapsible navigation drawer
- Compact header
- Touch-friendly buttons
- Single-column layout
- No horizontal overflow

Create reusable UI components.

---

# 7. DASHBOARD

Build a functional student dashboard.

Required sections:

1. Welcome message
2. Continue Practice
3. Learning progress
4. Weekly activity
5. Accuracy statistics
6. Completed exercises
7. Practice shortcuts
8. Recent materials
9. Browse Library
10. Mistake Review

Use actual backend data.

For new users, show useful empty states.

Never display fabricated learning statistics as genuine data.

---

# 8. PLATFORM NAVIGATION

The long-term navigation structure:

```text
PracticeIELTS
├── Dashboard
├── Practice Library
├── Listening
│   ├── Dictation
│   ├── Transcript Study
│   ├── Mock Tests
│   └── Mistake Review
├── Reading (Future)
├── Writing (Future)
├── Speaking (Future)
├── Progress
├── Profile
└── Admin Panel
```

Do not present future modules as working features.

## Logical User Flow

Example:

Dashboard → Library → Cambridge IELTS → Volume 10 → Test 1 → Part 1 → Dictation → Easy → Practice

The actual flow must adapt to the material hierarchy.

## Navigation Requirements

1. Back returns exactly one step in the actual navigation history.
2. Browser Back and Forward work correctly.
3. Breadcrumbs display the current location.
4. Previous Sentence is separate from Back Navigation.
5. Next Sentence changes the exercise segment, not the page hierarchy.
6. Direct links work.
7. Refresh preserves valid state.
8. Resume Practice restores the last position.
9. Unsaved work is protected.
10. No dead-end pages.
11. Navigation is consistent across all modules.

Use React Router.

Do not simulate navigation using disconnected local component state.

Use sensible fallback routes for users opening a page directly.

---

# 9. DYNAMIC CATEGORY MANAGEMENT

The platform must support arbitrary content sources.

Cambridge IELTS is only an example.

Example:

```text
Cambridge IELTS
    Volume 10
        Test 1
            Part 1
            Part 2
            Part 3
            Part 4
```

Another example:

```text
Academic Listening
    University Lectures
        Science
            Biology
```

## Category Features

- Create
- Edit
- Rename
- Delete safely
- Create subcategory
- Move
- Reorder
- Add image
- Add description
- Assign materials
- Search
- Filter

Prevent circular parent-child relationships.

Do not hardcode Book, Volume, Test, or Part as mandatory hierarchy levels.

Support optional metadata and tags.

---

# 10. LISTENING DICTATION ENGINE

**Dictation is the highest-priority learning feature.**

## Difficulty Levels

### Easy

Play one sentence.

Student listens and writes the complete sentence.

### Medium

Play two or three consecutive sentences.

### Hard

Play a longer continuous dialogue or monologue segment.

### Full Dictation

Play the entire listening section.

The original audio must remain unchanged.

Difficulty determines how much audio is presented.

## Audio Player

Implement:

- Play
- Pause
- Replay sentence
- Previous segment
- Next segment
- Rewind 5 seconds
- Forward 5 seconds
- Playback speed
- Volume control
- Keyboard shortcuts

Use original audio with timestamp-based segment playback.

Example:

```json
{
  "start_ms": 12000,
  "end_ms": 18400
}
```

Avoid unnecessary duplicate audio files for individual sentences.

Handle buffering, seeking, and accurate segment stopping.

## Writing Interface

Provide:

- Large textarea
- Autosave
- Check Answer
- Try Again
- Show Hint
- Reveal Transcript
- Previous Sentence
- Next Sentence
- Progress indicator

## Answer Checking

Use deterministic word-level comparison.

Detect:

- Correct words
- Incorrect words
- Missing words
- Extra words
- Word-order errors
- Spelling mistakes

Use accessible visual highlighting.

Make normalization configurable for:

- Capitalization
- Punctuation
- Whitespace
- Contractions
- Numbers

Store original student answers separately from normalized comparison data.

Do not use generative AI as the only answer-checking mechanism.

---

# 11. TRANSCRIPT STUDY

Create a separate Transcript Study mode.

Features:

- Audio playback
- Transcript display
- Sentence highlighting
- Click sentence to play
- Speaker labels
- Playback speed
- Save difficult sentences
- Vocabulary notes

Highlight the currently playing sentence when accurate timing information exists.

Do not expose the transcript during restricted Mock Test sessions.

---

# 12. LISTENING MOCK TEST ENGINE

Build a separate IELTS-style Mock Test module.

Support:

- Multiple choice
- Matching
- Form completion
- Note completion
- Table completion
- Sentence completion
- Short answer
- Map and diagram questions

## Exam Mode

- Timed attempts
- Exam-style playback restrictions
- No unrestricted replay
- No hints
- No transcript before submission
- Question navigation
- Submit Test
- Automatic scoring
- Results
- Answer review

Keep exam rules separate from unrestricted practice rules.

---

# 13. ADMIN CONTENT STUDIO

Teachers and administrators must be able to add listening materials without technical knowledge.

The interface must not require manual JSON editing or manually calculating every audio timestamp.

## Content Creation Wizard

Step 1 — Select or create category

Step 2 — Enter title and metadata

Step 3 — Upload audio

Step 4 — Select transcript method

Step 5 — Process transcript and alignment

Step 6 — Review synchronized segments

Step 7 — Preview as Student

Step 8 — Publish

Support saving drafts.

## Transcript Methods

### Method A — Audio Only

1. Admin uploads an audio recording.
2. System validates the audio.
3. System extracts metadata.
4. System converts audio if required.
5. Speech-to-text generates a transcript.
6. Sentence boundaries are identified.
7. Timestamps are generated.
8. Admin reviews and corrects the result.
9. Admin approves publication.

### Method B — Audio + Original Transcript

1. Admin uploads audio.
2. Admin provides an existing transcript.
3. System preserves the reference text.
4. Forced alignment matches text to audio.
5. Word-level timestamps are generated where supported.
6. Words are grouped into sentence segments.
7. Low-confidence or uncertain portions are flagged.
8. Admin corrects mistakes.
9. Admin approves publication.

Prefer this method when an authoritative transcript is available.

### Method C — Manual Entry

Admin manually enters:

- Transcript text
- Speaker
- Start time
- End time

---

# 14. VISUAL TRANSCRIPT EDITOR

Build a professional transcript editor.

Recommended layout:

Left:

- Waveform
- Timeline
- Playback controls

Right:

- Transcript text
- Sentence list
- Speaker labels
- Start/end timestamps

Required features:

- Edit text
- Split sentence
- Merge sentences
- Adjust timestamps
- Preview segment
- Highlight current segment
- Undo/redo
- Autosave
- Validation warnings
- Preview as Student

Changes must not silently corrupt existing exercise data or student results.

---

# 15. AUDIO INTELLIGENCE ARCHITECTURE

Separate the following services.

## TranscriptionService

Audio → transcript text

## AlignmentService

Audio + reference transcript → word timestamps

## SegmentationService

Aligned transcript → sentence-level playable segments

## AudioProcessingService

- Validation
- Metadata extraction
- Format conversion
- Waveform generation
- Audio normalization where appropriate

Use Celery for long-running jobs.

Provide:

- Job status
- Progress where measurable
- Error messages
- Retry policies
- Idempotent behavior
- Logs

Do not run heavy transcription inside synchronous DRF requests.

AI-generated transcripts must be editable and reviewed before publication.

Use replaceable provider interfaces.

---

# 16. AUDIO STORAGE AND STREAMING

Use private S3-compatible object storage as the primary audio storage solution.

Support:

- MP3
- WAV
- M4A
- Other formats through controlled conversion

Store original audio.

Generate browser-compatible playback versions when necessary.

Support HTTP Range requests for seeking.

Use signed URLs or authenticated media endpoints.

Never expose storage secrets to React.

## Segmentation

Store start/end timestamps.

Do not unnecessarily create separate audio files for every sentence.

Allow precise replay of selected intervals.

---

# 17. OPTIONAL TELEGRAM AUDIO IMPORT

Telegram integration is optional and should be implemented after the primary audio workflow is stable.

Telegram must not be required for normal playback.

Proposed flow:

1. Authorized teacher sends audio to a Telegram bot.
2. Backend receives the authorized file reference.
3. Backend imports the audio.
4. Audio is copied to primary application storage.
5. Processing begins.
6. Teacher reviews the transcript.
7. Teacher publishes the material.

Account for official Telegram Bot API file size and access limitations.

Never expose bot tokens or temporary Telegram download URLs to frontend clients.

---

# 18. USER ROLES

Implement:

## Student

- Browse materials
- Complete exercises
- View permitted transcripts
- Complete mock tests
- Review mistakes
- View progress

## Teacher / Content Editor

- Create assigned materials
- Upload audio
- Manage transcripts
- Review processing results
- Preview exercises
- Publish within granted permissions

## Administrator

- Manage users
- Manage roles
- Manage categories
- Manage all materials
- Monitor processing jobs
- Manage publishing
- Review audit logs

Enforce permissions in Django REST Framework.

Do not rely on hidden frontend buttons for security.

---

# 19. DATABASE DESIGN

Use PostgreSQL with Django ORM.

Design normalized models including:

- User
- Role
- Category
- LearningMaterial
- AudioAsset
- Transcript
- TranscriptVersion
- TranscriptSegment
- ProcessingJob
- Question
- QuestionOption
- AnswerKey
- PracticeSession
- StudentResponse
- MistakeRecord
- LearningProgress
- MockTestAttempt
- AuditLog

Use appropriate constraints, indexes, and migrations.

Validate segment timestamps against audio duration.

Student responses must reference the transcript version used for that exercise.

Preserve historical progress when reference material changes.

---

# 20. DRF API

Use the base prefix:

`/api/v1/`

Provide endpoints for:

- Authentication
- Users
- Categories
- Materials
- Audio
- Transcripts
- Segments
- Processing jobs
- Practice sessions
- Responses
- Mistakes
- Progress
- Mock tests
- Admin actions

Use:

- Serializers
- Permissions
- Validation
- Filtering
- Pagination
- Consistent errors
- OpenAPI documentation

Define API contracts before implementing dependent frontend components.

---

# 21. LEARNING PROGRESS

Track:

- Completed sentences
- Completed exercises
- Dictation accuracy
- Practice duration
- Repeated attempts
- Difficult sentences
- Weekly activity
- Mock Test scores
- Learning history

Support:

- Autosave
- Resume Practice
- Mistake Review
- Progress dashboard

Persist meaningful progress in PostgreSQL.

Display proper empty states for new users.

Do not use fictional production statistics.

---

# 22. SECURITY AND CONTENT RIGHTS

Implement:

- Secure authentication
- Role-based authorization
- Backend permission checks
- Input validation
- File upload validation
- Rate limiting
- Audit logging
- Private media access
- Secure secrets management
- Appropriate CORS and CSRF configuration
- Safe error handling

Never commit credentials.

Do not invent API keys.

Do not automatically scrape or redistribute copyrighted IELTS audio, books, or transcripts.

Include content ownership, source, and licensing metadata.

Administrators must provide material they are authorized to use.

---

# 23. DEVELOPMENT MILESTONES

Use the following milestones as the initial roadmap.

Expand each milestone into epics, tasks, and subtasks before implementation.

## Milestone 1 — Project Foundation

- Repository setup
- Django REST Framework
- React + TypeScript
- PostgreSQL
- Redis
- Docker Compose
- Authentication
- User roles
- Dashboard
- Sidebar
- Navigation
- Dynamic category foundation

## Milestone 2 — Core Dictation

- Audio upload
- Transcript import
- Manual segmentation
- Segment playback
- Dictation editor
- Answer comparison
- Autosave
- Progress persistence

## Milestone 3 — AI Content Studio

- Automatic transcription
- Forced alignment
- Celery processing
- Visual transcript editor
- Review workflow
- Publishing

## Milestone 4 — Learning Features

- Transcript Study
- Mistake Review
- Progress analytics
- Dashboard statistics

## Milestone 5 — Mock Test Engine

- Question editor
- Exam interface
- Timer
- Playback restrictions
- Automatic scoring
- Results

## Milestone 6 — Optional Integrations

- Telegram audio import
- Additional transcription providers
- Advanced teacher functionality

Reading, Writing, and Speaking remain future modules.

---

# 24. IMPLEMENTATION PROCEDURE

For each task:

1. Read the relevant task description.
2. Confirm dependencies.
3. Mark In Progress.
4. Inspect related files.
5. Implement required database models and migrations.
6. Implement backend services and endpoints.
7. Implement frontend components when applicable.
8. Connect frontend to backend.
9. Write tests.
10. Run tests.
11. Fix failures.
12. Verify acceptance criteria.
13. Update documentation.
14. Mark Completed.
15. Continue to the next eligible task.

Do not mark a task complete simply because code was written.

A task is complete only after relevant functionality has been verified.

---

# 25. CRITICAL END-TO-END ACCEPTANCE TEST

The following must eventually work with real application logic:

1. Admin logs in.
2. Admin creates a category.
3. Admin creates a listening material.
4. Admin uploads actual audio.
5. Admin imports a transcript.
6. Admin reviews and corrects segments.
7. Admin publishes the material.
8. Student logs in.
9. Student browses the Library.
10. Student opens the material.
11. Student selects Dictation.
12. Student selects Easy.
13. The actual audio segment plays.
14. Student types an answer.
15. Student selects Check Answer.
16. System compares the answer with the approved transcript.
17. Mistakes are displayed.
18. Student moves to the next sentence.
19. Progress is saved.
20. Student leaves the page.
21. Student returns.
22. Practice resumes from the saved position.

Do not claim this workflow passes unless it has been tested.

Use authorized test assets or original test fixtures.

---

# 26. DEFINITION OF DONE

A task or feature is complete only when:

- Required backend logic exists.
- Required frontend functionality exists.
- APIs are connected.
- Data persists correctly.
- Permissions are enforced.
- Relevant tests pass.
- Error states work.
- Loading states work.
- Documentation is updated.
- Acceptance criteria are satisfied.

Fake buttons, hardcoded statistics, simulated uploads, and disconnected pages are not considered complete functionality.

---

# 27. AUTONOMOUS EXECUTION RULES

The user is providing this Master Prompt once.

Your responsibility is to manage the implementation systematically.

You may continue through multiple tasks and milestones within the current Codex Cloud execution when:

- Dependencies are satisfied.
- Required tests pass.
- Permissions allow the work.
- Time and resources remain available.

Do not rush unfinished functionality to claim completion.

If the execution must end:

1. Finish a coherent implementation increment where possible.
2. Run relevant tests.
3. Update task status.
4. Document blockers.
5. Preserve repository progress.
6. Record the next actionable task.
7. Provide a concise handoff.

Do not assume you can automatically start another Codex Cloud task after the current execution ends.

A future task should be able to resume by reading `AGENTS.md`, `PROJECT_PLAN.md`, and `TASKS.md`.

---

# 28. FIRST EXECUTION INSTRUCTIONS

Begin immediately.

### Step A — Repository Inspection

Inspect the repository, branch, files, and existing configuration.

### Step B — Complete Project Planning

Before writing application code:

1. Analyze this entire specification.
2. Create the milestone hierarchy.
3. Decompose milestones into epics.
4. Decompose epics into tasks.
5. Decompose complex tasks into subtasks.
6. Define dependencies.
7. Define acceptance criteria.
8. Define verification methods.
9. Establish task priorities.
10. Save the complete plan.

### Step C — Architecture

Create:

- System architecture
- Database design
- Backend module boundaries
- Frontend module boundaries
- API contracts
- Audio processing architecture
- Storage strategy
- Authentication strategy

Record architectural decisions.

### Step D — Implementation

Begin Milestone 1.

Implement functional increments rather than disconnected components.

Verify each task before marking it complete.

### Step E — Continue

After Milestone 1 is complete and verified, proceed to the next milestone if execution resources permit.

If execution ends, preserve progress and identify the next task.

---

# FINAL OBJECTIVE

Build a real, maintainable, extensible PracticeIELTS application.

The platform must eventually support Listening, Reading, Writing, and Speaking.

The first release must focus on an excellent Listening Practice experience.

Prioritize:

1. Reliable application architecture
2. Logical navigation
3. Dynamic learning materials
4. Real audio playback
5. Dictation practice
6. Accurate answer checking
7. Teacher-friendly content management
8. Transcript processing and alignment
9. Student progress
10. IELTS-style Mock Tests

Use Django REST Framework and React.

Maintain complete development documentation.

Break the entire project into tasks before implementation.

Implement tasks according to their dependencies.

Test functionality before marking it complete.

Preserve repository context across Codex Cloud sessions.

**Build a real product, not a demonstration of a product.**

**Start by inspecting the repository, decomposing the complete specification into tasks, and creating the implementation plan. Then begin Milestone 1.**