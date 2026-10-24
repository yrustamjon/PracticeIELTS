> **Superseded (2026-10-24):** The user explicitly requested no images inside Mock. UX-01 implements interactive text, choices and tables instead. This document is retained only as historical context, not as the current implementation plan.

# PDF Inline Inputs Implementation Plan (Pending)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the uploaded PDF page layout in Mock while replacing numbered answer blanks with functional inputs.

**Architecture:** PDFium extracts normalized blank rectangles into question draft context. Approved pages are served as isolated single-page PDFs. PDF.js renders the pages at responsive scale; positioned HTML inputs use existing autosave. Existing legacy question sets keep their PNG view.

**Tech Stack:** Django/DRF, pypdf/pypdfium2, React/TypeScript, PDF.js, pytest/Vitest/Playwright.

**Spec:** `docs/superpowers/specs/2026-10-24-pdf-question-inputs-design.md`

## Global Constraints
- Preserve user edits and existing checkout; no worktree.
- No invented answers, OCR claims, or unapproved page exposure.
- Published versions and attempts remain pinned.

## Review Focus
- PDF answer-key page leakage from page isolation.
- Wrong or missing blank positions, especially across page boundaries and tables.
- Responsive scaling and keyboard labels/focus.
- Draft conversion must preserve prior answer keys until explicit teacher save.
- Scanned/ambiguous PDFs need review fallback without fabricated placement.

---

### Task 1: PDF geometry and private page endpoint
**Files:** `backend/processing/documents.py`, `backend/exams/services.py`, `backend/exams/views.py`, `backend/exams/serializers.py`, `backend/tests/test_exams.py`.
- [ ] Write failing tests for normalized numbered blank coordinates and isolated PDF bytes/permissions.
- [ ] Run targeted pytest and confirm red.
- [ ] Implement page geometry extraction and one-page PDF delivery under existing authorization.
- [ ] Run targeted and full backend tests, schema and Django checks.

### Task 2: Editor review and saved page association
**Files:** `frontend/src/features/QuestionStudio.tsx`, `frontend/src/services/api.ts`, frontend tests.
- [ ] Write failing tests for preserving PDF association and selected pages while adopting drafts.
- [ ] Run targeted Vitest and confirm red.
- [ ] Add teacher review of detected positions; save PDF and approved pages with question context.
- [ ] Run targeted and full frontend tests/build.

### Task 3: Page-faithful student Mock
**Files:** new `frontend/src/components/InlinePdfPage.tsx`, `frontend/src/features/Mock.tsx`, `frontend/package.json`, browser test.
- [ ] Write/update failing test for PDF appearance and inline answer controls.
- [ ] Run test and confirm red.
- [ ] Render approved PDF page with PDF.js and overlay real inputs at normalized boxes; legacy view stays available.
- [ ] Run frontend tests/build and browser suite.

### Task 4: Documentation and final verification
**Files:** `TASKS.md`, `docs/STATUS.md`, `API_CONTRACT.md`, `README.md`.
- [ ] Record exact supported PDF behavior, scanned fallback and version/privacy rules.
- [ ] Run backend/frontend/browser checks, migration check, strict schema, lint and `git diff --check`.
