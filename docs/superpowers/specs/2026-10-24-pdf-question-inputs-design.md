# PDF layout with inline answer inputs — design

## Intent
Students should see the uploaded IELTS-style question paper at its original page layout, including headings, instructions, notes and tables. Numbered answer blanks become real keyboard-accessible inputs at their original positions. A standalone PNG page beside separate answer fields does not meet this request.

## Current state
The app stores the original PDF privately, extracts selectable text, and can render approved pages as PNG. A separate-list conversion was explored but removed because it did not meet the clarified layout requirement. No inline PDF-input implementation is currently active.

## Approaches
1. **Chosen:** render only approved single-page PDF files with PDF.js and place HTML inputs over detected numbered blank coordinates. This preserves the PDF's layout and uses actual form controls. For text PDFs, PDFium supplies character boxes for the dotted/underlined blank. Teacher review is required.
2. Reconstruct the full PDF as HTML. Arbitrary fonts, tables, images and coordinates cannot be reproduced reliably from extracted text alone, so this cannot promise the requested appearance.
3. Keep PNG pages and separate inputs. This is the current behavior the user rejects.

## Behavior
- Upload extracts question drafts and answer-blank boxes by page. It never invents answer keys. The teacher reviews prompts, answer keys, word limits, approved question pages and detected input positions before saving a new immutable question-set version.
- The student Mock renders each approved page at responsive scale from a private, single-page PDF endpoint. Inputs overlay the numbered blanks and autosave through the existing attempt API. A blank without reliable coordinates gets an accessible fallback control below the page and is flagged for teacher review.
- Answer-key pages are never served to students. Teacher-only original PDF and extracted text stay private. Existing published question sets and attempts keep their prior display and pinned versions.
- Text-based PDFs support automatic positioning. Scanned/ambiguous layouts need manual placement/review; no OCR or pixel-perfect reconstruction of arbitrary PDFs is claimed.

## Acceptance
For the user's two-page text PDF, all ten inputs appear at the original blanks, including both table rows, while instructions, headings and table styling remain in place. Keyboard entry/autosave works. Student access to unapproved pages and keys remains denied. Existing attempts remain unchanged. Backend geometry/security and browser flow tests pass.
