# Cambridge 10 Test 1 content import

Goal: Import the already-reviewed Test 1 question paper as four unpublished Part question sets, without changing product code or unrelated content.

The user authorized the previously described import and limited it to the four Parts. This is content entry using existing validated services, not a new feature. Existing checkout and user changes are preserved; no worktree, merge, deployment or publication is required.

- [x] Prepare four exact PDF page extracts and 40 source-faithful questions, options, answer keys and reviewed field rectangles in ignored `backend/media/cambridge_documents/Cambridge_10/Test_1` files.
- [x] Validate all payloads with `QuestionSetInput`, including existing Part numbering; check PDFs against source and inspect annotated field previews. Preserve the source's either-order 11–12 group metadata and explicitly flag any existing scorer limitation; do not invent different answer rules or modify application behavior.
- [x] Use one atomic database transaction and existing `save_question_set` service as the material owner. Create only private document/question records and audit rows; use an import receipt and source/data signatures for safe repeat execution.
- [x] Read back all four sets and compare every question/option/key/field to prepared data; verify drafts, page authorization and unchanged pre-existing records. Record IDs, verification evidence and the next review step in `docs/STATUS.md` before marking CONTENT-02 Completed.

Verification scripts and payloads remain private local working artifacts; no copyrighted question seed data enters Git. No additional repository tests are needed for a content-only operation; run the existing relevant checks and direct readback/permission verification.

Outcome: four drafts (IDs 2–5), documents 4–7 and 40 questions persisted; 29 permission/page checks passed; repeat import made zero writes; Django system check passed. The source 11–12 group rule is saved but requires scorer support before publication. Detailed evidence and current next action are in `docs/STATUS.md`.
