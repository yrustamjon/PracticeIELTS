import {
  ArrowLeft,
  Ban,
  CalendarDays,
  ChevronRight,
  KeyRound,
  Mail,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Activity as ActivityIcon,
  LogIn,
  UserPlus,
  X,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useRef, useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, post, type User, type Page } from "../services/api";
import { useAuth } from "../stores/auth";
import { Empty, ErrorState, Loading } from "../components/ui";
import "./accountSettings.css";

type AdminAccount = {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  is_superuser: boolean;
  date_joined: string;
};
type Activity = {
  id: number;
  username: string;
  action: string;
  material_title: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export function AdminAvatar({
  name,
  large = false,
}: {
  name: string;
  large?: boolean;
}) {
  const parts = name
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  const initials =
    parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  const tone = [...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 3;
  return (
    <span
      className={`admin-avatar admin-avatar-${tone}${large ? " admin-avatar-large" : ""}`}
      aria-hidden="true"
    >
      {initials.toUpperCase()}
    </span>
  );
}
function AdminStatus({ active }: { active: boolean }) {
  return (
    <span className={`admin-status ${active ? "is-active" : "is-blocked"}`}>
      <i aria-hidden="true" />
      {active ? "Active" : "Blocked"}
    </span>
  );
}
function activityPresentation(action: string) {
  const known: Record<
    string,
    { label: string; Icon: typeof ActivityIcon; tone: string }
  > = {
    "admin.create": {
      label: "Administrator added",
      Icon: UserPlus,
      tone: "teal",
    },
    "admin.password_reset": {
      label: "Password changed",
      Icon: KeyRound,
      tone: "navy",
    },
    "admin.block": { label: "Access blocked", Icon: Ban, tone: "red" },
    "admin.unblock": {
      label: "Access restored",
      Icon: ShieldCheck,
      tone: "teal",
    },
    "auth.login": { label: "Signed in", Icon: LogIn, tone: "navy" },
    "auth.password_change": {
      label: "Password changed",
      Icon: KeyRound,
      tone: "navy",
    },
    "api.post": { label: "Content created", Icon: Plus, tone: "teal" },
    "api.patch": { label: "Content updated", Icon: ActivityIcon, tone: "navy" },
    "api.put": { label: "Content updated", Icon: ActivityIcon, tone: "navy" },
    "api.delete": { label: "Content deleted", Icon: Ban, tone: "red" },
  };
  const label = action.replace(/[._]+/g, " ");
  return (
    known[action] || {
      label: label.charAt(0).toUpperCase() + label.slice(1),
      Icon: ActivityIcon,
      tone: "navy",
    }
  );
}

export function AccountSettings() {
  const passwordDialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSuccess("");
    setError(undefined);
    if (data.get("new_password") !== data.get("confirm_password")) {
      setError(new Error("The new passwords do not match."));
      return;
    }
    setBusy(true);
    try {
      const result = await post<{ access: string; user: User }>(
        "auth/password/",
        {
          current_password: data.get("current_password"),
          new_password: data.get("new_password"),
        },
      );
      useAuth.getState().set(result.access, result.user);
      form.reset();
      passwordDialog.current?.close();
      setSuccess("Password changed. Other sessions have been signed out.");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="account-settings">
      <section className="panel form-panel self-security-card">
        <div className="self-security-icon"><KeyRound size={22} aria-hidden="true" /></div>
        <div className="self-security-copy"><h2>Account security</h2><p>Keep your account protected with a unique password.</p></div>
        <button ref={trigger} className="button secondary" onClick={() => {setError(undefined);passwordDialog.current?.querySelector<HTMLFormElement>("form")?.reset();passwordDialog.current?.showModal();}}><KeyRound size={16} aria-hidden="true" />Change password</button>
      </section>
      {success && <p className="success" role="status">{success}</p>}
      <dialog ref={passwordDialog} className="admin-create-dialog admin-password-dialog" aria-labelledby="password-heading" onClose={() => {setError(undefined);trigger.current?.focus();}}>
        <div className="admin-dialog-icon"><KeyRound size={23} aria-hidden="true" /></div>
        <div className="admin-list-heading"><h2 id="password-heading">Change password</h2><button type="button" className="admin-icon-button" aria-label="Close password dialog" onClick={() => passwordDialog.current?.close()}><X size={20} aria-hidden="true" /></button></div>
        <p className="admin-dialog-note">Confirm your current password to set a new one.</p>
        <form className="settings-form" onSubmit={changePassword}>
          <label>
            Current password
            <input
              name="current_password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <label>
            New password
            <input
              name="new_password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <label>
            Confirm new password
            <input
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          {error != null && <ErrorState error={error} />}
          <button className="button primary" disabled={busy}>
            {busy ? "Saving…" : "Save password"}
          </button>
        </form>
      </dialog>
    </div>
  );
}

export function SuperAdminSettings() {
  const cache = useQueryClient();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");
  const [accountPage, setAccountPage] = useState(1);
  const [logPage, setLogPage] = useState(1);
  const [params] = useSearchParams();
  const selectedId = params.get("administrator");
  const dialog = useRef<HTMLDialogElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const passwordDialog = useRef<HTMLDialogElement>(null);
  const passwordTrigger = useRef<HTMLButtonElement>(null);
  const [passwordError, setPasswordError] = useState<unknown>();
  const profile = useQuery({
    queryKey: ["admin-account", selectedId],
    queryFn: () => api<AdminAccount>(`admin/accounts/${selectedId}/`),
    enabled: !!selectedId,
  });
  useEffect(() => {
    passwordDialog.current?.close();
    setPasswordError(undefined);
    setLogPage(1);
    setSearch("");
    setSearchInput("");
    setError(undefined);
    setSuccess("");
  }, [selectedId]);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const admins = useQuery({
    queryKey: ["admin-accounts", accountPage],
    queryFn: () =>
      api<Page<AdminAccount>>(
        `admin/accounts/?page=${accountPage}&page_size=20`,
      ),
  });
  const logs = useQuery({
    queryKey: ["admin-activity", logPage, selectedId, search],
    queryFn: () =>
      api<Page<Activity>>(
        `admin/activity/?page=${logPage}&page_size=20&account=${encodeURIComponent(selectedId || "")}&search=${encodeURIComponent(search)}`,
      ),
    enabled: !!selectedId && !!profile.data,
  });
  async function createAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setError(undefined);
    setSuccess("");
    setBusy(true);
    try {
      await post("admin/accounts/", data);
      form.reset();
      dialog.current?.close();
      setAccountPage(1);
      await cache.invalidateQueries({ queryKey: ["admin-accounts"] });
      await cache.invalidateQueries({ queryKey: ["admin-activity"] });
      setSuccess(
        "Administrator created. This account cannot delete content or manage administrators.",
      );
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  async function updateAdmin(data: {
    new_password?: string;
    is_active?: boolean;
  }) {
    setBusy(true);
    setError(undefined);
    setPasswordError(undefined);
    setSuccess("");
    try {
      await api(`admin/accounts/${selectedId}/`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["admin-account", selectedId] }),
        cache.invalidateQueries({ queryKey: ["admin-accounts"] }),
        cache.invalidateQueries({ queryKey: ["admin-activity"] }),
      ]);
      setSuccess(
        data.new_password
          ? "Password changed. Previous sessions have been signed out."
          : data.is_active
            ? "Administrator unblocked."
            : "Administrator blocked.",
      );
      return true;
    } catch (err) {
      if (data.new_password) setPasswordError(err);
      else setError(err);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {!selectedId && (
        <section
          className="panel form-panel admin-directory"
          id="admin-settings"
          aria-labelledby="admins-heading"
        >
          <div className="admin-list-heading">
            <div>
              <span className="admin-eyebrow">YOUR TEAM</span>
              <h2 id="admins-heading">Administrators</h2>
              <p className="admin-section-note">
                {admins.data
                  ? `${admins.data.count} ${admins.data.count === 1 ? "account" : "accounts"}`
                  : "Manage your team’s access"}
              </p>
            </div>
            <button
              ref={addButton}
              className="button primary"
              onClick={() => {
                setError(undefined);
                dialog.current?.showModal();
              }}
            >
              <Plus size={17} aria-hidden="true" /> Add administrator
            </button>
          </div>
          {success && (
            <p className="success" role="status">
              {success}
            </p>
          )}
          <dialog
            ref={dialog}
            className="admin-create-dialog"
            aria-labelledby="create-admin-heading"
            onClose={() => addButton.current?.focus()}
          >
            <div className="admin-list-heading">
              <h2 id="create-admin-heading">Add administrator</h2>
              <button
                type="button"
                className="button subtle"
                aria-label="Close add administrator"
                onClick={() => dialog.current?.close()}
              >
                Close
              </button>
            </div>
            <form className="settings-form" onSubmit={createAdmin}>
              <label>
                Admin username
                <input
                  name="username"
                  autoComplete="off"
                  maxLength={150}
                  required
                />
              </label>
              <label>
                Admin email
                <input name="email" type="email" autoComplete="off" />
              </label>
              <label>
                Initial password
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>
              {error != null && <ErrorState error={error} />}
              {success && (
                <p className="success" role="status">
                  {success}
                </p>
              )}
              <button className="button primary" disabled={busy}>
                {busy ? "Adding admin…" : "Add administrator"}
              </button>
            </form>
          </dialog>
          {admins.isPending ? (
            <Loading />
          ) : admins.error ? (
            <ErrorState error={admins.error} />
          ) : (
            <>
              <ul
                className="admin-directory-list"
                aria-label="Administrator accounts"
              >
                {admins.data.results.map((admin) => (
                  <li key={admin.id}>
                    <Link
                      className="admin-person-row"
                      to={`?administrator=${admin.id}`}
                      aria-label={`Open profile for ${admin.username}`}
                    >
                      <AdminAvatar name={admin.username} />
                      <div className="admin-person-identity">
                        <strong>{admin.username}</strong>
                        <span>{admin.email || "No email provided"}</span>
                      </div>
                      <div className="admin-person-meta">
                        <span className="admin-role">
                          <ShieldCheck size={13} aria-hidden="true" />
                          {admin.is_superuser ? "Super admin" : "Admin"}
                        </span>
                        <AdminStatus active={admin.is_active} />
                      </div>
                      <ChevronRight
                        className="admin-person-arrow"
                        size={18}
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
              <SettingsPagination
                page={accountPage}
                previous={!!admins.data.previous}
                next={!!admins.data.next}
                onChange={setAccountPage}
                label="Administrator pages"
              />
            </>
          )}
        </section>
      )}
      {selectedId && (
        <>
          <Link className="admin-back-link" to="/admin/management">
            <ArrowLeft size={15} aria-hidden="true" /> Back to administrators
          </Link>
          {profile.isPending ? (
            <Loading />
          ) : profile.error ? (
            <ErrorState error={profile.error} />
          ) : (
            <>
              <section
                className="panel form-panel admin-profile-card"
                aria-labelledby="admin-profile-heading"
              >
                <div className="admin-profile-banner" aria-hidden="true" />
                <div className="admin-profile-body">
                  <div className="admin-profile-identity">
                    <AdminAvatar name={profile.data.username} large />
                    <div className="admin-profile-name">
                      <span className="admin-eyebrow">
                        ADMINISTRATOR PROFILE
                      </span>
                      <h2 id="admin-profile-heading">
                        {profile.data.username}
                      </h2>
                      <div className="admin-profile-badges">
                        <span className="admin-role">
                          <ShieldCheck size={13} aria-hidden="true" />
                          {profile.data.is_superuser ? "Super admin" : "Admin"}
                        </span>
                        <AdminStatus active={profile.data.is_active} />
                      </div>
                    </div>
                  </div>
                  <dl className="admin-profile-info">
                    <div>
                      <dt>
                        <Mail size={15} aria-hidden="true" />
                        Email address
                      </dt>
                      <dd>{profile.data.email || "No email provided"}</dd>
                    </div>
                    <div>
                      <dt>
                        <CalendarDays size={15} aria-hidden="true" />
                        Member since
                      </dt>
                      <dd>
                        {new Date(profile.data.date_joined).toLocaleDateString(
                          undefined,
                          { day: "numeric", month: "long", year: "numeric" },
                        )}
                      </dd>
                    </div>
                  </dl>
                  {error != null && <ErrorState error={error} />}
                  {success && (
                    <p className="success admin-profile-notice" role="status">
                      {success}
                    </p>
                  )}
                  <div className="admin-profile-actions">
                    <div className="admin-access-note">
                      <ShieldCheck size={18} aria-hidden="true" />
                      <span>
                        {profile.data.is_active
                          ? "Account access is enabled"
                          : "This account cannot sign in"}
                      </span>
                    </div>
                    {profile.data.is_superuser ? (
                      <Link
                        className="button secondary"
                        to="/profile?workspace=admin"
                      >
                        <KeyRound size={16} aria-hidden="true" />
                        My password settings
                      </Link>
                    ) : (
                      <div className="admin-action-buttons">
                        <button
                          ref={passwordTrigger}
                          className="button primary"
                          disabled={busy}
                          onClick={() => {
                            setPasswordError(undefined);
                            passwordDialog.current
                              ?.querySelector<HTMLFormElement>("form")
                              ?.reset();
                            passwordDialog.current?.showModal();
                          }}
                        >
                          <KeyRound size={16} aria-hidden="true" />
                          Change password
                        </button>
                        <button
                          className={`button ${profile.data.is_active ? "admin-block-button" : "secondary"}`}
                          disabled={busy}
                          onClick={() =>
                            void updateAdmin({
                              is_active: !profile.data.is_active,
                            })
                          }
                        >
                          <Ban size={16} aria-hidden="true" />
                          {profile.data.is_active
                            ? "Block administrator"
                            : "Unblock administrator"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </section>
              {!profile.data.is_superuser && (
                <dialog
                  ref={passwordDialog}
                  className="admin-create-dialog admin-password-dialog"
                  aria-labelledby="admin-password-title"
                  onClose={() => {
                    setPasswordError(undefined);
                    passwordTrigger.current?.focus();
                  }}
                >
                  <div className="admin-dialog-icon">
                    <KeyRound size={23} aria-hidden="true" />
                  </div>
                  <div className="admin-list-heading">
                    <h2 id="admin-password-title">Change password</h2>
                    <button
                      className="admin-icon-button"
                      type="button"
                      aria-label="Close password dialog"
                      onClick={() => passwordDialog.current?.close()}
                    >
                      <X size={20} aria-hidden="true" />
                    </button>
                  </div>
                  <p className="admin-dialog-note">
                    Set a new password for{" "}
                    <strong>{profile.data.username}</strong>. Existing sessions
                    will be signed out.
                  </p>
                  <form
                    className="settings-form"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      const form = event.currentTarget;
                      const data = new FormData(form);
                      if (
                        data.get("new_password") !==
                        data.get("confirm_password")
                      ) {
                        setPasswordError(
                          new Error("The new passwords do not match."),
                        );
                        return;
                      }
                      if (
                        await updateAdmin({
                          new_password: String(data.get("new_password")),
                        })
                      ) {
                        form.reset();
                        passwordDialog.current?.close();
                      }
                    }}
                  >
                    <label>
                      New password
                      <input
                        name="new_password"
                        type="password"
                        minLength={8}
                        autoComplete="new-password"
                        required
                        autoFocus
                      />
                    </label>
                    <label>
                      Confirm new password
                      <input
                        name="confirm_password"
                        type="password"
                        minLength={8}
                        autoComplete="new-password"
                        required
                      />
                    </label>
                    {passwordError != null && (
                      <ErrorState error={passwordError} />
                    )}
                    <div className="admin-dialog-actions">
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => passwordDialog.current?.close()}
                      >
                        Cancel
                      </button>
                      <button className="button primary" disabled={busy}>
                        {busy ? "Saving…" : "Save password"}
                      </button>
                    </div>
                  </form>
                </dialog>
              )}
            </>
          )}
          {profile.data && (
            <section
              className="panel form-panel admin-activity-card"
              aria-labelledby="activity-heading"
            >
              <div className="admin-activity-heading">
                <div>
                  <span className="admin-eyebrow">RECORDED ACTIVITY</span>
                  <h2 id="activity-heading">Activity history</h2>
                  <p className="admin-section-note">
                    Sign-ins and changes to this account.
                  </p>
                </div>
                <button
                  type="button"
                  className="admin-icon-button"
                  aria-label="Refresh activity"
                  onClick={() => void logs.refetch()}
                >
                  <RefreshCw size={17} aria-hidden="true" />
                </button>
              </div>
              <details className="admin-log-filter">
                <summary>
                  <Search size={14} aria-hidden="true" />
                  Search activity
                </summary>
                <form
                  className="settings-filters"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setSearch(searchInput.trim());
                    setLogPage(1);
                  }}
                >
                  <label>
                    Search activity
                    <input
                      type="search"
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      placeholder="Name, event or material"
                    />
                  </label>
                  <button className="button secondary">Search</button>
                </form>
              </details>
              {logs.isPending ? (
                <Loading />
              ) : logs.error ? (
                <ErrorState error={logs.error} />
              ) : (
                <>
                  {logs.data.results.length ? (
                    <ul
                      className="admin-timeline"
                      aria-label="Admin activity log"
                    >
                      {logs.data.results.map((log) => {
                        const { label, Icon, tone } = activityPresentation(
                          log.action,
                        );
                        return (
                          <li key={log.id}>
                            <span
                              className={`admin-event-icon admin-event-${tone}`}
                            >
                              <Icon size={17} aria-hidden="true" />
                            </span>
                            <div className="admin-event-body">
                              <strong>{label}</strong>
                              <p>
                                {log.username}
                                {log.material_title
                                  ? ` · ${log.material_title}`
                                  : typeof log.details.username === "string"
                                    ? ` · ${log.details.username}`
                                    : ""}
                              </p>
                            </div>
                            <time dateTime={log.created_at}>
                              <span>
                                {new Date(log.created_at).toLocaleDateString(
                                  undefined,
                                  { month: "short", day: "numeric" },
                                )}
                              </span>
                              <small>
                                {new Date(log.created_at).toLocaleTimeString(
                                  undefined,
                                  { hour: "2-digit", minute: "2-digit" },
                                )}
                              </small>
                            </time>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <Empty
                      title="No activity found"
                      description="Recorded administrator activity will appear here."
                    />
                  )}
                  <SettingsPagination
                    page={logPage}
                    previous={!!logs.data.previous}
                    next={!!logs.data.next}
                    onChange={setLogPage}
                    label="Activity pages"
                  />
                </>
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}

function SettingsPagination({
  page,
  previous,
  next,
  onChange,
  label,
}: {
  page: number;
  previous: boolean;
  next: boolean;
  onChange: (page: number) => void;
  label: string;
}) {
  if (!previous && !next) return null;
  return (
    <nav className="settings-pagination" aria-label={label}>
      <button
        className="button secondary"
        disabled={!previous}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </button>
      <span>Page {page}</span>
      <button
        className="button secondary"
        disabled={!next}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
