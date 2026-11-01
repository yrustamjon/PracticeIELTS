import { ResultDetails } from "../components/ResultDetails";
import { ReviewAnswers, ReviewFeedback } from "../components/ReviewFeedback";
import "./mockReview.css";
import { HighlightTools } from "../components/HighlightTools";
import { ReadingShareLink } from "./ReadingSharing";
import { createPortal } from "react-dom";
import { ReadingContinue, ReadingTestSelection } from "./ReadingSelection";
import { ResultNavigation } from "../components/ResultNavigation";
import { readingCatalog } from "../services/readingCatalog";
import { ReadingAdminLibrary } from "./ReadingAdminLibrary";
import { useEffect, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
  useBlocker,
} from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, apiBlob, post, type Page } from "../services/api";
import { ErrorState, Loading, PageTitle, Empty } from "../components/ui";
import { BookOpen, FileText, ChevronRight } from "lucide-react";
import { useAuth } from "../stores/auth";
import "./reading.css";

type Question = {
  number: number;
  prompt: string;
  max_words: number;
  allow_number: boolean;
};
type Group = {
  title: string;
  instructions: string;
  kind: string;
  text?: string;
  questions: Question[];
  options: string[];
  option_labels?: Record<string, string>;
  figure_indices?: number[];
  unordered_sets?: number[][];
  headers: string[];
  rows: string[][];
};
type Content = {
  title: string;
  subtitle: string;
  instructions: string;
  paragraphs: { label: string; text: string }[];
  figures?: {
    page: number;
    crop: number[];
    alt: string;
    after_paragraph: number;
  }[];
  groups: Group[];
};
type Version = {
  id: number;
  content: Content;
  keys?: Record<string, string[]>;
  published_at: string | null;
  source_pages?: number[];
  key_pages?: number[];
  review_notes?: string;
  source_name?: string;
  license?: string;
  rights_confirmed?: boolean;
};
type Paper = {
  id: number;
  book: string;
  test: number;
  passage: number;
  title: string;
  question_count: number;
  can_edit: boolean;
  full_available?: boolean;
  published_version: number | null;
  version?: Version;
};
type Attempt = {
  id: number;
  paper: number;
  version: Version;
  book: string;
  test: number;
  passage: number;
  answers: Record<string, string>;
  submitted_at: string | null;
  score: number | null;
  total: number;
  passages?: { passage: number; version: Version }[];
  timed?: boolean;
  deadline?: string | null;
  server_time?: string;
  results?: {
    number: number;
    answer: string;
    correct: boolean;
    accepted_answers: string[];
  }[];
};

function readingCollection(book: string) {
  return book.replace(/\s+\d+$/, "");
}
function readingPath(
  collection?: string | null,
  book?: string | null,
  test?: string | number | null,
) {
  const params = new URLSearchParams();
  if (collection) params.set("collection", collection);
  if (book) params.set("book", book);
  if (test) params.set("test", String(test));
  return `/reading${params.size ? `?${params}` : ""}`;
}
function ReadingTrail({
  items,
  onNavigate,
}: {
  items: { label: string; to?: string }[];
  onNavigate?: (to: string) => void;
}) {
  return (
    <nav className="reading-breadcrumbs" aria-label="Reading location">
      <ol>
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`}>
            {item.to ? (
              <Link
                to={item.to}
                onClick={
                  onNavigate
                    ? (e) => {
                        e.preventDefault();
                        onNavigate(item.to!);
                      }
                    : undefined
                }
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function ReadingLibrary() {
  const [params] = useSearchParams();
  const collection = params.get("collection");
  const book = params.get("book");
  const test = params.get("test");
  const query = useQuery({
    queryKey: ["reading-papers"],
    queryFn: () => readingCatalog<Paper>("reading-papers/?page_size=100"),
  });
  const published =
    query.data?.results.filter((p) => p.published_version) || [];
  const collectionPapers = published.filter(
    (p) => !collection || readingCollection(p.book) === collection,
  );
  const collections = [...new Set(published.map(p => readingCollection(p.book)))].sort((a,b) => a.localeCompare(b));
  const books = [...new Set(collectionPapers.map((p) => p.book))];
  const tests = [
    ...new Set(
      collectionPapers
        .filter((p) => !book || p.book === book)
        .map((p) => p.test),
    ),
  ].sort((a, b) => a - b);
  const papers = collectionPapers.filter(
    (p) => (!book || p.book === book) && (!test || p.test === Number(test)),
  );
  const trail: { label: string; to?: string }[] = [
    { label: "Library", to: "/library" },
  ];
  const skillLabel = collection ? `${collection} Reading` : "Reading";
  trail.push({
    label: skillLabel,
    to: book || test ? readingPath(collection) : undefined,
  });
  if (book)
    trail.push({
      label: book,
      to: test ? readingPath(collection, book) : undefined,
    });
  if (test) trail.push({ label: `Test ${test}` });
  return (
    <section className="catalog-page reading-library">
      <ReadingTrail items={trail} />
      <PageTitle
        eyebrow="READING / LIBRARY"
        title={
          test ? `${book ? `${book} · ` : ""}Test ${test}` : book || skillLabel
        }
        description={
          test
            ? "Choose the full test or work through one passage at a time."
            : book
              ? "Choose a test, then open its passages."
              : collection ? "Choose a book, then a test and a passage." : "Choose a category to explore its Reading books."
        }
        action={<Link className="button secondary" to="/reading/history">My Reading results</Link>}
      />
      {!test && <ReadingContinue />}
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : (
        <>
          {book && test && papers.length > 0 ? <ReadingTestSelection key={`${book}-${test}`} papers={papers} book={book} test={test} /> : <div className="section-title"><h2>{!book ? collection ? "Books" : "Categories" : "Tests"}</h2><small className="muted">Full Mock + passage practice</small></div>}
          <div className="catalog-cards">
            {!book && !collection && collections.map(name => (
              <Link className="catalog-card" key={name} to={readingPath(name)}>
                <div className="catalog-card-top"><span className="catalog-folder"><BookOpen size={23} /></span><span className="pill">READING</span></div>
                <h3>{name} Reading</h3><p>{new Set(published.filter(p => readingCollection(p.book) === name).map(p => p.book)).size} books</p>
                <div className="catalog-card-bottom">Open books<ChevronRight size={15} /></div>
              </Link>
            ))}
            {!book && !!collection &&
              books
                .sort((a, b) =>
                  a.localeCompare(b, undefined, { numeric: true }),
                )
                .map((name) => (
                  <Link
                    className="catalog-card"
                    key={name}
                    to={readingPath(
                      collection || readingCollection(name),
                      name,
                    )}
                  >
                    <div className="catalog-card-top">
                      <span className="catalog-folder">
                        <BookOpen size={23} />
                      </span>
                      <span className="pill">READING</span>
                    </div>
                    <h3>{name}</h3>
                    <p>
                      {
                        new Set(
                          collectionPapers
                            .filter((p) => p.book === name)
                            .map((p) => p.test),
                        ).size
                      }{" "}
                      published tests
                    </p>
                    <div className="catalog-card-bottom">
                      Open tests
                      <ChevronRight size={15} />
                    </div>
                  </Link>
                ))}
            {book &&
              !test &&
              tests.map((n) => (
                <Link
                  className="catalog-card"
                  key={n}
                  to={readingPath(
                    collection || readingCollection(book),
                    book,
                    n,
                  )}
                >
                  <div className="catalog-card-top">
                    <span className="catalog-folder">
                      <FileText size={23} />
                    </span>
                    <span className="pill">READING</span>
                  </div>
                  <h3>Test {n}</h3>
                  <p>
                    {papers.filter((p) => p.test === n).length} published
                    passages
                  </p>
                  <div className="catalog-card-bottom">
                    Open passages
                    <ChevronRight size={15} />
                  </div>
                </Link>
              ))}
            {!papers.length && (
              <Empty
                title="No published passages"
                description={
                  published.length
                    ? "Choose another book or test from the location links above."
                    : "Reviewed Reading books will appear here when published."
                }
              />
            )}
          </div>
        </>
      )}
    </section>
  );
}

export function Passage({
  content,
  figurePath,
}: {
  content: Content;
  figurePath?: (index: number) => string;
}) {
  function figures(after: number) {
    return content.figures?.map((figure, index) =>
      figure.after_paragraph === after &&
      !content.groups.some((group) => group.figure_indices?.includes(index)) ? (
        <figure key={index}>
          {figurePath ? (
            <SourcePage path={figurePath(index)} alt={figure.alt} />
          ) : (
            <p>{figure.alt}</p>
          )}
        </figure>
      ) : null,
    );
  }
  return (
    <article className="reading-prose">
      <h2>{content.title}</h2>
      {content.subtitle && (
        <p className="reading-subtitle">{content.subtitle}</p>
      )}
      {figures(0)}
      {content.paragraphs.map((p, i) => (
        <div key={i}>
          <p>
            {p.label && <strong>{p.label} </strong>}
            {p.text}
          </p>
          {figures(i + 1)}
        </div>
      ))}
    </article>
  );
}

export function ReadingQuestions({
  content,
  answers,
  onChange,
  disabled = false,
  figurePath,
}: {
  content: Content;
  answers: Record<string, string>;
  onChange: (n: number, a: string) => void;
  disabled?: boolean;
  figurePath?: (index: number) => string;
}) {
  function optionList(g: Group) {
    if (!g.options.some((option) => g.option_labels?.[option])) return null;
    return (
      <ul className="reading-source-options" aria-label="Answer options">
        {g.options.map((option) => (
          <li key={option}>
            <strong>{option}.</strong> {g.option_labels?.[option] || option}
          </li>
        ))}
      </ul>
    );
  }
  function control(q: Question, g: Group, showNumber = true) {
    const options =
      g.kind === "true_false"
        ? ["TRUE", "FALSE", "NOT GIVEN"]
        : g.kind === "yes_no"
          ? ["YES", "NO", "NOT GIVEN"]
          : [
                "choice",
                "multiple_choice",
                "headings",
                "matching",
                "completion",
              ].includes(g.kind)
            ? g.options
            : [];
    return (
      <span className="reading-answer">
        {showNumber && <span className="reading-number">{q.number}</span>}
        {options.length ? (
          <select
            id={`reading-answer-${q.number}`}
            aria-label={`Question ${q.number}`}
            aria-describedby={`reading-instructions-${g.questions[0].number}`}
            value={answers[q.number] || ""}
            disabled={disabled}
            onChange={(e) => onChange(q.number, e.target.value)}
          >
            <option value="">Choose…</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={`reading-answer-${q.number}`}
            aria-label={`Question ${q.number}`}
            aria-describedby={`reading-instructions-${g.questions[0].number}`}
            autoComplete="off"
            value={answers[q.number] || ""}
            maxLength={500}
            disabled={disabled}
            onChange={(e) => onChange(q.number, e.target.value)}
          />
        )}
        <ReviewFeedback number={q.number} />
      </span>
    );
  }
  return (
    <div className="reading-question-groups">
      <p>{content.instructions}</p>
      {content.groups.map((g, i) => (
        <section key={i}>
          <h3>{g.title}</h3>
          <p
            id={`reading-instructions-${g.questions[0].number}`}
            className="reading-instructions"
          >
            {g.instructions}
          </p>
          {g.figure_indices?.map((index) => {
            const figure = content.figures?.[index];
            return figure ? (
              <figure key={index}>
                {figurePath ? (
                  <SourcePage path={figurePath(index)} alt={figure.alt} />
                ) : (
                  <p>{figure.alt}</p>
                )}
              </figure>
            ) : null;
          })}
          {g.kind === "multiple_choice" && <p>{g.text}</p>}
          {g.kind !== "choice" && optionList(g)}
          {g.kind === "completion" ? (
            <div
              className={`reading-completion${g.text?.includes("\n↓\n") ? " reading-flowchart" : ""}`}
            >
              {(g.text || "").split("\n").map((line, index) => (
                <p
                  key={index}
                  className={
                    line.trim() === "↓" ? "reading-flow-arrow" : undefined
                  }
                >
                  {line.split(/(\{\{\d+\}\})/).map((part, k) => {
                    const marker = part.match(/^\{\{(\d+)\}\}$/);
                    const q =
                      marker &&
                      g.questions.find((q) => q.number === Number(marker[1]));
                    return q ? (
                      <span key={k}>{control(q, g)}</span>
                    ) : (
                      <span key={k}>{part}</span>
                    );
                  })}
                </p>
              ))}
            </div>
          ) : g.kind === "table" ? (
            <div className="reading-table-scroll">
              <table>
                {g.text && <caption>{g.text}</caption>}
                <thead>
                  <tr>
                    {g.headers.map((h, j) => (
                      <th
                        scope="col"
                        key={j}
                        aria-label={h ? undefined : "Item"}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r, j) => (
                    <tr key={j}>
                      {r.map((cell, k) => (
                        <td key={k}>
                          {cell.split(/(\{\{\d+\}\})/).map((s, l) => {
                            const m = s.match(/^\{\{(\d+)\}\}$/);
                            const q =
                              m &&
                              g.questions.find(
                                (q) => q.number === Number(m[1]),
                              );
                            return q ? (
                              <span key={l}>{control(q, g)}</span>
                            ) : (
                              <span key={l}>{s}</span>
                            );
                          })}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            g.questions.map((q) => (
              <div
                className={`reading-question${g.kind === "short_answer" ? " reading-question--blank reading-question--short" : " reading-question--blank"}`}
                key={q.number}
              >
                <label htmlFor={`reading-answer-${q.number}`}>
                  <span className="reading-question-number">{q.number}.</span>{" "}
                  {q.prompt}
                </label>
                {g.kind === "choice" && optionList(g)}
                {control(q, g, false)}
              </div>
            ))
          )}
        </section>
      ))}
    </div>
  );
}

export function ReadingAttemptPage({
  full = false,
  results = false,
}: {
  full?: boolean;
  results?: boolean;
}) {
  const endpoint = full ? "reading-full-attempts" : "reading-attempts";
  const [reviewParams] = useSearchParams();
  const reviewMock = reviewParams.get("review") === "1";
  const [reviewLayout,setReviewLayout] = useState("columns");
  const { id } = useParams();
  const navigate = useNavigate();
  const userId = useAuth((s) => s.user?.id);
  const [attempt, setAttempt] = useState<Attempt>();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [tab, setTab] = useState("passage");
  const [activePassage, setActivePassage] = useState(1);
  const [activeQuestion, setActiveQuestion] = useState<number | null>(null);
  const [toolbarSlot, setToolbarSlot] = useState<HTMLElement | null>(null);
  const [navigationSlot, setNavigationSlot] = useState<HTMLElement | null>(
    null,
  );
  useEffect(() => {
    setToolbarSlot(document.getElementById("exam-controls-slot"));
    setNavigationSlot(document.getElementById("exam-navigation-slot"));
  }, [full, results]);
  useEffect(() => {
    if (!full || !attempt) return;
    if (attempt.submitted_at && !results)
      navigate(`/reading/full/attempts/${id}/results`, { replace: true });
    if (!attempt.submitted_at && results)
      navigate(`/reading/full/attempts/${id}`, { replace: true });
  }, [full, results, attempt?.submitted_at, id]);
  useEffect(() => {
    if (activeQuestion === null) return;
    const field = document.getElementById(`reading-answer-${activeQuestion}`);
    field?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    field?.focus({ preventScroll: true });
  }, [activePassage, activeQuestion]);

  const [remaining, setRemaining] = useState<number | null>(null);
  const expiryRequested = useRef(false);
  const [error, setError] = useState<unknown>();
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [exiting, setExiting] = useState(false);
  const latest = useRef<Record<string, string>>({});
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());
  const generation = useRef(0);
  const editRevision = useRef(0);
  const pendingSaves = useRef(0);
  const operationLocked = useRef(false);
  const loaded = useRef<Attempt | undefined>(undefined);
  const cacheKey = `reading-unsaved:${full ? "full:" : ""}${userId ?? "signed-out"}:${id}`;
  function cacheDraft(value: Record<string, string> | null) {
    try {
      if (value) sessionStorage.setItem(cacheKey, JSON.stringify(value));
      else sessionStorage.removeItem(cacheKey);
    } catch {
      /* Saving to the server remains authoritative. */
    }
  }
  useEffect(() => {
    const current = ++generation.current;
    let live = true;
    loaded.current = undefined;
    latest.current = {};
    editRevision.current = 0;
    pendingSaves.current = 0;
    operationLocked.current = false;
    saveChain.current = Promise.resolve();
    setAttempt(undefined);
    setAnswers({});
    setError(undefined);
    setDirty(false);
    setSaving(false);
    setSubmitting(false);
    setExiting(false);
    setConfirm(false);
    setTab("passage");
    setActivePassage(1);
    expiryRequested.current = false;
    void api<Attempt>(`${endpoint}/${id}/`)
      .then((a) => {
        if (!live || generation.current !== current) return;
        let recovered: Record<string, string> = {};
        if (!a.submitted_at) {
          try {
            const raw = JSON.parse(sessionStorage.getItem(cacheKey) || "{}");
            const numbers = new Set(
              a.version.content.groups.flatMap((g) =>
                g.questions.map((q) => String(q.number)),
              ),
            );
            if (raw && typeof raw === "object" && !Array.isArray(raw))
              recovered = Object.fromEntries(
                Object.entries(raw).filter(
                  ([n, v]) => numbers.has(n) && typeof v === "string",
                ),
              ) as Record<string, string>;
          } catch {
            /* Invalid or unavailable local drafts are ignored. */
          }
        } else cacheDraft(null);
        const restored = { ...a.answers, ...recovered };
        const changed = Object.entries(restored).some(
          ([n, v]) => v !== (a.answers[n] || ""),
        );
        loaded.current = a;
        latest.current = restored;
        setAttempt(a);
        setAnswers(restored);
        setDirty(changed);
        if (changed) editRevision.current++;
      })
      .catch((e) => {
        if (live && generation.current === current) setError(e);
      });
    return () => {
      live = false;
    };
  }, [id, userId, full]);
  function change(n: number, a: string) {
    if (operationLocked.current || loaded.current?.submitted_at) return;
    latest.current = { ...latest.current, [n]: a };
    editRevision.current++;
    cacheDraft(latest.current);
    setAnswers(latest.current);
    setDirty(true);
    setError(undefined);
  }
  function save() {
    const current = generation.current;
    const revision = editRevision.current;
    const snapshot = { ...latest.current };
    const attemptId = id;
    if (!loaded.current || loaded.current.submitted_at)
      return Promise.resolve(loaded.current);
    pendingSaves.current++;
    setSaving(true);
    const result = saveChain.current
      .catch(() => {})
      .then(() =>
        api<Attempt>(`${endpoint}/${attemptId}/`, {
          method: "PATCH",
          body: JSON.stringify({ answers: snapshot }),
        }),
      );
    saveChain.current = result;
    return result
      .then((a) => {
        if (generation.current === current) {
          loaded.current = a;
          if (revision === editRevision.current) {
            setDirty(false);
            setAttempt(a);
            cacheDraft(null);
          }
        }
        return a;
      })
      .catch((e) => {
        if (generation.current === current) setError(e);
        throw e;
      })
      .finally(() => {
        if (generation.current === current) {
          pendingSaves.current--;
          setSaving(pendingSaves.current > 0);
        }
      });
  }
  useEffect(() => {
    const exit = (event: Event) => {
      if (loaded.current) {
        event.preventDefault();
        void leave(
          readingPath(
            readingCollection(loaded.current.book),
            loaded.current.book,
            loaded.current.test,
          ),
        );
      }
    };
    window.addEventListener("reading-mock-exit", exit);
    return () => window.removeEventListener("reading-mock-exit", exit);
  }, [id, full, userId]);
  useEffect(() => {
    if (!dirty || attempt?.submitted_at || submitting || exiting) return;
    const timer = setTimeout(() => {
      void save().catch(() => {});
    }, 650);
    return () => clearTimeout(timer);
  }, [answers, dirty, submitting, exiting, id]);
  useEffect(() => {
    function unload(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [dirty]);
  async function leave(to: string) {
    if (operationLocked.current) return;
    const current = generation.current;
    operationLocked.current = true;
    setExiting(true);
    setError(undefined);
    try {
      await save();
      if (generation.current === current) navigate(to);
    } catch {
      /* Keep the learner here with the visible save error. */
    } finally {
      if (generation.current === current) {
        operationLocked.current = false;
        setExiting(false);
      }
    }
  }
  async function submit() {
    if (operationLocked.current) return;
    const current = generation.current;
    operationLocked.current = true;
    setSubmitting(true);
    setError(undefined);
    try {
      await save();
      const a = await post<Attempt>(`${endpoint}/${id}/submit/`);
      if (generation.current === current) {
        loaded.current = a;
        setAttempt(a);
        setConfirm(false);
        setDirty(false);
        cacheDraft(null);
      }
    } catch (e) {
      if (generation.current === current) setError(e);
    } finally {
      if (generation.current === current) {
        operationLocked.current = false;
        setSubmitting(false);
      }
    }
  }
  useEffect(() => {
    if (!attempt?.deadline || attempt.submitted_at) {
      setRemaining(null);
      return;
    }
    const deadline = Date.parse(attempt.deadline);
    const offset = attempt.server_time
      ? Date.parse(attempt.server_time) - Date.now()
      : 0;
    let live = true;
    async function tick() {
      const seconds = Math.max(
        0,
        Math.ceil((deadline - Date.now() - offset) / 1000),
      );
      if (live) setRemaining(seconds);
      if (seconds === 0 && !expiryRequested.current) {
        expiryRequested.current = true;
        try {
          const a = await api<Attempt>(`${endpoint}/${id}/`);
          if (live) {
            loaded.current = a;
            latest.current = a.answers;
            setAttempt(a);
            setAnswers(a.answers);
            setDirty(false);
            setConfirm(false);
            cacheDraft(null);
          }
        } catch (e) {
          if (live) {
            setError(e);
            expiryRequested.current = false;
          }
        }
      }
    }
    void tick();
    const timer = setInterval(() => void tick(), 1000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [attempt?.deadline, attempt?.submitted_at, endpoint, id]);
  if (!attempt) return error ? <ErrorState error={error} /> : <Loading />;
  const currentContent =
    attempt.passages?.find((p) => p.passage === activePassage)?.version
      .content || attempt.version.content;
  const collection = readingCollection(attempt.book);
  const collectionPath = readingPath(collection);
  const bookPath = readingPath(collection, attempt.book);
  const testPath = readingPath(collection, attempt.book, attempt.test);
  const busy =
    submitting || exiting || (remaining === 0 && !attempt.submitted_at);

  if (full && results && attempt.submitted_at && reviewMock) {
    const passage = attempt.passages?.find(p=>p.passage===activePassage);
    const content = passage?.version.content || attempt.version.content;
    const numbers = new Set(content.groups.flatMap(g=>g.questions.map(q=>q.number)));
    return <ReviewAnswers results={attempt.results || []}><div className="mock-review-workspace">
      <div className="mock-review-heading"><div><span className="eyebrow">READING / REVIEW</span><h1>{attempt.book} · Test {attempt.test}</h1><p>Read-only review · {attempt.score} / {attempt.total}</p></div><Link className="button secondary" to={`/reading/full/attempts/${id}/results`}>Back to result</Link></div>
      <nav className="exam-part-tabs" aria-label="Review passages">{(attempt.passages||[]).map(p=><button key={p.passage} className={p.passage===activePassage?"active":""} onClick={()=>setActivePassage(p.passage)}>Passage {p.passage}</button>)}</nav>
      <HighlightTools key={`review-${id}-${activePassage}`} selector=".mock-review-reading" storageKey={`${userId}-${endpoint}-${id}-${activePassage}`} />
      <div className="review-layout-tools" role="group" aria-label="Reading review layout"><button className={reviewLayout==="columns"?"active":""} aria-pressed={reviewLayout==="columns"} onClick={()=>setReviewLayout("columns")}>Side by side</button><button className={reviewLayout==="stacked"?"active":""} aria-pressed={reviewLayout==="stacked"} onClick={()=>setReviewLayout("stacked")}>Stacked</button></div>
      <div className={`reading-panes mock-review-reading ${reviewLayout==="stacked"?"review-stacked":""}`} data-tab="all"><section className="reading-pane reading-passage" aria-label="Reading passage"><Passage content={content} figurePath={index=>`${endpoint}/${id}/figures/${activePassage}/${index}/`} /></section><section className="reading-pane reading-questions" aria-label="Reading questions"><ReadingQuestions content={content} answers={answers} onChange={()=>{}} disabled figurePath={index=>`${endpoint}/${id}/figures/${activePassage}/${index}/`} /></section></div>
    </div></ReviewAnswers>;
  }
  if (full && results && attempt.submitted_at) {
    return (
      <>
        <ResultNavigation
          steps={[
            { label: "Reading Mocks", to: "/reading" },
            { label: "My Reading results", to: "/reading/history" },
            { label: attempt.book, to: bookPath },
            { label: `Test ${attempt.test}`, to: testPath },
            { label: "Result" },
          ]}
          back={{ label: "Back to test", to: testPath }}
        />
        <PageTitle
          eyebrow="READING / MOCK RESULTS"
          title="A clearer picture of your reading"
          description={`${attempt.book} · Test ${attempt.test} · Full Reading Mock`}
        />
        <section className="panel exam-results">
          <div className="exam-result-heading">
            <div
              className="exam-score"
              aria-label={`Result: ${attempt.score} / ${attempt.total}`}
            >
              {attempt.score}
              <small> / {attempt.total}</small>
            </div>
            <div>
              <h2>
                {Math.round(((attempt.score || 0) / attempt.total) * 100)}%
                correct
              </h2>
              <p>
                {attempt.timed ? "Timed exam" : "Untimed mock"} · Raw score from
                your published answer key.
              </p>
            </div>
          </div>
          <div className="editor-actions"><Link className="button primary" to="?review=1">Review Mock</Link><ReadingShareLink attemptId={attempt.id} full /></div>
          <ResultDetails label="Passage" results={(attempt.results || []).map(r=>({...r,group:attempt.passages?.find(p=>p.version.content.groups.some(g=>g.questions.some(q=>q.number===r.number)))?.passage || attempt.passage || 1,prompt:attempt.version.content.groups.flatMap(g=>g.questions).find(q=>q.number===r.number)?.prompt}))} />
          <div className="editor-actions">
            <Link className="button primary" to={testPath}>
              Back to test
            </Link>
            <Link className="button secondary" to={bookPath}>
              All tests
            </Link>
          </div>
        </section>
      </>
    );
  }
  const mockControls = (
    <div className="exam-header-actions">
      <button
        className="button secondary exam-fullscreen"
        aria-label="Toggle exam fullscreen"
        onClick={() => {
          if (document.fullscreenElement) void document.exitFullscreen();
          else
            void document
              .querySelector<HTMLElement>(".exam-shell")
              ?.requestFullscreen();
        }}
      >
        ⛶
      </button>
      {remaining === null ? (
        <span className="difficulty-badge">No time limit</span>
      ) : (
        <span
          className={`exam-countdown ${remaining < 60 ? "urgent" : ""}`}
          role="timer"
          aria-label="Time remaining"
        >
          {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
        </span>
      )}
      <button
        className="button primary"
        disabled={busy}
        onClick={() => {
          if (
            window.confirm(
              "Submit this mock? Your answers become read-only and the review will open.",
            )
          )
            void submit();
        }}
      >
        {submitting ? "Submitting…" : "Submit Mock"}
      </button>
    </div>
  );
  const questionNavigation = (
    <nav className="exam-question-nav" aria-label="Question navigation">
      <div className="question-nav-summary">
        <strong>
          {Object.values(answers).filter((answer) => answer.trim()).length} of{" "}
          {attempt.total} answered
        </strong>
        <span className="save-status" role="status">
          {saving ? "Saving…" : dirty ? "Unsaved changes" : "Saved"}
        </span>
        <button
          className="text-link"
          disabled={saving || busy}
          onClick={() => void save().catch(() => {})}
        >
          Save answers
        </button>
      </div>
      <div className="question-nav-parts">
        {attempt.passages?.map((p) => (
          <div
            key={p.passage}
            className={`question-nav-part ${activePassage === p.passage ? "active" : ""}`}
          >
            <button
              className="question-nav-label"
              aria-current={activePassage === p.passage ? "step" : undefined}
              onClick={() => {
                setActivePassage(p.passage);
                setActiveQuestion(null);
              }}
            >
              Passage {p.passage}
            </button>
            <div>
              {p.version.content.groups
                .flatMap((g) => g.questions)
                .map((q) => (
                  <button
                    key={q.number}
                    className={`question-jump ${answers[q.number]?.trim() ? "answered" : ""}`}
                    aria-label={`Go to question ${q.number}${answers[q.number]?.trim() ? ", answered" : ", unanswered"}`}
                    aria-current={
                      activeQuestion === q.number ? "true" : undefined
                    }
                    onClick={() => {
                      setActivePassage(p.passage);
                      setTab("questions");
                      setActiveQuestion(q.number);
                    }}
                  >
                    {q.number}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
  return (
    <section
      className={`reading-workspace${full ? " reading-mock-workspace" : ""}`}
    >
      {full && !results && (
        <ReadingMockGuard
          safeToLeave={() =>
            !!loaded.current?.submitted_at || operationLocked.current
          }
          save={save}
          onError={setError}
        />
      )}
      {full && (
        <>
          <h1 className="sr-only">
            {attempt.book} · Test {attempt.test} · Full Reading Mock
          </h1>
          {toolbarSlot ? (
            createPortal(mockControls, toolbarSlot)
          ) : (
            <header className="reading-toolbar">
              <a
                href={testPath}
                onClick={(e) => {
                  e.preventDefault();
                  void leave(testPath);
                }}
              >
                Save &amp; exit
              </a>
              {mockControls}
            </header>
          )}
        </>
      )}
      {!full && (
        <>
          <ReadingTrail
            items={[
              { label: "Library", to: "/library" },
              { label: `${collection} Reading`, to: collectionPath },
              { label: attempt.book, to: bookPath },
              { label: `Test ${attempt.test}`, to: testPath },
              {
                label: full
                  ? "Full Reading Mock"
                  : `Passage ${attempt.passage}`,
              },
            ]}
            onNavigate={(to) => void leave(to)}
          />
          <header className="reading-toolbar">
            <div>
              <a
                href={testPath}
                aria-disabled={busy || undefined}
                onClick={(e) => {
                  e.preventDefault();
                  void leave(testPath);
                }}
              >
                {exiting ? "Saving before leaving…" : "Save & exit"}
              </a>
              <h1>
                {attempt.book} · Test {attempt.test} ·{" "}
                {full ? "Full Reading Mock" : `Passage ${attempt.passage}`}
              </h1>
            </div>
            <div>
              {remaining !== null && (
                <span role="timer" aria-label="Time remaining">
                  {Math.floor(remaining / 60)}:
                  {String(remaining % 60).padStart(2, "0")}
                </span>
              )}
              <span role="status">
                {attempt.submitted_at
                  ? "Submitted"
                  : saving
                    ? "Saving…"
                    : dirty
                      ? "Unsaved changes"
                      : "Saved"}
              </span>
              {!attempt.submitted_at && (
                <>
                  <button
                    className="button"
                    disabled={saving || busy}
                    onClick={() => void save().catch(() => {})}
                  >
                    Save answers
                  </button>
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() => setConfirm(true)}
                  >
                    Submit answers
                  </button>
                </>
              )}
            </div>
          </header>
        </>
      )}
      {error != null && <ErrorState error={error} />}
      {confirm && (
        <div
          className="reading-confirm"
          role="alertdialog"
          aria-label="Submit Reading answers"
        >
          <p>
            Submit {Object.values(answers).filter((a) => a.trim()).length} of{" "}
            {attempt.total} answered questions? Your result will be final.
          </p>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => void submit()}
          >
            Confirm submission
          </button>
          <button
            className="button"
            disabled={busy}
            onClick={() => setConfirm(false)}
          >
            Keep reading
          </button>
        </div>
      )}
      {!full && attempt.submitted_at && (
        <div className="reading-results">
          <h2>
            Result: {attempt.score} / {attempt.total}
          </h2>
          <ReadingShareLink attemptId={attempt.id} />
          <ResultDetails label="Passage" results={(attempt.results || []).map(r=>({...r,group:attempt.passage || 1}))} />
        </div>
      )}
      <div className="reading-tabs" role="tablist" aria-label="Reading panes">
        {["passage", "questions"].map((t) => (
          <button
            id={`reading-tab-${t}`}
            role="tab"
            key={t}
            aria-selected={tab === t}
            aria-controls={`reading-pane-${t}`}
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                const next = t === "passage" ? "questions" : "passage";
                setTab(next);
                document.getElementById(`reading-tab-${next}`)?.focus();
              }
            }}
          >
            {t === "passage" ? "Passage" : "Questions"}
          </button>
        ))}
      </div>
      <HighlightTools key={`${endpoint}-${id}-${activePassage}`} selector=".reading-panes" storageKey={`${userId}-${endpoint}-${id}-${activePassage}`} />
      <div className="reading-panes" data-tab={tab}>
        <section
          id="reading-pane-passage"
          className="reading-pane reading-passage"
          aria-label="Reading passage"
          tabIndex={0}
        >
          <Passage
            content={currentContent}
            figurePath={(index) =>
              `${endpoint}/${id}/figures/${full ? `${activePassage}/` : ""}${index}/`
            }
          />
        </section>
        <section
          id="reading-pane-questions"
          className="reading-pane reading-questions"
          aria-label="Reading questions"
          tabIndex={0}
        >
          <ReadingQuestions
            content={currentContent}
            figurePath={(index) =>
              `${endpoint}/${id}/figures/${full ? `${activePassage}/` : ""}${index}/`
            }
            answers={answers}
            onChange={change}
            disabled={!!attempt.submitted_at || busy}
          />
        </section>
      </div>
      {full &&
        (navigationSlot
          ? createPortal(questionNavigation, navigationSlot)
          : questionNavigation)}
    </section>
  );
}

function ReadingMockGuard({
  safeToLeave,
  save,
  onError,
}: {
  safeToLeave: () => boolean;
  save: () => Promise<unknown>;
  onError: (error: unknown) => void;
}) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !safeToLeave() && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    void save()
      .then(() => blocker.proceed())
      .catch((error) => {
        onError(error);
        blocker.reset();
      });
  }, [blocker.state]);
  return null;
}

function SourcePage({
  path,
  alt = "Original source PDF page for comparison",
}: {
  path: string;
  alt?: string;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<unknown>();
  useEffect(() => {
    let live = true;
    let object = "";
    setUrl("");
    setError(undefined);
    void apiBlob(path)
      .then((b) => {
        if (live) {
          object = URL.createObjectURL(b);
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
  }, [path]);
  return error ? (
    <ErrorState error={error} />
  ) : url ? (
    <img className="reading-source-page" src={url} alt={alt} />
  ) : (
    <Loading />
  );
}

export function ReadingReview() {
  const { id } = useParams();
  const user = useAuth((s) => s.user);
  const query = useQuery<Paper | Page<Paper>>({
    queryKey: ["reading-review", id],
    enabled: !!user?.can_edit && !!id,
    queryFn: () =>
      id
        ? api<Paper>(`reading-papers/${id}/`)
        : api<Page<Paper>>("reading-papers/?owned=true&page_size=100"),
  });
  const [page, setPage] = useState<number>();
  const [confirmed, setConfirmed] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<unknown>();
  const [pending, setPending] = useState(false);
  if (!user?.can_edit)
    return <ErrorState error={new Error("Editor access required.")} />;
  if (!id) return <ReadingAdminLibrary />;
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} />;
  const paper = query.data as Paper;
  const v = paper.version;
  if (!paper.can_edit || !v)
    return <ErrorState error={new Error("You cannot review this paper.")} />;
  const pages = [...(v.source_pages || []), ...(v.key_pages || [])];
  const activePage = pages.includes(page || 0) ? page! : pages[0];
  async function publish() {
    setPending(true);
    setError(undefined);
    try {
      const revised = await post<Version>(`reading-papers/${id}/versions/`, {
        ...v,
        review_notes: notes || v!.review_notes,
      });
      await post(`reading-papers/${id}/publish/`, {
        version: revised.id,
        confirm_review: confirmed,
      });
      await query.refetch();
      setConfirmed(false);
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }
  return (
    <section>
      <ReadingTrail
        items={[
          { label: "Admin", to: "/admin" },
          { label: "Reading library", to: "/admin/reading" },
          {
            label: paper.book,
            to: `/admin/reading?book=${encodeURIComponent(paper.book)}`,
          },
          {
            label: `Test ${paper.test}`,
            to: `/admin/reading?book=${encodeURIComponent(paper.book)}&test=${paper.test}`,
          },
          { label: `Passage ${paper.passage}` },
        ]}
      />
      <h1>Compare source: {paper.title}</h1>
      <p>
        {v.source_name} · {paper.book} · Test {paper.test} · Passage{" "}
        {paper.passage}
      </p>
      <div className="reading-review-panes">
        <section>
          <label>
            Original PDF page
            <select
              value={activePage}
              onChange={(e) => setPage(Number(e.target.value))}
            >
              {pages.map((n) => (
                <option key={n} value={n}>
                  PDF page {n}
                  {v.key_pages?.includes(n) ? " · answer key" : ""}
                </option>
              ))}
            </select>
          </label>
          <SourcePage
            path={`reading-papers/${id}/source-pages/${activePage}/?version=${v.id}`}
          />
        </section>
        <section>
          <Passage
            content={v.content}
            figurePath={(index) =>
              `reading-papers/${id}/figures/${index}/?version=${v.id}`
            }
          />
          <ReadingQuestions
            content={v.content}
            figurePath={(index) =>
              `reading-papers/${id}/figures/${index}/?version=${v.id}`
            }
            answers={{}}
            onChange={() => {}}
            disabled
          />
          <h2>Private answer key</h2>
          {Object.entries(v.keys || {}).map(([n, a]) => (
            <p key={n}>
              {n}. {a.join(" / ")}
            </p>
          ))}
        </section>
      </div>
      <label>
        Source comparison notes
        <textarea
          value={notes || v.review_notes || ""}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Record passage, table, instructions, numbering and key comparisons."
        />
      </label>
      <label className="reading-review-confirm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        I compared the complete passage, question instructions, table, all
        answer fields and keys against the original PDF.
      </label>
      {error != null && <ErrorState error={error} />}
      <button
        className="button primary"
        disabled={!confirmed || pending}
        onClick={() => void publish()}
      >
        {pending ? "Publishing…" : "Publish reviewed version"}
      </button>
    </section>
  );
}
