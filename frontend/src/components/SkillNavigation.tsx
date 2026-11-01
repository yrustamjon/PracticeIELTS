import { Link } from "react-router-dom";
import { Headphones, BookOpen } from "lucide-react";
import "./skillNavigation.css";

export function SkillNavigation({
  active,
  workspace = "learner",
}: {
  active?: "listening" | "reading";
  workspace?: "learner" | "admin";
}) {
  return (
    <nav className="skill-navigation" aria-label="Choose Listening or Reading">
      <Link
        to={workspace === "admin" ? "/admin/content" : "/library"}
        className={active === "listening" ? "selected" : ""}
        aria-current={active === "listening" ? "true" : undefined}
      >
        <Headphones aria-hidden="true" />
        <span>
          <strong>Listening</strong>
          <small>
            {workspace === "admin"
              ? "Books, tests & audio"
              : "Audio practice & Listening Mocks"}
          </small>
        </span>
      </Link>
      <Link
        to={workspace === "admin" ? "/admin/reading" : "/reading"}
        className={active === "reading" ? "selected" : ""}
        aria-current={active === "reading" ? "true" : undefined}
      >
        <BookOpen aria-hidden="true" />
        <span>
          <strong>Reading</strong>
          <small>
            {workspace === "admin"
              ? "Books, tests & passages"
              : "Passages & reading questions"}
          </small>
        </span>
      </Link>
    </nav>
  );
}
