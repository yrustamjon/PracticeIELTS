import { useEffect, useState } from "react";
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
} from "../services/api";
import { ErrorState } from "../components/ui";
import { PrivateImage } from "../components/PrivateImage";
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
  const [minutes, setMinutes] = useState(30);
  const [page, setPage] = useState(1);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<unknown>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(40);
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
      setPage(1);
      setDirty(true);
      setMessage(
        "PDF saved privately. Select only the question pages students should see.",
      );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  function fromPdf() {
    try {
      if (!document.data) throw new Error("Upload a question PDF first.");
      const map = new Map<number, string>();
      for (const line of keys.split("\n").filter((s) => s.trim())) {
        const match = line.match(/^\s*(\d+)[.):\s-]+(.+)$/);
        if (!match)
          throw new Error("Use one answer per line, for example: 1. station");
        const n = Number(match[1]);
        if (map.has(n)) throw new Error(`Answer ${n} is repeated.`);
        map.set(n, match[2].trim());
      }
      const next = [];
      for (let n = 1; n <= count; n++) {
        const answer = map.get(n);
        if (!answer) throw new Error(`Add the answer key for question ${n}.`);
        next.push({
          ...question(n),
          prompt: `Question ${n} — answer using the question paper.`,
          answers: answer
            .split(";")
            .map((s) => s.trim())
            .filter(Boolean),
        });
      }
      setQuestions(next);
      setDirty(true);
      setMessage(
        "Questions prepared from your answer key. Check each type and word limit before saving.",
      );
    } catch (e) {
      setError(e);
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
          document: document.data?.id || null,
          document_pages: pages,
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
    <section className="panel form-panel question-studio">
      <div className="section-title">
        <h2>
          <span className="step-number">3</span>Real exam questions
        </h2>
        <span className="pill">{questions.length} questions</span>
      </div>
      <p className="muted">
        Type questions, or upload a question paper and enter its answer key. Add
        options, matching items, completion tasks, tables, maps or diagrams
        without editing JSON.
      </p>
      {error != null && <ErrorState error={error} />}
      {message && (
        <div className="success" role="status">
          {message}
        </div>
      )}
      {qs.error && <ErrorState error={qs.error} />}
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
          Up to 15 MB / 50 pages. Scanned pages can be displayed; text
          extraction is available only where the PDF contains selectable text.
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
            Select only question pages for students. Answer keys printed on
            selected pages will be visible to them.
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
          <PrivateImage
            path={`question-documents/${document.data.id}/pages/${page}/`}
            alt={`Editor preview of question paper, page ${page}`}
          />
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
          <details className="optional-transcript">
            <summary>Quick setup: use PDF questions + an answer key</summary>
            <p className="muted">
              Students will see your selected PDF pages alongside numbered
              answer fields. Review the generated question types; the site does
              not invent the answer key.
            </p>
            <label>
              Number of questions
              <input
                type="number"
                aria-label="PDF question count"
                min="1"
                max="40"
                value={count}
                onChange={(e) =>
                  setCount(Math.max(1, Math.min(40, Number(e.target.value))))
                }
              />
            </label>
            <label>
              Answer key — one answer per line
              <textarea
                aria-label="PDF answer key"
                rows={6}
                value={keys}
                onChange={(e) => setKeys(e.target.value)}
                placeholder={"1. station\n2. 15\n3. library; public library"}
              />
            </label>
            <button
              type="button"
              className="button secondary"
              onClick={fromPdf}
            >
              <Plus size={16} />
              Create answer fields from PDF
            </button>
          </details>
        </div>
      )}
      {qs.data && audioId && qs.data.audio !== audioId && (
        <div className="notice-box">
          A new recording was uploaded. Review and save these questions for that
          recording before publishing.
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
                  placeholder="Write the prompt, or refer to the question in your PDF…"
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
                Context / notes (optional)
                <textarea
                  aria-label={`Question ${i + 1} context`}
                  rows={2}
                  value={String(q.context.body || "")}
                  onChange={(e) =>
                    update(i, {
                      context: { ...q.context, body: e.target.value },
                    })
                  }
                  placeholder="Heading, form details, note or extra context"
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
                  Upload the map/diagram as a PDF and select its question pages
                  above. Students will see the figure beside the answer fields.
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
