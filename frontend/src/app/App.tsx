import { SharedReadingResult } from "../features/ReadingSharing";
import { ReadingHistory } from "../features/ReadingSelection";
import { ReadingImport, ReadingImportDetail } from "../features/ReadingImport";
import {
  ReadingLibrary,
  ReadingAttemptPage,
  ReadingReview,
} from "../features/Reading";
import { SharedPractice } from "../features/SharedPractice";
import { AdminHome, AdminManagement } from "../features/AdminDashboard";
import { AdminUsers } from "../features/AdminUsers";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Headphones,
  Search,
  ChevronDown,
  House,
  LibraryBig,
  FileText,
  ChartNoAxesCombined,
  Settings,
  Menu,
  X,
  LogOut,
  BookOpen,
  ArrowUpRight,
  AudioLines,
  UserRound,
  Users,
} from "lucide-react";
import { useWorkspace } from "../stores/workspace";
import { useAuth } from "../stores/auth";
import { api, post, restore, type User } from "../services/api";
import { Loading, ErrorState } from "../components/ui";
import { MockHistory } from "../features/MockHistory";
import { SharedMock } from "../features/SharedMock";
import { MockPage, MockResults } from "../features/Mock";
import { FutureModule } from "../features/Learning";
import { Dashboard } from "../features/Dashboard";
import { MaterialDetail } from "../features/Library";
import { NestedLibrary, TestDetail } from "../features/Catalog";
import { TestStudio } from "../features/TestStudio";
import { Practice } from "../features/Practice";
import { Admin } from "../features/Admin";
import {
  ProgressPage,
  Mistakes,
  Transcript,
  Profile,
} from "../features/Learning";

function Brand({ home = "/" }: { home?: string }) {
  return (
    <Link to={home} className="brand" aria-label="PracticeIELTS home">
      <Headphones />
      <span>
        Practice<span>IELTS</span>
      </span>
    </Link>
  );
}
const links = [
  ["/", "Dashboard", House],
  ["/library", "Library", LibraryBig],
  ["/dictation", "Listening Practice", Headphones],
  ["/mock-tests", "Listening Mocks", FileText],
  ["/reading", "Reading", BookOpen],
  ["/mistakes", "Mistake Review", BookOpen],
  ["/progress", "Progress", ChartNoAxesCombined],
] as const;
const learnerQuickLinks = [
  ["/", "Home", House],
  ["/library", "Library", LibraryBig],
  ["/reading", "Reading", BookOpen],
  ["/mock-tests", "Listen Mock", FileText],
  ["/profile", "Profile", UserRound],
] as const;
function Shell() {
  const { admin, profilePath } = useWorkspace();
  const [drawer, setDrawer] = useState(false);
  const navigation = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [profile, setProfile] = useState(false);
  const [search, setSearch] = useState("");
  const user = useAuth((s) => s.user)!;
  const adminLinks = [
    ["/admin", "Dashboard", House],
    ["/admin/content", "Listening library", Headphones],
    ["/admin/reading", "Reading", BookOpen],
    ...(user.can_view_users
      ? ([["/admin/users", "Users & statistics", Users]] as const)
      : []),
    ...(user.is_superuser
      ? ([
          ["/admin/management", "Administrators & activity", Settings],
        ] as const)
      : []),
    [profilePath, "Profile & settings", UserRound],
  ] as const;
  function navigationClass(to: string, active: boolean) {
    return active ||
      (to === "/admin/content" &&
        /^\/admin\/(?:\d+|materials)(?:\/|$)/.test(location.pathname))
      ? "active"
      : "";
  }

  const navigate = useNavigate();
  const location = useLocation();
  const cache = useQueryClient();
  const switchParams = new URLSearchParams(location.search);
  admin
    ? switchParams.delete("workspace")
    : switchParams.set("workspace", "admin");
  const switchTarget = location.pathname.startsWith("/practice/")
    ? `${location.pathname}${switchParams.size ? `?${switchParams}` : ""}`
    : admin
      ? "/"
      : "/admin";
  useEffect(() => {
    window.scrollTo(0, 0);
    setDrawer(false);
    setProfile(false);
  }, [location.pathname, location.search]);
  useEffect(() => {
    function close(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDrawer(false);
        setProfile(false);
      }
    }
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  useEffect(() => {
    if (!drawer || !window.matchMedia("(max-width: 760px)").matches) return;
    const media = window.matchMedia("(max-width: 760px)");
    const closeOnDesktop = () => {
      if (!media.matches) setDrawer(false);
    };
    media.addEventListener("change", closeOnDesktop);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = navigation.current;
    const focusable = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), input:not([disabled])",
        ) || [],
      );
    focusable()[0]?.focus();
    function trapFocus(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    panel?.addEventListener("keydown", trapFocus);
    return () => {
      media.removeEventListener("change", closeOnDesktop);
      document.body.style.overflow = previousOverflow;
      panel?.removeEventListener("keydown", trapFocus);
      menuButton.current?.focus({ preventScroll: true });
    };
  }, [drawer]);
  async function logout() {
    await post("auth/logout/");
    useAuth.getState().clear();
    cache.clear();
  }
  function searchSubmit(e: FormEvent) {
    e.preventDefault();
    navigate(
      `${admin ? "/admin/content" : "/library"}?search=${encodeURIComponent(search)}`,
    );
  }
  const readingMock = /^\/reading\/full\/attempts\/\d+\/?$/.test(
    location.pathname,
  );
  if (readingMock || /^\/mock\/\d+\/?$/.test(location.pathname))
    return (
      <div className="exam-shell">
        <a className="skip-link" href="#main-content">
          Skip to questions
        </a>
        <header className="exam-topbar">
          <Brand />
          <span className="exam-candidate">
            {readingMock ? <BookOpen size={17} /> : <Headphones size={17} />}
            {readingMock ? "Reading" : "Listening"} · {user.username}
          </span>
          <div id="exam-audio-slot" />
          <div id="exam-controls-slot" />
          <Link
            to={readingMock ? "/reading" : "/mock-tests"}
            className="exam-exit"
            aria-label="Save & exit"
            onClick={
              readingMock
                ? (e) => {
                    const exit = new Event("reading-mock-exit", {
                      cancelable: true,
                    });
                    if (!window.dispatchEvent(exit)) e.preventDefault();
                  }
                : undefined
            }
          >
            <span className="exam-exit-label">Save & exit</span>
            <LogOut size={16} aria-hidden="true" />
          </Link>
        </header>
        <main
          id="main-content"
          className={`exam-main${readingMock ? " reading-exam-main" : ""}`}
        >
          <Outlet />
        </main>
        <div id="exam-navigation-slot" />
      </div>
    );
  return (
    <div
      className={`app-shell ${admin ? "admin-workspace" : "learner-workspace"}`}
    >
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="topbar">
        <button
          ref={menuButton}
          className="icon-button mobile-menu"
          aria-label="Open navigation"
          aria-expanded={drawer}
          aria-controls="workspace-navigation"
          onClick={() => setDrawer(!drawer)}
        >
          <Menu />
        </button>
        <Brand home={admin ? "/admin" : "/"} />
        <form className="global-search" onSubmit={searchSubmit}>
          <Search size={20} />
          <input
            aria-label={admin ? "Search content" : "Search materials"}
            placeholder={
              admin
                ? "Search your content..."
                : "Search for tests, topics or keywords..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <kbd>↵</kbd>
        </form>
        <div className="header-actions">
          <Link
            to={profilePath}
            className="icon-button"
            aria-label="Profile settings"
          >
            <Settings size={21} />
          </Link>
          <button
            className="profile-button"
            aria-label="Account menu"
            aria-expanded={profile}
            onClick={() => setProfile(!profile)}
          >
            <span className="avatar">
              {user.username.slice(0, 2).toUpperCase()}
            </span>
            <span className="profile-name">{user.username}</span>
            {user.can_edit && (
              <span className="workspace-badge">
                {admin ? "Admin" : "Learner"}
              </span>
            )}
            <ChevronDown size={16} />
          </button>
          {profile && (
            <div className="profile-menu">
              <div className="workspace-menu-title">
                {admin ? "Admin workspace" : "Learner workspace"}
              </div>
              <Link to={profilePath}>Profile & settings</Link>
              {user.can_edit && (
                <Link to={switchTarget} className="workspace-switch">
                  {admin ? <Headphones size={17} /> : <Settings size={17} />}
                  Switch to {admin ? "learner" : "admin"} mode
                </Link>
              )}
              <button onClick={() => void logout()}>
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>
      {drawer && (
        <button
          className="drawer-backdrop"
          aria-label="Close navigation"
          onClick={() => setDrawer(false)}
        />
      )}
      <aside
        ref={navigation}
        id="workspace-navigation"
        className={`sidebar ${drawer ? "open" : ""}`}
      >
        <div className="mobile-drawer-heading">
          <strong>{admin ? "Admin workspace" : "Your workspace"}</strong>
          <button
            className="icon-button"
            aria-label="Close menu"
            onClick={() => setDrawer(false)}
          >
            <X size={22} />
          </button>
        </div>
        <div className="sidebar-label">
          {admin ? "ADMIN WORKSPACE" : "YOUR WORKSPACE"}
        </div>
        <nav aria-label="Main navigation">
          {(admin ? adminLinks : links).map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/" || to === "/admin"}
              className={({ isActive }) => navigationClass(to, isActive)}
            >
              <Icon size={21} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <main
        id="main-content"
        className="main-content"
        inert={drawer || undefined}
      >
        <Outlet />
        <footer className="footer">
          <span>© {new Date().getFullYear()} PracticeIELTS</span>
        </footer>
      </main>
      <nav
        className="mobile-bottom-nav"
        style={
          admin
            ? {
                gridTemplateColumns: `repeat(${adminLinks.length}, minmax(0, 1fr))`,
              }
            : undefined
        }
        aria-label="Quick navigation"
        inert={drawer || undefined}
      >
        {(admin ? adminLinks : learnerQuickLinks).map(([to, label, Icon]) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/" || to === "/admin"}
            className={({ isActive }) => navigationClass(to, isActive)}
            aria-label={label}
          >
            <Icon size={21} aria-hidden="true" />
            <span>
              {admin
                ? to === "/admin"
                  ? "Home"
                  : to === "/admin/content"
                    ? "Content"
                    : to === "/admin/reading"
                      ? "Reading"
                      : to === "/admin/users"
                        ? "Users"
                        : to === "/admin/management"
                          ? "Manage"
                          : "Profile"
                : label}
            </span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
function Auth() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>();
  const navigate = useNavigate();
  const location = useLocation();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const result = await post<{ access: string; user: User }>(
        `auth/${mode}/`,
        data,
      );
      useAuth.getState().set(result.access, result.user);
      navigate((location.state as { from?: string })?.from || "/", {
        replace: true,
      });
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-story">
        <Brand />
        <div className="auth-story-content">
          <div className="eyebrow">LISTEN. PRACTISE. GROW.</div>
          <h1>
            Your next breakthrough
            <br />
            starts with listening.
          </h1>
          <p>
            A focused space to build your listening skills,
            <br />
            one sentence at a time.
          </p>
          <div className="auth-wave">
            <AudioLines size={100} />
          </div>
          <div className="auth-benefits">
            <span>
              <Headphones />
              Focused dictation
            </span>
            <span>
              <BookOpen />
              Transcript study
            </span>
            <span>
              <ChartNoAxesCombined />
              Meaningful progress
            </span>
          </div>
        </div>
        <span className="auth-bottom">Built for the way you learn.</span>
      </div>
      <div className="auth-form-side">
        <div className="auth-form-wrap">
          <span className="pill">YOUR LISTENING JOURNEY</span>
          <h1>
            {mode === "login" ? "Welcome back." : "Make room for progress."}
          </h1>
          <p>
            {mode === "login"
              ? "Sign in and pick up where you left off."
              : "Create your free student account to start practising."}
          </p>
          <form onSubmit={submit}>
            {error != null && <ErrorState error={error} />}
            <label>
              Username
              <input
                name="username"
                autoComplete="username"
                required
                maxLength={150}
                placeholder="Your username"
              />
            </label>
            {mode === "register" && (
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                />
              </label>
            )}
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                minLength={mode === "register" ? 8 : 1}
                required
                placeholder={
                  mode === "login" ? "Your password" : "At least 8 characters"
                }
              />
            </label>
            {mode === "register" && (
              <small className="muted">
                Use a unique password with letters and numbers.
              </small>
            )}
            <button className="button primary wide" disabled={pending}>
              {pending
                ? "Please wait…"
                : mode === "login"
                  ? "Sign in"
                  : "Create account"}
              <ArrowUpRight size={18} />
            </button>
          </form>
          <div className="auth-switch">
            {mode === "login"
              ? "New to PracticeIELTS?"
              : "Already have an account?"}{" "}
            <button
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError(undefined);
              }}
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
function Protected() {
  const user = useAuth((s) => s.user);
  const location = useLocation();
  return user ? (
    <Shell />
  ) : (
    <Navigate
      to="/login"
      replace
      state={{ from: location.pathname + location.search }}
    />
  );
}
export function App() {
  const [ready, setReady] = useState(false);
  const user = useAuth((s) => s.user);
  useEffect(() => {
    void restore()
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  if (!ready) return <Loading />;
  return (
    <Routes>
      <Route path="shared/practice/:token" element={<SharedPractice />} />
      <Route path="shared/mock/:token" element={<SharedMock />} />
      <Route path="shared/reading/:token" element={<SharedReadingResult />} />
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Auth />}
      />
      <Route element={<Protected />}>
        <Route index element={<Dashboard />} />
        <Route path="library" element={<NestedLibrary />} />
        <Route path="library/:id" element={<MaterialDetail />} />
        <Route
          path="dictation"
          element={<NestedLibrary defaultMode="practice" />}
        />
        <Route path="practice/:id" element={<Practice />} />
        <Route path="transcript/:id" element={<Transcript />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="mistakes" element={<Mistakes />} />
        <Route
          path="mock-tests"
          element={<NestedLibrary defaultMode="mock" />}
        />
        <Route path="mock-tests/history" element={<MockHistory />} />
        <Route path="mock/:id" element={<MockPage />} />
        <Route path="mock/:id/results" element={<MockResults />} />
        <Route path="reading" element={<ReadingLibrary />} />
        <Route path="reading/history" element={<ReadingHistory />} />
        <Route path="reading/attempts/:id" element={<ReadingAttemptPage />} />
        <Route
          path="reading/full/attempts/:id"
          element={<ReadingAttemptPage full />}
        />
        <Route
          path="reading/full/attempts/:id/results"
          element={<ReadingAttemptPage full results />}
        />
        <Route path="admin/reading" element={<ReadingReview />} />
        <Route path="admin/reading/import" element={<ReadingImport />} />
        <Route
          path="admin/reading/imports/:id"
          element={<ReadingImportDetail />}
        />
        <Route path="admin/reading/:id" element={<ReadingReview />} />
        <Route path="future/:module" element={<FutureModule />} />
        <Route path="profile" element={<Profile />} />
        <Route path="admin/users" element={<AdminUsers />} />
        <Route path="admin" element={<AdminHome />} />
        <Route path="admin/content" element={<TestStudio />} />
        <Route path="admin/management" element={<AdminManagement />} />
        <Route path="admin/materials" element={<Admin />} />
        <Route path="tests/:id" element={<TestDetail />} />
        <Route path="admin/:id" element={<Admin />} />
        <Route
          path="*"
          element={
            <div className="empty">
              <X />
              <h1>Page not found</h1>
              <Link className="button primary" to="/">
                Back to dashboard
              </Link>
            </div>
          }
        />
      </Route>
    </Routes>
  );
}
