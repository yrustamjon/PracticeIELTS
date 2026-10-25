import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  FileText,
  Headphones,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  api,
  allPages,
  post,
  type Category,
  type ListeningTest,
  type Material,
  type Page,
} from "../services/api";
import { useAuth } from "../stores/auth";
import { Loading, ErrorState, Empty, PageTitle } from "../components/ui";
import { CatalogBreadcrumbs, Pagination } from "./Catalog";
import { BookHierarchy, StudioFlow } from "./StudioHierarchy";

type Creation = { kind: "book" | "volume" | "test"; parent: number | null };
export function TestStudio() {
  const editor = useAuth((s) => s.user?.can_edit),
    cache = useQueryClient(),
    navigate = useNavigate();
  const [params, setParams] = useSearchParams(),
    requestedCategory = Number(params.get("category")) || null,
    testId = Number(params.get("test")) || null,
    page = Math.max(1, Number(params.get("page")) || 1),
    term = params.get("search") || "";
  const [search, setSearch] = useState(term),
    [dialog, setDialog] = useState<Creation | null>(null),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(),
    [attach, setAttach] = useState<number | null>(null),
    [attachMaterial, setAttachMaterial] = useState(""),
    [moveVolume, setMoveVolume] = useState("");
  const categories = useQuery({
    queryKey: ["categories", "all"],
    queryFn: () => allPages<Category>("categories/?page_size=100"),
    enabled: !!editor,
  });
  const test = useQuery({
    queryKey: ["studio-test", testId],
    queryFn: () => api<ListeningTest>(`listening-tests/${testId}/`),
    enabled: !!editor && !!testId,
    refetchInterval: (q) =>
      q.state.data &&
      ["queued", "running"].includes(q.state.data.assembly_state)
        ? 2000
        : false,
  });
  const t = test.data,
    category = t?.category || requestedCategory,
    selected = categories.data?.find((c) => c.id === category),
    children = (categories.data || []).filter(
      (c) => (c.parent || null) === category,
    ),
    isBook = !!selected && !selected.parent,
    showVolumes = isBook || !!children.length,
    isVolume = !!selected && !!selected.parent && !children.length;
  const stage = testId ? 4 : !category ? 1 : showVolumes ? 2 : 3;
  const tests = useQuery({
    queryKey: ["studio-tests", category, page, term],
    queryFn: () =>
      api<Page<ListeningTest>>(
        `listening-tests/?owned=true&category=${category}&page=${page}&page_size=6&search=${encodeURIComponent(term)}`,
      ),
    enabled: !!editor && isVolume && !testId,
  });
  const independent = useQuery({
    queryKey: ["studio-attach-materials"],
    queryFn: () =>
      allPages<Material>("materials/?standalone=true&page_size=100"),
    enabled: !!attach,
  });
  useEffect(() => {
    setSearch(term);
  }, [term]);
  useEffect(() => {
    setDialog(null);
    setAttach(null);
    setError(undefined);
  }, [category, testId]);
  useEffect(() => {
    if (!dialog && !attach) return;
    const previous = document.activeElement as HTMLElement | null;
    function key(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) {
        setDialog(null);
        setAttach(null);
      }
      if (e.key === "Tab") {
        const nodes = Array.from(
          document.querySelectorAll<HTMLElement>(
            ".studio-modal button:not(:disabled),.studio-modal input,.studio-modal select",
          ),
        );
        const first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [dialog, attach, busy]);
  if (!editor)
    return (
      <Empty
        title="Editors only"
        description="Your account cannot add or edit learning materials."
      />
    );
  function choose(c: number | null, id: number | null = null) {
    const p = new URLSearchParams();
    if (c) p.set("category", String(c));
    if (id) p.set("test", String(id));
    setParams(p);
    setError(undefined);
  }
  function open(kind: "book" | "volume" | "test") {
    setName("");
    setDialog({ kind, parent: kind === "book" ? null : category });
    setError(undefined);
  }
  function updateTest(next: ListeningTest) {
    cache.setQueryData(["studio-test", next.id], next);
    void cache.invalidateQueries({ queryKey: ["studio-tree-tests"] });
    void cache.invalidateQueries({ queryKey: ["studio-tests"] });
  }
  async function create(e: FormEvent) {
    e.preventDefault();
    if (!dialog) return;
    setBusy(true);
    setError(undefined);
    try {
      if (dialog.kind === "test") {
        const next = await post<ListeningTest>("listening-tests/", {
          title: name.trim(),
          category: dialog.parent,
        });
        updateTest(next);
        setDialog(null);
        choose(next.category, next.id);
      } else {
        const next = await post<Category>("categories/", {
          name: name.trim(),
          parent: dialog.parent,
        });
        await cache.invalidateQueries({ queryKey: ["categories"] });
        setDialog(null);
        choose(next.id);
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function part(number: number, material?: number) {
    if (!testId) return;
    setBusy(true);
    setError(undefined);
    try {
      const next = await post<ListeningTest>(
        `listening-tests/${testId}/parts/`,
        { number, ...(material ? { material } : {}) },
      );
      updateTest(next);
      setAttach(null);
      const p = next.parts.find((p) => p.number === number);
      if (p)
        navigate(`/admin/${p.id}?test=${next.id}&category=${next.category}`);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function fullRecording() {
    if (!testId) return;
    setBusy(true);
    setError(undefined);
    try {
      const next = await post<ListeningTest>(
        `listening-tests/${testId}/full-recording/`,
        {},
      );
      updateTest(next);
      if (next.full)
        navigate(
          `/admin/${next.full.id}?test=${next.id}&category=${next.category}`,
        );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function assemble() {
    setBusy(true);
    setError(undefined);
    try {
      const next = await post<ListeningTest>(
        `listening-tests/${testId}/assemble/`,
      );
      updateTest(next);
      await test.refetch();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function moveTest(e: FormEvent) {
    e.preventDefault();
    if (!t || !moveVolume) return;
    setBusy(true);
    setError(undefined);
    try {
      const next = await api<ListeningTest>(`listening-tests/${t.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ category: Number(moveVolume) }),
      });
      updateTest(next);
      choose(next.category, next.id);
      await cache.invalidateQueries({ queryKey: ["categories"] });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  function paginate(n: number) {
    const p = new URLSearchParams(params);
    p.set("page", String(n));
    setParams(p);
  }
  function find(e: FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams(params);
    search.trim() ? p.set("search", search.trim()) : p.delete("search");
    p.delete("page");
    setParams(p);
  }
  const ready = t?.parts.filter((p) => p.status === "published").length || 0,
    kind = !category ? "book" : showVolumes ? "volume" : "test",
    noun = !category ? "Books" : showVolumes ? "Volumes" : "Tests",
    listing = children.filter((c) =>
      c.name.toLowerCase().includes(term.toLowerCase()),
    ),
    createLabel =
      kind === "book"
        ? "Add book"
        : kind === "volume"
          ? "Add volume"
          : "New test";
  return (
    <div className="catalog-page admin-studio unified-studio">
      <PageTitle
        eyebrow="ADMIN / CONTENT LIBRARY"
        title={t?.title || selected?.name || "Books"}
        description={
          testId
            ? "Add and edit the Parts in this test."
            : !category
              ? "Choose a book, for example Cambridge."
              : showVolumes
                ? "Choose a volume, for example Cambridge 10."
                : "Choose a test to open its Parts."
        }
        action={
          testId ? (
            t ? (
              <Link className="button secondary" to={`/tests/${t.id}`}>
                Preview
                <ChevronRight size={15} />
              </Link>
            ) : undefined
          ) : categories.data && (!category || selected) ? (
            <button className="button primary" onClick={() => open(kind)}>
              <Plus size={16} />
              {createLabel}
            </button>
          ) : undefined
        }
      />
      <StudioFlow stage={stage} />
      <div className="studio-layout">
        <BookHierarchy categoryId={category} testId={testId} />
        <div className="studio-main">
          <div className="studio-location">
            <CatalogBreadcrumbs
              categories={categories.data || []}
              category={category}
              base="/admin"
              rootLabel="Books"
            />
            {t && (
              <span className="crumb-item">
                <ChevronRight size={12} />
                <strong>{t.title}</strong>
              </span>
            )}
          </div>
          {error != null && !dialog && !attach && <ErrorState error={error} />}{" "}
          {categories.isPending ? (
            <Loading />
          ) : categories.error ? (
            <ErrorState error={categories.error} />
          ) : category && !selected ? (
            <Empty
              title="Book or volume not found"
              description="Return to Books to choose another item."
              action={
                <Link className="button secondary" to="/admin">
                  Books
                </Link>
              }
            />
          ) : testId ? (
            <>
              {test.isPending ? (
                <Loading />
              ) : test.error ? (
                <ErrorState error={test.error} />
              ) : (
                t && (
                  <>
                    <div className="studio-level-heading">
                      <button
                        className="back-link"
                        onClick={() => choose(t.category)}
                      >
                        <ArrowLeft size={14} />
                        Back to tests
                      </button>
                      <h2>Parts</h2>
                    </div>
                    {!isVolume && (
                      <div className="notice-box legacy-test-location">
                        <p>
                          This existing test needs a volume inside its book.
                        </p>
                        {children.some(
                          (c) =>
                            !categories.data.some(
                              (child) => child.parent === c.id,
                            ),
                        ) ? (
                          <form onSubmit={(e) => void moveTest(e)}>
                            <label>
                              Move test to volume
                              <select
                                value={moveVolume}
                                required
                                onChange={(e) => setMoveVolume(e.target.value)}
                              >
                                <option value="">Choose a volume</option>
                                {children
                                  .filter(
                                    (c) =>
                                      !categories.data.some(
                                        (child) => child.parent === c.id,
                                      ),
                                  )
                                  .map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name}
                                    </option>
                                  ))}
                              </select>
                            </label>
                            <button
                              className="button secondary"
                              disabled={busy || !moveVolume}
                            >
                              Move test
                            </button>
                          </form>
                        ) : (
                          <button
                            className="text-link"
                            onClick={() => choose(t.category)}
                          >
                            Open the book to add a volume
                          </button>
                        )}
                      </div>
                    )}
                    <div className="full-test-banner">
                      <span className="full-test-icon">
                        <FileText size={23} />
                      </span>
                      <div>
                        <span className="small-label">
                          FULL MOCK + PRACTICE
                        </span>
                        <h3>
                          {t.assembly_state === "queued" ||
                          t.assembly_state === "running"
                            ? "Preparing Full test…"
                            : t.full?.status === "published"
                              ? "Full test is available"
                              : "Four Parts make one Full test"}
                        </h3>
                        <p>
                          {t.full?.status === "published"
                            ? `${t.full.question_count} published questions · ${t.full.mock_available ? "Mock + Practice" : "Practice available"}`
                            : "Publishing all four Parts prepares Full test automatically. You can also upload one complete recording."}
                        </p>
                      </div>
                      <span className="pill">{ready} / 4 ready</span>
                      <button
                        className="button secondary full-recording-button"
                        disabled={
                          busy ||
                          ["queued", "running"].includes(t.assembly_state)
                        }
                        onClick={() => void fullRecording()}
                      >
                        <Plus size={14} />
                        {t.full_source === "upload"
                          ? "Edit Full recording"
                          : "Upload Full recording"}
                      </button>
                    </div>
                    {t.assembly_state === "failed" && (
                      <div className="assembly-error">
                        <p role="alert">{t.assembly_error}</p>
                        <button
                          className="button secondary"
                          disabled={busy}
                          onClick={() => void assemble()}
                        >
                          Retry Full test
                        </button>
                      </div>
                    )}
                    <div className="studio-part-grid">
                      {[1, 2, 3, 4].map((n) => {
                        const p = t.parts.find((p) => p.number === n);
                        return (
                          <article className="panel studio-part-card" key={n}>
                            <div className="studio-part-card-top">
                              <span>0{n}</span>
                              <span
                                className={`status-badge ${p?.status || "empty"}`}
                              >
                                {p?.status === "published"
                                  ? "Published"
                                  : p
                                    ? "Draft"
                                    : "Empty"}
                              </span>
                            </div>
                            <h3>Part {n}</h3>
                            <p>
                              {p
                                ? `${p.question_count} published questions · ${p.status === "published" ? "Available for students" : "Continue the setup steps."}`
                                : "Audio → questions → transcript → review & publish."}
                            </p>
                            <div className="studio-part-features">
                              <span>
                                <Headphones size={12} />
                                Audio
                              </span>
                              <span>
                                <FileText size={12} />
                                Questions
                              </span>
                              <span>
                                <BookOpen size={12} />
                                Transcript
                              </span>
                            </div>
                            {p ? (
                              <Link
                                className="button secondary wide"
                                to={`/admin/${p.id}?test=${t.id}&category=${t.category}`}
                              >
                                <ChevronRight size={15} />
                                {p.status === "published"
                                  ? "Edit Part"
                                  : "Continue setup"}
                              </Link>
                            ) : (
                              <>
                                <button
                                  className="button secondary wide"
                                  disabled={busy}
                                  onClick={() => void part(n)}
                                >
                                  <Plus size={15} />
                                  Add Part
                                </button>
                                <button
                                  className="text-link attach-part"
                                  disabled={busy}
                                  onClick={() => {
                                    setAttach(n);
                                    setAttachMaterial("");
                                  }}
                                >
                                  Use an existing material
                                </button>
                              </>
                            )}
                          </article>
                        );
                      })}
                    </div>
                    <div className="notice-box">
                      Published Parts can be used individually. Full test
                      appears automatically after all four Parts are ready.
                    </div>
                  </>
                )
              )}
            </>
          ) : (
            <>
              <div className="studio-level-heading">
                {selected && (
                  <button
                    className="back-link"
                    onClick={() => choose(selected.parent)}
                  >
                    <ArrowLeft size={14} />
                    {selected.parent ? "Back to book" : "Back to books"}
                  </button>
                )}
                <div>
                  <h2>{!category ? "Choose a book" : noun}</h2>
                  <small className="muted">
                    {isVolume
                      ? tests.data
                        ? `${tests.data.count} tests`
                        : ""
                      : `${listing.length} ${noun.toLowerCase()}`}
                  </small>
                </div>
              </div>
              <form
                className="studio-level-search search-field"
                onSubmit={find}
              >
                <Search size={16} />
                <input
                  aria-label={`Search ${noun.toLowerCase()}`}
                  placeholder={`Search ${noun.toLowerCase()}…`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button className="button subtle">Search</button>
              </form>
              {isVolume ? (
                tests.isPending ? (
                  <Loading />
                ) : tests.error ? (
                  <ErrorState error={tests.error} />
                ) : tests.data.count ? (
                  <>
                    <div className="catalog-cards studio-test-cards">
                      {tests.data.results.map((next) => (
                        <button
                          key={next.id}
                          className="catalog-card"
                          onClick={() => choose(next.category, next.id)}
                        >
                          <div className="catalog-card-top">
                            <span className="catalog-folder">
                              <FileText size={22} />
                            </span>
                            <span className="pill">
                              {
                                next.parts.filter(
                                  (p) => p.status === "published",
                                ).length
                              }
                              /4 READY
                            </span>
                          </div>
                          <h3>{next.title}</h3>
                          <p>Full test and Parts 1–4</p>
                          <div className="catalog-card-bottom">
                            Open Parts
                            <ChevronRight size={14} />
                          </div>
                        </button>
                      ))}
                    </div>
                    <Pagination
                      page={page}
                      count={tests.data.count}
                      onChange={paginate}
                    />
                  </>
                ) : (
                  <div className="panel">
                    <Empty
                      title="No tests yet"
                      description={
                        term
                          ? "Try another test name."
                          : "Use New test above. Its Parts will appear inside the test."
                      }
                    />
                  </div>
                )
              ) : listing.length ? (
                <>
                  <div className="catalog-cards studio-test-cards">
                    {listing.slice((page - 1) * 6, page * 6).map((c) => (
                      <button
                        key={c.id}
                        className="catalog-card"
                        onClick={() => choose(c.id)}
                      >
                        <div className="catalog-card-top">
                          <span className="catalog-folder">
                            <BookOpen size={23} />
                          </span>
                          <span className="pill">
                            {c.parent ? "VOLUME" : "BOOK"}
                          </span>
                        </div>
                        <h3>{c.name}</h3>
                        <p>
                          {c.description ||
                            (!c.parent
                              ? "Open this book to choose a volume."
                              : "Open this volume to choose a test.")}
                        </p>
                        <div className="catalog-card-bottom">
                          {c.parent ? "Open tests" : "Open volumes"}
                          <ChevronRight size={14} />
                        </div>
                      </button>
                    ))}
                  </div>
                  {listing.length > 6 && (
                    <Pagination
                      page={page}
                      count={listing.length}
                      onChange={paginate}
                    />
                  )}
                </>
              ) : (
                <div className="panel">
                  <Empty
                    title={
                      term
                        ? `No matching ${noun.toLowerCase()}`
                        : !category
                          ? "Add your first book"
                          : "No volumes yet"
                    }
                    description={
                      term
                        ? "Try another name."
                        : !category
                          ? "Use Add book above, then add a volume inside it."
                          : "Use Add volume above, then create tests inside the volume."
                    }
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {dialog && (
        <div className="studio-modal-backdrop">
          <section
            className="studio-modal panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="studio-dialog-title"
          >
            <div className="section-title">
              <h2 id="studio-dialog-title">
                {dialog.kind === "book"
                  ? "Add book"
                  : dialog.kind === "volume"
                    ? "Add volume"
                    : "New test"}
              </h2>
              <button
                className="icon-button"
                disabled={busy}
                aria-label="Close dialog"
                onClick={() => setDialog(null)}
              >
                <X size={19} />
              </button>
            </div>
            <form onSubmit={(e) => void create(e)}>
              {dialog.parent && (
                <p className="studio-create-location">
                  Inside{" "}
                  <strong>
                    {categories.data?.find((c) => c.id === dialog.parent)?.name}
                  </strong>
                </p>
              )}
              <label>
                Name
                <input
                  autoFocus
                  required
                  maxLength={dialog.kind === "test" ? 200 : 120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    dialog.kind === "book"
                      ? "e.g. Cambridge"
                      : dialog.kind === "volume"
                        ? `e.g. ${selected?.name || "Cambridge"} 10`
                        : "e.g. Test 1"
                  }
                />
              </label>
              {error != null && <ErrorState error={error} />}
              <div className="studio-modal-actions">
                <button
                  className="button secondary"
                  type="button"
                  disabled={busy}
                  onClick={() => setDialog(null)}
                >
                  Cancel
                </button>
                <button
                  className="button primary"
                  disabled={busy || !name.trim()}
                >
                  {busy ? "Saving…" : "Create"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {attach && (
        <div className="studio-modal-backdrop">
          <section
            className="studio-modal panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="attach-title"
          >
            <div className="section-title">
              <h2 id="attach-title">Existing material → Part {attach}</h2>
              <button
                className="icon-button"
                disabled={busy}
                aria-label="Close dialog"
                onClick={() => setAttach(null)}
              >
                <X size={18} />
              </button>
            </div>
            <p className="muted">
              Choose a single-part material you own. Its versions and student
              history remain intact.
            </p>
            {independent.isPending ? (
              <Loading />
            ) : independent.error ? (
              <ErrorState error={independent.error} />
            ) : (
              <label>
                Material
                <select
                  value={attachMaterial}
                  onChange={(e) => setAttachMaterial(e.target.value)}
                >
                  <option value="">Select material</option>
                  {independent.data.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {error != null && <ErrorState error={error} />}
            <div className="studio-modal-actions">
              <button
                className="button secondary"
                onClick={() => setAttach(null)}
              >
                Cancel
              </button>
              <button
                className="button primary"
                disabled={busy || !attachMaterial}
                onClick={() => void part(attach, Number(attachMaterial))}
              >
                Use material
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
