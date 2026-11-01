import { ShareDialog } from "../components/ShareDialog";
import { ResultDetails } from "../components/ResultDetails";
import "./sharedResults.css";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api, post } from "../services/api";
import { ShareResults } from "../components/ShareResults";
import { ErrorState, Loading } from "../components/ui";

type SharedReading = {
  book: string;
  test: number;
  passage: number;
  title: string;
  timed: boolean;
  score: number;
  total: number;
  submitted_at: string;
  results: {
    number: number;
    passage: number;
    prompt: string;
    answer: string;
    correct: boolean;
    accepted_answers: string[];
    options: { key: string; text: string }[];
  }[];
};
export function ReadingShareLink({
  attemptId,
  full = false,
}: {
  attemptId: number;
  full?: boolean;
}) {
  const cache = useQueryClient();
  const key = ["reading-share", full, attemptId];
  const q = useQuery({
    queryKey: key,
    queryFn: () =>
      api<{ token: string | null }>(
        `${full ? "reading-full-attempts" : "reading-attempts"}/${attemptId}/share/`,
      ),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  async function change(remove = false) {
    setBusy(true);
    setError(undefined);
    try {
      const value = remove
        ? (await api(
            `${full ? "reading-full-attempts" : "reading-attempts"}/${attemptId}/share/`,
            { method: "DELETE" },
          ),
          { token: null })
        : await post<{ token: string }>(
            `${full ? "reading-full-attempts" : "reading-attempts"}/${attemptId}/share/`,
          );
      cache.setQueryData(key, value);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  const url = q.data?.token
    ? `${window.location.origin}/shared/reading/${q.data.token}`
    : "";
  return (
    <ShareDialog title="Share your Reading result">
      <p className="muted">
        Anyone with this link can see the book, test, passage, your answers,
        mistakes and correct answers.
      </p>
      {(error || q.error) != null && <ErrorState error={error || q.error} />}
      {q.isPending ? (
        <Loading />
      ) : url ? (
        <>
          <label>
            Public result link
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
            />
          </label>
          <div className="editor-actions">
            <a
              className="text-link"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              Open shared result
            </a>
            <ShareResults text={url} />
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void change(true)}
            >
              Stop sharing
            </button>
          </div>
        </>
      ) : (
        <button
          className="button secondary"
          disabled={busy || !!q.error}
          onClick={() => void change()}
        >
          {busy ? "Creating link…" : "Create public result link"}
        </button>
      )}
    </ShareDialog>
  );
}

export function SharedReadingResult() {
  const { token } = useParams();
  const q = useQuery({
    queryKey: ["public-reading", token],
    retry: false,
    queryFn: async (): Promise<SharedReading> => {
      const r = await fetch(
        `/api/v1/shared-reading-results/${encodeURIComponent(token || "")}/`,
        { credentials: "omit", referrerPolicy: "no-referrer" },
      );
      if (!r.ok)
        throw new Error(
          r.status === 404
            ? "This result link is unavailable or has been removed."
            : "Could not load this result. Please try again.",
        );
      return r.json();
    },
  });
  return (
    <main className="shared-mock-page">
      <Link className="brand" to="/">
        PracticeIELTS
      </Link>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} />
      ) : (
        <>
          <p className="eyebrow">SHARED READING RESULT</p>
          <p className="muted">
            {q.data.book} · Test {q.data.test} ·{" "}
            {q.data.passage ? `Passage ${q.data.passage}` : "Full Reading Mock"}
          </p>
          <h1>{q.data.title}</h1>
          <section className="panel exam-results">
            <div className="exam-result-heading">
              <div
                className="exam-score"
                aria-label={`Result: ${q.data.score} / ${q.data.total}`}
              >
                {q.data.score}
                <small> / {q.data.total}</small>
              </div>
              <div>
                <h2>
                  {Math.round((q.data.score / Math.max(q.data.total, 1)) * 100)}
                  % correct
                </h2>
                <p>
                  {q.data.timed ? "Timed exam" : "Untimed"} ·{" "}
                  {new Date(q.data.submitted_at).toLocaleString()}
                </p>
                <p>
                  {q.data.results.filter((r) => !r.correct).length} mistakes
                </p>
              </div>
            </div>
            <ResultDetails label="Passage" results={q.data.results.map(r=>({...r,group:r.passage}))} />
          </section>
        </>
      )}
    </main>
  );
}
