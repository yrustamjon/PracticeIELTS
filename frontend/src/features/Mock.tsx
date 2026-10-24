import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useBlocker, useNavigate, useParams } from "react-router-dom";
import {
  Clock,
  FileText,
  ChevronLeft,
  ChevronRight,
  Check,
  Play,
  Volume2,
  Headphones,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import {
  api,
  apiBlob,
  post,
  type MockAttempt,
  type Material,
  type ExamQuestion,
} from "../services/api";
import {
  Loading,
  ErrorState,
  Empty,
  PageTitle,
  BookCover,
} from "../components/ui";
import { PrivateImage } from "../components/PrivateImage";

export function MockSelection({
  materialId,
  available,
}: {
  materialId: number;
  available: boolean;
}) {
  const [timing, setTiming] = useState<"timed" | "untimed">("timed");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const navigate = useNavigate();
  const attempts = useQuery({
    queryKey: ["mock-attempts"],
    queryFn: () => api<{ results: MockAttempt[] }>("mock-attempts/"),
  });
  const active = attempts.data?.results.find(
    (a) => a.material === materialId && !a.submitted_at,
  );
  async function start() {
    setBusy(true);
    setError(undefined);
    try {
      let restart = false;
      if (active && active.timing !== timing) {
        if (
          !window.confirm(
            `An active ${active.timing} mock exists. Submit it and start a new ${timing} attempt?`,
          )
        ) {
          navigate(`/mock/${active.id}`);
          return;
        }
        restart = true;
      }
      const attempt = await post<MockAttempt>("mock-attempts/", {
        material: materialId,
        timing,
        restart,
      });
      navigate(`/mock/${attempt.id}`);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  if (!available)
    return (
      <div className="notice-box">
        This material has no published exam questions yet. Its Practice modes
        are available; the teacher can add typed questions or a PDF to enable
        Mock.
      </div>
    );
  return (
    <>
      <p className="muted mode-explanation">
        Use the same recording and exam questions. Choose a timed attempt or
        work through the mock without a time limit.
      </p>
      <div className="difficulty-options exam-timing-options">
        {[
          [
            "timed",
            "Real Exam · Timed",
            "A server-enforced countdown. Answers are submitted when the time ends.",
          ],
          [
            "untimed",
            "Mock · No time limit",
            "Take as long as you need. Submit your answers when you are ready.",
          ],
        ].map(([key, title, text]) => (
          <label className={timing === key ? "selected" : ""} key={key}>
            <input
              type="radio"
              name="exam-timing"
              checked={timing === key}
              onChange={() => setTiming(key as "timed" | "untimed")}
            />
            <span>
              <strong>{title}</strong>
              <small>{text}</small>
            </span>
          </label>
        ))}
      </div>
      <div className="notice-box">
        Audio plays once per attempt. Hints, answer keys and the transcript open
        after submission.
      </div>
      {active && (
        <p className="resume-exam">
          <Link className="text-link" to={`/mock/${active.id}`}>
            Resume active {active.timing} mock
            <ChevronRight size={15} />
          </Link>
        </p>
      )}
      {error != null && <ErrorState error={error} />}
      <button
        className="button primary"
        disabled={busy}
        onClick={() => void start()}
      >
        <ShieldCheck size={17} />
        {busy
          ? "Preparing…"
          : active && active.timing === timing
            ? "Resume Mock"
            : "Start Mock"}
        <ChevronRight size={17} />
      </button>
    </>
  );
}

export function MockLibrary() {
  const materials = useQuery({
    queryKey: ["mock-materials"],
    queryFn: () => api<{ results: Material[] }>("materials/"),
  });
  const attempts = useQuery({
    queryKey: ["mock-attempts"],
    queryFn: () => api<{ results: MockAttempt[] }>("mock-attempts/"),
  });
  return (
    <>
      <PageTitle
        eyebrow="LISTENING / MOCK TESTS"
        title="Bring your practice to exam day"
        description="Real question formats. Timed or untimed. One recording, one focused attempt."
      />
      {attempts.data?.results.some((a) => !a.submitted_at) && (
        <section className="panel form-panel">
          <h2>Continue your mock</h2>
          {attempts.data.results
            .filter((a) => !a.submitted_at)
            .map((a) => (
              <Link
                className="exam-history-row"
                key={a.id}
                to={`/mock/${a.id}`}
              >
                <FileText size={20} />
                <span>
                  <strong>{a.title}</strong>
                  <small>
                    {a.timing === "untimed" ? "No time limit" : "Timed attempt"}{" "}
                    ·{" "}
                    {
                      Object.values(a.answers).filter((x) =>
                        Array.isArray(x) ? x.length : x,
                      ).length
                    }{" "}
                    / {a.total} answered
                  </small>
                </span>
                <ChevronRight size={18} />
              </Link>
            ))}
        </section>
      )}
      {materials.isPending ? (
        <Loading />
      ) : materials.error ? (
        <ErrorState error={materials.error} />
      ) : materials.data.results.filter((m) => m.mock_available).length ? (
        <div className="materials-grid">
          {materials.data.results
            .filter((m) => m.mock_available)
            .map((m) => (
              <Link
                className="panel material-card"
                key={m.id}
                to={`/library/${m.id}?mode=mock`}
              >
                <div className="material-art">
                  <BookCover small />
                  <span className="pill">LISTENING MOCK</span>
                </div>
                <div className="material-card-info">
                  <span className="small-label muted">{m.category_name}</span>
                  <h3>{m.title}</h3>
                  <p>{m.question_count} questions · timed and untimed</p>
                  <div className="material-bottom">
                    <span>Choose a mode</span>
                    <ChevronRight size={16} />
                  </div>
                </div>
              </Link>
            ))}
        </div>
      ) : (
        <section className="panel">
          <Empty
            title="Your next mock is being prepared"
            description="Published materials with exam questions will appear here. Teachers can upload a PDF question paper or build the questions in Content Studio."
            action={
              <Link className="button primary" to="/dictation">
                Practise listening
                <Headphones size={17} />
              </Link>
            }
          />
        </section>
      )}
      {attempts.data?.results.some((a) => a.submitted_at) && (
        <section className="panel form-panel exam-history">
          <h2>Mock history</h2>
          {attempts.data.results
            .filter((a) => a.submitted_at)
            .map((a) => (
              <Link
                className="exam-history-row"
                key={a.id}
                to={`/mock/${a.id}/results`}
              >
                <Check size={19} />
                <span>
                  <strong>{a.title}</strong>
                  <small>
                    {a.timing === "untimed" ? "Untimed" : "Timed"} ·{" "}
                    {new Date(a.submitted_at!).toLocaleDateString()}
                  </small>
                </span>
                <strong>
                  {a.score}/{a.total}
                </strong>
                <ChevronRight size={17} />
              </Link>
            ))}
        </section>
      )}
    </>
  );
}

export function MockPage() {
  const { id } = useParams();
  const q = useQuery({
    queryKey: ["mock-attempt", id],
    queryFn: () => api<MockAttempt>(`mock-attempts/${id}/`),
  });
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorState error={q.error} />;
  return <ExamWorkspace key={id} initial={q.data} />;
}

function ExamAudio({
  attempt,
  onPlaying,
}: {
  attempt: MockAttempt;
  onPlaying: (playing: boolean) => void;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const object = useRef("");
  const [started, setStarted] = useState(attempt.audio_started);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>();
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [volume, setVolume] = useState(1);
  useEffect(
    () => () => {
      audio.current?.pause();
      if (object.current) URL.revokeObjectURL(object.current);
      onPlaying(false);
    },
    [],
  );
  async function play() {
    setLoading(true);
    setError(undefined);
    try {
      const ticket = await post<{ url: string; ticket: string }>(
        `mock-attempts/${attempt.id}/start-audio/`,
      );
      setStarted(true);
      const blob = await apiBlob(ticket.url.replace("/api/v1/", ""), {
        headers: { "X-Exam-Audio": ticket.ticket },
      });
      object.current = URL.createObjectURL(blob);
      if (audio.current) {
        audio.current.src = object.current;
        audio.current.volume = volume;
        await audio.current.play();
      }
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="exam-audio">
      <audio
        ref={audio}
        preload="none"
        onPlay={() => {
          setPlaying(true);
          onPlaying(true);
        }}
        onPause={() => {
          setPlaying(false);
          onPlaying(false);
        }}
        onEnded={() => {
          setEnded(true);
          setPlaying(false);
          onPlaying(false);
        }}
      />
      <div>
        <span className="eyebrow">EXAM RECORDING · ONE PLAY</span>
        <h3>
          {loading
            ? "Preparing audio…"
            : playing
              ? "Listening in progress"
              : ended
                ? "Recording finished"
                : started
                  ? "Audio was started for this attempt"
                  : "Ready when you are"}
        </h3>
        <p>
          {started
            ? "Keep this page open while listening. Playback cannot be restarted for this attempt."
            : "Start once when you are ready. Question navigation keeps the recording playing."}
        </p>
      </div>
      <div className="exam-audio-actions">
        <button
          className="button primary"
          disabled={started || loading}
          onClick={() => void play()}
        >
          <Play size={16} />
          {loading ? "Loading…" : "Start audio once"}
        </button>
        <label>
          <Volume2 size={18} />
          <input
            aria-label="Exam audio volume"
            type="range"
            min="0"
            max="1"
            step=".05"
            value={volume}
            onChange={(e) => {
              setVolume(Number(e.target.value));
              if (audio.current) audio.current.volume = Number(e.target.value);
            }}
          />
        </label>
      </div>
      {error != null && <ErrorState error={error} />}
    </section>
  );
}

function ExamWorkspace({ initial }: { initial: MockAttempt }) {
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [answers, setAnswers] = useState(initial.answers);
  const [part, setPart] = useState(
    Math.min(...initial.questions.map((q) => q.part)),
  );
  const [page, setPage] = useState(initial.document_pages[0] || 1);
  const [save, setSave] = useState("Saved");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [remaining, setRemaining] = useState(
    initial.deadline
      ? Math.max(
          0,
          Date.parse(initial.deadline) - Date.parse(initial.server_now),
        )
      : null,
  );
  const finished = useRef(!!initial.submitted_at);
  const latest = useRef(answers);
  latest.current = answers;
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const submitting = useRef(false);
  const baseTime = useRef(performance.now());
  const baseRemaining = useRef(remaining);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !finished.current && currentLocation.pathname !== nextLocation.pathname,
  );
  function remember(a: MockAttempt) {
    cache.setQueryData(["mock-attempt", String(initial.id)], a);
    if (a.submitted_at) finished.current = true;
    void cache.invalidateQueries({ queryKey: ["mock-attempts"] });
    return a;
  }
  function persist(snapshot: Record<string, string | string[]>) {
    setSave("Saving…");
    const pending = queue.current
      .catch(() => {})
      .then(() =>
        api<MockAttempt>(`mock-attempts/${initial.id}/`, {
          method: "PATCH",
          body: JSON.stringify({ answers: snapshot }),
        }),
      )
      .then((a) => {
        remember(a);
        if (JSON.stringify(latest.current) === JSON.stringify(snapshot))
          setSave("Saved");
        return a;
      });
    queue.current = pending;
    return pending;
  }
  async function submit(auto = false) {
    if (submitting.current) return;
    if (
      !auto &&
      !window.confirm(
        "Submit this mock? Your answers become read-only and the review will open.",
      )
    )
      return;
    submitting.current = true;
    setBusy(true);
    setError(undefined);
    try {
      try {
        await persist(latest.current);
      } catch (e) {
        const current = await api<MockAttempt>(`mock-attempts/${initial.id}/`);
        if (!current.submitted_at) throw e;
        remember(current);
      }
      const result = remember(
        await post<MockAttempt>(`mock-attempts/${initial.id}/submit/`),
      );
      finished.current = true;
      void cache.invalidateQueries({ queryKey: ["progress"] });
      navigate(`/mock/${result.id}/results`);
    } catch (e) {
      setError(e);
      submitting.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    if (initial.submitted_at) {
      finished.current = true;
      navigate(`/mock/${initial.id}/results`, { replace: true });
    }
  }, [initial.submitted_at]);
  useEffect(() => {
    if (finished.current) return;
    const timer = setTimeout(
      () =>
        void persist(answers).catch((e) => {
          setSave("Not saved");
          setError(e);
        }),
      600,
    );
    return () => clearTimeout(timer);
  }, [answers]);
  useEffect(() => {
    if (baseRemaining.current === null || finished.current) return;
    const timer = setInterval(() => {
      const left = Math.max(
        0,
        baseRemaining.current! - (performance.now() - baseTime.current),
      );
      setRemaining(left);
      if (left <= 0) {
        clearInterval(timer);
        void submit(true);
      }
    }, 500);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (
      audioPlaying &&
      !window.confirm(
        "Leaving stops the exam audio and it cannot be replayed for this attempt. Leave anyway?",
      )
    ) {
      blocker.reset();
      return;
    }
    void persist(latest.current)
      .then(() => blocker.proceed())
      .catch(async (e) => {
        try {
          const a = remember(
            await api<MockAttempt>(`mock-attempts/${initial.id}/`),
          );
          if (a.submitted_at) {
            finished.current = true;
            blocker.proceed();
            return;
          }
        } catch {}
        setError(e);
        blocker.reset();
      });
  }, [blocker]);
  useEffect(() => {
    function warn(e: BeforeUnloadEvent) {
      if (!finished.current && (save !== "Saved" || audioPlaying)) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [save, audioPlaying]);
  function answer(number: number, value: string | string[]) {
    setAnswers((a) => ({ ...a, [number]: value }));
    setSave("Unsaved");
  }
  const parts = [...new Set(initial.questions.map((q) => q.part))].sort();
  const questions = initial.questions.filter((q) => q.part === part);
  const answered = initial.questions.filter((q) => {
    const value = answers[String(q.number)];
    return Array.isArray(value) ? value.length > 0 : !!value?.trim();
  }).length;
  return (
    <>
      <PageTitle
        eyebrow="LISTENING / MOCK"
        title={initial.title}
        description="Focus on the recording and questions. Practice and the transcript unlock after submission."
        action={
          <div className="exam-header-actions">
            {remaining === null ? (
              <span className="difficulty-badge">
                <Clock size={16} />
                No time limit
              </span>
            ) : (
              <span
                className={`exam-countdown ${remaining < 60000 ? "urgent" : ""}`}
                role="timer"
              >
                <Clock size={18} />
                {Math.floor(remaining / 60000)}:
                {String(Math.floor(remaining / 1000) % 60).padStart(2, "0")}
              </span>
            )}
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void submit()}
            >
              <Check size={17} />
              {busy ? "Submitting…" : "Submit Mock"}
            </button>
          </div>
        }
      />
      <div className="exam-rules">
        <ShieldCheck size={18} />
        <span>
          {remaining === null
            ? "Untimed mock — submit whenever you are ready."
            : "Timed exam — the server enforces your deadline."}{" "}
          No transcript, hints or answer keys before submission.
        </span>
        <span className="save-status">{save}</span>
      </div>
      {error != null && <ErrorState error={error} />}
      <ExamAudio attempt={initial} onPlaying={setAudioPlaying} />
      <div className="exam-part-tabs">
        {parts.map((p) => (
          <button
            className={part === p ? "active" : ""}
            key={p}
            onClick={() => setPart(p)}
          >
            Part {p}
            <small>
              {initial.questions.filter((q) => q.part === p).length} questions
            </small>
          </button>
        ))}
        <span>
          {answered} / {initial.total} answered
        </span>
      </div>
      <div
        className={`real-exam-grid ${initial.document_pages.length ? "with-pdf" : ""}`}
      >
        {initial.document_pages.length > 0 && (
          <aside className="panel exam-paper">
            <div className="pdf-controls">
              <button
                className="button secondary"
                disabled={initial.document_pages.indexOf(page) === 0}
                onClick={() =>
                  setPage(
                    initial.document_pages[
                      initial.document_pages.indexOf(page) - 1
                    ],
                  )
                }
              >
                <ChevronLeft size={16} />
              </button>
              <span>Question paper · page {page}</span>
              <button
                className="button secondary"
                disabled={
                  initial.document_pages.indexOf(page) ===
                  initial.document_pages.length - 1
                }
                onClick={() =>
                  setPage(
                    initial.document_pages[
                      initial.document_pages.indexOf(page) + 1
                    ],
                  )
                }
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <PrivateImage
              path={`mock-attempts/${initial.id}/document-pages/${page}/`}
              alt={`Question paper page ${page}`}
            />
          </aside>
        )}
        <section className="panel exam-questions">
          <div className="workspace-heading">
            <h2>Part {part}</h2>
            <span className="pill">
              {remaining === null ? "Untimed" : "Timed"}
            </span>
          </div>
          {questions.map((q) => (
            <QuestionControl
              key={q.number}
              question={q}
              value={answers[String(q.number)] || ""}
              disabled={busy}
              onChange={(value) => answer(q.number, value)}
            />
          ))}
          <div className="workspace-navigation">
            <button
              className="button secondary"
              disabled={parts.indexOf(part) === 0}
              onClick={() => setPart(parts[parts.indexOf(part) - 1])}
            >
              <ChevronLeft size={16} />
              Previous part
            </button>
            {parts.indexOf(part) === parts.length - 1 ? (
              <button
                className="button primary"
                disabled={busy}
                onClick={() => void submit()}
              >
                Submit Mock
                <Check size={17} />
              </button>
            ) : (
              <button
                className="button primary"
                onClick={() => setPart(parts[parts.indexOf(part) + 1])}
              >
                Next part
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function QuestionControl({
  question: q,
  value,
  onChange,
  disabled,
}: {
  question: ExamQuestion;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  disabled: boolean;
}) {
  const multiple = q.type === "multiple_choice" && (q.selections || 1) > 1;
  const selected = Array.isArray(value) ? value : [];
  return (
    <article className="exam-question-control">
      <div className="exam-question-number">{q.number}</div>
      <div className="exam-question-body">
        <span className="question-kind">{q.type.replaceAll("_", " ")}</span>
        {q.instructions && (
          <p className="exam-instructions">{q.instructions}</p>
        )}
        {typeof q.context.body === "string" && q.context.body && (
          <p className="question-context">{q.context.body}</p>
        )}
        {Array.isArray(q.context.table) && (
          <div className="question-table">
            <table>
              <tbody>
                {(q.context.table as unknown[])
                  .filter(Array.isArray)
                  .map((row, i) => (
                    <tr key={i}>
                      {(row as unknown[]).map((cell, j) =>
                        i === 0 ? (
                          <th key={j}>{String(cell)}</th>
                        ) : (
                          <td key={j}>{String(cell)}</td>
                        ),
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="exam-prompt" id={`question-${q.number}`}>
          {q.prompt}
        </p>
        {q.type === "multiple_choice" ? (
          <div className="exam-options">
            {q.options.map((o) => (
              <label key={o.key}>
                <input
                  type={multiple ? "checkbox" : "radio"}
                  name={`question-${q.number}`}
                  value={o.key}
                  checked={
                    multiple ? selected.includes(o.key) : value === o.key
                  }
                  disabled={
                    disabled ||
                    (multiple &&
                      !selected.includes(o.key) &&
                      selected.length >= (q.selections || 1))
                  }
                  onChange={(e) =>
                    onChange(
                      multiple
                        ? e.target.checked
                          ? [...selected, o.key]
                          : selected.filter((v) => v !== o.key)
                        : o.key,
                    )
                  }
                />
                <span>
                  <strong>{o.key}.</strong> {o.text}
                </span>
              </label>
            ))}
          </div>
        ) : q.type === "matching" ? (
          <select
            aria-label={`Answer ${q.number}`}
            disabled={disabled}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">Select a match</option>
            {q.options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.key}. {o.text}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            aria-label={`Answer ${q.number}`}
            aria-describedby={`question-${q.number}`}
            value={typeof value === "string" ? value : ""}
            disabled={disabled}
            maxLength={1000}
            placeholder="Your answer"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </div>
    </article>
  );
}

export function MockResults() {
  const { id } = useParams();
  const q = useQuery({
    queryKey: ["mock-results", id],
    queryFn: () => api<MockAttempt>(`mock-attempts/${id}/`),
  });
  const navigate = useNavigate();
  useEffect(() => {
    if (q.data && !q.data.submitted_at)
      navigate(`/mock/${id}`, { replace: true });
  }, [q.data]);
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorState error={q.error} />;
  const a = q.data;
  if (!a.submitted_at) return null;
  return (
    <>
      <PageTitle
        eyebrow="LISTENING / MOCK RESULTS"
        title="A clearer picture of your listening"
        description={a.title}
      />
      <section className="panel exam-results">
        <div className="exam-result-heading">
          <div className="exam-score">
            {a.score}
            <small> / {a.total}</small>
          </div>
          <div>
            <h2>
              {Math.round(((a.score || 0) / Math.max(a.total, 1)) * 100)}%
              correct
            </h2>
            <p>
              {a.timing === "untimed" ? "Untimed mock" : "Timed exam"} · Raw
              score from your published answer key.
            </p>
          </div>
        </div>
        <div className="exam-result-list">
          {a.results?.map((r) => {
            const question = a.questions.find((q) => q.number === r.number);
            return (
              <div
                className={`exam-result-row ${r.correct ? "correct" : "incorrect"}`}
                key={r.number}
              >
                <span>{r.number}</span>
                <div>
                  <h3>{question?.prompt}</h3>
                  <p>
                    Your answer:{" "}
                    {Array.isArray(r.answer)
                      ? r.answer.join(", ")
                      : r.answer || "No answer"}
                  </p>
                  <small>
                    Accepted:{" "}
                    {r.accepted_answers
                      .map((v) => (Array.isArray(v) ? v.join(" + ") : v))
                      .join(" / ")}
                  </small>
                </div>
                <strong>{r.correct ? "Correct" : "Review"}</strong>
              </div>
            );
          })}
        </div>
        <div className="editor-actions">
          <Link
            className="button primary"
            to={`/library/${a.material}?mode=practice`}
          >
            <Headphones size={17} />
            Work through it in Practice
          </Link>
          <Link className="button secondary" to={`/transcript/${a.material}`}>
            <FileText size={17} />
            Study the transcript
          </Link>
          <Link className="text-link" to="/mock-tests">
            All mocks
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </>
  );
}
