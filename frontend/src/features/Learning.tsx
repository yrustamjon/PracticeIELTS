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
  Mail,
  ShieldCheck,
  BookOpenCheck,
} from "lucide-react";
import {
  api,
  type Progress,
  type CheckedResponse,
  type Material,
} from "../services/api";
import { useAuth } from "../stores/auth";
import { useWorkspace } from "../stores/workspace";
import {
  PageTitle,
  Empty,
  Loading,
  ErrorState,
  SectionTitle,
} from "../components/ui";
import { AccountSettings, AdminAvatar } from "./AccountSettings";
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
  const { admin } = useWorkspace();
  const user = useAuth((s) => s.user)!;
  return (
    <>
      <PageTitle
        title={admin ? "Administrator profile" : "Your learning profile"}
        description={admin ? "Manage your account and workspace settings." : "A space that belongs to you."}
      />
      <div className="account-settings self-profile-workspace">
        <section className="panel form-panel admin-profile-card" aria-labelledby="self-profile-name">
          <div className="admin-profile-banner" aria-hidden="true" />
          <div className="admin-profile-body">
            <div className="admin-profile-identity"><AdminAvatar name={user.username} large /><div className="admin-profile-name"><span className="admin-eyebrow">MY ACCOUNT</span><h2 id="self-profile-name">{user.username}</h2><div className="admin-profile-badges"><span className="admin-role"><ShieldCheck size={14} aria-hidden="true" />{user.is_superuser ? "Super administrator" : user.role.charAt(0).toUpperCase()+user.role.slice(1)}</span><span className="admin-status is-active"><i aria-hidden="true" />Active</span></div></div></div>
            <dl className="admin-profile-info"><div><dt><Mail size={15} aria-hidden="true" />Email address</dt><dd>{user.email || "No email provided"}</dd></div><div><dt><BookOpenCheck size={15} aria-hidden="true" />Workspace</dt><dd>{admin ? "Administration" : "Learning"}</dd></div></dl>
          </div>
        </section>
        <Link to={admin ? "/admin/content" : "/progress"} className="panel self-workspace-link"><span className="self-security-icon"><BookOpenCheck size={22} aria-hidden="true" /></span><span><strong>{admin ? "Your content workspace" : "Your learning progress"}</strong><small>{admin ? "Manage books, tests and learning materials." : "Explore your saved practice and results."}</small></span><ArrowRight size={19} aria-hidden="true" /></Link>
      </div>
      <AccountSettings />
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
  const { admin } = useWorkspace();
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
            admin
              ? "Content creation for this module is not available yet. Use Content Studio for Listening mock materials."
              : "This module is not open for practice or content uploads yet. Start with Listening."
          }
          action={
            <Link
              className="button primary"
              to={admin ? "/admin" : "/library"}
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
