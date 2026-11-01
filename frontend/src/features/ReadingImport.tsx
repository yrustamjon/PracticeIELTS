import { readingCatalog } from "../services/readingCatalog";
import { useEffect, useState, type FormEvent } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, FileUp, ShieldCheck, RefreshCw } from "lucide-react";
import { api, apiBlob, post, type Page } from "../services/api";
import { useAuth } from "../stores/auth";
import { ErrorState, Loading } from "../components/ui";
import "./readingImport.css";

type Capabilities = {
  available: boolean;
  provider: string;
  model: string;
  review_model: string;
  reason: string;
  max_file_mb: number;
  max_pages: number;
};
type Question = {
  number: number;
  prompt?: string;
  max_words?: number;
  allow_number?: boolean;
};
type Group = {
  title?: string;
  instructions?: string;
  kind?: string;
  text?: string;
  questions?: Question[];
  options?: string[];
  option_labels?: Record<string, string>;
  headers?: string[];
  rows?: string[][];
};
type Candidate = {
  book?: string;
  test?: number;
  passage?: number;
  content?: {
    title?: string;
    subtitle?: string;
    instructions?: string;
    paragraphs?: { label?: string; text?: string }[];
    groups?: Group[];
  };
  keys?: Record<string, string[]>;
  source_pages?: number[];
  key_pages?: number[];
};
type Finding = {
  id: string;
  candidate_index: number | null;
  stage: string;
  severity: "error" | "warning";
  message: string;
  source_pages: number[];
  path?: string;
  resolved?: boolean;
  resolution_note?: string;
};
type Job = {
  id: number;
  book: string;
  source_name: string;
  source_page_count?: number;
  state:
    "queued" | "running" | "needs_review" | "blocked" | "failed" | "completed";
  stage: string;
  progress: Record<string, unknown>;
  candidates: Candidate[];
  findings: Finding[];
  metrics: Record<string, unknown>;
  error_code: string;
  error_message: string;
  published_papers: {
    candidate_index: number;
    paper: number;
    version: number;
  }[];
  created_at: string;
  extracted_pages?: {
    page: number;
    text: string;
    method: string;
    warnings?: string[];
  }[];
};
const states: Record<Job["state"], string> = {
  queued: "Waiting to start",
  running: "Preparing Reading",
  needs_review: "Ready for review",
  blocked: "Waiting for setup",
  failed: "Preparation stopped",
  completed: "Published",
};
const stageNames: Record<string, string> = {
  queued: "Waiting for a worker",
  extracting: "Reading the source PDF",
  extracting_source: "Reading source pages",
  preparing_source: "Opening source PDF",
  published: "Published",
  extracting_pages: "Reading the source pages",
  extracting_text: "Reading the source text",
  ocr: "Recognising scanned text",
  preparing: "Preparing passages and questions",
  reviewing: "Checking against the source",
  correcting: "Correcting detected issues",
  validating: "Checking questions and keys",
  ready_for_review: "Ready for administrator review",
  provider_not_configured: "Model connection required",
  completed: "Published",
};
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const pageNumbers = (value: string) =>
  value
    .split(/[,\s]+/)
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);

function ImportBreadcrumbs({
  sourceName,
  onNavigate,
  disabled = false,
}: {
  sourceName?: string;
  onNavigate?: (to: string) => void;
  disabled?: boolean;
}) {
  const [context] = useSearchParams();
  const book = context.get("book");
  const test = context.get("test");
  const selected = new URLSearchParams();
  if (book) selected.set("book", book);
  if (test) selected.set("test", test);
  const suffix = selected.size ? `?${selected}` : "";
  const parents = [
    { label: "Admin", to: "/admin" },
    { label: "Reading", to: "/admin/reading" },
    ...(book
      ? [{ label: book, to: `/admin/reading?book=${encodeURIComponent(book)}` }]
      : []),
    ...(book && test
      ? [{ label: `Test ${test}`, to: `/admin/reading${suffix}` }]
      : []),
    { label: "PDF imports", to: `/admin/reading/import${suffix}` },
  ];
  return (
    <nav className="reading-import-breadcrumbs" aria-label="Reading location">
      <ol>
        {parents.map((item, i) => (
          <li key={item.to}>
            {!sourceName && i === parents.length - 1 ? (
              <span aria-current="page">{item.label}</span>
            ) : (
              <Link
                to={item.to}
                aria-disabled={disabled || undefined}
                onClick={
                  onNavigate
                    ? (e) => {
                        e.preventDefault();
                        if (!disabled) onNavigate(item.to);
                      }
                    : undefined
                }
              >
                {item.label}
              </Link>
            )}
          </li>
        ))}
        {sourceName && (
          <li>
            <span aria-current="page">{sourceName}</span>
          </li>
        )}
      </ol>
    </nav>
  );
}

function EditorOnly() {
  return (
    <ErrorState
      error={new Error("Editor access is required to manage Reading imports.")}
    />
  );
}
function JobState({ job }: { job: Job }) {
  return (
    <span className={`reading-import-state state-${job.state}`}>
      {states[job.state]}
    </span>
  );
}
function SetupNotice() {
  return (
    <div className="reading-import-provider">
      <ShieldCheck aria-hidden="true" size={19} />
      <span>
        Text extraction and OCR prepare an editable draft. You review the
        complete passage, questions and keys against the original PDF before
        publishing. ML preparation is not enabled in this workflow.
      </span>
    </div>
  );
}

export function ReadingImport() {
  const [locationParams] = useSearchParams();
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>();
  const capabilities = useQuery({
    queryKey: ["reading-import-capabilities"],
    enabled: !!user?.can_edit,
    queryFn: () => api<Capabilities>("reading-imports/capabilities/"),
  });
  const jobs = useQuery({
    queryKey: ["reading-imports"],
    enabled: !!user?.can_edit,
    queryFn: () => api<Page<Job>>("reading-imports/?page_size=30"),
    refetchInterval: (query) =>
      query.state.data?.results.some((j) =>
        ["queued", "running"].includes(j.state),
      )
        ? 3000
        : false,
  });
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const file = data.get("source");
    if (!(file instanceof File) || !file.size) {
      setError(new Error("Choose the source PDF."));
      return;
    }
    if (file.size > (capabilities.data?.max_file_mb || 50) * 1024 * 1024) {
      setError(new Error("The source PDF is too large."));
      return;
    }
    data.set("rights_confirmed", "true");
    setPending(true);
    setError(undefined);
    try {
      const job = await api<Job>("reading-imports/", {
        method: "POST",
        body: data,
      });
      const context = new URLSearchParams();
      const selectedBook = String(data.get("book") || "").trim();
      if (selectedBook) context.set("book", selectedBook);
      const selectedTest = Number(locationParams.get("test"));
      if (
        Number.isInteger(selectedTest) &&
        selectedTest >= 1 &&
        selectedTest <= 100
      )
        context.set("test", String(selectedTest));
      navigate(
        `/admin/reading/imports/${job.id}${context.size ? `?${context}` : ""}`,
      );
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  if (!user?.can_edit) return <EditorOnly />;
  return (
    <section className="reading-import-page">
      <ImportBreadcrumbs />
      <header className="reading-import-heading">
        <div>
          <span className="eyebrow">READING · PDF IMPORT</span>
          <h1>Add Reading from a PDF</h1>
          <p>
            Upload the original paper or book. The system extracts the source
            text, including scanned pages. Select the passage pages, edit the
            draft and questions, then compare everything with the original PDF.
          </p>
        </div>
        <BookOpen aria-hidden="true" size={34} />
      </header>
      <ol
        className="reading-import-steps"
        aria-label="Reading preparation workflow"
      >
        <li>Upload PDF</li>
        <li>Extract text / OCR</li>
        <li>Edit passage &amp; questions</li>
        <li>Compare source &amp; approve</li>
      </ol>
      {capabilities.isPending ? (
        <Loading />
      ) : capabilities.error ? (
        <ErrorState error={capabilities.error} />
      ) : (
        capabilities.data && <SetupNotice />
      )}
      <div className="reading-import-start-grid">
        <form
          className="panel reading-import-upload"
          onSubmit={(e) => void upload(e)}
        >
          <h2>Source document</h2>
          {locationParams.get("test") && (
            <p className="muted">
              Adding to Test {locationParams.get("test")}. You can check the
              location before saving a passage.
            </p>
          )}
          <label>
            Original PDF
            <input
              type="file"
              name="source"
              accept="application/pdf,.pdf"
              required
              disabled={pending}
            />
          </label>
          <small>
            Include the answer-key pages. Up to{" "}
            {capabilities.data?.max_file_mb || 50} MB and{" "}
            {capabilities.data?.max_pages || 200} pages. You will enter or
            verify the answer keys before publication.
          </small>
          <label>
            Book name
            <input
              name="book"
              defaultValue={locationParams.get("book") || ""}
              required
              maxLength={150}
              placeholder="For example, Cambridge 10"
              disabled={pending}
            />
          </label>
          <label>
            Source permission / licence
            <input
              name="license"
              maxLength={500}
              required
              placeholder="Describe your permission to use this source"
              disabled={pending}
            />
          </label>
          <label className="reading-import-checkbox">
            <input type="checkbox" required disabled={pending} />I am authorised
            to use and publish this material.
          </label>
          {error != null && <ErrorState error={error} />}
          <button
            className="button primary"
            disabled={pending || capabilities.isPending || !!capabilities.error}
          >
            <FileUp aria-hidden="true" size={18} />
            {pending ? "Uploading PDF…" : "Upload & extract text"}
          </button>
        </form>
        <aside className="panel reading-import-explanation">
          <h2>Build from the extracted text</h2>
          <p>
            Reuse the actual PDF text instead of retyping the whole passage. OCR
            drafts require source comparison.
          </p>
          <ul>
            <li>Choose the pages for each passage and its answer key.</li>
            <li>
              Correct the passage, add question groups and enter the source
              answer keys.
            </li>
            <li>
              Check every passage, question, table and key against the source.
            </li>
            <li>
              Published passages and learners’ previous attempts keep their
              saved versions.
            </li>
          </ul>
          <p>
            OCR does not verify answer correctness. Any uncertain text must be
            corrected before you approve it.
          </p>
        </aside>
      </div>
      <section className="reading-import-history">
        <h2>Your PDF imports</h2>
        {jobs.isPending ? (
          <Loading />
        ) : jobs.error ? (
          <ErrorState error={jobs.error} />
        ) : jobs.data?.results.length ? (
          <div className="reading-import-job-list">
            {jobs.data.results.map((job) => (
              <Link to={`/admin/reading/imports/${job.id}`} key={job.id}>
                <span>
                  <strong>{job.book || job.source_name}</strong>
                  <small>
                    {job.source_name} ·{" "}
                    {new Date(job.created_at).toLocaleDateString()}
                  </small>
                </span>
                <JobState job={job} />
              </Link>
            ))}
          </div>
        ) : (
          <p>No PDFs have been imported yet.</p>
        )}
      </section>
    </section>
  );
}

function SourcePreview({ jobId, page }: { jobId: number; page: number }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<unknown>();
  useEffect(() => {
    let live = true;
    let object = "";
    setUrl("");
    setError(undefined);
    void apiBlob(`reading-imports/${jobId}/source-pages/${page}/`)
      .then((blob) => {
        if (live) {
          object = URL.createObjectURL(blob);
          setUrl(object);
        }
      })
      .catch((e) => {
        if (live) setError(e);
      });
    return () => {
      live = false;
      if (object) URL.revokeObjectURL(object);
    };
  }, [jobId, page]);
  return error ? (
    <ErrorState error={error} />
  ) : url ? (
    <img
      className="reading-import-source"
      src={url}
      alt={`Original PDF page ${page}`}
    />
  ) : (
    <Loading />
  );
}

function PageListInput({
  label,
  pages,
  onChange,
}: {
  label: string;
  pages: number[];
  onChange: (pages: number[]) => void;
}) {
  const joined = pages.join(", ");
  const [value, setValue] = useState(joined);
  useEffect(() => setValue(joined), [joined]);
  return (
    <label>
      {label}
      <input
        value={value}
        placeholder="For example, 18, 19, 20, 21"
        onChange={(e) => {
          setValue(e.target.value);
          e.target.setCustomValidity("");
        }}
        onBlur={(e) => {
          const parts = value.split(/[,\s]+/).filter(Boolean);
          if (
            parts.some(
              (p) => !/^\d+$/.test(p) || Number(p) < 1 || Number(p) > 200,
            )
          ) {
            e.target.setCustomValidity(
              "Enter PDF page numbers from 1 to 200, separated by commas.",
            );
            e.target.reportValidity();
            return;
          }
          e.target.setCustomValidity("");
          onChange(pageNumbers(value));
        }}
      />
    </label>
  );
}

function CandidateEditor({
  candidate,
  onChange,
  disabled,
}: {
  candidate: Candidate;
  onChange: (candidate: Candidate) => void;
  disabled: boolean;
}) {
  const c = candidate.content || {};
  function update(fn: (draft: Candidate) => void) {
    const draft = clone(candidate);
    draft.content ||= {};
    draft.keys ||= {};
    fn(draft);
    onChange(draft);
  }
  function updateGroup(index: number, fn: (group: Group) => void) {
    update((d) => {
      d.content!.groups ||= [];
      fn(d.content!.groups[index]);
    });
  }
  function removeUnusedKeys(draft: Candidate, numbers: number[]) {
    const retained = new Set(
      (draft.content?.groups || []).flatMap((group) =>
        (group.questions || []).map((question) => question.number),
      ),
    );
    for (const number of numbers)
      if (!retained.has(number)) delete draft.keys?.[String(number)];
  }
  return (
    <fieldset className="reading-import-editor" disabled={disabled}>
      <legend>Prepared passage</legend>
      <div className="reading-import-identity">
        <label>
          Book
          <input
            value={candidate.book || ""}
            onChange={(e) =>
              update((d) => {
                d.book = e.target.value;
              })
            }
            maxLength={150}
          />
        </label>
        <label>
          Test
          <input
            type="number"
            min={1}
            max={100}
            value={candidate.test ?? ""}
            onChange={(e) =>
              update((d) => {
                d.test = Number(e.target.value);
              })
            }
          />
        </label>
        <label>
          Passage
          <input
            type="number"
            min={1}
            max={3}
            value={candidate.passage ?? ""}
            onChange={(e) =>
              update((d) => {
                d.passage = Number(e.target.value);
              })
            }
          />
        </label>
      </div>
      <label>
        Passage title
        <input
          value={c.title || ""}
          onChange={(e) =>
            update((d) => {
              d.content!.title = e.target.value;
            })
          }
          maxLength={250}
        />
      </label>
      <label>
        Subtitle
        <textarea
          value={c.subtitle || ""}
          onChange={(e) =>
            update((d) => {
              d.content!.subtitle = e.target.value;
            })
          }
          rows={2}
        />
      </label>
      <label>
        Passage instructions
        <textarea
          value={c.instructions || ""}
          onChange={(e) =>
            update((d) => {
              d.content!.instructions = e.target.value;
            })
          }
          rows={2}
        />
      </label>
      <div className="reading-import-page-fields">
        <PageListInput
          label="Passage / question PDF pages"
          pages={candidate.source_pages || []}
          onChange={(pages) =>
            update((d) => {
              d.source_pages = pages;
            })
          }
        />
        <PageListInput
          label="Answer-key PDF pages"
          pages={candidate.key_pages || []}
          onChange={(pages) =>
            update((d) => {
              d.key_pages = pages;
            })
          }
        />
      </div>
      <details className="reading-import-edit-section" open>
        <summary>
          Passage text · {(c.paragraphs || []).length} paragraphs
        </summary>
        {(c.paragraphs || []).map((p, i) => (
          <div className="reading-import-paragraph" key={i}>
            <label>
              Paragraph {i + 1} label
              <input
                value={p.label || ""}
                onChange={(e) =>
                  update((d) => {
                    d.content!.paragraphs![i].label = e.target.value;
                  })
                }
                maxLength={12}
              />
            </label>
            <label>
              Paragraph {i + 1} text
              <textarea
                value={p.text || ""}
                rows={5}
                onChange={(e) =>
                  update((d) => {
                    d.content!.paragraphs![i].text = e.target.value;
                  })
                }
              />
            </label>
            <button
              type="button"
              className="text-link"
              onClick={() =>
                update((d) => {
                  d.content!.paragraphs!.splice(i, 1);
                })
              }
            >
              Remove paragraph {i + 1}
            </button>
          </div>
        ))}
        <button
          type="button"
          className="button secondary"
          onClick={() =>
            update((d) => {
              d.content!.paragraphs ||= [];
              d.content!.paragraphs.push({ label: "", text: "" });
            })
          }
        >
          Add paragraph
        </button>
      </details>
      {(c.groups || []).map((g, gi) => (
        <details className="reading-import-edit-section" key={gi} open>
          <summary>{g.title || `Question group ${gi + 1}`}</summary>
          <label>
            Group {gi + 1} title
            <input
              value={g.title || ""}
              onChange={(e) =>
                updateGroup(gi, (x) => {
                  x.title = e.target.value;
                })
              }
            />
          </label>
          <label>
            Group {gi + 1} instructions
            <textarea
              value={g.instructions || ""}
              rows={3}
              onChange={(e) =>
                updateGroup(gi, (x) => {
                  x.instructions = e.target.value;
                })
              }
            />
          </label>
          <label>
            Group {gi + 1} question type
            <select
              value={g.kind || "short_answer"}
              onChange={(e) =>
                updateGroup(gi, (x) => {
                  x.kind = e.target.value;
                  if (
                    ![
                      "choice",
                      "multiple_choice",
                      "headings",
                      "matching",
                      "completion",
                    ].includes(x.kind)
                  )
                    x.option_labels = {};
                })
              }
            >
              <option value="true_false">TRUE / FALSE / NOT GIVEN</option>
              <option value="yes_no">YES / NO / NOT GIVEN</option>
              <option value="short_answer">Short answer / completion</option>
              <option value="choice">Choice</option>
              <option value="multiple_choice">
                Choose multiple letters (any order)
              </option>
              <option value="headings">Match headings</option>
              <option value="matching">Match information / features</option>
              <option value="table">Table completion</option>
              <option value="completion">
                Inline notes / summary completion
              </option>
              {g.kind &&
                ![
                  "true_false",
                  "yes_no",
                  "short_answer",
                  "choice",
                  "multiple_choice",
                  "headings",
                  "matching",
                  "completion",
                  "table",
                ].includes(g.kind) && (
                  <option value={g.kind}>Unsupported: {g.kind}</option>
                )}
            </select>
          </label>
          {[
            "choice",
            "multiple_choice",
            "headings",
            "matching",
            "completion",
          ].includes(g.kind || "") && (
            <label>
              Group {gi + 1} options · one per line
              <textarea
                value={(g.options || []).join("\n")}
                rows={4}
                onChange={(e) =>
                  updateGroup(gi, (x) => {
                    x.options = e.target.value.split("\n");
                    x.option_labels = Object.fromEntries(
                      Object.entries(x.option_labels || {}).filter(([code]) =>
                        x.options!.includes(code),
                      ),
                    );
                  })
                }
              />
            </label>
          )}
          {[
            "choice",
            "multiple_choice",
            "headings",
            "matching",
            "completion",
          ].includes(g.kind || "") &&
            (g.options || []).filter(Boolean).map((code) => (
              <label key={code}>
                Group {gi + 1} option {code} text
                <input
                  value={g.option_labels?.[code] || ""}
                  onChange={(e) =>
                    updateGroup(gi, (x) => {
                      const labels = { ...x.option_labels };
                      if (e.target.value.trim()) labels[code] = e.target.value;
                      else delete labels[code];
                      x.option_labels = labels;
                    })
                  }
                />
              </label>
            ))}
          {g.kind === "multiple_choice" && (
            <label>
              Group {gi + 1} shared question
              <textarea
                rows={4}
                value={g.text || ""}
                onChange={(e) =>
                  updateGroup(gi, (x) => {
                    x.text = e.target.value;
                  })
                }
              />
            </label>
          )}
          {g.kind === "completion" && (
            <label>
              Group {gi + 1} completion text · use {"{{number}}"} at each blank
              <textarea
                rows={8}
                value={g.text || ""}
                onChange={(e) =>
                  updateGroup(gi, (x) => {
                    x.text = e.target.value;
                  })
                }
              />
            </label>
          )}
          {(g.questions || []).map((q, qi) => (
            <section className="reading-import-question" key={qi}>
              <h4>Question {q.number}</h4>
              <label>
                Question number
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={q.number}
                  onChange={(e) =>
                    update((d) => {
                      const old = String(q.number);
                      const next = e.target.value;
                      d.content!.groups![gi].questions![qi].number =
                        Number(next);
                      if (
                        old !== next &&
                        next &&
                        !d.keys![next] &&
                        d.keys![old]
                      ) {
                        d.keys![next] = d.keys![old];
                        delete d.keys![old];
                      }
                    })
                  }
                />
              </label>
              <label>
                Question {q.number} wording
                <textarea
                  value={q.prompt || ""}
                  rows={2}
                  onChange={(e) =>
                    updateGroup(gi, (x) => {
                      x.questions![qi].prompt = e.target.value;
                    })
                  }
                />
              </label>
              <div className="reading-import-page-fields">
                <label>
                  Question {q.number} maximum words
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={q.max_words ?? 1}
                    onChange={(e) =>
                      updateGroup(gi, (x) => {
                        x.questions![qi].max_words = Number(e.target.value);
                      })
                    }
                  />
                </label>
                <label className="reading-import-checkbox">
                  <input
                    type="checkbox"
                    checked={q.allow_number || false}
                    onChange={(e) =>
                      updateGroup(gi, (x) => {
                        x.questions![qi].allow_number = e.target.checked;
                      })
                    }
                  />
                  Allow a number in the answer
                </label>
              </div>
              <label>
                Question {q.number} accepted answers · one variant per line
                <textarea
                  value={(candidate.keys?.[String(q.number)] || []).join("\n")}
                  rows={2}
                  onChange={(e) =>
                    update((d) => {
                      d.keys![String(q.number)] = e.target.value.split("\n");
                    })
                  }
                />
              </label>
              <button
                type="button"
                className="text-link"
                onClick={() =>
                  update((d) => {
                    d.content!.groups![gi].questions!.splice(qi, 1);
                    removeUnusedKeys(d, [q.number]);
                  })
                }
              >
                Remove question {q.number}
              </button>
            </section>
          ))}
          <button
            type="button"
            className="button secondary"
            onClick={() =>
              updateGroup(gi, (x) => {
                const all = (c.groups || []).flatMap((group) =>
                  (group.questions || []).map((q) => q.number),
                );
                x.questions ||= [];
                x.questions.push({
                  number: Math.max(0, ...all) + 1,
                  prompt: "",
                  max_words: 1,
                  allow_number: false,
                });
              })
            }
          >
            Add question to group {gi + 1}
          </button>
          {g.kind === "table" && (
            <div className="reading-import-table-editor">
              <h4>Complete table</h4>
              <p>
                Keep every row and column. A placeholder such as {"{{9}}"} is
                the answer field for question 9.
              </p>
              <label>
                Group {gi + 1} table headings · one per line
                <textarea
                  value={(g.headers || []).join("\n")}
                  rows={2}
                  onChange={(e) =>
                    updateGroup(gi, (x) => {
                      x.headers = e.target.value.split("\n");
                    })
                  }
                />
              </label>
              {(g.rows || []).map((row, ri) => (
                <fieldset key={ri}>
                  <legend>Table row {ri + 1}</legend>
                  {row.map((cell, ci) => (
                    <label key={ci}>
                      {g.headers?.[ci] || `Column ${ci + 1}`} · row {ri + 1}
                      <textarea
                        rows={2}
                        value={cell}
                        onChange={(e) =>
                          updateGroup(gi, (x) => {
                            x.rows![ri][ci] = e.target.value;
                          })
                        }
                      />
                    </label>
                  ))}
                  <button
                    type="button"
                    className="text-link"
                    onClick={() =>
                      updateGroup(gi, (x) => {
                        x.rows!.splice(ri, 1);
                      })
                    }
                  >
                    Remove table row {ri + 1}
                  </button>
                </fieldset>
              ))}
              <button
                type="button"
                className="button secondary"
                onClick={() =>
                  updateGroup(gi, (x) => {
                    x.rows ||= [];
                    x.rows.push((x.headers || []).map(() => ""));
                  })
                }
              >
                Add table row
              </button>
            </div>
          )}
          <p className="reading-import-removal-note">
            Removing questions keeps the remaining question numbers and table
            placeholders unchanged. Correct the source layout if a placeholder
            no longer belongs here.
          </p>
          <button
            type="button"
            className="text-link"
            onClick={() =>
              update((d) => {
                const numbers = (d.content!.groups![gi].questions || []).map(
                  (q) => q.number,
                );
                d.content!.groups!.splice(gi, 1);
                removeUnusedKeys(d, numbers);
              })
            }
          >
            Remove question group {gi + 1}
          </button>
        </details>
      ))}
      <button
        type="button"
        className="button secondary"
        onClick={() =>
          update((d) => {
            d.content!.groups ||= [];
            d.content!.groups.push({
              title: "",
              instructions: "",
              kind: "short_answer",
              questions: [],
              options: [],
              headers: [],
              rows: [],
            });
          })
        }
      >
        Add question group
      </button>
    </fieldset>
  );
}

export function ReadingImportDetail() {
  const [locationParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const { id } = useParams();
  const query = useQuery({
    queryKey: ["reading-import", id],
    enabled: !!user?.can_edit && !!id,
    queryFn: () => api<Job>(`reading-imports/${id}/`),
    refetchInterval: (query) =>
      query.state.data && ["queued", "running"].includes(query.state.data.state)
        ? 2500
        : false,
  });
  const [saving, setSaving] = useState(false);
  const [sourceSelection, setSourceSelection] = useState<number[]>([]);
  const [drafts, setDrafts] = useState<Candidate[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const requestedCandidate = Math.max(
    0,
    Number(locationParams.get("candidate")) || 0,
  );
  const [selected, setSelected] = useState(requestedCandidate);
  const [sourcePage, setSourcePage] = useState(1);
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>();
  useEffect(() => {
    setDrafts(null);
    setNotes({});
    setSelected(requestedCandidate);
    setConfirmed(false);
    setError(undefined);
  }, [id, requestedCandidate]);
  const job = query.data;
  const occupied = useQuery({
    queryKey: ["reading-existing-locations", id],
    enabled: !!user?.can_edit,
    queryFn: () =>
      readingCatalog<{ book: string; test: number; passage: number }>(
        "reading-papers/?owned=true&page_size=100",
      ),
  });
  const candidates = drafts || job?.candidates || [];
  const candidate = candidates[selected];
  const findings =
    job?.findings.filter(
      (f) => f.candidate_index === null || f.candidate_index === selected,
    ) || [];
  const openFindings = findings.filter((f) => !f.resolved);
  const dirty = drafts !== null || Object.values(notes).some(Boolean);
  useEffect(() => {
    function warnBeforeExit(event: BeforeUnloadEvent) {
      if (dirty) {
        event.preventDefault();
      }
    }
    window.addEventListener("beforeunload", warnBeforeExit);
    return () => window.removeEventListener("beforeunload", warnBeforeExit);
  }, [dirty]);
  const published = job?.published_papers.find(
    (p) => p.candidate_index === selected,
  );
  const canEdit =
    !!job && ["needs_review", "completed"].includes(job.state) && !published;
  useEffect(() => {
    const c = job?.candidates[selected];
    if (c?.source_pages?.[0]) setSourcePage(c.source_pages[0]);
    setConfirmed(false);
  }, [selected, job?.id]);
  async function retry() {
    setPending(true);
    setError(undefined);
    try {
      await post(`reading-imports/${id}/retry/`);
      await query.refetch();
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }
  async function save() {
    setSaving(true);
    setPending(true);
    setError(undefined);
    try {
      const resolutions = Object.entries(notes)
        .filter(([, note]) => note.trim())
        .map(([finding_id, resolution_note]) => ({
          finding_id,
          resolution_note,
        }));
      await api<Job>(`reading-imports/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({ candidates, resolutions }),
      });
      setDrafts(null);
      setNotes({});
      setConfirmed(false);
      await query.refetch();
      return true;
    } catch (e) {
      setError(e);
      return false;
    } finally {
      setSaving(false);
      setPending(false);
    }
  }
  async function navigateToParent(to: string) {
    if (pending) return;
    if (dirty && !(await save())) return;
    navigate(to);
  }
  async function approve() {
    setPending(true);
    setError(undefined);
    try {
      await post(`reading-imports/${id}/approve/`, {
        candidate_index: selected,
        confirm_review: confirmed,
        ...(job?.metrics?.processing_mode === "ocr_only"
          ? { confirm_manual_review: confirmed }
          : {}),
      });
      await query.refetch();
      setConfirmed(false);
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }
  function addPassage() {
    const pages = (job?.extracted_pages || []).filter((p) =>
      sourceSelection.includes(p.page),
    );
    const targetBook = locationParams.get("book") || job?.book || "";
    const targetTest = Math.min(
      100,
      Math.max(1, Number(locationParams.get("test")) || 1),
    );
    if (occupied.isPending || occupied.error) {
      setError(
        new Error(
          "Existing passages could not be checked yet. Wait for loading or reload before adding a passage.",
        ),
      );
      return;
    }
    const used = new Set(
      [...candidates, ...(occupied.data?.results || [])]
        .filter((c) => c.book === targetBook && c.test === targetTest)
        .map((c) => c.passage),
    );
    const nextPassage = [1, 2, 3].find((n) => !used.has(n));
    if (!nextPassage) {
      setError(
        new Error(
          `This source already has three passages for Test ${targetTest}. Open another test from the Reading library to add its passages.`,
        ),
      );
      return;
    }
    const next = [
      ...candidates,
      {
        book: targetBook,
        test: targetTest,
        passage: nextPassage,
        source_pages: pages.map((p) => p.page),
        key_pages: [],
        keys: {},
        content: {
          title: "",
          subtitle: "",
          instructions: "",
          paragraphs: pages.flatMap((p) =>
            p.text
              .split(/\n\s*\n/)
              .map((text) => ({ label: "", text: text.trim() }))
              .filter((p) => p.text),
          ),
          groups: [],
        },
      },
    ];
    setDrafts(next);
    setSourcePage(pages[0]?.page || 1);
    setSelected(next.length - 1);
    setConfirmed(false);
    setSourceSelection([]);
  }
  if (!user?.can_edit) return <EditorOnly />;
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} />;
  if (!job) return null;
  const current =
    job.progress?.current ??
    job.progress?.pages_done ??
    job.progress?.completed_pages;
  const total =
    job.progress?.total ?? job.progress?.pages_total ?? job.source_page_count;
  const count =
    typeof job.source_page_count === "number" && job.source_page_count > 0
      ? Math.min(job.source_page_count, 200)
      : Math.max(
          1,
          ...candidates.flatMap((c) => [
            ...(c.source_pages || []),
            ...(c.key_pages || []),
          ]),
        );
  return (
    <section className="reading-import-page">
      <ImportBreadcrumbs
        sourceName={job.source_name}
        onNavigate={(to) => void navigateToParent(to)}
        disabled={pending}
      />
      <div className="reading-import-save-state">
        <span role="status">
          {saving
            ? "Saving corrections…"
            : dirty
              ? "Unsaved corrections"
              : "No unsaved corrections"}
        </span>
        <small>Parent links save your corrections before leaving.</small>
      </div>
      <header className="reading-import-heading">
        <div>
          <span className="eyebrow">READING · SOURCE REVIEW</span>
          <h1>{job.book || job.source_name}</h1>
          <p>{job.source_name}</p>
        </div>
        <JobState job={job} />
      </header>
      <div className="panel reading-import-progress" aria-live="polite">
        <strong>{stageNames[job.stage] || states[job.state]}</strong>
        {typeof current === "number" &&
          typeof total === "number" &&
          total > 0 && (
            <span>
              {current} / {total} pages processed
            </span>
          )}
        {job.metrics?.processing_mode !== "ocr_only" &&
          typeof job.metrics?.model_calls === "number" && (
            <span>{job.metrics.model_calls} model calls recorded</span>
          )}
        {typeof current !== "number" && Array.isArray(job.extracted_pages) && (
          <span>
            {job.extracted_pages.length} source pages extracted
            {typeof job.source_page_count === "number"
              ? ` / ${job.source_page_count} source pages`
              : ""}
          </span>
        )}
        {job.error_message && <p role="alert">{job.error_message}</p>}
        {["blocked", "failed"].includes(job.state) && (
          <button
            className="button secondary"
            disabled={pending}
            onClick={() => void retry()}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Retry preparation
          </button>
        )}
        {["queued", "running"].includes(job.state) && (
          <p>
            The saved job continues in the background. You can leave and return
            to this page.
          </p>
        )}
      </div>
      {error != null && <ErrorState error={error} />}
      {["needs_review", "completed"].includes(job.state) &&
        (job.extracted_pages || []).length > 0 && (
          <section className="panel reading-import-page-picker">
            <h2>Create a passage from the extracted pages</h2>
            <p>
              Select the pages containing a complete passage. The selected text
              is copied into an editable OCR draft; headers, questions and page
              breaks may need correction. Add question groups and the original
              answer keys below.
            </p>
            <div className="reading-import-notice">
              <div>
                <strong>Text and table passages only</strong>
                <p>
                  OCR does not preserve required images or diagrams in the
                  Reading passage. Do not publish a task that needs those
                  visuals; use only passages whose complete required content is
                  preserved as text and tables.
                </p>
              </div>
            </div>
            <div className="reading-import-page-selection">
              {job.extracted_pages!.map((p) => (
                <label className="reading-import-checkbox" key={p.page}>
                  <input
                    type="checkbox"
                    checked={sourceSelection.includes(p.page)}
                    onChange={(e) =>
                      setSourceSelection(
                        e.target.checked
                          ? [...sourceSelection, p.page]
                          : sourceSelection.filter((n) => n !== p.page),
                      )
                    }
                  />
                  PDF page {p.page} ·{" "}
                  {p.method === "ocr" ? "OCR draft" : "extracted text"}
                  {p.warnings?.length ? " · review needed" : ""}
                </label>
              ))}
            </div>
            <button
              className="button secondary"
              disabled={
                !sourceSelection.length || candidates.length >= 50 || pending
              }
              onClick={addPassage}
            >
              Add passage from selected pages
            </button>
          </section>
        )}
      {candidates.length > 0 && (
        <>
          <div
            className="reading-import-current-context"
            aria-label="Current passage context"
          >
            <strong>{candidate?.book || "Book not set"}</strong>
            <span>
              {candidate?.test ? `Test ${candidate.test}` : "Test not set"}
            </span>
            <span>
              {candidate?.passage
                ? `Passage ${candidate.passage}`
                : "Passage not set"}
            </span>
            {candidate?.content?.title && (
              <span>{candidate.content.title}</span>
            )}
          </div>
          <div className="reading-import-candidate-nav">
            <label>
              Prepared passage
              <select
                value={selected}
                onChange={(e) => setSelected(Number(e.target.value))}
              >
                {candidates.map((c, i) => (
                  <option value={i} key={i}>
                    {c.book || job.book} · Test {c.test || "?"} · Passage{" "}
                    {c.passage || "?"} — {c.content?.title || "Untitled"}
                  </option>
                ))}
              </select>
            </label>
            <span>
              {openFindings.length} unresolved{" "}
              {openFindings.length === 1 ? "finding" : "findings"} for this
              passage
            </span>
          </div>
          <div className="reading-import-review-grid">
            <aside className="reading-import-source-panel">
              <label>
                Original PDF page
                <select
                  value={Math.min(sourcePage, count)}
                  onChange={(e) => setSourcePage(Number(e.target.value))}
                >
                  {Array.from({ length: count }, (_, i) => (
                    <option value={i + 1} key={i + 1}>
                      PDF page {i + 1}
                      {candidate?.key_pages?.includes(i + 1)
                        ? " · answer key"
                        : ""}
                    </option>
                  ))}
                </select>
              </label>
              <SourcePreview
                jobId={job.id}
                page={Math.min(sourcePage, count)}
              />
            </aside>
            <div className="reading-import-review-content">
              <section className="panel reading-import-findings">
                <h2>Exceptions to check</h2>
                {!findings.length ? (
                  <p>
                    Compare the complete passage, questions and answer keys with
                    the source. OCR text has not been independently checked by a
                    model.
                  </p>
                ) : (
                  findings.map((f) => (
                    <article
                      key={f.id}
                      className={`reading-import-finding ${f.resolved ? "resolved" : f.severity}`}
                    >
                      <div>
                        <strong>
                          {f.resolved
                            ? "Resolved"
                            : f.severity === "error"
                              ? "Needs correction"
                              : "Check source"}
                        </strong>
                        <small>
                          {f.stage === "review"
                            ? "Independent source check"
                            : f.stage === "validation"
                              ? "Structure check"
                              : "Preparation"}
                        </small>
                      </div>
                      <p>{f.message}</p>
                      {f.source_pages?.length > 0 && (
                        <div className="reading-import-page-links">
                          {f.source_pages.map((n) => (
                            <button
                              type="button"
                              className="text-link"
                              key={n}
                              onClick={() => setSourcePage(n)}
                            >
                              View PDF page {n}
                            </button>
                          ))}
                        </div>
                      )}
                      {f.resolved ? (
                        <p className="muted">Resolution: {f.resolution_note}</p>
                      ) : (
                        canEdit && (
                          <label>
                            Resolution note for {f.id}
                            <textarea
                              value={notes[f.id] || ""}
                              onChange={(e) =>
                                setNotes({ ...notes, [f.id]: e.target.value })
                              }
                              rows={2}
                              placeholder="Describe the correction or what you confirmed against the source."
                              disabled={pending}
                            />
                          </label>
                        )
                      )}
                    </article>
                  ))
                )}
              </section>
              {candidate && (
                <CandidateEditor
                  key={selected}
                  candidate={candidate}
                  onChange={(value) => {
                    const next = clone(candidates);
                    next[selected] = value;
                    setDrafts(next);
                    setConfirmed(false);
                  }}
                  disabled={!canEdit || pending}
                />
              )}
              {published ? (
                <div className="reading-import-published">
                  <ShieldCheck aria-hidden="true" size={20} />
                  <p>
                    This passage has been published.{" "}
                    <Link to={`/admin/reading/${published.paper}`}>
                      Open its saved source review
                    </Link>
                  </p>
                </div>
              ) : (
                canEdit && (
                  <section className="panel reading-import-approval">
                    <h2>Save and approve</h2>
                    <button
                      className="button secondary"
                      disabled={pending || !dirty}
                      onClick={() => void save()}
                    >
                      {pending
                        ? "Please wait…"
                        : "Save corrections & resolutions"}
                    </button>
                    {dirty && (
                      <p role="status">
                        Save your edits before approving this passage.
                      </p>
                    )}
                    <label className="reading-import-checkbox">
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(e) => setConfirmed(e.target.checked)}
                        disabled={pending || dirty}
                      />
                      I manually compared this complete passage, all questions,
                      tables and answer keys with the original PDF. I confirm
                      that this passage needs no images or diagrams and that all
                      required content is preserved as text and tables. I
                      approve publication.
                    </label>
                    {openFindings.some((f) => f.severity === "error") && (
                      <p>
                        Resolve blocking findings and save the corrections
                        before publishing.
                      </p>
                    )}
                    <button
                      className="button primary"
                      disabled={
                        pending ||
                        dirty ||
                        !confirmed ||
                        openFindings.some((f) => f.severity === "error")
                      }
                      onClick={() => void approve()}
                    >
                      <ShieldCheck size={18} aria-hidden="true" />
                      Publish this reviewed passage
                    </button>
                  </section>
                )
              )}
            </div>
          </div>
        </>
      )}
      {!candidates.length && !["queued", "running"].includes(job.state) && (
        <p>
          No prepared passages are available yet. The source PDF remains saved.
          Select its extracted pages to start a passage draft when extraction is
          ready.
        </p>
      )}
    </section>
  );
}
