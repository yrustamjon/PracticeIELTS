import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderOpen,
  Headphones,
  Plus,
  Search,
} from "lucide-react";
import {
  api,
  allPages,
  post,
  type Category,
  type Material,
  type Page,
  type ListeningTest,
  type Session,
  type MockAttempt,
} from "../services/api";
import { useAuth } from "../stores/auth";
import {
  Empty,
  ErrorState,
  Loading,
  PageTitle,
  BookCover,
} from "../components/ui";
import { MockSelection } from "./Mock";

export function Pagination({
  page,
  count,
  size = 6,
  onChange,
}: {
  page: number;
  count: number;
  size?: number;
  onChange: (n: number) => void;
}) {
  const total = Math.max(1, Math.ceil(count / size));
  return (
    <nav className="catalog-pagination" aria-label="Pages">
      <span>
        {count
          ? `${(page - 1) * size + 1}–${Math.min(page * size, count)} of ${count}`
          : "0 results"}
      </span>
      <div>
        <button
          className="icon-button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={15} />
        </button>
        {Array.from({ length: Math.min(total, 5) }, (_, i) => {
          const n = Math.min(Math.max(1, page - 2), Math.max(1, total - 4)) + i;
          return (
            <button
              key={n}
              className={page === n ? "active" : ""}
              aria-current={page === n ? "page" : undefined}
              onClick={() => onChange(n)}
            >
              {n}
            </button>
          );
        })}
        <button
          className="icon-button"
          aria-label="Next page"
          disabled={page >= total}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </nav>
  );
}
export function categoryPath(categories: Category[], id: number | null) {
  const path: Category[] = [],
    seen = new Set<number>();
  let current = categories.find((c) => c.id === id);
  while (current && !seen.has(current.id)) {
    path.unshift(current);
    seen.add(current.id);
    current = categories.find((c) => c.id === current!.parent);
  }
  return path;
}
export function CatalogBreadcrumbs({
  categories,
  category,
  base = "/library",
}: {
  categories: Category[];
  category: number | null;
  base?: string;
}) {
  return (
    <nav className="breadcrumbs" aria-label="Location">
      <Link to={base}>Library</Link>
      {categoryPath(categories, category).map((c) => (
        <span className="crumb-item" key={c.id}>
          <ChevronRight size={12} />
          <Link to={`${base}?category=${c.id}`}>{c.name}</Link>
        </span>
      ))}
    </nav>
  );
}
export function NestedLibrary({
  defaultMode = "all",
}: {
  defaultMode?: string;
}) {
  const [params, setParams] = useSearchParams(),
    category = Number(params.get("category")) || null,
    term = params.get("search") || "",
    page = Math.max(1, Number(params.get("page")) || 1),
    testPage = Math.max(1, Number(params.get("test_page")) || 1);
  const [search, setSearch] = useState(term),
    [folderPage, setFolderPage] = useState(1);
  const editor = useAuth((s) => s.user?.can_edit);
  useEffect(() => {
    setSearch(term);
    setFolderPage(1);
  }, [term, category]);
  const categories = useQuery({
    queryKey: ["categories", "all"],
    queryFn: () => allPages<Category>("categories/?page_size=100"),
  });
  const filter = `category=${category || ""}&search=${encodeURIComponent(term)}&page_size=6`,
    query = filter + `&page=${page}`,
    testQuery = filter + `&page=${testPage}`;
  const tests = useQuery({
    queryKey: ["listening-tests", testQuery],
    queryFn: () =>
      !category && !term
        ? Promise.resolve<Page<ListeningTest>>({
            results: [],
            count: 0,
            next: null,
            previous: null,
          })
        : api<Page<ListeningTest>>(`listening-tests/?${testQuery}`),
  });
  const materials = useQuery({
    queryKey: ["standalone-materials", query, defaultMode],
    queryFn: () =>
      api<Page<Material>>(
        `materials/?standalone=true&${query}${defaultMode === "mock" ? "&mock_available=true" : ""}`,
      ),
  });
  const attempts = useQuery({
    queryKey: ["mock-attempts"],
    queryFn: () => api<{ results: MockAttempt[] }>("mock-attempts/"),
    enabled: defaultMode === "mock",
  });
  const selected = categories.data?.find((c) => c.id === category),
    children = (categories.data || []).filter(
      (c) =>
        (c.parent || null) === category &&
        c.name.toLowerCase().includes(term.toLowerCase()),
    );
  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    if (key === "category") next.delete("search");
    if (key !== "page" && key !== "test_page") {
      next.delete("page");
      next.delete("test_page");
    }
    setParams(next);
  }
  return (
    <div className="catalog-page">
      <PageTitle
        eyebrow="LISTENING / LIBRARY"
        title={
          selected?.name ||
          (defaultMode === "mock" ? "Mock Tests" : "Practice Library")
        }
        description="Choose a collection, open a book, then select your test."
        action={
          editor ? (
            <Link
              className="button primary"
              to={`/admin${category ? `?category=${category}` : ""}`}
            >
              <Plus size={16} />
              Add material
            </Link>
          ) : undefined
        }
      />
      <CatalogBreadcrumbs
        categories={categories.data || []}
        category={category}
        base={
          defaultMode === "practice"
            ? "/dictation"
            : defaultMode === "mock"
              ? "/mock-tests"
              : "/library"
        }
      />
      <div className="catalog-toolbar">
        {category && (
          <button
            className="button secondary"
            onClick={() =>
              update(
                "category",
                selected?.parent ? String(selected.parent) : "",
              )
            }
          >
            <ArrowLeft size={16} />
            Back
          </button>
        )}
        <form
          className="search-field"
          onSubmit={(e) => {
            e.preventDefault();
            update("search", search);
          }}
        >
          <Search size={17} />
          <input
            aria-label="Search library"
            placeholder="Search this collection…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="button subtle">Search</button>
        </form>
        {term && (
          <button className="text-link" onClick={() => update("search", "")}>
            Clear
          </button>
        )}
      </div>
      {categories.error && <ErrorState error={categories.error} />}
      <div className="catalog-scroll">
        {defaultMode === "mock" && attempts.error && (
          <ErrorState error={attempts.error} />
        )}
        {defaultMode === "mock" &&
          attempts.data?.results.some((a) => !a.submitted_at) && (
            <section className="panel catalog-resume">
              <h2>Continue your mock</h2>
              <div className="catalog-resume-list">
                {attempts.data.results
                  .filter((a) => !a.submitted_at)
                  .map((a) => (
                    <Link
                      key={a.id}
                      className="exam-history-row"
                      to={`/mock/${a.id}`}
                    >
                      <FileText size={18} />
                      <span>
                        <strong>{a.title}</strong>
                        <small>
                          {a.timing === "untimed"
                            ? "No time limit"
                            : "Timed attempt"}
                        </small>
                      </span>
                      <ChevronRight size={15} />
                    </Link>
                  ))}
              </div>
            </section>
          )}

        {children.length > 0 && (
          <section className="catalog-section">
            <div className="section-title">
              <h2>{category ? "Books & collections" : "Your collections"}</h2>
              <small className="muted">{children.length} collections</small>
            </div>
            <div className="catalog-cards">
              {children.slice((folderPage - 1) * 6, folderPage * 6).map((c) => (
                <button
                  className="catalog-card"
                  key={c.id}
                  onClick={() => update("category", String(c.id))}
                >
                  <div className="catalog-card-top">
                    <span className="catalog-folder">
                      <FolderOpen size={23} />
                    </span>
                    <span className="pill">
                      {c.parent ? "BOOK / COLLECTION" : "COLLECTION"}
                    </span>
                  </div>
                  <h3>{c.name}</h3>
                  <p>
                    {c.description ||
                      "Open the books and tests in this collection."}
                  </p>
                  <div className="catalog-card-bottom">
                    Open collection
                    <ChevronRight size={15} />
                  </div>
                </button>
              ))}
            </div>
            {children.length > 6 && (
              <Pagination
                page={folderPage}
                count={children.length}
                onChange={setFolderPage}
              />
            )}
          </section>
        )}
        {tests.isPending || materials.isPending ? (
          <Loading />
        ) : tests.error ? (
          <ErrorState error={tests.error} />
        ) : materials.error ? (
          <ErrorState error={materials.error} />
        ) : (
          <>
            {!!tests.data.count && (
              <section className="catalog-section">
                <div className="section-title">
                  <h2>Tests</h2>
                  <small className="muted">Full test + separate Parts</small>
                </div>
                <div className="catalog-cards">
                  {tests.data.results.map((t) => (
                    <Link
                      className="catalog-card"
                      key={t.id}
                      to={`/tests/${t.id}?mode=${defaultMode === "practice" ? "practice" : "mock"}`}
                    >
                      <div className="catalog-card-top">
                        <span className="catalog-folder">
                          <FileText size={22} />
                        </span>
                        <span className="pill">
                          {
                            t.parts.filter((p) => p.status === "published")
                              .length
                          }
                          /4 PARTS
                        </span>
                      </div>
                      <h3>{t.title}</h3>
                      <p>
                        {t.category_name} ·{" "}
                        {t.full?.status === "published"
                          ? "Full test available"
                          : "Work with the published Parts"}
                      </p>
                      <div className="catalog-card-bottom">
                        Mock + Practice
                        <ChevronRight size={15} />
                      </div>
                    </Link>
                  ))}
                </div>
                {tests.data.count > 6 && (
                  <Pagination
                    page={testPage}
                    count={tests.data.count}
                    onChange={(n) => update("test_page", String(n))}
                  />
                )}
              </section>
            )}
            {!!materials.data.count && (
              <section className="catalog-section">
                <div className="section-title">
                  <h2>
                    {tests.data.count
                      ? "Independent materials"
                      : "Listening materials"}
                  </h2>
                  <small className="muted">
                    {materials.data.count} materials
                  </small>
                </div>
                <div className="catalog-cards">
                  {materials.data.results.map((m) => (
                    <Link
                      className="catalog-card"
                      to={`/library/${m.id}?mode=${defaultMode === "practice" ? "practice" : m.mock_available ? "mock" : "practice"}`}
                      key={m.id}
                    >
                      <div className="catalog-card-top">
                        <span className="catalog-folder">
                          <Headphones size={22} />
                        </span>
                        <span className="pill">
                          {m.status === "draft"
                            ? "DRAFT"
                            : m.mock_available
                              ? "MOCK + PRACTICE"
                              : "PRACTICE"}
                        </span>
                      </div>
                      <h3>{m.title}</h3>
                      <p>{m.category_name}</p>
                      <div className="catalog-card-bottom">
                        Open material
                        <ChevronRight size={15} />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
            {!children.length && !tests.data.count && !materials.data.count && (
              <div className="panel">
                <Empty
                  title="No materials in this collection"
                  description={
                    term
                      ? "Try another search."
                      : "Published tests and Parts will appear here."
                  }
                  action={
                    editor ? (
                      <Link className="button secondary" to="/admin">
                        Open Admin Panel
                      </Link>
                    ) : undefined
                  }
                />
              </div>
            )}
            {materials.data.count > 6 && (
              <Pagination
                page={page}
                count={materials.data.count}
                onChange={(n) => update("page", String(n))}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function TestDetail() {
  const { id } = useParams(),
    [params, setParams] = useSearchParams(),
    navigate = useNavigate();
  const [difficulty, setDifficulty] = useState("easy"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>();
  const test = useQuery({
    queryKey: ["listening-test", id],
    queryFn: () => api<ListeningTest>(`listening-tests/${id}/`),
    refetchInterval: (q) =>
      q.state.data &&
      ["queued", "running"].includes(q.state.data.assembly_state)
        ? 2000
        : false,
  });
  const cats = useQuery({
    queryKey: ["categories", "all"],
    queryFn: () => allPages<Category>("categories/?page_size=100"),
  });
  if (test.isPending) return <Loading />;
  if (test.error) return <ErrorState error={test.error} />;
  const t = test.data,
    part =
      params.get("part") ||
      (t.full?.status === "published"
        ? "all"
        : String(
            t.parts.find((p) => p.status === "published")?.number || "all",
          )),
    target =
      part === "all" ? t.full : t.parts.find((p) => String(p.number) === part),
    mode = params.get("mode") || "mock";
  function choose(key: string, value: string) {
    const n = new URLSearchParams(params);
    n.set(key, value);
    setParams(n);
  }
  async function start() {
    if (!target) return;
    setBusy(true);
    setError(undefined);
    try {
      const s = await post<Session>("sessions/", {
        material: target.id,
        difficulty,
      });
      navigate(`/practice/${s.id}`);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="catalog-page test-detail">
      <CatalogBreadcrumbs categories={cats.data || []} category={t.category} />
      <PageTitle
        eyebrow="ONE TEST / MOCK + PRACTICE"
        title={t.title}
        description="Choose the full test or work through one Part at a time."
        action={
          <Link
            className="button secondary"
            to={`/library?category=${t.category}`}
          >
            <ArrowLeft size={16} />
            Back to tests
          </Link>
        }
      />
      <nav className="test-part-picker" aria-label="Choose test section">
        {["all", "1", "2", "3", "4"].map((p) => {
          const m =
            p === "all" ? t.full : t.parts.find((x) => String(x.number) === p);
          return (
            <button
              key={p}
              className={p === part ? "active" : ""}
              aria-pressed={p === part}
              disabled={!m || m.status !== "published"}
              onClick={() => choose("part", p)}
            >
              {p === "all" ? "Full test" : `Part ${p}`}
              <small>
                {p === "all"
                  ? "Parts 1–4"
                  : m?.question_count
                    ? `${m.question_count} questions`
                    : "Dictation"}
                {!m || m.status !== "published" ? " · Not ready" : ""}
              </small>
            </button>
          );
        })}
      </nav>
      <div className="test-mode-layout">
        <aside className="panel test-overview">
          <div className="test-cover">
            <BookCover />
          </div>
          <div className="test-overview-copy">
            <span className="small-label muted">{t.category_name}</span>
            <h2>{part === "all" ? "Full test" : `Part ${part}`}</h2>
            <p className="muted">
              {part === "all"
                ? "All four Parts, one focused attempt."
                : "Study this Part independently."}
            </p>
            <span className="test-question-count">
              <FileText size={14} />
              {target?.question_count || 0} published questions
            </span>
          </div>
          <div className="test-outline">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className={
                  part === "all" || part === String(n) ? "selected" : ""
                }
              >
                <span>
                  <Check size={13} />
                  Part {n}
                </span>
                <small>
                  {t.parts.find((p) => p.number === n)?.status === "published"
                    ? "Available"
                    : "Not ready"}
                </small>
              </div>
            ))}
          </div>
        </aside>
        <section className="panel test-mode-panel">
          <h2>How would you like to practise?</h2>
          <div className="test-mode-cards">
            {[
              ["mock", "Mock", "Answer the original exam questions."],
              [
                "practice",
                "Practice",
                "Listen to a sentence or chunk and write.",
              ],
            ].map(([key, title, description]) => (
              <button
                key={key}
                className={mode === key ? "active" : ""}
                aria-pressed={mode === key}
                onClick={() => choose("mode", key)}
              >
                {key === "mock" ? (
                  <FileText size={24} />
                ) : (
                  <Headphones size={24} />
                )}
                <strong>{title}</strong>
                <span>{description}</span>
                <small>
                  {mode === key ? "Selected" : "Choose"}
                  <ChevronRight size={12} />
                </small>
              </button>
            ))}
          </div>
          {!target || target.status !== "published" ? (
            <p className="notice-box">
              This section is not published yet. Choose an available Part.
            </p>
          ) : mode === "mock" ? (
            <MockSelection
              key={target.id}
              materialId={target.id}
              available={target.mock_available}
            />
          ) : (
            <>
              <div className="test-difficulties">
                {[
                  ["easy", "Easy", "Short chunks · word count shown"],
                  ["medium", "Medium", "One sentence · no word count"],
                  ["hard", "Hard", "2–3 consecutive sentences"],
                ].map(([key, title, text]) => (
                  <label
                    key={key}
                    className={difficulty === key ? "selected" : ""}
                  >
                    <input
                      type="radio"
                      name="difficulty"
                      checked={difficulty === key}
                      onChange={() => setDifficulty(key)}
                    />
                    <span>
                      <strong>{title}</strong>
                      <small>{text}</small>
                    </span>
                  </label>
                ))}
              </div>
              <p className="notice-box">
                Practice uses the reviewed transcript and original audio from
                this {part === "all" ? "test" : "Part"}.
              </p>
              {error != null && <ErrorState error={error} />}
              <button
                className="button primary"
                disabled={busy}
                onClick={() => void start()}
              >
                {busy ? "Opening…" : "Start Dictation"}
                <ChevronRight size={16} />
              </button>
            </>
          )}
          {target?.status === "published" && (
            <Link
              className="text-link test-transcript-link"
              to={`/transcript/${target.id}`}
            >
              <BookOpen size={14} />
              Transcript Study
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}
