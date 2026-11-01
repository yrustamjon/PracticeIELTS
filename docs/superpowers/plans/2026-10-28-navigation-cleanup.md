# Navigation cleanup implementation plan

**Goal:** Make Listening and Reading easy to find without duplicated navigation or a flat Reading catalogue.
**Architecture:** Preserve routes and APIs. Simplify the shell and dashboard; derive Reading hierarchy from published papers and keep selection in URL parameters.
**Tech Stack:** React, TypeScript, React Router, Query, existing CSS.
**Spec:** docs/superpowers/specs/2026-10-28-navigation-cleanup-design.md

## Constraints
Preserve user edits, Library name, saved attempts, server authorization and published versions. No deployment. Existing checkout per AGENTS.md.

## Review focus
- Direct book/test links and browser back must retain location.
- Draft passages must never appear to learners.
- Failed start/resume must remain retryable.
- Empty Reading catalogue must be honest.
- Phone cards and navigation must fit without overflow.

## Tasks
- [x] Add regression coverage for Reading book → test → passage URL navigation and unpublished exclusion; run and observe failure.
- [x] Simplify shell groups, dashboard choices and decorative/redundant content. Preserve all existing deep routes.
- [x] Implement Reading hierarchy using existing readingPath and published papers; align card styling and compact skill navigation.
- [x] Run frontend suite/build, Django check and browser responsive checks. Review touched files and record evidence in TASKS.md/docs/STATUS.md.

Execution: inline in the existing checkout. No automatic commits because the checkout contains substantial pre-existing user work.

## Review rulings and evidence
- User expanded scope to administrator adding. Implemented ReadingAdminLibrary with persisted draft locations, source review links and book/test/candidate URL context.
- Reviewer identified draft tests missing until publication and collision with another source. Added private location summaries and server-side collision rejection; importer reserves known paper numbers. Follow pagination in catalogue queries.
- Existing checkout and no commits preserve substantial prior user edits.
- Browser fixture workflows passed at 1440/390/320px after correcting candidate select and heading badge overflow. Real upload/OCR is outside this UI fixture run.
- Normal-hasher full SQLite backend suite: 190 passed / 3 skipped. Frontend full suite93 passed; final production build/check/migration drift/Ruff/diff passed.

- User explicitly authorized real-site rollout after verification. Deployed with database/frontend rollback at backups/before-navigation-cleanup-20261028T061244Z; live editor/student checks passed, including real OCR/draft persistence and13/13 learner submission. Probe users/source/attempts cleaned; published pins and existing data retained.
