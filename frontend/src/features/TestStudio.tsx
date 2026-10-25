import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  FileText,
  FolderOpen,
  Headphones,
  Plus,
  Search,
  Settings,
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

export function TestStudio() {
  const editor = useAuth((s) => s.user?.can_edit),
    cache = useQueryClient(),
    navigate = useNavigate();
  const [params, setParams] = useSearchParams(),
    category = Number(params.get("category")) || null,
    testId = Number(params.get("test")) || null;
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [dialog, setDialog] = useState<"source" | "book" | "test" | null>(null),
    [name, setName] = useState(""),
    [parent, setParent] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(),
    [attach, setAttach] = useState<number | null>(null),
    [attachMaterial, setAttachMaterial] = useState("");
  const categories = useQuery({
    queryKey: ["categories", "all"],
    queryFn: () => allPages<Category>("categories/?page_size=100"),
    enabled: !!editor,
  });
  const tests = useQuery({
    queryKey: ["studio-tests", category, page],
    queryFn: () =>
      api<Page<ListeningTest>>(
        `listening-tests/?owned=true&category=${category || ""}&page=${page}&page_size=6`,
      ),
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
  const independent = useQuery({
    queryKey: ["studio-attach-materials"],
    queryFn: () =>
      allPages<Material>("materials/?standalone=true&page_size=100"),
    enabled: !!attach,
  });
  useEffect(() => {
    setPage(1);
  }, [category]);
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
            ".studio-modal button:not(:disabled),.studio-modal input,.studio-modal select,.studio-modal a",
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
  function choose(c: number | null, t: number | null = null) {
    const p = new URLSearchParams();
    if (c) p.set("category", String(c));
    if (t) p.set("test", String(t));
    setParams(p);
    setError(undefined);
  }
  function open(type: "source" | "book" | "test") {
    setName("");
    setParent(category ? String(category) : "");
    setDialog(type);
    setError(undefined);
  }
  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      if (dialog === "test") {
        const t = await post<ListeningTest>("listening-tests/", {
          title: name.trim(),
          category: Number(parent),
        });
        setDialog(null);
        choose(t.category, t.id);
      } else {
        const c = await post<Category>("categories/", {
          name: name.trim(),
          parent: dialog === "source" ? null : Number(parent) || null,
        });
        setDialog(null);
        choose(c.id);
        await cache.invalidateQueries({ queryKey: ["categories"] });
      }
      await cache.invalidateQueries({ queryKey: ["studio-tests"] });
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
      const t = await post<ListeningTest>(`listening-tests/${testId}/parts/`, {
        number,
        ...(material ? { material } : {}),
      });
      cache.setQueryData(["studio-test", testId], t);
      setAttach(null);
      const p = t.parts.find((p) => p.number === number);
      if (p) navigate(`/admin/${p.id}?test=${t.id}&category=${t.category}`);
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
      const t = await post<ListeningTest>(
        `listening-tests/${testId}/full-recording/`,
        {},
      );
      cache.setQueryData(["studio-test", testId], t);
      if (t.full)
        navigate(`/admin/${t.full.id}?test=${t.id}&category=${t.category}`);
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
      const t = await post<ListeningTest>(
        `listening-tests/${testId}/assemble/`,
      );
      cache.setQueryData(["studio-test", testId], t);
      await test.refetch();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const selected = categories.data?.find((c) => c.id === category),
    t = test.data,
    ready = t?.parts.filter((p) => p.status === "published").length || 0;
  function tree(parentId: number | null, depth = 0): ReactNode {
    if (depth > 12) return null;
    return (categories.data || [])
      .filter((c) => (c.parent || null) === parentId)
      .map((c) => (
        <div className="studio-tree-item" key={c.id}>
          <button
            className={category === c.id ? "selected" : ""}
            style={{ paddingLeft: 12 + depth * 12 }}
            onClick={() => choose(c.id)}
          >
            {c.parent ? <BookOpen size={15} /> : <FolderOpen size={15} />}
            <span>{c.name}</span>
          </button>
          {tree(c.id, depth + 1)}
        </div>
      ));
  }
  return (
    <div className="catalog-page admin-studio">
      <PageTitle
        eyebrow="ADMIN / MATERIALS"
        title="Everything in its place."
        description="Choose a book, open a test, then prepare each Part separately."
        action={
          <button className="button primary" onClick={() => open("book")}>
            <Plus size={16} />
            Add book
          </button>
        }
      />
      <div className="studio-section-tabs">
        <span>
          <FileText size={16} />
          Materials
        </span>
        <Link to="/admin/materials">
          <Settings size={14} />
          Independent materials & collections
        </Link>
        <Link to="/library">
          Student view
          <ChevronRight size={13} />
        </Link>
      </div>
      {error != null && !dialog && !attach && <ErrorState error={error} />}
      <div className="studio-layout">
        <aside className="panel studio-tree">
          <div className="studio-tree-head">
            <strong>Collections & books</strong>
            <button
              className="icon-button"
              aria-label="Add source collection"
              onClick={() => open("source")}
            >
              <Plus size={16} />
            </button>
          </div>
          <label className="studio-tree-search">
            <Search size={15} />
            <input
              aria-label="Find a book"
              placeholder="Find a book…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="studio-tree-scroll">
            {categories.isPending ? (
              <Loading />
            ) : categories.error ? (
              <ErrorState error={categories.error} />
            ) : search ? (
              (categories.data || [])
                .filter((c) =>
                  c.name.toLowerCase().includes(search.toLowerCase()),
                )
                .map((c) => (
                  <button
                    key={c.id}
                    className="tree-search-result"
                    onClick={() => {
                      choose(c.id);
                      setSearch("");
                    }}
                  >
                    <BookOpen size={15} />
                    {c.name}
                  </button>
                ))
            ) : (
              tree(null)
            )}
            {!categories.isPending && !categories.data?.length && (
              <button
                className="button secondary"
                onClick={() => open("source")}
              >
                Create your first collection
              </button>
            )}
          </div>
          <div className="studio-tree-bottom">
            <FolderOpen size={13} />
            Source → book → test
          </div>
        </aside>
        <div className="studio-main">
          <CatalogBreadcrumbs
            categories={categories.data || []}
            category={category}
            base="/admin"
          />
          {testId ? (
            <>
              {test.isPending ? (
                <Loading />
              ) : test.error ? (
                <ErrorState error={test.error} />
              ) : (
                t && (
                  <>
                    <div className="studio-test-heading">
                      <div>
                        <button
                          className="back-link"
                          onClick={() => choose(t.category)}
                        >
                          <ArrowLeft size={14} />
                          Back to tests
                        </button>
                        <h2>{t.title}</h2>
                        <p className="muted">
                          One upload per Part. Mock and Practice use the same
                          content.
                        </p>
                      </div>
                      <Link className="button secondary" to={`/tests/${t.id}`}>
                        Preview
                        <ChevronRight size={15} />
                      </Link>
                    </div>
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
              <div className="studio-test-heading">
                <div>
                  <h2>{selected?.name || "All books"} · Tests</h2>
                  <p className="muted">Open a test to add its Parts.</p>
                </div>
                <button
                  className="button primary"
                  disabled={!categories.data?.length}
                  onClick={() => open("test")}
                >
                  <Plus size={15} />
                  New test
                </button>
              </div>
              {tests.isPending ? (
                <Loading />
              ) : tests.error ? (
                <ErrorState error={tests.error} />
              ) : tests.data.count ? (
                <>
                  <div className="catalog-cards studio-test-cards">
                    {tests.data.results.map((t) => (
                      <button
                        key={t.id}
                        className="catalog-card"
                        onClick={() => choose(t.category, t.id)}
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
                            /4 READY
                          </span>
                        </div>
                        <h3>{t.title}</h3>
                        <p>{t.category_name}</p>
                        <div className="catalog-card-bottom">
                          Manage Parts
                          <ChevronRight size={14} />
                        </div>
                      </button>
                    ))}
                  </div>
                  <Pagination
                    page={page}
                    count={tests.data.count}
                    onChange={setPage}
                  />
                </>
              ) : (
                <div className="panel">
                  <Empty
                    title="Your next test starts here"
                    description="Create a test in the selected book, then add Parts 1–4."
                    action={
                      <button
                        className="button secondary"
                        disabled={!categories.data?.length}
                        onClick={() => open("test")}
                      >
                        <Plus size={15} />
                        Create test
                      </button>
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
                {dialog === "source"
                  ? "New collection"
                  : dialog === "book"
                    ? "Add a book"
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
              <label>
                Name
                <input
                  autoFocus
                  required
                  maxLength={dialog === "test" ? 200 : 120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    dialog === "source"
                      ? "e.g. Cambridge"
                      : dialog === "book"
                        ? "e.g. Cambridge 10"
                        : "e.g. Test 1"
                  }
                />
              </label>
              {dialog !== "source" && (
                <label>
                  {dialog === "book" ? "Inside collection" : "Inside book"}
                  <select
                    required
                    value={parent}
                    onChange={(e) => setParent(e.target.value)}
                  >
                    <option value="">Select a collection</option>
                    {categories.data?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {categoryPathLabel(categories.data, c)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
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
function categoryPathLabel(categories: Category[], c: Category) {
  const p = categories.find((x) => x.id === c.parent);
  return p ? `${p.name} / ${c.name}` : c.name;
}
