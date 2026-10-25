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
  CheckCheck,
  FileText,
} from "lucide-react";
import { api, post, type Session, type Comparison } from "../services/api";
import { Loading, ErrorState, PageTitle } from "../components/ui";
import { Pagination } from "./Catalog";
import { AudioPlayer } from "../components/AudioPlayer";
import { PracticeTimingEditor, type PlaybackTiming } from "./PracticeTimingEditor";
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
  const [listPage, setListPage] = useState(
    Math.floor(initial.position / 8) + 1,
  );
  const [answer, setAnswer] = useState(
    initial.drafts[String(initial.position)] || "",
  );
  const [result, setResult] = useState<Comparison | null>(null);
  const [hint, setHint] = useState("");
  const [save, setSave] = useState("Saved");
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [timingPreview, setTimingPreview] = useState<PlaybackTiming | null>(null);
  const [timingPlayRequest, setTimingPlayRequest] = useState(0);
  const [timingMessage, setTimingMessage] = useState("");
  const editor = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    function resize() {
      if (!editor.current) return;
      editor.current.style.height = "auto";
      editor.current.style.height = `${editor.current.scrollHeight + 2}px`;
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [answer, session.position]);
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
      setTimingPreview(null);
      setTimingPlayRequest(0);
      setTimingMessage("");
      setSession(s);
      setListPage(Math.floor(next / 8) + 1);
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
  async function saveTiming(start_ms: number, end_ms: number) {
    setBusy(true);
    setError(undefined);
    setTimingMessage("");
    try {
      await persist(answer, session.position);
      const saved = await api<Session>(`sessions/${session.id}/timing/`, {
        method: "PATCH",
        body: JSON.stringify({
          position: session.position,
          start_ms,
          end_ms,
          revision: session.timing_revision ?? null,
        }),
      });
      setSession(saved);
      cache.setQueryData(["session", String(session.id)], saved);
      setTimingPreview(null);
      setTimingPlayRequest(0);
      setTimingMessage("Timing saved for Easy Practice.");
      void cache.invalidateQueries({ queryKey: ["progress"] });
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
  async function changeLevel(difficulty: string) {
    if (difficulty === session.difficulty || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await persist(answer, session.position);
      const next = await post<Session>("sessions/", {
        material: session.material,
        difficulty,
      });
      navigate(`/practice/${next.id}`);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="practice-screen">
      <div className="breadcrumbs">
        <Link to="/library">Library</Link>
        <ChevronRight size={12} />
        <Link to={`/library/${session.material}?mode=practice`}>
          {session.title}
        </Link>
        <ChevronRight size={12} />
        <span>Practice</span>
      </div>
      <PageTitle
        eyebrow="LISTEN. WRITE. CHECK."
        title={session.title}
        description="One exercise at a time. Build your listening with the original audio."
        action={
          <Link
            className="button secondary"
            to={`/library/${session.material}?mode=practice`}
          >
            <ArrowLeft size={15} />
            Back to material
          </Link>
        }
      />
      <div className="practice-toolbar">
        <div className="practice-levels" aria-label="Practice difficulty">
          {[
            ["easy", "Easy", "Word count shown"],
            ["medium", "Medium", "One sentence"],
            ["hard", "Hard", "2–3 sentences"],
          ].map(([key, label, description]) => (
            <button
              key={key}
              disabled={busy}
              aria-pressed={session.difficulty === key}
              className={session.difficulty === key ? "active" : ""}
              onClick={() => void changeLevel(key)}
            >
              {label}
              <small>{description}</small>
            </button>
          ))}
        </div>
        <span className="pill">
          {session.checked_positions.length} / {session.groups.length} checked
        </span>
      </div>
      <div className="practice-split">
        <aside className="panel practice-exercises">
          <div className="practice-exercises-heading">
            <strong>Exercises</strong>
            <span className="pill">{session.groups.length}</span>
          </div>
          <div className="practice-exercise-list">
            {session.groups
              .slice((listPage - 1) * 8, listPage * 8)
              .map((g, j) => {
                const i = (listPage - 1) * 8 + j,
                  done = session.checked_positions.includes(i);
                return (
                  <button
                    key={i}
                    disabled={busy}
                    className={`${i === session.position ? "current" : ""} ${done ? "done" : ""}`}
                    aria-label={`Go to segment ${i + 1}`}
                    aria-current={i === session.position ? "step" : undefined}
                    onClick={() => void move(i)}
                  >
                    <span className="practice-exercise-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>
                      <strong>Exercise {String(i + 1).padStart(2, "0")}</strong>
                      <small>
                        {done
                          ? "Checked"
                          : session.difficulty === "hard"
                            ? "Listen to consecutive sentences"
                            : "Listen and write"}
                      </small>
                    </span>
                    {done ? <Check size={14} /> : <ChevronRight size={14} />}
                  </button>
                );
              })}
          </div>
          <Pagination
            page={listPage}
            count={session.groups.length}
            size={8}
            onChange={setListPage}
          />
        </aside>
        <section className="panel practice-session-main">
          <div className="workspace-heading">
            <div>
              <span className="small-label muted">
                EXERCISE {String(session.position + 1).padStart(2, "0")}
              </span>
              <h2>Listen and write</h2>
            </div>
            <span className="save-status">
              <CheckCheck size={14} />
              {save}
            </span>
          </div>
          <AudioPlayer
            url={session.audio.stream_url}
            start={(timingPreview || interval).start_ms}
            end={(timingPreview || interval).end_ms}
            playRequest={timingPlayRequest}
          />
          <div className="practice-answer-scroll">
            {session.difficulty === "easy" && session.can_edit_timing && (
              <PracticeTimingEditor
                key={`${session.version}:${session.position}:${session.timing_revision}`}
                interval={interval}
                duration={session.audio.duration_ms}
                previousEnd={session.groups[session.position - 1]?.end_ms}
                nextStart={session.groups[session.position + 1]?.start_ms}
                busy={busy}
                onPreview={(timing) => {
                  setTimingPreview(timing);
                  if (timing) setTimingPlayRequest((value) => value + 1);
                  else setTimingPlayRequest(0);
                }}
                onSave={saveTiming}
              />
            )}
            {timingMessage && <p className="practice-timing-message" role="status">{timingMessage}</p>}
            <div className="dictation-editor">
              {session.difficulty === "easy" &&
                interval.word_count !== undefined && (
                  <div className="expected-word-count">
                    <FileText size={15} />
                    <strong>{interval.word_count} words to listen for</strong>
                    <span>Easy mode</span>
                  </div>
                )}
              <label htmlFor="answer">What did you hear?</label>
              <textarea
                ref={editor}
                id="answer"
                value={answer}
                onChange={(e) => {
                  setAnswer(e.target.value);
                  setSave("Unsaved");
                  setResult(null);
                }}
                onKeyDown={(e) => {
                  if (
                    (e.ctrlKey || e.metaKey) &&
                    e.key === "Enter" &&
                    !busy &&
                    answer.trim()
                  ) {
                    e.preventDefault();
                    void check();
                  }
                }}
                placeholder="Start typing what you hear…"
                disabled={busy}
                rows={4}
                spellCheck={false}
              />
              {hint && (
                <div className="hint-box">
                  <Lightbulb size={16} />
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
                    <RotateCcw size={14} />
                    Try Again
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="practice-check-actions">
            <div>
              <button
                className="text-link"
                disabled={busy}
                onClick={() => void reveal()}
              >
                <Lightbulb size={14} />
                Show Hint
              </button>
              <button
                className="text-link"
                disabled={busy}
                onClick={() => void reveal(true)}
              >
                <Eye size={14} />
                Reveal Transcript
              </button>
            </div>
            <button
              className="button primary"
              disabled={busy || !answer.trim()}
              onClick={() => void check()}
            >
              <Check size={16} />
              {busy ? "Saving…" : "Check Answer"}
            </button>
          </div>
          <div className="workspace-navigation">
            <button
              className="button secondary"
              disabled={session.position === 0 || busy}
              onClick={() => void move(session.position - 1)}
            >
              <ChevronLeft size={15} />
              Previous Segment
            </button>
            <span className="muted">
              {session.position + 1} / {session.groups.length}
            </span>
            <button
              className="button secondary"
              disabled={session.position === session.groups.length - 1 || busy}
              onClick={() => void move(session.position + 1)}
            >
              Next Segment
              <ChevronRight size={15} />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
