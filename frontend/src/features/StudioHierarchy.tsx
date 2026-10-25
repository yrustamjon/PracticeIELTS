import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  ChevronRight,
  FileText,
  Headphones,
  Search,
} from "lucide-react";
import {
  allPages,
  post,
  type Category,
  type ListeningTest,
} from "../services/api";
import { Loading, ErrorState } from "../components/ui";
import { categoryPath } from "./Catalog";

export function StudioFlow({ stage }: { stage: number }) {
  return (
    <ol className="studio-flow" aria-label="Content workflow">
      {["Book", "Volume", "Test", "Parts"].map((name, i) => (
        <li
          key={name}
          className={
            stage === i + 1 ? "current" : stage > i + 1 ? "complete" : ""
          }
          aria-current={stage === i + 1 ? "step" : undefined}
        >
          <span>{i + 1}</span>
          {name}
          {i < 3 && <ChevronRight size={12} />}
        </li>
      ))}
    </ol>
  );
}
export function BookHierarchy({
  categoryId,
  testId,
  partNumber,
  full = false,
}: {
  categoryId: number | null;
  testId: number | null;
  partNumber?: number;
  full?: boolean;
}) {
  const navigate = useNavigate(),
    cache = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set()),
    [term, setTerm] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>();
  const current = useRef<HTMLButtonElement | null>(null);
  const categories = useQuery({
    queryKey: ["categories", "all"],
    queryFn: () => allPages<Category>("categories/?page_size=100"),
  });
  const tests = useQuery({
    queryKey: ["studio-tree-tests"],
    queryFn: () =>
      allPages<ListeningTest>("listening-tests/?owned=true&page_size=100"),
  });
  const activeTest = tests.data?.find((t) => t.id === testId),
    effectiveCategory = activeTest?.category || categoryId;
  useEffect(() => {
    const path = categoryPath(categories.data || [], effectiveCategory);
    setExpanded((old) => {
      const next = new Set(old);
      path.forEach((c) => next.add("c" + c.id));
      if (testId) next.add("t" + testId);
      return next;
    });
  }, [effectiveCategory, testId, categories.data]);
  useEffect(() => {
    current.current?.scrollIntoView({ block: "nearest" });
  }, [partNumber, full, testId, tests.data]);
  function toggle(key: string) {
    setExpanded((old) => {
      const next = new Set(old);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }
  function choose(category: number, test?: number) {
    setTerm("");
    navigate(`/admin?category=${category}${test ? `&test=${test}` : ""}`);
  }
  async function openPart(t: ListeningTest, n: number) {
    const p = t.parts.find((p) => p.number === n);
    if (p) {
      navigate(`/admin/${p.id}?category=${t.category}&test=${t.id}`);
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const next = await post<ListeningTest>(`listening-tests/${t.id}/parts/`, {
        number: n,
      });
      cache.setQueryData(["studio-test", t.id], next);
      await cache.invalidateQueries({ queryKey: ["studio-tree-tests"] });
      const created = next.parts.find((p) => p.number === n);
      if (created)
        navigate(`/admin/${created.id}?category=${t.category}&test=${t.id}`);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  function testNode(t: ListeningTest) {
    const open = expanded.has("t" + t.id),
      active = testId === t.id;
    return (
      <li key={"t" + t.id} className="hierarchy-test">
        <div className={"hierarchy-row " + (active ? "ancestor" : "")}>
          <button
            className={"hierarchy-toggle " + (open ? "expanded" : "")}
            aria-label={`${open ? "Collapse" : "Expand"} ${t.title}`}
            aria-expanded={open}
            onClick={() => toggle("t" + t.id)}
          >
            <ChevronRight size={12} />
          </button>
          <button
            className="hierarchy-select"
            aria-current={active && !partNumber && !full ? "page" : undefined}
            onClick={() => choose(t.category, t.id)}
          >
            <FileText size={14} />
            <span>{t.title}</span>
            <small>
              {t.parts.filter((p) => p.status === "published").length}/4
            </small>
          </button>
        </div>
        {open && (
          <ul>
            {t.full && (
              <li>
                <button
                  ref={active && full ? current : undefined}
                  className="hierarchy-leaf"
                  aria-current={active && full ? "page" : undefined}
                  onClick={() =>
                    navigate(
                      `/admin/${t.full!.id}?category=${t.category}&test=${t.id}`,
                    )
                  }
                >
                  <FileText size={13} />
                  <span>Full test</span>
                </button>
              </li>
            )}
            {[1, 2, 3, 4].map((n) => {
              const p = t.parts.find((p) => p.number === n),
                selected = active && partNumber === n;
              return (
                <li key={n}>
                  <button
                    ref={selected ? current : undefined}
                    className="hierarchy-leaf"
                    disabled={busy}
                    aria-current={selected ? "page" : undefined}
                    aria-label={`${p ? "Open" : "Add"} Part ${n}, ${t.title}`}
                    onClick={() => void openPart(t, n)}
                  >
                    <Headphones size={13} />
                    <span>Part {n}</span>
                    <small className={p?.status === "published" ? "ready" : ""}>
                      {p?.status === "published"
                        ? "Ready"
                        : p
                          ? "Draft"
                          : "Not added"}
                    </small>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </li>
    );
  }
  function branch(parent: number | null, seen = new Set<number>()): ReactNode {
    return (categories.data || [])
      .filter(
        (c) =>
          (c.parent || null) === parent &&
          !seen.has(c.id),
      )
      .map((c) => {
        const open = expanded.has("c" + c.id),
          path = categoryPath(categories.data || [], effectiveCategory),
          active = effectiveCategory === c.id && !testId;
        const next = new Set(seen);
        next.add(c.id);
        return (
          <li key={c.id}>
            <div
              className={
                "hierarchy-row " +
                (path.some((p) => p.id === c.id) ? "ancestor" : "")
              }
            >
              <button
                className={"hierarchy-toggle " + (open ? "expanded" : "")}
                aria-label={`${open ? "Collapse" : "Expand"} ${c.name}`}
                aria-expanded={open}
                onClick={() => toggle("c" + c.id)}
              >
                <ChevronRight size={12} />
              </button>
              <button
                className="hierarchy-select"
                aria-current={active ? "page" : undefined}
                onClick={() => choose(c.id)}
              >
                <BookOpen size={15} />
                <span>{c.name}</span>
              </button>
            </div>
            {open && (
              <ul>
                {branch(c.id, next)}
                {tests.data
                  ?.filter((t) => t.category === c.id)
                  .map(testNode)}
              </ul>
            )}
          </li>
        );
      });
  }
  return (
    <aside className="panel studio-tree book-hierarchy">
      <div className="studio-tree-head">
        <strong>Your books</strong>
      </div>
      <label className="studio-tree-search">
        <Search size={15} />
        <input
          aria-label="Find a book or test"
          placeholder="Find a book or test…"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
      </label>
      <nav className="studio-tree-scroll" aria-label="Book hierarchy">
        {categories.isPending ? (
          <Loading />
        ) : categories.error ? (
          <ErrorState error={categories.error} />
        ) : (
          <ul>
            {term ? (
              <>
                {categories.data
                  .filter((c) =>
                    c.name.toLowerCase().includes(term.toLowerCase()),
                  )
                  .map((c) => (
                    <li key={c.id}>
                      <button
                        className="hierarchy-search-result"
                        onClick={() => choose(c.id)}
                      >
                        <BookOpen size={14} />
                        <span>{c.name}</span>
                      </button>
                    </li>
                  ))}
                {tests.data
                  ?.filter((t) =>
                    t.title.toLowerCase().includes(term.toLowerCase()),
                  )
                  .map((t) => (
                    <li key={"s" + t.id}>
                      <button
                        className="hierarchy-search-result"
                        onClick={() => choose(t.category, t.id)}
                      >
                        <FileText size={14} />
                        <span>
                          {t.title}
                          <small>{t.category_name}</small>
                        </span>
                      </button>
                    </li>
                  ))}
              </>
            ) : (
              branch(null)
            )}
          </ul>
        )}
        {tests.isPending && (
          <span className="hierarchy-loading">Loading tests…</span>
        )}
        {tests.error && <ErrorState error={tests.error} />}{" "}
        {error != null && <ErrorState error={error} />}
      </nav>
      <div className="studio-tree-bottom">Book → Volume → Test → Parts</div>
    </aside>
  );
}
