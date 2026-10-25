# Easy Practice Admin Timing Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist administrator timing corrections directly from Easy Practice.
**Architecture:** Immutable timing snapshots are separate from transcript versions. Sessions pin snapshots; only the editing admin advances in place, preserving answers; new Easy sessions select the latest snapshot.
**Tech Stack:** Existing Django/DRF, React/TypeScript and pytest/Vitest.
**Spec:** ../specs/2026-10-25-easy-practice-timing-design.md

## Global Constraints

Preserve user edits and published transcripts. Enforce admin/staff and Easy permissions on the server. Use /api/v1. Validate integer milliseconds, positive duration, audio bounds and neighbor intervals. No dependencies or copyrighted fixtures. Use the existing checkout.

## Review Focus

Stale revisions must not overwrite newer corrections; legacy sessions must preserve grouping; student responses must remain pinned; Easy chunks must map to the displayed interval rather than a whole sentence; simultaneous autosave must retain answers.

### Task 1: Persisted timing API

- [x] Add failing tests in backend/tests/test_practice_timing.py for exact Easy chunk persistence, student/teacher/mode/ownership rejection, invalid intervals, stale revisions and unchanged old sessions/transcripts/answers.
- [x] Add PracticeTimingRevision and PracticeSession.timing_revision with conditional uniqueness constraints and a migration.
- [x] Add learning/services/practice_timing.py with permission, revision and interval validation; overlay snapshots in comparison.groups.
- [x] Add validated request serializer, schema/capability fields and SessionViewSet timing action; select latest timing snapshot when starting Easy.
- [x] Run targeted tests, backend suite and Django/migration checks; record actual outcomes.

### Task 2: Connected Practice controls

- [x] Add component tests for precise input, preview/cancel, save and errors, and unchanged answer flow.
- [x] Add frontend/src/features/PracticeTimingEditor.tsx and minimal Practice.tsx/API types/CSS integration without replacing existing user edits.
- [x] Apply prepared frontend patch, run Vitest and production build, inspect the diff and update API_CONTRACT/TASKS/STATUS with evidence.

Verification evidence is recorded in docs/STATUS.md.
