import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  BookOpen,
  Check,
  ChevronRight,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { post } from "../services/api";
import { readingCatalog } from "../services/readingCatalog";
import { MockTimingOptions } from "../components/MockTimingOptions";
import { Empty, ErrorState, Loading, PageTitle } from "../components/ui";
import { ResultNavigation } from "../components/ResultNavigation";
import "./mockHistory.css";

type Paper = {
  id: number;
  passage: number;
  title: string;
  question_count: number;
  full_available?: boolean;
};
export type ReadingRecord = {
  id: number;
  paper: number;
  book: string;
  test: number;
  passage: number;
  title: string;
  timed: boolean;
  submitted_at: string | null;
  created_at: string;
  score: number | null;
  total: number;
};
function useReadingRecords(full = true) {
  return useQuery({
    queryKey: [full ? "reading-full-records" : "reading-passage-records"],
    queryFn: () =>
      readingCatalog<ReadingRecord>(
        full ? "reading-full-attempts/" : "reading-attempts/",
      ),
    staleTime: 0,
  });
}
export function ReadingContinue() {
  const q = useReadingRecords();
  const active = q.data?.results.filter((a) => !a.submitted_at) || [];
  return (
    <>
      {q.error && <ErrorState error={q.error} />}
      {!!active.length && (
        <section className="panel catalog-resume">
          <h2>Continue your mock</h2>
          <div className="catalog-resume-list">
            {active.map((a) => (
              <Link
                className="exam-history-row"
                key={a.id}
                to={`/reading/full/attempts/${a.id}`}
              >
                <BookOpen size={18} />
                <span>
                  <strong>
                    {a.book} · Test {a.test}
                  </strong>
                  <small>{a.timed ? "Timed attempt" : "No time limit"}</small>
                </span>
                <ChevronRight size={15} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
export function ReadingTestSelection({
  papers,
  book,
  test,
}: {
  papers: Paper[];
  book: string;
  test: string;
}) {
  const [params, setParams] = useSearchParams();
  const fullPaper = papers.find((p) => p.passage === 1 && p.full_available);
  const requested = params.get("part");
  const part =
    requested || (fullPaper ? "all" : String(papers[0]?.passage || "all"));
  const target =
    part === "all" ? fullPaper : papers.find((p) => String(p.passage) === part);
  const full = part === "all";
  const records = useReadingRecords();
  const passageRecords = useReadingRecords(false);
  const active = records.data?.results.find(
    (a) => a.paper === fullPaper?.id && !a.submitted_at,
  );
  const passageActive = passageRecords.data?.results.find(
    (a) => a.paper === target?.id && !a.submitted_at,
  );
  const [timing, setTiming] = useState<"timed" | "untimed">("timed");
  const [chosen, setChosen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const navigate = useNavigate();
  useEffect(() => {
    if (active && !chosen) setTiming(active.timed ? "timed" : "untimed");
  }, [active?.id, active?.timed, chosen]);
  const locked = !full && active?.timed;
  async function start() {
    if (!target || locked) return;
    setBusy(true);
    setError(undefined);
    try {
      if (full && active && active.timed !== (timing === "timed")) {
        if (
          !window.confirm(
            `An active ${active.timed ? "timed" : "untimed"} mock exists. Submit it and start a new ${timing} attempt?`,
          )
        ) {
          navigate(`/reading/full/attempts/${active.id}`);
          return;
        }
        await post(`reading-full-attempts/${active.id}/submit/`, {});
      }
      const a = await post<{ id: number }>(
        full ? "reading-full-attempts/" : "reading-attempts/",
        { paper: target.id, ...(full ? { timed: timing === "timed" } : {}) },
      );
      navigate(`/reading/${full ? "full/" : ""}attempts/${a.id}`);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <nav
        className="test-part-picker reading-part-picker"
        aria-label="Choose test section"
      >
        {["all", "1", "2", "3"].map((n) => {
          const p =
            n === "all"
              ? fullPaper
              : papers.find((p) => String(p.passage) === n);
          return (
            <button
              key={n}
              className={part === n ? "active" : ""}
              aria-pressed={part === n}
              disabled={!p || busy}
              onClick={() => {
                const next = new URLSearchParams(params);
                next.set("part", n);
                setParams(next);
                setError(undefined);
              }}
            >
              {n === "all" ? "Full test" : `Passage ${n}`}
              <small>
                {n === "all"
                  ? "Passages 1–3 · 40 questions"
                  : p
                    ? `${p.question_count} questions`
                    : "Not ready"}
              </small>
            </button>
          );
        })}
      </nav>
      <div className="test-mode-layout">
        <aside className="panel test-overview">
          <div className="test-cover">
            <div className="book-cover">
              <span>PracticeIELTS</span>
              <strong>
                READ
                <br />
                &amp; LEARN
              </strong>
              <BookOpen size={32} aria-hidden="true" />
              <small>YOUR READING JOURNEY</small>
            </div>
          </div>
          <div className="test-overview-copy">
            <span className="small-label muted">
              {book} · Test {test}
            </span>
            <h2>
              {full
                ? "Full Reading Mock"
                : target?.title || "Passage unavailable"}
            </h2>
            <p className="muted">
              {full
                ? "All three passages, one focused attempt."
                : "Study this passage independently."}
            </p>
            <span className="test-question-count">
              <FileText size={14} />
              {full ? (target ? 40 : 0) : target?.question_count || 0} published
              questions
            </span>
          </div>
          <div className="test-outline">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={full || part === String(n) ? "selected" : ""}
              >
                <span>
                  <Check size={13} />
                  Passage {n}
                </span>
                <small>
                  {papers.some((p) => p.passage === n)
                    ? "Available"
                    : "Not ready"}
                </small>
              </div>
            ))}
          </div>
        </aside>
        <section className="panel test-mode-panel">
          <h2>
            {full
              ? "How would you like to take this mock?"
              : "Passage practice"}
          </h2>
          {records.error && <ErrorState error={records.error} />}
          {passageRecords.error && <ErrorState error={passageRecords.error} />}
          {(records.error || passageRecords.error) && (
            <button
              className="button secondary"
              onClick={() => {
                void records.refetch();
                void passageRecords.refetch();
              }}
            >
              Try again
            </button>
          )}
          {!target && (
            <p className="notice-box">
              This section is not ready. Choose an available passage.
            </p>
          )}
          {full ? (
            <>
              <p className="muted mode-explanation">
                Read the original passages and answer the exam questions. Choose
                a timed attempt or work without a time limit.
              </p>
              <MockTimingOptions
                timing={timing}
                onChange={(v) => {
                  setChosen(true);
                  setTiming(v);
                }}
              />
              <p className="notice-box">
                {timing === "timed"
                  ? "60 minutes. The mock submits automatically when time runs out."
                  : "No time limit. Save your answers and return whenever you need."}{" "}
                Answer keys open after submission.
              </p>
            </>
          ) : (
            <p className="notice-box">
              Untimed practice · Your answers are saved. Answer keys open after
              submission.
            </p>
          )}
          {active && (
            <p className="resume-exam">
              <Link
                className="text-link"
                to={`/reading/full/attempts/${active.id}`}
              >
                Resume active {active.timed ? "timed" : "untimed"} mock
                <ChevronRight size={15} />
              </Link>
            </p>
          )}
          {locked && (
            <p className="notice-box">
              Finish your timed Full Reading Mock before opening passage
              practice.
            </p>
          )}
          {error != null && <ErrorState error={error} />}
          <button
            className="button primary"
            disabled={
              !target ||
              !!locked ||
              busy ||
              records.isPending ||
              !!records.error ||
              (!full && (passageRecords.isPending || !!passageRecords.error))
            }
            onClick={() => void start()}
          >
            <ShieldCheck size={17} />
            {busy
              ? "Preparing…"
              : full
                ? active && active.timed === (timing === "timed")
                  ? "Resume Mock"
                  : "Start Mock"
                : passageActive
                  ? "Resume Practice"
                  : "Start Practice"}
            <ChevronRight size={17} />
          </button>
        </section>
      </div>
    </>
  );
}
export function ReadingHistory() {
  const full = useReadingRecords();
  const passages = useReadingRecords(false);
  const entries = [
    ...(full.data?.results || []).map((a) => ({ ...a, full: true })),
    ...(passages.data?.results || []).map((a) => ({ ...a, full: false })),
  ]
    .filter((a) => a.submitted_at)
    .sort((a, b) => Date.parse(b.submitted_at!) - Date.parse(a.submitted_at!));
  return (
    <div className="mock-history-page">
      <ResultNavigation
        steps={[
          { label: "Reading", to: "/reading" },
          { label: "My Reading results" },
        ]}
        back={{ label: "Back to Reading", to: "/reading" }}
      />
      <PageTitle
        eyebrow="READING / HISTORY"
        title="My Reading results"
        description="Revisit your answers and completed attempts."
      />
      <section className="history-panel">
        {full.isPending || passages.isPending ? (
          <Loading />
        ) : full.error || passages.error ? (
          <>
            <ErrorState error={full.error || passages.error} />
            <button
              className="button secondary"
              onClick={() => {
                void full.refetch();
                void passages.refetch();
              }}
            >
              Try again
            </button>
          </>
        ) : entries.length ? (
          <div className="mock-history-list">
            {entries.map((a) => (
              <Link
                key={`${a.full}-${a.id}`}
                className="mock-history-row"
                to={`/reading/${a.full ? "full/" : ""}attempts/${a.id}${a.full ? "/results" : ""}`}
              >
                <span className="history-record-icon">
                  <BookOpen size={21} />
                </span>
                <span className="mock-history-description">
                  <small className="history-book">{a.book}</small>
                  <strong>
                    Test {a.test} ·{" "}
                    {a.full ? "Full Reading Mock" : `Passage ${a.passage}`}
                  </strong>
                  <span className="history-record-meta">
                    <span className="history-mode">
                      {a.timed ? "Timed" : "Untimed"}
                    </span>
                    <time dateTime={a.submitted_at!}>
                      {new Date(a.submitted_at!).toLocaleString()}
                    </time>
                  </span>
                </span>
                <span className="mock-history-score">
                  <strong>
                    {a.score} / {a.total}
                  </strong>
                </span>
                <span className="history-open">
                  View result
                  <ChevronRight size={18} />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <Empty
            title="No completed Reading attempts yet"
            description="Submit a mock or passage practice to see your score and answers here."
            action={
              <Link className="button primary" to="/reading">
                Choose a test
              </Link>
            }
          />
        )}
      </section>
    </div>
  );
}
