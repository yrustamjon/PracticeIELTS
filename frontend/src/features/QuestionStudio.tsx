import { lazy, Suspense, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Save,
  Trash2,
  FileText,
  ChevronLeft,
  ChevronRight,
  Upload,
} from "lucide-react";
import {
  api,
  type ExamQuestion,
  type QuestionType,
  type QuestionSet,
  type QuestionDocument,
  type QuestionDraftResult,
  type PdfField,
  type PaperSection,
} from "../services/api";
import { HtmlQuestionPaper } from "../components/HtmlQuestionPaper";
import { ErrorState } from "../components/ui";
import { PrivateImage } from "../components/PrivateImage";
const PdfQuestionPage = lazy(() => import("../components/PdfQuestionPage"));
export const QUESTION_TYPES: [QuestionType, string][] = [
  ["multiple_choice", "Multiple choice"],
  ["matching", "Matching"],
  ["form_completion", "Form completion"],
  ["note_completion", "Note completion"],
  ["table_completion", "Table completion"],
  ["sentence_completion", "Sentence completion"],
  ["short_answer", "Short answer"],
  ["map_label", "Map labelling"],
  ["diagram_label", "Diagram labelling"],
];
function question(number: number): ExamQuestion {
  return {
    number,
    part: Math.min(4, Math.ceil(number / 10)),
    type: "short_answer",
    prompt: "",
    instructions: "NO MORE THAN THREE WORDS AND/OR A NUMBER",
    options: [],
    answers: [""],
    max_words: 3,
    context: {},
  };
}
export function QuestionStudio({
  materialId,
  audioReady,
  audioId,
  onSaved,
  onDirty,
}: {
  materialId: number;
  audioReady: boolean;
  audioId?: number;
  onSaved: () => void;
  onDirty: (dirty: boolean) => void;
}) {
  const cache = useQueryClient();
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [pages, setPages] = useState<number[]>([]);
  const [presentation, setPresentation] = useState<"text" | "html" | "pdf">(
    "text",
  );
  const [sections, setSections] = useState<PaperSection[]>([]);
  const [placementQuestion, setPlacementQuestion] = useState(1);
  const [sourceDocument, setSourceDocument] = useState<number | null>(null);
  const [minutes, setMinutes] = useState(30);
  const [page, setPage] = useState(1);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<unknown>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [draftWarnings, setDraftWarnings] = useState<string[]>([]);
  const [keys, setKeys] = useState("");
  const qs = useQuery({
    queryKey: ["question-set", materialId],
    queryFn: () =>
      api<QuestionSet | null>(`materials/${materialId}/questions/`),
  });
  const document = useQuery({
    queryKey: ["question-document", materialId],
    queryFn: () =>
      api<QuestionDocument | null>(
        `materials/${materialId}/question-document/`,
      ),
  });
  useEffect(() => {
    if (qs.data && !dirty) {
      setQuestions(qs.data.questions);
      setSourceDocument(qs.data.document);
      setPresentation(
        qs.data.presentation === "pdf" || qs.data.presentation === "html"
          ? qs.data.presentation
          : "text",
      );
      setSections(qs.data.sections || []);
      setPages(qs.data.document_pages);
      setMinutes(qs.data.duration_seconds / 60);
    }
  }, [qs.data?.id]);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  useEffect(() => {
    if (qs.data && audioId && qs.data.audio !== audioId) setDirty(true);
  }, [qs.data?.id, audioId]);
  function update(index: number, changes: Partial<ExamQuestion>) {
    setQuestions((list) =>
      list.map((q, i) => (i === index ? { ...q, ...changes } : q)),
    );
    setDirty(true);
  }
  async function upload(file: File) {
    setBusy(true);
    setError(undefined);
    setMessage("");
    try {
      const f = new FormData();
      f.append("file", file);
      const d = await api<QuestionDocument>(
        `materials/${materialId}/question-document/`,
        { method: "POST", body: f },
      );
      cache.setQueryData(["question-document", materialId], d);
      setPages([]);
      setSourceDocument(d.id);
      setPresentation("pdf");
      setQuestions((list) =>
        list.map((q) => {
          const context = { ...q.context };
          delete context.pdf_field;
          return { ...q, context };
        }),
      );
      setPage(1);
      setDirty(true);
      setMessage(
        "PDF saved privately. Select question pages, then create questions and review the answer fields on the original page.",
      );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function fromPdf() {
    setError(undefined);
    setBusy(true);
    try {
      if (!document.data) throw new Error("Upload a question PDF first.");
      if (!pages.length)
        throw new Error(
          "Select question pages first. Leave answer-key pages unselected.",
        );
      const map = new Map<number, string>();
      for (const line of keys.split("\n").filter((s) => s.trim())) {
        const match = line.match(/^\s*(\d+)[.):\s-]+(.+)$/);
        if (!match)
          throw new Error("Use one answer per line, for example: 1. station");
        const n = Number(match[1]);
        if (map.has(n)) throw new Error(`Answer ${n} is repeated.`);
        map.set(n, match[2].trim());
      }
      const drafts = await api<QuestionDraftResult>(
        `materials/${materialId}/question-drafts/`,
        {
          method: "POST",
          body: JSON.stringify({ document: document.data.id, pages }),
        },
      );
      setDraftWarnings(drafts.warnings);
      if (!drafts.questions.length)
        throw new Error(
          "No numbered text questions could be extracted. Copy the selectable text or type the questions below.",
        );
      if (
        questions.length &&
        !window.confirm(
          "Replace the current question drafts with PDF text? Existing answer keys for matching question numbers will be kept unless you supplied new keys.",
        )
      )
        return;
      setSourceDocument(document.data.id);
      setPresentation("pdf");
      setPage(pages[0]);
      setPlacementQuestion(drafts.questions[0].number);
      setQuestions(
        drafts.questions.map((draft) => {
          const old = questions.find((q) => q.number === draft.number);
          const key = map.get(draft.number);
          return {
            ...draft,
            answers: key
              ? key
                  .split(";")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : old?.answers || [""],
          };
        }),
      );
      setDirty(true);
      setMessage(
        "Editable question drafts created. Review the text, choices and answer keys below before saving.",
      );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function importHtml(file: File) {
    setBusy(true);
    setError(undefined);
    setMessage("");
    try {
      const form = new FormData();
      form.append("file", file);
      const draft = await api<{
        sections: PaperSection[];
        questions: ExamQuestion[];
        warnings: string[];
      }>(`materials/${materialId}/question-html/`, {
        method: "POST",
        body: form,
      });
      if (
        questions.length &&
        !window.confirm(
          "Replace the question drafts with this HTML paper? Matching question numbers keep their existing answer keys.",
        )
      )
        return;
      setQuestions(
        draft.questions.map((q) => ({
          ...q,
          answers: questions.find((old) => old.number === q.number)
            ?.answers || [""],
        })),
      );
      setSections(draft.sections);
      setPresentation("html");
      setDraftWarnings(draft.warnings);
      setDirty(true);
      setMessage(
        "Native question paper imported. Review the complete notes and controls, then enter/check each answer key before saving.",
      );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setError(undefined);
    setMessage("");
    try {
      await api<QuestionSet>(`materials/${materialId}/questions/`, {
        method: "PUT",
        body: JSON.stringify({
          questions,
          presentation,
          sections: presentation === "html" ? sections : [],
          document: presentation === "html" ? null : sourceDocument,
          document_pages: presentation === "html" ? [] : pages,
          duration_seconds: Math.round(minutes * 60),
        }),
      });
      setDirty(false);
      await cache.invalidateQueries({ queryKey: ["question-set", materialId] });
      onSaved();
      setMessage(
        "Questions saved as a new version. Publishing will release Mock and Practice together.",
      );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      id="material-questions"
      className="panel form-panel question-studio"
    >
      <div className="section-title">
        <h2>
          <span className="step-number">3</span>Real exam questions
        </h2>
        <span className="pill">{questions.length} questions</span>
      </div>
      <p className="muted">
        Keep the original PDF layout, including headings, tables and
        instructions, and place working answer fields over its blanks. Review
        positions and enter the answer key before publishing. You can also
        author a text-only exam.
      </p>
      {error != null && <ErrorState error={error} />}
      {message && (
        <div className="success" role="status">
          {message}
        </div>
      )}
      {qs.error && <ErrorState error={qs.error} />}
      <div className="native-paper-import">
        <label>
          Native HTML question paper
          <input
            aria-label="HTML question paper"
            type="file"
            accept=".html,.htm"
            disabled={busy}
            onChange={(e) => {
              if (e.target.files?.[0]) void importHtml(e.target.files[0]);
            }}
          />
        </label>
        <p className="muted">
          Import a question paper like the supplied example. Notes, lists,
          tables and answer fields stay together. Scripts, promotions and remote
          media are omitted; review missing figures before publishing.
        </p>
      </div>
      {presentation === "html" && (
        <div className="native-paper-editor">
          <h3>Student paper preview</h3>
          <HtmlQuestionPaper
            sections={sections}
            questions={questions}
            answers={{}}
            disabled
            onAnswer={() => {}}
          />
          <details>
            <summary>Edit formatted paper and answer positions</summary>
            <p className="muted">
              Use {"{{1}}, {{2}}"} for answer blanks, or {"{{3:A}} / {{3:B}}"}{" "}
              for individual choice controls. Each marker must match a question
              below.
            </p>
            {sections.map((section, i) => (
              <label key={i}>
                Part {section.part} formatted paper
                <textarea
                  aria-label={`Part ${section.part} formatted paper`}
                  rows={8}
                  value={section.html}
                  onChange={(e) => {
                    setSections((old) =>
                      old.map((s, n) =>
                        n === i ? { ...s, html: e.target.value } : s,
                      ),
                    );
                    setDirty(true);
                  }}
                />
              </label>
            ))}
          </details>
          {draftWarnings.map((warning, i) => (
            <p key={i} className="notice-box">
              {warning}
            </p>
          ))}
        </div>
      )}
      <div className="question-pdf-upload">
        <label>
          Question paper (PDF, optional)
          <input
            aria-label="Question paper PDF"
            type="file"
            accept=".pdf"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
        </label>
        <p className="muted">
          Up to 15 MB / 50 pages. The original layout is preserved. Numbered
          text blanks can be positioned automatically; scans and ambiguous
          blanks need manual placement.
        </p>
      </div>
      {document.data && (
        <div className="pdf-studio">
          <div className="section-title">
            <h3>
              <FileText size={16} /> Question paper · {document.data.page_count}{" "}
              pages
            </h3>
            <span className="pill">Private editor preview</span>
          </div>
          <div className="notice-box">
            Select only question pages. In original-layout mode these pages are
            shown to students with working answer fields. Leave answer-key pages
            unselected.
          </div>
          <div className="pdf-page-selection">
            {Array.from(
              { length: document.data.page_count },
              (_, i) => i + 1,
            ).map((n) => (
              <label key={n}>
                <input
                  type="checkbox"
                  checked={pages.includes(n)}
                  onChange={(e) => {
                    setSourceDocument(document.data!.id);
                    setPages((old) =>
                      e.target.checked
                        ? [...old, n]
                        : old.filter((p) => p !== n),
                    );
                    setDirty(true);
                  }}
                />
                Page {n}
              </label>
            ))}
          </div>
          <div className="pdf-controls">
            <button
              type="button"
              className="button secondary"
              disabled={page === 1}
              onClick={() => setPage((n) => n - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              Preview page {page} / {document.data.page_count}
            </span>
            <button
              type="button"
              className="button secondary"
              disabled={page === document.data.page_count}
              onClick={() => setPage((n) => n + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <label className="pdf-layout-choice">
            <input
              type="checkbox"
              checked={presentation === "pdf"}
              onChange={(e) => {
                setPresentation(e.target.checked ? "pdf" : "text");
                setSourceDocument(document.data!.id);
                setDirty(true);
              }}
            />
            Keep original PDF layout with interactive answer blanks
          </label>
          {presentation === "pdf" ? (
            <>
              <label>
                Place answer field for
                <select
                  aria-label="Place PDF answer field"
                  value={placementQuestion}
                  onChange={(e) => setPlacementQuestion(Number(e.target.value))}
                >
                  {questions.length ? (
                    questions.map((q) => (
                      <option key={q.number} value={q.number}>
                        Question {q.number}
                        {q.context.pdf_field
                          ? " · positioned"
                          : " · needs position"}
                      </option>
                    ))
                  ) : (
                    <option value={1}>Create questions first</option>
                  )}
                </select>
              </label>
              <p className="muted">
                Review the blue boxes. To move or resize a field, choose its
                question and drag a new rectangle over the blank. On scanned
                papers, add questions below and draw each field manually.
              </p>
              <Suspense fallback={<p>Opening PDF editor…</p>}>
                <PdfQuestionPage
                  path={`question-documents/${document.data.id}/pdf-pages/${page}/`}
                  pageNumber={page}
                  questions={questions}
                  answers={{}}
                  selectedNumber={placementQuestion}
                  onPlace={
                    questions.length
                      ? (number: number, field: PdfField) => {
                          const i = questions.findIndex(
                            (q) => q.number === number,
                          );
                          if (i >= 0)
                            update(i, {
                              context: {
                                ...questions[i].context,
                                pdf_field: field,
                              },
                            });
                        }
                      : undefined
                  }
                />
              </Suspense>
              {questions.some((q) => !q.context.pdf_field) && (
                <p className="notice-box">
                  Some questions still need an answer field. Choose each missing
                  question above and draw its rectangle before saving.
                </p>
              )}
            </>
          ) : (
            <PrivateImage
              path={`question-documents/${document.data.id}/pages/${page}/`}
              alt={`Editor preview of question paper, page ${page}`}
            />
          )}
          <details className="optional-transcript">
            <summary>Extracted text (editor only)</summary>
            <p className="muted">
              Review before using. This does not automatically determine
              question types or correct answers.
            </p>
            <textarea
              readOnly
              aria-label="Extracted PDF text"
              value={
                document.data.extracted_text ||
                "No selectable text found. The PDF pages can still be shown to students; enter the answer key below."
              }
              rows={5}
            />
          </details>
          <details className="optional-transcript" open>
            <summary>Quick setup: PDF to editable questions</summary>
            <p className="muted">
              Numbered blanks become editable fields on the original PDF. The
              complete page stays in place. Review detected boxes; answer keys
              are never guessed.
            </p>
            <label>
              Answer key (optional) — one answer per line
              <textarea
                aria-label="PDF answer key"
                rows={4}
                value={keys}
                onChange={(e) => setKeys(e.target.value)}
                placeholder={"1. station\n2. A\n3. library; public library"}
              />
            </label>
            <button
              type="button"
              className="button secondary"
              disabled={busy || !pages.length}
              onClick={() => void fromPdf()}
            >
              <Plus size={16} />{" "}
              {busy ? "Reading PDF…" : "Create editable questions from PDF"}
            </button>
            {draftWarnings.length > 0 && (
              <ul className="import-warnings">
                {draftWarnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            )}
          </details>
        </div>
      )}
      {qs.data && audioId && qs.data.audio !== audioId && (
        <div className="notice-box">
          A new recording was uploaded. Review and save these questions for that
          recording before publishing.
        </div>
      )}
      {qs.data?.presentation === "legacy_pdf" && (
        <div className="notice-box">
          This older question set needs review. Import the PDF blanks and keep
          original layout, or enter complete prompts and tables for a text-only
          exam.
        </div>
      )}
      <div className="question-list">
        {questions.map((q, i) => (
          <article className="question-author" key={i}>
            <div className="question-author-head">
              <strong>Question {i + 1}</strong>
              <button
                className="icon-button"
                aria-label={`Remove question ${i + 1}`}
                onClick={() => {
                  setQuestions((list) =>
                    list
                      .filter((_, n) => n !== i)
                      .map((item, n) => ({ ...item, number: n + 1 })),
                  );
                  setDirty(true);
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
            <div className="form-grid">
              <label>
                Question type
                <select
                  aria-label={`Question ${i + 1} type`}
                  value={q.type}
                  onChange={(e) =>
                    update(i, { type: e.target.value as QuestionType })
                  }
                >
                  {QUESTION_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Part
                <select
                  aria-label={`Question ${i + 1} part`}
                  value={q.part}
                  onChange={(e) => update(i, { part: Number(e.target.value) })}
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      Part {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="full">
                Question / prompt
                <textarea
                  aria-label={`Question ${i + 1} prompt`}
                  rows={2}
                  value={q.prompt}
                  onChange={(e) => update(i, { prompt: e.target.value })}
                  placeholder="Write the complete question. Use ____ for the answer blank."
                />
              </label>
              <label className="full">
                Instructions
                <input
                  aria-label={`Question ${i + 1} instructions`}
                  value={q.instructions}
                  onChange={(e) => update(i, { instructions: e.target.value })}
                />
              </label>
              {["multiple_choice", "matching"].includes(q.type) ? (
                <label className="full">
                  Options — one per line (A. Option text)
                  <textarea
                    aria-label={`Question ${i + 1} options`}
                    rows={4}
                    value={q.options
                      .map((o) => o.key + ". " + o.text)
                      .join("\n")}
                    onChange={(e) => {
                      const options = e.target.value
                        .split("\n")
                        .map((line, index) => {
                          const match = line.match(
                            /^([a-zA-Z0-9]{1,8})[.):|]\s*(.*)$/,
                          );
                          return {
                            key: match
                              ? match[1].toUpperCase()
                              : String.fromCharCode(65 + index),
                            text: match ? match[2] : line,
                          };
                        });
                      update(i, { options });
                    }}
                  />
                </label>
              ) : (
                <label>
                  Maximum answer words
                  <input
                    aria-label={`Question ${i + 1} word limit`}
                    type="number"
                    min="1"
                    max="20"
                    value={q.max_words}
                    onChange={(e) =>
                      update(i, { max_words: Number(e.target.value) })
                    }
                  />
                </label>
              )}
              <label
                className={
                  ["multiple_choice", "matching"].includes(q.type) ? "full" : ""
                }
              >
                Accepted answer(s)
                <input
                  aria-label={`Question ${i + 1} answers`}
                  value={(q.answers || [])
                    .map((a) => (Array.isArray(a) ? a.join("+") : a))
                    .join("; ")}
                  onChange={(e) =>
                    update(i, {
                      answers: e.target.value
                        .split(";")
                        .map((a) =>
                          q.type === "multiple_choice" && a.includes("+")
                            ? a.split("+").map((x) => x.trim().toUpperCase())
                            : a.trim(),
                        ),
                    })
                  }
                  placeholder={
                    q.type === "multiple_choice"
                      ? "A, or A+C for multiple selections"
                      : "station; railway station"
                  }
                />
                <small className="muted">
                  {q.type === "multiple_choice"
                    ? "Use A+C for a multi-selection combination; separate alternatives with semicolons."
                    : "Separate acceptable variants with semicolons."}
                </small>
              </label>
              <label className="full">
                Student context / description
                <textarea
                  aria-label={`Question ${i + 1} context`}
                  rows={2}
                  value={String(q.context.body || "")}
                  onChange={(e) =>
                    update(i, {
                      context: { ...q.context, body: e.target.value },
                    })
                  }
                  placeholder="Heading, form details or a complete text description. This text will be visible to students."
                />
              </label>
              {q.type === "table_completion" && (
                <label className="full">
                  Table — one row per line, separate cells with |
                  <textarea
                    aria-label={`Question ${i + 1} table`}
                    rows={4}
                    value={
                      Array.isArray(q.context.table)
                        ? (q.context.table as string[][])
                            .map((row) => row.join(" | "))
                            .join("\n")
                        : ""
                    }
                    onChange={(e) =>
                      update(i, {
                        context: {
                          ...q.context,
                          table: e.target.value
                            .split("\n")
                            .map((row) =>
                              row.split("|").map((cell) => cell.trim()),
                            ),
                        },
                      })
                    }
                    placeholder={"Time | Activity\n9 am | ______"}
                  />
                </label>
              )}
              {["map_label", "diagram_label"].includes(q.type) && (
                <div className="full notice-box">
                  In original PDF mode the figure stays in its original
                  position. Place the answer field beside its label. Text-only
                  mode requires a complete description in Student context.
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
      <div className="editor-actions">
        <button
          className="button secondary"
          disabled={questions.length >= 100}
          onClick={() => {
            setQuestions((list) => [...list, question(list.length + 1)]);
            setDirty(true);
          }}
        >
          <Plus size={16} />
          Add question
        </button>
        <label className="duration-input">
          Timed exam limit (minutes)
          <input
            type="number"
            aria-label="Timed exam limit in minutes"
            min="1"
            max="240"
            value={minutes}
            onChange={(e) => {
              setMinutes(Number(e.target.value));
              setDirty(true);
            }}
          />
        </label>
        <button
          className="button primary"
          disabled={!questions.length || !audioReady || busy || !dirty}
          onClick={() => void save()}
        >
          <Save size={16} />
          Save exam questions
        </button>
      </div>
      {!audioReady && (
        <p className="muted export-note">
          Upload audio before saving the question set.
        </p>
      )}
      <p className="muted export-note">
        Timed and untimed modes use this same question set. Without saved
        questions, the material offers Practice only.
      </p>
    </section>
  );
}
