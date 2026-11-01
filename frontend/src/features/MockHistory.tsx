import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronRight, Headphones, History } from "lucide-react";
import { api, type Page } from "../services/api";
import "./mockHistory.css";
import { ResultNavigation } from "../components/ResultNavigation";
import { Empty, ErrorState, Loading, PageTitle } from "../components/ui";

export type MockHistoryEntry = {
  id: number; title: string; category_name: string; timing: "timed" | "untimed";
  submitted_at: string; score: number; total: number;
};
export function MockHistory() {
  const [params, setParams] = useSearchParams();
  const requested = Number(params.get("page"));
  const page = Number.isInteger(requested) && requested > 0 ? requested : 1;
  const q = useQuery({ queryKey: ["mock-history", page], queryFn: () => api<Page<MockHistoryEntry>>(`mock-attempts/history/?page=${page}`) });
  return <div className="mock-history-page">
    <ResultNavigation steps={[{label: "Mock Tests", to: "/mock-tests"}, {label: "My Mock results"}]} back={{label: "Back to Mock Tests", to: "/mock-tests"}} />
    <PageTitle eyebrow="LISTENING / MOCK HISTORY" title="My Mock results" description="Revisit your answers. See where you can improve." />
    <section className="history-panel">
      {q.isPending ? <Loading /> : q.error ? <><ErrorState error={q.error} /><button className="button secondary" onClick={() => void q.refetch()}>Try again</button>{page > 1 && <button className="button secondary" onClick={() => setParams({})}>First page</button>}</> : q.data.results.length ? <>
        <header className="history-panel-heading">
          <div><span className="history-heading-icon"><History size={18} aria-hidden="true" /></span><h2>Completed mocks</h2><span className="history-count">{q.data.count} results</span></div>
          <span className="history-order">Latest first</span>
        </header>
        <div className="mock-history-list">{q.data.results.map(a => {
          const percent = Math.round(a.score / Math.max(a.total, 1) * 100);
          const date = new Date(a.submitted_at);
          return <Link className="mock-history-row" key={a.id} to={`/mock/${a.id}/results${page > 1 ? `?history_page=${page}` : ""}`}>
            <span className="history-record-icon"><Headphones size={21} aria-hidden="true" /></span>
            <span className="mock-history-description"><small className="history-book">{a.category_name}</small><strong>{a.title}</strong><span className="history-record-meta"><span className="history-mode">{a.timing === "untimed" ? "Untimed" : "Timed"}</span><time dateTime={a.submitted_at}>{date.toLocaleDateString(undefined, {month: "short", day: "numeric", year: "numeric"})}<span className="history-time"> · {date.toLocaleTimeString(undefined, {hour: "2-digit", minute: "2-digit"})}</span></time></span></span>
            <span className={`mock-history-score ${percent >= 70 ? "history-score-high" : ""}`}><strong>{a.score} / {a.total}</strong><small>{percent}% correct</small></span>
            <span className="history-open"><span>View result</span><ChevronRight size={18} aria-hidden="true" /></span>
          </Link>;
        })}</div>
        <nav className="catalog-pagination" aria-label="Mock history pages"><span>{(page - 1) * 10 + 1}–{(page - 1) * 10 + q.data.results.length} of {q.data.count}</span><div>
          <button className="button secondary" disabled={!q.data.previous} onClick={() => setParams({page: String(page - 1)})}>Previous</button>
          <button className="button secondary" disabled={!q.data.next} onClick={() => setParams({page: String(page + 1)})}>Next</button>
        </div></nav>
      </> : <Empty title="No completed mocks yet" description="After you submit a Mock, its score and answers will appear here." action={<Link className="button primary" to="/mock-tests">Choose a Mock</Link>} />}
    </section>
  </div>;
}
