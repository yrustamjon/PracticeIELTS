import "./sharedResults.css";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { type Comparison } from "../services/api";
import { ResultNavigation } from "../components/ResultNavigation";
import { ErrorState, Loading } from "../components/ui";

type SharedPracticeData = {
  title: string;
  category_path: string[];
  test_title: string;
  part_label: string;
  difficulty: string;
  exercise_count: number;
  checked_count: number;
  status: "in_progress" | "completed";
  accuracy: number | null;
  completed_at: string | null;
  results: (Comparison & {
    number: number;
    answer: string;
    attempt_count: number;
    first_accuracy: number;
    attempts: {
      number: number;
      accuracy: number;
      mistakes: { status: string; actual: string; expected: string }[];
    }[];
  })[];
};
export function SharedPractice() {
  const { token } = useParams();
  const [search, setSearch] = useSearchParams();
  const rawPage = Number(search.get("page") || 1);
  const requestedPage =
    Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const q = useQuery({
    queryKey: ["public-practice", token],
    retry: false,
    refetchInterval: (query) => (query.state.error ? false : 15000),
    queryFn: async (): Promise<SharedPracticeData> => {
      const response = await fetch(
        `/api/v1/shared-practice-results/${encodeURIComponent(token || "")}/`,
        { credentials: "omit", referrerPolicy: "no-referrer" },
      );
      if (!response.ok)
        throw new Error(
          response.status === 404
            ? "This practice link is unavailable or has been removed."
            : "Could not load this practice. Please try again.",
        );
      return response.json();
    },
  });
  const pageCount = Math.max(1, Math.ceil((q.data?.results.length || 0) / 10));
  const page = Math.min(requestedPage, pageCount);
  const sortedResults = [...(q.data?.results || [])].sort((a, b) => {
    const totalMistakes = (result: SharedPracticeData["results"][number]) =>
      result.attempts?.reduce(
        (total, attempt) => total + attempt.mistakes.length,
        0,
      ) ?? 0;
    return totalMistakes(b) - totalMistakes(a) || a.number - b.number;
  });
  const visibleResults = sortedResults.slice((page - 1) * 10, page * 10);
  function goToPage(next: number) {
    const params = new URLSearchParams(search);
    params.set("page", String(next));
    setSearch(params);
  }
  const level = q.data
    ? q.data.difficulty.charAt(0).toUpperCase() + q.data.difficulty.slice(1)
    : "";
  return (
    <main className="shared-mock-page shared-practice-page">
      <Link className="brand" to="/">
        PracticeIELTS
      </Link>
      <ResultNavigation
        steps={[
          { label: "PracticeIELTS", to: "/" },
          { label: "Shared practice result" },
        ]}
        back={{ label: "Back to PracticeIELTS", to: "/" }}
      />
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} />
      ) : (
        <>
          <p className="eyebrow">SHARED LISTENING PRACTICE</p>
          <p className="muted">{q.data.category_path.join(" → ")}</p>
          <h1>{q.data.title}</h1>
          <p>
            {[q.data.test_title, q.data.part_label, `${level} dictation`]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <section className="panel shared-practice-summary">
            <div className="shared-practice-summary-top">
              <span className="pill">
                {q.data.part_label} · {level}
              </span>
              <p role="status">
                {q.data.status === "completed" ? "Completed" : "In progress"}
              </p>
            </div>
            <span className="shared-practice-count">
              {level} · {q.data.checked_count} / {q.data.exercise_count}{" "}
              exercises checked
            </span>
            <h2>
              {q.data.accuracy === null
                ? "Waiting for the first checked answer"
                : `${q.data.accuracy}% accuracy`}
            </h2>
            <progress
              aria-label="Practice completion"
              value={q.data.checked_count}
              max={Math.max(1, q.data.exercise_count)}
            />
            <p className="muted">
              Live result · updates every 15 seconds. Only checked answers are
              shown.
            </p>
            <button
              className="button secondary"
              disabled={q.isFetching}
              onClick={() => void q.refetch()}
            >
              {q.isFetching ? "Updating…" : "Refresh progress"}
            </button>
            <p className="muted">
              Average of the latest checked answers, including retries.
            </p>
            <p>
              {q.data.difficulty === "medium"
                ? "The learner listened to one sentence at a time and typed what they heard."
                : q.data.difficulty === "easy"
                  ? "The learner listened to short audio chunks and typed what they heard."
                  : q.data.difficulty === "hard"
                    ? "The learner listened to groups of sentences and typed what they heard."
                    : "The learner listened to the full recording and typed what they heard."}
            </p>
            <p className="muted">
              {q.data.completed_at
                ? `Completed ${new Date(q.data.completed_at).toLocaleString()}.`
                : "The learner is still working on this practice."}{" "}
              This result covers only the practice shown above.
            </p>
          </section>
          {q.data.checked_count === 0 && (
            <section className="panel">
              <h2>No checked answers yet</h2>
              <p>
                The learner can keep this same link while working. Answers
                appear here after Check Answer.
              </p>
            </section>
          )}
          {q.data.checked_count > 0 && (
            <details className="shared-practice-details">
              <summary>
                <span>
                  <strong>Batafsil</strong>
                  <small>Most mistakes first · all attempts</small>
                </span>
                <span className="pill">{q.data.checked_count} exercises</span>
              </summary>
              <div className="shared-practice-answers">
                {visibleResults.map((result) => (
                  <section className="panel" key={result.number}>
                    <div className="shared-exercise-heading">
                      <h2>Exercise {result.number}</h2>
                      <span className="pill">Latest: {result.accuracy}%</span>
                    </div>
                    <p className="muted">
                      Total mistakes:{" "}
                      {result.attempts?.reduce(
                        (total, attempt) => total + attempt.mistakes.length,
                        0,
                      ) ?? 0}{" "}
                      · All attempts
                    </p>
                    <p className="muted">
                      {result.attempt_count}{" "}
                      {result.attempt_count === 1 ? "attempt" : "attempts"} ·
                      First: {result.first_accuracy}% → Latest:{" "}
                      {result.accuracy}%
                    </p>
                    <details className="shared-attempt-mistakes">
                      <summary>Mistakes by attempt</summary>
                      <ol className="shared-attempt-list">
                        {result.attempts?.map((attempt) => (
                          <li
                            className={`shared-attempt ${attempt.mistakes.length === 0 ? "shared-attempt-clean" : ""}`}
                            key={attempt.number}
                          >
                            <div className="shared-attempt-header">
                              <strong>Attempt {attempt.number}</strong>
                              <span className="shared-attempt-score">
                                {attempt.accuracy}%
                              </span>
                            </div>
                            {attempt.mistakes.length === 0 ? (
                              <p className="shared-no-mistakes">
                                ✓ No mistakes
                              </p>
                            ) : (
                              <ul className="shared-mistake-list">
                                {attempt.mistakes.map((mistake, index) => (
                                  <li className="shared-mistake" key={index}>
                                    {mistake.status === "missing" ? (
                                      <>
                                        <span className="shared-mistake-kind">
                                          Missing word
                                        </span>
                                        <span className="shared-word-expected">
                                          {mistake.expected}
                                        </span>
                                      </>
                                    ) : mistake.status === "extra" ? (
                                      <>
                                        <span className="shared-mistake-kind">
                                          Extra word
                                        </span>
                                        <del className="shared-word-actual">
                                          {mistake.actual}
                                        </del>
                                      </>
                                    ) : (
                                      <>
                                        <span className="sr-only">
                                          You wrote:{" "}
                                        </span>
                                        <del className="shared-word-actual">
                                          {mistake.actual}
                                        </del>
                                        <span
                                          className="shared-word-arrow"
                                          aria-hidden="true"
                                        >
                                          →
                                        </span>
                                        <span className="sr-only">
                                          Correct word:{" "}
                                        </span>
                                        <span className="shared-word-expected">
                                          {mistake.expected}
                                        </span>
                                      </>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ol>
                    </details>
                  </section>
                ))}
              </div>
              {pageCount > 1 && (
                <nav
                  className="shared-practice-pagination"
                  aria-label="Shared practice pages"
                >
                  <button
                    className="button secondary"
                    disabled={page === 1}
                    onClick={() => goToPage(page - 1)}
                  >
                    Previous
                  </button>
                  <span aria-live="polite">
                    Page {page} of {pageCount}
                  </span>
                  <button
                    className="button secondary"
                    disabled={page === pageCount}
                    onClick={() => goToPage(page + 1)}
                  >
                    Next
                  </button>
                </nav>
              )}
            </details>
          )}
        </>
      )}
    </main>
  );
}
