import { useEffect, useState, type FormEvent } from "react";
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
  Bell,
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
} from "lucide-react";
import { useAuth } from "../stores/auth";
import { api, post, restore, type User } from "../services/api";
import { Loading, ErrorState } from "../components/ui";
import { MockLibrary, MockPage, MockResults } from "../features/Mock";
import { FutureModule } from "../features/Learning";
import { Dashboard } from "../features/Dashboard";
import { Library, MaterialDetail } from "../features/Library";
import { Practice } from "../features/Practice";
import { Admin } from "../features/Admin";
import {
  ProgressPage,
  Mistakes,
  Transcript,
  Profile,
} from "../features/Learning";

function Brand() {
  return (
    <Link to="/" className="brand" aria-label="PracticeIELTS home">
      <Headphones />
      <span>
        Practice<span>IELTS</span>
      </span>
    </Link>
  );
}
const links = [
  ["/", "Dashboard", House],
  ["/library", "Practice Library", LibraryBig],
  ["/dictation", "Dictation", Headphones],
  ["/mock-tests", "Mock Tests", FileText],
  ["/mistakes", "Mistake Review", BookOpen],
  ["/progress", "Progress", ChartNoAxesCombined],
] as const;
function Shell() {
  const [drawer, setDrawer] = useState(false);
  const [profile, setProfile] = useState(false);
  const [search, setSearch] = useState("");
  const user = useAuth((s) => s.user)!;
  const navigate = useNavigate();
  const location = useLocation();
  const cache = useQueryClient();
  useEffect(() => {
    window.scrollTo(0, 0);
    setDrawer(false);
    setProfile(false);
  }, [location.pathname]);
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
  async function logout() {
    await post("auth/logout/");
    useAuth.getState().clear();
    cache.clear();
  }
  function searchSubmit(e: FormEvent) {
    e.preventDefault();
    navigate(`/library?search=${encodeURIComponent(search)}`);
  }
  if (/^\/mock\/\d+\/?$/.test(location.pathname))
    return (
      <div className="exam-shell">
        <a className="skip-link" href="#main-content">
          Skip to questions
        </a>
        <header className="exam-topbar">
          <Brand />
          <span className="exam-candidate">
            <Headphones size={17} />
            Listening · {user.username}
          </span>
          <Link to="/mock-tests" className="exam-exit">
            Save & exit
          </Link>
        </header>
        <main id="main-content" className="exam-main">
          <Outlet />
        </main>
      </div>
    );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="topbar">
        <button
          className="icon-button mobile-menu"
          aria-label="Open navigation"
          aria-expanded={drawer}
          aria-controls="workspace-navigation"
          onClick={() => setDrawer(!drawer)}
        >
          <Menu />
        </button>
        <Brand />
        <form className="global-search" onSubmit={searchSubmit}>
          <Search size={20} />
          <input
            aria-label="Search materials"
            placeholder="Search for tests, topics or keywords..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <kbd>↵</kbd>
        </form>
        <div className="header-actions">
          <Link
            to="/progress"
            className="icon-button"
            aria-label="Learning activity"
          >
            <Bell size={23} />
          </Link>
          <button
            className="profile-button"
            aria-expanded={profile}
            onClick={() => setProfile(!profile)}
          >
            <span className="avatar">
              {user.username.slice(0, 2).toUpperCase()}
            </span>
            <span className="profile-name">{user.username}</span>
            <ChevronDown size={16} />
          </button>
          {profile && (
            <div className="profile-menu">
              <Link to="/profile">My profile</Link>
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
        id="workspace-navigation"
        className={`sidebar ${drawer ? "open" : ""}`}
      >
        <div className="sidebar-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          {links.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === "/"}>
              <Icon size={21} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="future-nav">
          <span>COMING LATER</span>
          {[
            ["reading", "Reading"],
            ["writing", "Writing"],
            ["speaking", "Speaking"],
          ].map(([key, title]) => (
            <NavLink key={key} to={`/future/${key}`}>
              <BookOpen size={17} />
              {title}
              <small>Future</small>
            </NavLink>
          ))}
        </div>
        {user.can_edit && (
          <div className="admin-nav">
            <NavLink to="/admin">
              <Settings size={21} />
              Admin Panel
              <span className="staff-dot" />
            </NavLink>
          </div>
        )}
        <div className="sidebar-footer">
          <div className="mini-mark">
            <AudioLines size={21} />
          </div>
          <strong>
            A little practice.
            <br />A little more confidence.
          </strong>
          <span>Your next step starts here.</span>
        </div>
      </aside>
      <main id="main-content" className="main-content">
        <Outlet />
        <footer className="footer">
          <span>© {new Date().getFullYear()} PracticeIELTS</span>
          <span>Small steps. Real progress.</span>
        </footer>
      </main>
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
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Auth />}
      />
      <Route element={<Protected />}>
        <Route index element={<Dashboard />} />
        <Route path="library" element={<Library />} />
        <Route path="library/:id" element={<MaterialDetail />} />
        <Route path="dictation" element={<Library dictation />} />
        <Route path="practice/:id" element={<Practice />} />
        <Route path="transcript/:id" element={<Transcript />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="mistakes" element={<Mistakes />} />
        <Route path="mock-tests" element={<MockLibrary />} />
        <Route path="mock/:id" element={<MockPage />} />
        <Route path="mock/:id/results" element={<MockResults />} />
        <Route path="future/:module" element={<FutureModule />} />
        <Route path="profile" element={<Profile />} />
        <Route path="admin" element={<Admin />} />
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
