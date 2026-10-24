import { createPortal } from "react-dom";
import { HtmlQuestionPaper } from "../components/HtmlQuestionPaper";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
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
  type PdfField,
} from "../services/api";
import {
  Loading,
  ErrorState,
  Empty,
  PageTitle,
  BookCover,
} from "../components/ui";
import { hasAnswer } from "../components/ExamQuestion";
import { QuestionPaper } from "../components/QuestionPaper";

const PdfQuestionPage = lazy(() => import("../components/PdfQuestionPage"));

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
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
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
        onTimeUpdate={(e) => setElapsed(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
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
        <span className="exam-recording-time">
          {Math.floor(elapsed / 60)}:
          {String(Math.floor(elapsed) % 60).padStart(2, "0")} /{" "}
          {Math.floor(duration / 60)}:
          {String(Math.floor(duration) % 60).padStart(2, "0")}
        </span>
        <progress
          aria-label="Recording progress"
          max={duration || 1}
          value={elapsed}
        />
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
  const [audioSlot, setAudioSlot] = useState<HTMLElement | null>(null);
  const [toolbarSlot, setToolbarSlot] = useState<HTMLElement | null>(null);
  const [navigationSlot, setNavigationSlot] = useState<HTMLElement | null>(
    null,
  );
  useEffect(() => {
    setAudioSlot(document.getElementById("exam-audio-slot"));
    setToolbarSlot(document.getElementById("exam-controls-slot"));
    setNavigationSlot(document.getElementById("exam-navigation-slot"));
  }, []);
  const [part, setPart] = useState(
    Math.min(...initial.questions.map((q) => q.part)),
  );
  const [pdfLayout, setPdfLayout] = useState<"stacked" | "columns">("stacked");
  const [pdfPage, setPdfPage] = useState(initial.document_pages[0] || 1);
  const [activeQuestion, setActiveQuestion] = useState<number | null>(null);
  useEffect(() => {
    if (activeQuestion === null) return;
    const target = document.getElementById(`exam-question-${activeQuestion}`);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    target
      ?.querySelector<HTMLElement>("input, select")
      ?.focus({ preventScroll: true });
  }, [part, activeQuestion, pdfPage]);
  function jump(number: number) {
    const question = initial.questions.find((q) => q.number === number);
    if (question) {
      setPart(question.part);
      const field = question.context.pdf_field as PdfField | undefined;
      if (field) setPdfPage(field.page);
      setActiveQuestion(number);
      if (question.part === part) {
        const target = document.getElementById(`exam-question-${number}`);
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
        target
          ?.querySelector<HTMLElement>("input, select")
          ?.focus({ preventScroll: true });
      }
    }
  }
  function goPart(number: number) {
    setPart(number);
    document.querySelector(".exam-main")?.scrollTo({ top: 0 });
    const q = initial.questions.find((q) => q.part === number);
    const field = q?.context.pdf_field as PdfField | undefined;
    if (field) setPdfPage(field.page);
  }
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
    return hasAnswer(value);
  }).length;
  const visiblePdfPages = initial.document_pages.filter((pageNumber) => {
    if (parts.length === 1) return true;
    const onPage = initial.questions.filter(
      (q) => (q.context.pdf_field as PdfField | undefined)?.page === pageNumber,
    );
    if (onPage.length) return onPage.some((q) => q.part === part);
    // Retain approved context-only pages with the preceding section (or next
    // section for an introductory page); never fetch an unapproved page.
    const located = initial.questions
      .filter((q) => q.context.pdf_field)
      .map((q) => ({
        part: q.part,
        page: (q.context.pdf_field as PdfField).page,
      }))
      .sort((a, b) => a.page - b.page);
    const owner =
      located.filter((q) => q.page < pageNumber).at(-1) ||
      located.find((q) => q.page > pageNumber);
    return !owner || owner.part === part;
  });
  const headerControls = (
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
  );
  const questionNavigation = (
    <nav className="exam-question-nav" aria-label="Question navigation">
      <div className="question-nav-summary">
        <strong>
          {answered} of {initial.total} answered
        </strong>
        <span>
          <span className="save-status">{save}</span>
        </span>
      </div>
      <div className="question-nav-parts">
        {parts.map((p) => (
          <div
            className={`question-nav-part ${part === p ? "active" : ""}`}
            key={p}
          >
            <button
              className="question-nav-label"
              onClick={() => goPart(p)}
              aria-current={part === p ? "step" : undefined}
            >
              Part {p}
            </button>
            {part !== p && (
              <small>
                {initial.questions.filter((q) => q.part === p).length} questions
              </small>
            )}
            <div>
              {initial.questions
                .filter((q) => q.part === p)
                .map((q) => {
                  const done = hasAnswer(answers[String(q.number)]);

                  return (
                    <button
                      key={q.number}
                      className={`question-jump ${done ? "answered" : ""}`}
                      aria-label={`Go to question ${q.number}${done ? ", answered" : ", unanswered"}`}
                      aria-current={
                        activeQuestion === q.number ? "true" : undefined
                      }
                      onClick={() => jump(q.number)}
                    >
                      {q.number}
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
  return (
    <>
      <div className="sr-only">
        <h1>{initial.title}</h1>
      </div>
      {toolbarSlot ? createPortal(headerControls, toolbarSlot) : headerControls}
      {error != null && <ErrorState error={error} />}
      {audioSlot ? (
        createPortal(
          <ExamAudio attempt={initial} onPlaying={setAudioPlaying} />,
          audioSlot,
        )
      ) : (
        <ExamAudio attempt={initial} onPlaying={setAudioPlaying} />
      )}
      <div className="exam-part-tabs">
        {parts.map((p) => (
          <button
            className={part === p ? "active" : ""}
            key={p}
            onClick={() => goPart(p)}
          >
            Part {p}
            <small>
              {initial.questions.filter((q) => q.part === p).length}{" "}
              {initial.questions.filter((q) => q.part === p).length === 1
                ? "question"
                : "questions"}
            </small>
          </button>
        ))}
        <span>
          {answered} / {initial.total} answered
        </span>
      </div>
      <div className="real-exam-grid">
        <section className="panel exam-questions">
          <div className="workspace-heading">
            <div>
              <h2>Part {part}</h2>
              <p className="muted">
                Listen and answer questions {questions[0]?.number}–
                {questions.at(-1)?.number}.
              </p>
            </div>
            <span className="pill">
              {remaining === null ? "Untimed" : "Timed"}
            </span>
          </div>
          {initial.presentation === "html" ? (
            <HtmlQuestionPaper
              sections={(initial.sections || []).filter((s) => s.part === part)}
              questions={initial.questions}
              answers={answers}
              onAnswer={answer}
              disabled={busy}
            />
          ) : initial.presentation === "pdf" ? (
            <div className="exam-original-paper">
              <div className="pdf-pages-toolbar">
                <span>
                  {visiblePdfPages.length} question{" "}
                  {visiblePdfPages.length === 1 ? "page" : "pages"} · Part{" "}
                  {part}
                </span>
                <div role="group" aria-label="PDF page layout">
                  <button
                    className={pdfLayout === "stacked" ? "active" : ""}
                    aria-pressed={pdfLayout === "stacked"}
                    onClick={() => setPdfLayout("stacked")}
                  >
                    Stacked
                  </button>
                  <button
                    className={pdfLayout === "columns" ? "active" : ""}
                    aria-pressed={pdfLayout === "columns"}
                    onClick={() => setPdfLayout("columns")}
                  >
                    Side by side
                  </button>
                </div>
              </div>
              <div
                className={`pdf-page-stack ${pdfLayout === "columns" ? "two-columns" : ""}`}
              >
                {visiblePdfPages.map((pageNumber) => (
                  <Suspense key={pageNumber} fallback={<Loading />}>
                    <PdfQuestionPage
                      path={`mock-attempts/${initial.id}/pdf-pages/${pageNumber}/`}
                      pageNumber={pageNumber}
                      questions={initial.questions}
                      answers={answers}
                      disabled={busy}
                      onAnswer={answer}
                      lazy
                    />
                  </Suspense>
                ))}
              </div>
            </div>
          ) : (
            <>
              <QuestionPaper
                questions={questions}
                answers={answers}
                disabled={busy}
                flags={[]}
                onAnswer={answer}
              />
            </>
          )}
          <div className="workspace-navigation">
            <button
              className="button secondary"
              disabled={parts.indexOf(part) === 0}
              onClick={() => goPart(parts[parts.indexOf(part) - 1])}
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
                onClick={() => goPart(parts[parts.indexOf(part) + 1])}
              >
                Next part
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </section>
      </div>
      {navigationSlot
        ? createPortal(questionNavigation, navigationSlot)
        : questionNavigation}
    </>
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
