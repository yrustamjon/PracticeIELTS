import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  Target,
  FileText,
  Clock,
  BookOpen,
  ChevronRight,
  Headphones,
  ArrowRight,
  UserRound,
} from "lucide-react";
import {
  api,
  type Progress,
  type CheckedResponse,
  type Material,
} from "../services/api";
import { useAuth } from "../stores/auth";
import {
  PageTitle,
  Empty,
  Loading,
  ErrorState,
  SectionTitle,
} from "../components/ui";
import { Activity } from "./Dashboard";
import { ComparisonView } from "./Practice";
import { AudioPlayer } from "../components/AudioPlayer";
export function ProgressPage() {
  const q = useQuery({
    queryKey: ["progress"],
    queryFn: () => api<Progress>("progress/"),
  });
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorState error={q.error} />;
  const p = q.data;
  return (
    <>
      <PageTitle
        eyebrow="YOUR LEARNING JOURNEY"
        title="Small steps. Visible progress."
        description="Every time you practise, you build something that lasts."
      />
      <div className="metric-grid">
        {[
          [
            Target,
            p.accuracy === null ? "—" : `${p.accuracy}%`,
            "Dictation accuracy",
          ],
          [FileText, p.sentences_completed, "Segments checked"],
          [BookOpen, p.exercises_completed, "Exercises completed"],
          [Clock, p.attempts, "Practice attempts"],
        ].map(([Icon, value, label], i) => {
          const Component = Icon as typeof Target;
          return (
            <div className="panel metric-card" key={i}>
              <Component size={25} />
              <strong>{value as string | number}</strong>
              <span>{label as string}</span>
            </div>
          );
        })}
      </div>
      <section className="panel activity-panel">
        <SectionTitle title="A week of listening" />
        <p className="muted">Checked answers over the last seven days.</p>
        <Activity data={p} />
      </section>
      {p.attempts === 0 && (
        <section className="panel">
          <Empty
            title="Your story is still being written"
            description="Complete your first dictation and your progress will start to take shape."
            action={
              <Link className="button primary" to="/dictation">
                Find a practice
                <ArrowRight size={17} />
              </Link>
            }
          />
        </section>
      )}
    </>
  );
}
export function Mistakes() {
  const q = useQuery({
    queryKey: ["responses", "mistakes"],
    queryFn: () =>
      api<{ results: CheckedResponse[] }>("responses/?mistakes=true"),
  });
  return (
    <>
      <PageTitle
        eyebrow="LISTENING / MISTAKE REVIEW"
        title="Turn a little friction into progress"
        description="Revisit checked answers that need another listen."
      />
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} />
      ) : q.data.results.length ? (
        <div className="review-list">
          {q.data.results.map((r) => (
            <section className="panel review-card" key={r.id}>
              <div className="section-title">
                <div>
                  <span className="small-label muted">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                  <h3>{r.title}</h3>
                </div>
                <Link className="text-link" to={`/practice/${r.session}`}>
                  Return to practice
                  <ChevronRight size={16} />
                </Link>
              </div>
              <p className="muted">Your answer: {r.answer || "(No answer)"}</p>
              <ComparisonView result={r.result} />
            </section>
          ))}
        </div>
      ) : (
        <section className="panel">
          <Empty
            title="A clear page, a fresh start"
            description="When a checked answer has mistakes, you can revisit it here. Keep listening and keep learning."
            action={
              <Link className="button primary" to="/dictation">
                Start Dictation
                <Headphones size={17} />
              </Link>
            }
          />
        </section>
      )}
    </>
  );
}
export function Transcript() {
  const { id } = useParams();
  const q = useQuery({
    queryKey: ["material", id],
    queryFn: () => api<Material>(`materials/${id}/`),
  });
  const [index, setIndex] = useState(0);
  const [playRequest, setPlayRequest] = useState(0);
  const [active, setActive] = useState(-1);
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorState error={q.error} />;
  const m = q.data;
  return (
    <>
      <div className="breadcrumbs">
        <Link to={`/library/${id}`}>{m.title}</Link>
        <ChevronRight size={13} />
        <span>Transcript Study</span>
      </div>
      <PageTitle
        eyebrow="LISTENING / TRANSCRIPT STUDY"
        title={m.title}
        description="Read between the sounds. Replay any sentence to listen a little closer."
      />
      {m.audio ? (
        <div className="panel transcript-panel">
          <AudioPlayer
            url={m.audio.stream_url}
            start={m.segments[index]?.start_ms || 0}
            playRequest={playRequest}
            onTime={(ms) =>
              setActive(
                m.segments.findIndex((s) => ms >= s.start_ms && ms < s.end_ms),
              )
            }
          />
          <div className="transcript-list">
            {m.segments.map((s, i) => (
              <button
                key={i}
                className={active === i ? "active" : ""}
                onClick={() => {
                  setIndex(i);
                  setPlayRequest((n) => n + 1);
                }}
              >
                <span>{String(i + 1).padStart(2, "0")}</span>
                <div>
                  {s.speaker && <small>{s.speaker}</small>}
                  <p>{s.text}</p>
                </div>
                <span className="timestamp">
                  {(s.start_ms / 1000).toFixed(1)}s
                </span>
              </button>
            ))}
          </div>
          <p className="muted transcript-footnote">
            Click a sentence to seek to its timestamp. Saved vocabulary notes
            are planned for a later milestone.
          </p>
        </div>
      ) : (
        <Empty
          title="Transcript not ready"
          description="This material needs audio and reviewed segments before study can begin."
        />
      )}
    </>
  );
}
export function Profile() {
  const user = useAuth((s) => s.user)!;
  return (
    <>
      <PageTitle
        title="Your learning profile"
        description="A space that belongs to you."
      />
      <section className="panel profile-card">
        <span className="icon-orbit">
          <UserRound size={35} />
        </span>
        <h2>{user.username}</h2>
        <p>{user.email || "No email provided"}</p>
        <span className="pill">{user.role}</span>
        <p className="muted">
          Your practice sessions and checked answers are saved to this account.
        </p>
        <Link to="/progress" className="button secondary">
          View my progress
          <ArrowRight size={17} />
        </Link>
      </section>
    </>
  );
}
export function MockTests() {
  return (
    <>
      <PageTitle
        eyebrow="LISTENING / MOCK TESTS"
        title="Make practice feel like exam day"
        description="A dedicated space for full IELTS-style listening tests."
      />
      <section className="panel">
        <Empty
          title="Mock tests are coming in a later milestone"
          description="Timed attempts, exam playback restrictions and question scoring are planned. In the meantime, build your listening confidence with dictation."
          action={
            <Link className="button primary" to="/dictation">
              Practise Dictation
              <Headphones size={17} />
            </Link>
          }
        />
      </section>
    </>
  );
}

export function FutureModule() {
  const { module } = useParams();
  const user = useAuth((s) => s.user);
  const title =
    (
      {
        reading: "Reading",
        writing: "Writing",
        speaking: "Speaking",
      } as Record<string, string>
    )[module || ""] || "Future module";
  return (
    <>
      <PageTitle
        eyebrow="FUTURE MODULE"
        title={title}
        description="Listening comes first. This module will become available in a later release."
      />
      <section className="panel">
        <Empty
          title={`${title} is planned`}
          description={
            user?.can_edit
              ? "Content creation for this module is not available yet. Use Content Studio for Listening mock materials."
              : "This module is not open for practice or content uploads yet. Start with Listening."
          }
          action={
            <Link
              className="button primary"
              to={user?.can_edit ? "/admin" : "/library"}
            >
              Open Listening
              <Headphones size={17} />
            </Link>
          }
        />
      </section>
    </>
  );
}
