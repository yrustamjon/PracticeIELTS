import "./dashboard.css";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ChevronRight,
  Headphones,
  FileText,
  BookOpen,
  Target,
  Clock,
  AudioLines,
  NotebookPen,
} from "lucide-react";
import { api, type Progress } from "../services/api";
import { useAuth } from "../stores/auth";
import { Loading, ErrorState, PageTitle, SectionTitle } from "../components/ui";
export function Activity({ data }: { data: Progress }) {
  const max = Math.max(...data.weekly_activity.map((x) => x.count), 1);
  return (
    <div
      className="activity-chart"
      aria-label="Practice attempts in the last seven days"
    >
      {data.weekly_activity.map((x) => (
        <div
          className="chart-day"
          key={x.date}
          title={`${x.date}: ${x.count} attempts`}
        >
          <span className="bar-track">
            <i
              style={{
                height: x.count
                  ? `${Math.max(8, (x.count / max) * 100)}%`
                  : "4px",
              }}
              className={x.count ? "active" : ""}
            />
          </span>
          <span>{x.day}</span>
        </div>
      ))}
    </div>
  );
}
export function Dashboard() {
  const user = useAuth((s) => s.user)!;
  const progress = useQuery({
    queryKey: ["progress"],
    queryFn: () => api<Progress>("progress/"),
  });
  if (progress.isPending) return <Loading />;
  if (progress.error) return <ErrorState error={progress.error} />;
  const data = progress.data!,
    resume = data.resume;
  const ratio = resume
    ? Math.round((resume.checked_positions.length / resume.groups.length) * 100)
    : 0;
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <div className="learner-dashboard">
      <PageTitle
        title={`${greeting}, ${user.username}`}
        description="Choose your next Listening or Reading task."
        action={
          <span className="date-label">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </span>
        }
      />
      <div className="dashboard-top">
        <section className="panel continue-card">
          <SectionTitle
            title={resume ? "Continue where you left off" : "Start practising"}
            to="/library"
            label="Library"
          />
          <div className="continue-body">
            <div className="continue-details">
              <span className="muted small-label">
                {resume ? "Listening Practice" : "LISTENING & READING"}
              </span>
              <h3>
                {resume ? resume.title : "Choose a book. Make your next step."}
              </h3>
              {resume && (
                <>
                  <div className="metadata">
                    <span>
                      <FileText size={16} />
                      {`Segment ${resume.position + 1} of ${resume.groups.length}`}
                    </span>
                    <span>
                      <Clock size={16} />
                      {resume
                        ? `${Math.ceil(resume.audio.duration_ms / 60000)} minutes`
                        : "At your own pace"}
                    </span>
                    <span>
                      <AudioLines size={16} />
                      {resume ? resume.difficulty : "Every level"}
                    </span>
                  </div>
                  <div className="progress-caption">
                    {resume
                      ? `${ratio}% complete`
                      : "A little listening, every day."}
                  </div>
                  <div className="progress-track">
                    <i style={{ width: `${ratio}%` }} />
                  </div>
                </>
              )}
              {!resume && (
                <p className="muted">
                  Open the Library to choose Listening audio or Reading
                  passages. Your answers are saved as you practise.
                </p>
              )}
              <div className="continue-actions">
                <Link
                  className="button primary"
                  to={resume ? `/practice/${resume.id}` : "/library"}
                >
                  {resume ? "Continue Practice" : "Browse Library"}
                  <ChevronRight size={20} />
                </Link>
                <Link className="text-link" to="/mistakes">
                  <NotebookPen size={17} />
                  Review Mistakes
                </Link>
              </div>
            </div>
          </div>
        </section>
        <section className="panel progress-card">
          <SectionTitle title="Listening progress" />
          <div className="chart-caption">
            <span>7-day activity</span>
            <span className="small-label">This week</span>
          </div>
          <Activity data={data} />
          <div className="progress-stats">
            <div>
              <Target size={34} />
              <span>
                <strong>
                  {data.accuracy === null ? "—" : `${data.accuracy}%`}
                </strong>
                <small>Accuracy</small>
              </span>
            </div>
            <div>
              <FileText size={32} />
              <span>
                <strong>{data.sentences_completed}</strong>
                <small>Segments completed</small>
              </span>
            </div>
          </div>
        </section>
      </div>
      <SectionTitle
        title="What would you like to practise?"
        to="/library"
        label="Open Library"
      />
      <div className="practice-grid">
        <PracticeCard
          icon={<Headphones />}
          title="Listening practice"
          text="Listen and write what you hear. Improve your accuracy and spelling."
          link="Start Dictation"
          to="/dictation"
          color="teal"
        />
        <PracticeCard
          icon={<FileText />}
          title="Listening mocks"
          text="Answer interactive exam questions. Choose a timed test or take your time."
          link="Choose a Mock Test"
          to="/mock-tests"
          color="teal"
        />
        <PracticeCard
          icon={<BookOpen />}
          title="Reading"
          text="Choose a book and test. Read a passage, answer questions and review your mistakes."
          link="Choose a Reading test"
          to="/reading"
          color="teal"
        />
      </div>
    </div>
  );
}
function PracticeCard({
  icon,
  title,
  text,
  link,
  to,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  link: string;
  to: string;
  color: string;
}) {
  return (
    <Link className={`practice-card ${color}`} to={to}>
      <span className="practice-icon">{icon}</span>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
        <span className="text-link">
          {link}
          <ChevronRight size={17} />
        </span>
      </div>
    </Link>
  );
}
