# PracticeIELTS — current handoff

## Latest real-application increment
Implemented in backend/ and frontend/ (not only demo/): audio-only uploads queue durable Celery jobs; a real local faster-whisper CPU model produces transcript/word timestamps; optional TXT/PDF reference text uses reviewed recognized-word anchors. Generated versions require teacher review before publication. Easy displays word count and uses anchored chunks; Medium is one sentence without count; Hard plays up to three sentences. Legacy session grouping is preserved through a versioned migration.

The same material now has normalized, versioned exam question sets: multiple choice/multi-select, matching, form/note/table/sentence completion, short answer, maps and diagrams. Private question PDFs are extracted for editors and rendered to PNG; only explicitly approved pages reach students. PDF quick setup uses teacher-provided answer keys; it does not invent questions or answers. Both timed and untimed mocks save/resume answers, enforce deadlines only for timed attempts, score deterministically, and expose keys after submission. Single-use audio tickets and active-exam study-route guards are implemented. Reading/Writing/Speaking are future placeholders for both roles.

The content studio now uploads audio + optional transcript, shows real job stages/errors, accepts typed questions or PDF, reviews generated segments, and publishes Mock + Practice together. No per-sentence timestamps are required in the normal workflow. Advanced manual recovery remains available. Root .env is loaded consistently by plain Django/Celery commands. Setup is portable to Mac cache/CA paths; Node 24.15+ and PyAV 15.1.0 compatibility are pinned.

## Verification already completed
- 49 non-model PostgreSQL backend tests passed, covering pipeline contracts, roles, reference gaps, idempotency, PDF extraction/rendering/page privacy, all question types, timed expiry, untimed persistence, media ownership/single-use tickets, hidden keys, legacy grouping and safety bounds.
- A separate real base.en integration test passed: original synthesized speech → actual ASR → timestamped segments → Easy/Medium/Hard; optional authoritative reference retained; teacher review/publication → student Practice API. No fake provider in this test.
- Actual original 49-second MP3 transcription ran with both tiny.en and base.en. Model artifact hashes were verified; base.en is the default, pinned to 3d3d5dee26484f91867d81cb899cfcf72b96be6c. The sample comparison was 93% normalized word accuracy; this is a single fixture, not a general accuracy guarantee. Teacher review is still required.
- Strict OpenAPI validation, Django checks, migration drift check and Ruff passed during implementation. Frontend typecheck/production build and 3 Vitest tests passed.
- One browser test passed for the real upload outcome, an explicitly authored manual transcript fixture, private PDF/MC question authoring, publication, Practice answer check/resume/refresh, untimed mock/no timer, exam audio and scoring, timed expiry, and mobile layout. This first run recorded the model-download error correctly; it did not claim that failed ASR succeeded.
- Model network access was diagnosed and restored via the configuration draft (including the actual CDN us.aws.cdn.hf.co); supported HTTP downloading keeps TLS enabled. Real decoding exposed incompatible PyAV 19; pinning 15.1.0 fixed it. Public model access needs no HF token.

## Immediate final checks still to finish at this checkpoint
1. Restart backend and worker so the latest .env loader/model configuration is active.
2. Run RUN_SPEECH_TESTS=1 backend/.venv/bin/pytest backend/tests -q as one final suite, strict schema/migration checks, frontend build/Vitest.
3. Run the updated two-test Playwright suite. The second test strictly requires audio-only upload → successful real worker transcript → review/publish → student Easy/Medium/Hard, without a manual transcript fixture. Do not mark this flow verified before it passes.
4. Exercise the updated reusable setup/start instructions and save the cloud configuration draft. Record final results and push a verification follow-up if needed.

## Remaining product limitations
- Reference alignment is recognized-word anchoring with explicit unknown timestamps and review flags, not a full phoneme forced aligner. Waveform split/merge/undo/redo remains future work.
- PDFs can display scanned pages but no automatic OCR or reliable arbitrary exam/answer-key inference is claimed; teacher authoring and page selection are required.
- Single-use media delivery is not DRM; received bytes can be retained by a determined client. Exam audio currently loads an authenticated blob; leaving/reloading does not grant a new start.
- S3 configuration exists but no external bucket smoke test was run. Vocabulary notes, saved/resolved mistake workflow, richer analytics, Telegram, production hardening and broad accessibility/browser audits remain pending.
- No copyrighted IELTS assets, outside-site scraping, default passwords, deployment, or environment publication were performed. Source demo/ remains a separate local interface prototype.

## Continuation
Read AGENTS.md, TASKS.md and this file. Finish the four final checks above, preserve historical versions, update task evidence, and push verified increments to main as authorized. Cloud settings saved in a draft are not proof of publication or restoration in a fresh task.
