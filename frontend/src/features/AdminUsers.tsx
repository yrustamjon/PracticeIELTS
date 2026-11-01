import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  Users,
  Search,
  Activity,
  GraduationCap,
  FileCheck,
} from "lucide-react";
import { api, type Page } from "../services/api";
import { useAuth } from "../stores/auth";
import { Empty, ErrorState, Loading, PageTitle } from "../components/ui";
import { ResultNavigation } from "../components/ResultNavigation";
import "./adminUsers.css";

type DirectoryUser = {
  id: number;
  username: string;
  email: string;
  role: string;
  is_superuser: boolean;
  is_active: boolean;
  date_joined: string;
  practice_sessions: number;
  checked_answers: number;
  completed_mocks: number;
  mock_score_percent: number | null;
  last_learning_at: string | null;
};
type Overview = {
  total_users: number;
  students: number;
  active_accounts: number;
  learning_users_7d: number;
  completed_mocks: number;
  checked_answers: number;
  mock_score_percent: number | null;
};
export function AdminUsers() {
  const allowed = useAuth((s) => !!s.user?.can_view_users);
  const [params, setParams] = useSearchParams();
  const requested = Number(params.get("page"));
  const page = Number.isInteger(requested) && requested > 0 ? requested : 1;
  const search = params.get("search") || "",
    role = params.get("role") || "";
  const [input, setInput] = useState(search);
  useEffect(() => setInput(search), [search]);
  const overview = useQuery({
    queryKey: ["admin-users-overview"],
    queryFn: () => api<Overview>("admin/users/overview/"),
    enabled: allowed,
  });
  const users = useQuery({
    queryKey: ["admin-users", page, search, role],
    queryFn: () =>
      api<Page<DirectoryUser>>(
        `admin/users/?page=${page}&search=${encodeURIComponent(search)}&role=${encodeURIComponent(role)}`,
      ),
    enabled: allowed,
  });
  function update(next: { search?: string; role?: string; page?: string }) {
    const updated = new URLSearchParams(params);
    updated.delete("page");
    Object.entries(next).forEach(([key, value]) =>
      value ? updated.set(key, value) : updated.delete(key),
    );
    setParams(updated);
  }
  return (
    <div className="admin-users-page">
      <ResultNavigation
        steps={[
          { label: "Admin dashboard", to: "/admin" },
          { label: "Users & statistics" },
        ]}
        back={{ label: "Back to dashboard", to: "/admin" }}
      />
      <PageTitle
        eyebrow="ADMIN / USERS"
        title="Users & statistics"
        description="Your community and their learning activity."
      />
      {!allowed ? (
        <Empty
          title="Administrators only"
          description="Your account cannot view the user directory."
        />
      ) : (
        <>
          {overview.isPending ? (
            <Loading />
          ) : overview.error ? (
            <ErrorState error={overview.error} />
          ) : (
            <>
              <div className="directory-metrics">
                {[
                  [
                    Users,
                    "Total users",
                    overview.data.total_users,
                    `${overview.data.active_accounts} active accounts`,
                  ],
                  [
                    GraduationCap,
                    "Students",
                    overview.data.students,
                    "Registered learner accounts",
                  ],
                  [
                    Activity,
                    "Learning this week",
                    overview.data.learning_users_7d,
                    "Users with activity in the last 7 days",
                  ],
                  [
                    FileCheck,
                    "Completed mocks",
                    overview.data.completed_mocks,
                    overview.data.mock_score_percent === null
                      ? "No scored attempts yet"
                      : `${overview.data.mock_score_percent}% overall score`,
                  ],
                ].map(([Icon, label, value, caption]) => {
                  const Component = Icon as typeof Users;
                  return (
                    <section className="directory-metric" key={String(label)}>
                      <Component size={20} aria-hidden="true" />
                      <span>{String(label)}</span>
                      <strong>{String(value)}</strong>
                      <small>{String(caption)}</small>
                    </section>
                  );
                })}
              </div>
              <p className="directory-note">
                {overview.data.checked_answers} dictation answers checked across
                all users.
              </p>
            </>
          )}
          <section className="directory-panel">
            <form
              className="directory-toolbar"
              onSubmit={(e) => {
                e.preventDefault();
                update({ search: input.trim() });
              }}
            >
              <label className="directory-search">
                <span className="sr-only">Search users</span>
                <Search size={17} aria-hidden="true" />
                <input
                  aria-label="Search users"
                  placeholder="Search username or email…"
                  value={input}
                  maxLength={150}
                  onChange={(e) => setInput(e.target.value)}
                />
              </label>
              <select
                aria-label="Filter by role"
                value={role}
                onChange={(e) => update({ role: e.target.value })}
              >
                <option value="">All roles</option>
                <option value="student">Students</option>
                <option value="teacher">Teachers</option>
                <option value="admin">Administrators</option>
              </select>
              <button className="button primary">Search</button>
            </form>
            {users.isPending ? (
              <Loading />
            ) : users.error ? (
              <>
                <ErrorState error={users.error} />
                <button
                  className="button secondary"
                  onClick={() => void users.refetch()}
                >
                  Try again
                </button>
                {page > 1 && (
                  <button
                    className="button secondary"
                    onClick={() => update({})}
                  >
                    First page
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="directory-list-heading">
                  <h2>User directory</h2>
                  <span>{users.data.count} users</span>
                </div>
                {users.data.results.length ? (
                  <ul className="directory-records" aria-label="Users">
                    {users.data.results.map((user) => (
                      <li key={user.id}>
                        <div className="directory-person">
                          <span className="directory-avatar">
                            {user.username.slice(0, 2).toUpperCase()}
                          </span>
                          <div>
                            <strong>{user.username}</strong>
                            <span>{user.email || "No email provided"}</span>
                            <small>
                              Joined{" "}
                              {new Date(user.date_joined).toLocaleDateString()}
                            </small>
                          </div>
                        </div>
                        <div className="directory-role">
                          <span>
                            {user.is_superuser ? "Super admin" : user.role}
                          </span>
                          <small
                            className={user.is_active ? "directory-active" : ""}
                          >
                            {user.is_active
                              ? "Active account"
                              : "Inactive account"}
                          </small>
                        </div>
                        <dl className="directory-learning">
                          <div>
                            <dt>Mocks</dt>
                            <dd>{user.completed_mocks}</dd>
                          </div>
                          <div>
                            <dt>Mock score</dt>
                            <dd>
                              {user.mock_score_percent === null
                                ? "—"
                                : `${user.mock_score_percent}%`}
                            </dd>
                          </div>
                          <div>
                            <dt>Practice sessions</dt>
                            <dd>{user.practice_sessions}</dd>
                          </div>
                          <div>
                            <dt>Answers checked</dt>
                            <dd>{user.checked_answers}</dd>
                          </div>
                        </dl>
                        <small className="directory-last">
                          {user.last_learning_at
                            ? `Last learning: ${new Date(user.last_learning_at).toLocaleString()}`
                            : "No learning activity yet"}
                        </small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty
                    title="No users found"
                    description="Try another username, email or role."
                  />
                )}
                <nav className="directory-pagination" aria-label="User pages">
                  <span>Page {page}</span>
                  <div>
                    <button
                      className="button secondary"
                      disabled={!users.data.previous}
                      onClick={() => update({ page: String(page - 1) })}
                    >
                      Previous
                    </button>
                    <button
                      className="button secondary"
                      disabled={!users.data.next}
                      onClick={() => update({ page: String(page + 1) })}
                    >
                      Next
                    </button>
                  </div>
                </nav>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
