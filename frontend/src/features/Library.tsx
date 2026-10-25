import { MockSelection } from "./Mock";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Search,
  FileText,
  ChevronRight,
  Headphones,
  BookOpen,
  ArrowLeft,
  Clock,
  FolderOpen,
  Play,
} from "lucide-react";
import {
  api,
  post,
  type Material,
  type Category,
  type Session,
} from "../services/api";
import {
  Loading,
  ErrorState,
  Empty,
  PageTitle,
  BookCover,
} from "../components/ui";
export function Library({ dictation = false }: { dictation?: boolean }) {
  const [params, setParams] = useSearchParams();
  const term = params.get("search") || "";
  const category = params.get("category") || "";
  const [search, setSearch] = useState(term);
  const mode = dictation ? "practice" : params.get("mode") || "all";
  const page = Math.max(1, Number(params.get("page")) || 1);
  useEffect(() => setSearch(term), [term]);
  const materials = useQuery({
    queryKey: ["materials", term, category, mode, page],
    queryFn: () =>
      api<{
        results: Material[];
        count: number;
        next: string | null;
        previous: string | null;
      }>(
        `materials/?search=${encodeURIComponent(term)}&category=${category}&page=${page}${mode === "mock" ? "&mock_available=true" : ""}`,
      ),
  });
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<{ results: Category[] }>("categories/"),
  });
  const selected = categories.data?.results.find(
    (c) => String(c.id) === category,
  );
  const descendants =
    categories.data?.results.filter(
      (c) => String(c.parent || "") === category,
    ) || [];
  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  }
  return (
    <>
      <PageTitle
        eyebrow={
          dictation ? "LISTENING / DICTATION" : "YOUR LISTENING COLLECTION"
        }
        title={
          dictation
            ? "Find your next dictation"
            : selected?.name || "Practice Library"
        }
        description={
          dictation
            ? "Choose a material. Listen closely. Make every word count."
            : "Good practice starts with the right material."
        }
      />
      <div className="breadcrumbs">
        <Link to="/">Dashboard</Link>
        <ChevronRight size={13} />
        <Link to="/library">Library</Link>
        {selected && (
          <>
            <ChevronRight size={13} />
            <span>{selected.name}</span>
          </>
        )}
      </div>
      {!dictation && (
        <nav className="library-modes" aria-label="Choose practice type">
          {(
            [
              ["all", "All materials", FolderOpen],
              ["mock", "Mock tests", FileText],
              ["practice", "Dictation", Headphones],
              ["transcript", "Transcript study", BookOpen],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={String(key)}
              className={mode === key ? "active" : ""}
              aria-pressed={mode === key}
              onClick={() => update("mode", String(key))}
            >
              <Icon size={17} />
              {String(label)}
            </button>
          ))}
        </nav>
      )}
      <div className="panel library-toolbar">
        <form
          className="search-field"
          onSubmit={(e) => {
            e.preventDefault();
            update("search", search);
          }}
        >
          <Search size={19} />
          <input
            aria-label="Search library"
            placeholder="Find materials, topics or keywords…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="button subtle" type="submit">
            Search
          </button>
        </form>
        <select
          aria-label="Filter by collection"
          value={category}
          onChange={(e) => update("category", e.target.value)}
        >
          <option value="">All collections</option>
          {categories.data?.results.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {(term || category) && (
        <div className="active-filters">
          <span>
            Showing {term ? `results for “${term}”` : "selected collection"}
            {selected ? ` · ${selected.name}` : ""}
          </span>
          <button
            className="text-link"
            onClick={() => {
              const next = new URLSearchParams(params);
              next.delete("search");
              next.delete("category");
              next.delete("page");
              setSearch("");
              setParams(next);
            }}
          >
            Clear filters
          </button>
        </div>
      )}
      {descendants.length > 0 && (
        <div className="collection-chips">
          {descendants.map((c) => (
            <button key={c.id} onClick={() => update("category", String(c.id))}>
              <FolderOpen size={16} />
              {c.name}
              <ChevronRight size={14} />
            </button>
          ))}
        </div>
      )}
      {materials.isPending ? (
        <Loading />
      ) : materials.error ? (
        <ErrorState error={materials.error} />
      ) : materials.data.results.length ? (
        <>
          <div className="results-count">
            {materials.data.count} material
            {materials.data.count !== 1 ? "s" : ""}{" "}
            {selected && `in ${selected.name}`}
          </div>
          <div className="materials-grid">
            {materials.data.results.map((m) => (
              <Link
                className="panel material-card"
                to={`/library/${m.id}${mode !== "all" ? `?mode=${mode}` : ""}`}
                key={m.id}
              >
                <div className="material-art">
                  <BookCover small />
                  <div className="material-play">
                    <Play size={22} />
                  </div>
                  <span className="pill">
                    {m.status === "draft" ? "DRAFT" : "LISTENING"}
                  </span>
                </div>
                <div className="material-card-info">
                  <span className="small-label muted">{m.category_name}</span>
                  <h3>{m.title}</h3>
                  <p>
                    {m.description ||
                      "Make time for focused listening practice."}
                  </p>
                  <div className="material-modes">
                    <span>
                      <Headphones size={13} />
                      Dictation
                    </span>
                    {m.mock_available && (
                      <span>
                        <FileText size={13} />
                        Mock · {m.question_count} questions
                      </span>
                    )}
                  </div>
                  <div className="material-bottom">
                    <span>
                      <Clock size={14} />
                      {m.audio
                        ? `${Math.ceil(m.audio.duration_ms / 60000)} min`
                        : "Audio pending"}
                    </span>
                    <span>
                      {mode === "mock"
                        ? "Open Mock"
                        : mode === "practice"
                          ? "Start Dictation"
                          : mode === "transcript"
                            ? "Study transcript"
                            : "Choose practice"}
                      <ChevronRight size={14} />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {(materials.data.next || materials.data.previous) && (
            <nav className="library-pagination" aria-label="Library pages">
              <button
                className="button secondary"
                disabled={!materials.data.previous}
                onClick={() => update("page", String(page - 1))}
              >
                Previous
              </button>
              <span>Page {page}</span>
              <button
                className="button secondary"
                disabled={!materials.data.next}
                onClick={() => update("page", String(page + 1))}
              >
                Next
              </button>
            </nav>
          )}
        </>
      ) : (
        <div className="panel">
          <Empty
            title={
              term || category || mode === "mock"
                ? "No matching materials"
                : "A fresh page for your listening journey"
            }
            description={
              term || category || mode === "mock"
                ? "Try a different keyword or collection."
                : "No published materials yet. Your teacher can add original or licensed recordings from the Admin Panel."
            }
          />
        </div>
      )}
    </>
  );
}
export function MaterialDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [difficulty, setDifficulty] = useState("easy");
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ["material", id],
    queryFn: () => api<Material>(`materials/${id}/`),
  });
  async function start() {
    setBusy(true);
    setError(undefined);
    try {
      const session = await post<Session>("sessions/", {
        material: Number(id),
        difficulty,
      });
      navigate(`/practice/${session.id}`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} />;
  const m = query.data;
  const mode = params.get("mode") || (m.mock_available ? "mock" : "practice");
  if (m.test_part || m.full_test)
    return (
      <Navigate
        replace
        to={`/tests/${m.test_part?.test || m.full_test}?part=${m.test_part?.number || "all"}&mode=${mode}`}
      />
    );
  return (
    <>
      <button
        className="back-link"
        onClick={() =>
          (window.history.state?.idx ?? 0) > 0
            ? navigate(-1)
            : navigate("/library")
        }
      >
        <ArrowLeft size={17} />
        Back
      </button>
      <div className="breadcrumbs">
        <Link to="/library">Library</Link>
        <ChevronRight size={13} />
        <Link to={`/library?category=${m.category}`}>{m.category_name}</Link>
        <ChevronRight size={13} />
        <span>{m.title}</span>
      </div>
      <PageTitle
        eyebrow="LISTENING PRACTICE"
        title={m.title}
        description={
          m.description || "A focused listening session, on your terms."
        }
      />
      <div className="detail-grid">
        <section className="panel detail-summary">
          <BookCover />
          <h3>{m.category_name}</h3>
          <div className="metadata">
            <span>
              <Clock size={16} />
              {m.audio
                ? `${Math.ceil(m.audio.duration_ms / 60000)} minutes`
                : "No audio"}
            </span>
            <span>
              <Headphones size={16} />
              {m.segments.length} segments
            </span>
          </div>
          <p className="muted">
            Source: {m.source || "Not provided"}
            <br />
            License: {m.license || "Not provided"}
          </p>
        </section>
        <section className="panel practice-options">
          <h2>How would you like to practise?</h2>
          <p className="muted">Choose a focus that works for you today.</p>
          <div className="mode-tabs">
            <button
              className={mode === "mock" ? "active" : ""}
              onClick={() => navigate(`/library/${id}?mode=mock`)}
            >
              <FileText size={18} />
              Listening Mock
            </button>
            <button
              className={mode === "practice" ? "active" : ""}
              onClick={() => navigate(`/library/${id}?mode=practice`)}
            >
              <Headphones size={18} />
              Dictation
            </button>
            <button
              className={mode === "transcript" ? "active" : ""}
              onClick={() => navigate(`/library/${id}?mode=transcript`)}
            >
              <BookOpen size={18} />
              Transcript Study
            </button>
          </div>
          {mode === "mock" ? (
            <MockSelection materialId={m.id} available={!!m.mock_available} />
          ) : mode === "transcript" ? (
            <>
              <p>
                Listen alongside the full transcript and replay any sentence.
              </p>
              <Link className="button primary" to={`/transcript/${id}`}>
                Open Transcript Study
                <ChevronRight size={18} />
              </Link>
            </>
          ) : (
            <>
              <div className="difficulty-options">
                {[
                  [
                    "easy",
                    "Easy",
                    "A short chunk or sentence · word count shown",
                  ],
                  ["medium", "Medium", "One complete sentence · no word count"],
                  [
                    "hard",
                    "Hard",
                    "Two or three sentences continuously · no word count",
                  ],
                  ["full", "Full dictation", "The complete section"],
                ].map(([key, name, desc]) => (
                  <label
                    className={difficulty === key ? "selected" : ""}
                    key={key}
                  >
                    <input
                      type="radio"
                      name="difficulty"
                      value={key}
                      checked={difficulty === key}
                      onChange={() => setDifficulty(key)}
                    />
                    <span>
                      <strong>{name}</strong>
                      <small>{desc}</small>
                    </span>
                  </label>
                ))}
              </div>
              {error != null && <ErrorState error={error} />}
              <button
                className="button primary"
                onClick={() => void start()}
                disabled={busy || m.status !== "published"}
              >
                {busy ? "Opening practice…" : "Start Dictation"}
                <ChevronRight size={18} />
              </button>
              {m.status !== "published" && (
                <p className="muted">This material is still a draft.</p>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
