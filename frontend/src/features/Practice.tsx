import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useBlocker } from "react-router-dom";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Check,
  Lightbulb,
  Eye,
  RotateCcw,
  Headphones,
  CheckCheck,
  FileText,
} from "lucide-react";
import { api, post, type Session, type Comparison } from "../services/api";
import { Loading, ErrorState, PageTitle } from "../components/ui";
import { AudioPlayer } from "../components/AudioPlayer";
export function ComparisonView({ result }: { result: Comparison }) {
  return (
    <div className="comparison">
      <div className="comparison-heading">
        <strong>{result.accuracy}% accuracy</strong>
        <span>
          {result.accuracy === 100
            ? "Every word counts. Nicely done!"
            : "A chance to listen a little closer."}
        </span>
      </div>
      <div className="word-comparison">
        {result.tokens.map((t, i) => (
          <span
            key={i}
            className={`word ${t.status}`}
            title={`${t.status}${t.reason ? " · " + t.reason : ""}`}
          >
            <span className="word-status">{t.status}</span>
            {t.status === "correct" ? (
              t.actual
            ) : t.status === "missing" ? (
              <ins>{t.expected}</ins>
            ) : t.status === "extra" ? (
              <del>{t.actual}</del>
            ) : (
              <>
                <del>{t.actual}</del>
                <ins>{t.expected}</ins>
              </>
            )}
          </span>
        ))}
      </div>
      <p className="reference-text">
        <strong>Transcript</strong> {result.reference}
      </p>
      <div className="comparison-legend">
        <span>✓ Correct</span>
        <span>↔ Incorrect</span>
        <span>+ Missing</span>
        <span>− Extra</span>
      </div>
    </div>
  );
}
export function Practice() {
  const { id } = useParams();
  const query = useQuery({
    queryKey: ["session", id],
    queryFn: () => api<Session>(`sessions/${id}/`),
  });
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} />;
  return <Workspace key={id} initial={query.data} />;
}
function Workspace({ initial }: { initial: Session }) {
  const [session, setSession] = useState(initial);
  const [answer, setAnswer] = useState(
    initial.drafts[String(initial.position)] || "",
  );
  const [result, setResult] = useState<Comparison | null>(null);
  const [hint, setHint] = useState("");
  const [save, setSave] = useState("Saved");
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const cache = useQueryClient();
  const latest = useRef({ answer, position: session.position });
  latest.current = { answer, position: session.position };
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const interval = session.groups[session.position];
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      currentLocation.pathname !== nextLocation.pathname,
  );
  function persist(value: string, position: number, next = position) {
    setSave("Saving…");
    const p = chain.current
      .catch(() => {})
      .then(() =>
        api<Session>(`sessions/${session.id}/`, {
          method: "PATCH",
          body: JSON.stringify({
            draft: value,
            draft_position: position,
            position: next,
          }),
        }),
      )
      .then((saved) => {
        cache.setQueryData(["session", String(session.id)], saved);
        if (
          latest.current.answer === value &&
          latest.current.position === position
        )
          setSave("Saved");
        return saved;
      });
    chain.current = p;
    return p;
  }
  useEffect(() => {
    const timer = setTimeout(() => {
      void persist(answer, session.position).catch((e) => {
        setSave("Not saved");
        setError(e);
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [answer, session.position]);
  useEffect(() => {
    function before(e: BeforeUnloadEvent) {
      if (save !== "Saved") {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [save]);
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    const current = latest.current;
    void persist(current.answer, current.position)
      .then(() => blocker.proceed())
      .catch((e) => {
        setError(e);
        setSave("Not saved");
        blocker.reset();
      });
  }, [blocker]);
  async function move(next: number) {
    if (next < 0 || next >= session.groups.length) return;
    setBusy(true);
    setError(undefined);
    try {
      const s = await persist(answer, session.position, next);
      setSession(s);
      setAnswer(s.drafts[String(next)] || "");
      setResult(null);
      setHint("");
      setSave("Saved");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function check() {
    setBusy(true);
    setError(undefined);
    try {
      await persist(answer, session.position);
      const r = await post<Comparison>(`sessions/${session.id}/check/`, {
        answer,
        position: session.position,
      });
      setResult(r);
      setSession((s) => ({
        ...s,
        checked_positions: [...new Set([...s.checked_positions, s.position])],
      }));
      setSave("Saved");
      void cache.invalidateQueries({ queryKey: ["progress"] });
      void cache.invalidateQueries({ queryKey: ["responses"] });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function reveal(full = false) {
    try {
      const d = await api<{ hint: string; transcript: string | null }>(
        `sessions/${session.id}/hint/?reveal=${full}`,
      );
      setHint(full ? d.transcript || "" : d.hint);
    } catch (e) {
      setError(e);
    }
  }
  return (
    <>
      <button
        className="back-link"
        onClick={async () => {
          try {
            await persist(answer, session.position);
            if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
            else navigate(`/library/${session.material}`);
          } catch (e) {
            setError(e);
          }
        }}
      >
        <ArrowLeft size={17} />
        Back to material
      </button>
      <div className="breadcrumbs">
        <Link to="/library">Library</Link>
        <ChevronRight size={13} />
        <Link to={`/library/${session.material}`}>{session.title}</Link>
        <ChevronRight size={13} />
        <span>Dictation</span>
      </div>
      <PageTitle
        eyebrow="LISTENING / DICTATION"
        title={session.title}
        description="Listen carefully. Write what you hear. Find your rhythm."
        action={
          <span className="difficulty-badge">
            <Headphones size={16} />
            {session.difficulty} mode
          </span>
        }
      />
      <div className="workspace-grid">
        <div>
          <section className="panel">
            <div className="workspace-heading">
              <h2>
                Segment {session.position + 1}
                <span> / {session.groups.length}</span>
              </h2>
              <span className="save-status">
                <CheckCheck size={16} />
                {save}
              </span>
            </div>
            <AudioPlayer
              url={session.audio.stream_url}
              start={interval.start_ms}
              end={interval.end_ms}
            />
            <div className="dictation-editor">
              <label htmlFor="answer">What did you hear?</label>
              <p className="muted">
                Play the audio as many times as you need, then write the
                complete passage.
              </p>
              {session.difficulty === "easy" &&
                interval.word_count !== undefined && (
                  <div className="expected-word-count">
                    <FileText size={17} />
                    <strong>{interval.word_count} words to listen for</strong>
                    <span>Easy mode</span>
                  </div>
                )}
              <textarea
                id="answer"
                value={answer}
                onChange={(e) => {
                  setAnswer(e.target.value);
                  setSave("Unsaved");
                  setResult(null);
                }}
                placeholder="Start typing what you hear…"
                disabled={busy}
                rows={7}
                spellCheck={false}
              />
              <div className="editor-bottom">
                <span>
                  {session.difficulty === "easy"
                    ? "Take it one chunk at a time."
                    : "Listen closely, then write the complete passage."}
                </span>
                <span>Your answer is saved automatically</span>
              </div>
              <div className="editor-actions">
                <button
                  className="button primary"
                  disabled={busy || !answer.trim()}
                  onClick={() => void check()}
                >
                  <Check size={18} />
                  {busy ? "Saving…" : "Check Answer"}
                </button>
                <button className="button subtle" onClick={() => void reveal()}>
                  <Lightbulb size={17} />
                  Show Hint
                </button>
                <button
                  className="button subtle"
                  onClick={() => void reveal(true)}
                >
                  <Eye size={17} />
                  Reveal Transcript
                </button>
              </div>
              {hint && (
                <div className="hint-box">
                  <Lightbulb size={18} />
                  {hint}
                </div>
              )}
              {error != null && <ErrorState error={error} />}{" "}
              {result && (
                <>
                  <ComparisonView result={result} />
                  <button
                    className="text-link retry"
                    onClick={() => {
                      setResult(null);
                      setAnswer("");
                      setHint("");
                    }}
                  >
                    <RotateCcw size={15} />
                    Try Again
                  </button>
                </>
              )}
            </div>
            <div className="workspace-navigation">
              <button
                className="button secondary"
                disabled={session.position === 0 || busy}
                onClick={() => void move(session.position - 1)}
              >
                <ChevronLeft size={18} />
                Previous Segment
              </button>
              <button
                className="button primary"
                disabled={
                  session.position === session.groups.length - 1 || busy
                }
                onClick={() => void move(session.position + 1)}
              >
                Next Segment
                <ChevronRight size={18} />
              </button>
            </div>
          </section>
        </div>
        <aside className="workspace-aside">
          <section className="panel">
            <h3>Your session</h3>
            <p className="muted">A little progress with every sentence.</p>
            <div className="progress-caption">
              {session.checked_positions.length} of {session.groups.length}{" "}
              checked
            </div>
            <div className="progress-track">
              <i
                style={{
                  width: `${(session.checked_positions.length / session.groups.length) * 100}%`,
                }}
              />
            </div>
            <div className="segment-grid">
              {session.groups.map((_, i) => (
                <button
                  key={i}
                  disabled={busy}
                  className={`${i === session.position ? "current" : ""} ${session.checked_positions.includes(i) ? "done" : ""}`}
                  onClick={() => void move(i)}
                  aria-label={`Go to segment ${i + 1}`}
                  aria-current={i === session.position ? "step" : undefined}
                >
                  {session.checked_positions.includes(i) ? (
                    <Check size={16} />
                  ) : (
                    i + 1
                  )}
                </button>
              ))}
            </div>
          </section>
          <div className="practice-tip">
            <Lightbulb size={23} />
            <h3>Listen for the little things</h3>
            <p>
              Articles, endings and connecting words are easy to miss. Replay
              slowly, then return to normal speed.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
