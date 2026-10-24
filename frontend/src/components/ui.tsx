import type { ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  AudioLines,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
export function Loading() {
  return (
    <div className="state">
      <LoaderCircle className="spin" />
      <p>Getting your workspace ready…</p>
    </div>
  );
}
export function ErrorState({ error }: { error: unknown }) {
  return (
    <div className="error" role="alert">
      <AlertCircle size={19} />
      {error instanceof Error ? error.message : "Unable to load this page."}
    </div>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="icon-orbit">
        <BookOpen size={28} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function SectionTitle({
  title,
  to,
  label = "View all",
}: {
  title: string;
  to?: string;
  label?: string;
}) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {to && (
        <Link className="text-link" to={to}>
          {label}
          <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function Waveform() {
  return (
    <div className="waveform" aria-hidden="true">
      {[
        12, 30, 20, 40, 25, 50, 36, 69, 45, 30, 17, 39, 25, 20, 46, 34, 50, 25,
        19, 12,
      ].map((h, i) => (
        <i key={i} style={{ height: h }} />
      ))}
    </div>
  );
}
export function BookCover({ small = false }: { small?: boolean }) {
  return (
    <div className={`book-cover ${small ? "small" : ""}`}>
      <span>PracticeIELTS</span>
      <strong>
        LISTEN
        <br />& LEARN<span>01</span>
      </strong>
      <AudioLines size={small ? 20 : 32} />
      <small>YOUR LISTENING JOURNEY</small>
    </div>
  );
}
