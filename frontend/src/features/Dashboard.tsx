import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ChevronRight,
  Headphones,
  FileText,
  BookOpen,
  Target,
  Clock,
  AudioLines,
  NotebookPen,
  FolderOpen,
} from "lucide-react";
import { api, type Progress, type Category } from "../services/api";
import { useAuth } from "../stores/auth";
import {
  Loading,
  ErrorState,
  PageTitle,
  SectionTitle,
  Waveform,
  BookCover,
} from "../components/ui";
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
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<{ results: Category[] }>("categories/"),
  });
  if (progress.isPending || categories.isPending) return <Loading />;
  if (progress.error || categories.error)
    return <ErrorState error={progress.error || categories.error} />;
  const data = progress.data!,
    resume = data.resume;
  const ratio = resume
    ? Math.round((resume.checked_positions.length / resume.groups.length) * 100)
    : 0;
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <>
      <PageTitle
        title={`${greeting}, ${user.username}`}
        description="Keep building your listening skills."
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
      <div className="dashboard-intro">
        <span>
          <Headphones size={18} />
          <strong>Listening workspace</strong>
        </span>
        <p>Choose a material, then practise your way.</p>
        {user.can_edit && (
          <Link className="text-link" to="/admin">
            Manage materials
            <ChevronRight size={16} />
          </Link>
        )}
      </div>
      <div className="dashboard-top">
        <section className="panel continue-card">
          <SectionTitle
            title={
              resume
                ? "Continue where you left off"
                : "Your next chapter starts here"
            }
            to="/dictation"
            label="View all"
          />
          <div className="continue-body">
            <BookCover />
            <div className="continue-details">
              <span className="muted small-label">Listening Practice</span>
              <h3>
                {resume ? resume.title : "Build a stronger listening habit"}
              </h3>
              <div className="metadata">
                <span>
                  <FileText size={16} />
                  {resume
                    ? `Segment ${resume.position + 1} of ${resume.groups.length}`
                    : "Sentence by sentence"}
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
              <div className="continue-actions">
                <Link
                  className="button primary"
                  to={resume ? `/practice/${resume.id}` : "/library"}
                >
                  {resume ? "Continue Practice" : "Find your first practice"}
                  <ChevronRight size={20} />
                </Link>
                <Link className="text-link" to="/mistakes">
                  <NotebookPen size={17} />
                  Review Mistakes
                </Link>
              </div>
            </div>
            <Waveform />
          </div>
        </section>
        <section className="panel progress-card">
          <SectionTitle title="Your progress" />
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
                <small>Accuracy rate</small>
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
        title="Choose your practice"
        to="/library"
        label="Explore all practice types"
      />
      <div className="practice-grid">
        <PracticeCard
          icon={<Headphones />}
          title="Dictation Practice"
          text="Listen and write what you hear. Improve your accuracy and spelling."
          link="Start Dictation"
          to="/dictation"
          color="teal"
        />
        <PracticeCard
          icon={<FileText />}
          title="Mock Test"
          text="Answer interactive exam questions. Choose a timed test or take your time."
          link="Choose a Mock Test"
          to="/mock-tests"
          color="orange"
        />
        <PracticeCard
          icon={<BookOpen />}
          title="Transcript Study"
          text="Read, listen and analyse transcripts to learn from the content."
          link="Open Transcript Library"
          to="/library?mode=transcript"
          color="purple"
        />
      </div>
      <SectionTitle
        title="Browse Library"
        to="/library"
        label="View all materials"
      />
      {categories.data!.results.length ? (
        <div className="library-grid">
          {categories
            .data!.results.filter((c) => !c.parent)
            .map((c, i) => (
              <Link
                key={c.id}
                to={`/library?category=${c.id}`}
                className="panel library-category"
              >
                <div className={`category-art art-${i % 3}`}>
                  <BookOpen size={43} />
                </div>
                <div>
                  <h3>{c.name}</h3>
                  <p>
                    {c.description ||
                      "Discover listening materials in this collection."}
                  </p>
                  <span>{c.material_count} materials</span>
                </div>
                <ChevronRight size={18} />
              </Link>
            ))}
        </div>
      ) : (
        <div className="panel library-welcome">
          <span className="icon-orbit">
            <FolderOpen size={29} />
          </span>
          <div>
            <h3>Your listening library is growing</h3>
            <p>
              {user.can_edit
                ? "Add your first collection and publish original or licensed listening material."
                : "Published listening collections will appear here. Your progress starts with your first practice."}
            </p>
          </div>
          <Link
            to={user.can_edit ? "/admin" : "/library"}
            className="text-link"
          >
            {user.can_edit ? "Add a collection" : "Explore library"}
            <ArrowRight size={17} />
          </Link>
        </div>
      )}
      <div className="daily-note">
        <span>
          <Headphones size={17} /> MAKE IT A HABIT
        </span>
        <p>
          Progress comes from showing up. Give your listening a little time
          today.
        </p>
      </div>
    </>
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
