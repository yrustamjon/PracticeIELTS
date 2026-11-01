import { ShareDialog } from "../components/ShareDialog";
import { ResultDetails } from "../components/ResultDetails";
import "./sharedResults.css";
import { ResultNavigation } from "../components/ResultNavigation";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api, post } from "../services/api";
import { ShareResults } from "../components/ShareResults";
import { ErrorState, Loading } from "../components/ui";

type SharedResult = {
  title: string; category_path: string[]; test_title: string; part_label: string;
  timing: string; score: number; total: number; submitted_at: string;
  results: { number: number; part: number; prompt: string; correct: boolean;
    answer: string | string[]; accepted_answers: (string | string[])[];
    options: { key: string; text: string }[] }[];
};
const answerText = (answer: string | string[]) => Array.isArray(answer) ? answer.join(", ") : answer || "No answer";

export function MockShareLink({ attemptId }: { attemptId: number }) {
  const cache = useQueryClient();
  const key = ["mock-share", attemptId];
  const q = useQuery({ queryKey: key, queryFn: () => api<{token: string | null}>(`mock-attempts/${attemptId}/share/`) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  async function change(remove = false) {
    setBusy(true); setError(undefined);
    try {
      const value = remove
        ? (await api(`mock-attempts/${attemptId}/share/`, { method: "DELETE" }), { token: null })
        : await post<{token: string}>(`mock-attempts/${attemptId}/share/`);
      cache.setQueryData(key, value);
    } catch (err) { setError(err); } finally { setBusy(false); }
  }
  const url = q.data?.token ? `${window.location.origin}/shared/mock/${q.data.token}` : "";
  return <ShareDialog title="Share your Mock result">

    <p className="muted">Anyone with this link can see the book, test, your answers, mistakes and correct answers.</p>
    {(error || q.error) != null && <ErrorState error={error || q.error} />}
    {q.isPending ? <Loading /> : url ? <>
      <label>Public result link<input readOnly value={url} onFocus={e => e.currentTarget.select()} /></label>
      <div className="editor-actions">
        <a className="text-link" href={url} target="_blank" rel="noreferrer">Open shared result</a>
        <ShareResults text={url} />
        <button className="button secondary" disabled={busy} onClick={() => void change(true)}>Stop sharing</button>
      </div>
    </> : <button className="button secondary" disabled={busy || !!q.error} onClick={() => void change()}>{busy ? "Creating link…" : "Create public result link"}</button>}
  </ShareDialog>;
}

export function SharedMock() {
  const { token } = useParams();
  const q = useQuery({ queryKey: ["public-mock", token], retry: false, queryFn: async (): Promise<SharedResult> => {
    const response = await fetch(`/api/v1/shared-results/${encodeURIComponent(token || "")}/`, { credentials: "omit", referrerPolicy: "no-referrer" });
    if (!response.ok) throw new Error(response.status === 404 ? "This result link is unavailable or has been removed." : "Could not load this result. Please try again.");
    return response.json();
  } });
  return <main className="shared-mock-page">
    <Link className="brand" to="/">PracticeIELTS</Link>
    <ResultNavigation steps={[{label: "PracticeIELTS", to: "/"}, {label: "Shared Mock result"}]} back={{label: "Back to PracticeIELTS", to: "/"}} />
    {q.isPending ? <Loading /> : q.error ? <ErrorState error={q.error} /> : <>
      <p className="eyebrow">SHARED LISTENING MOCK RESULT</p>
      <p className="muted">{q.data.category_path.join(" → ")}</p>
      <h1>{q.data.title}</h1>
      <p>{[q.data.test_title, q.data.part_label].filter(Boolean).join(" · ")}</p>
      <section className="panel exam-results">
        <div className="exam-result-heading"><div className="exam-score">{q.data.score}<small> / {q.data.total}</small></div>
          <div><h2>{Math.round(q.data.score / Math.max(q.data.total, 1) * 100)}% correct</h2>
            <p>{q.data.timing === "untimed" ? "Untimed mock" : "Timed exam"} · {new Date(q.data.submitted_at).toLocaleString()}</p>
            <p>{q.data.results.filter(r => !r.correct).length} mistakes</p></div>
        </div>
        <ResultDetails label="Part" results={q.data.results.map(r=>({...r,group:r.part}))} />
      </section>
    </>}
  </main>;
}
