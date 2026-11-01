import { useAuth } from "../stores/auth";
import { readingCatalog } from "../services/readingCatalog";
import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BookOpen, FileText, ChevronRight, Plus, FileUp } from "lucide-react";
import { api, type Page } from "../services/api";
import { PageTitle, Loading, ErrorState, Empty } from "../components/ui";
import { ResultNavigation } from "../components/ResultNavigation";

type Paper = {
  id: number;
  book: string;
  test: number;
  passage: number;
  title: string;
  published_version: number | null;
  question_count: number;
  full_available?: boolean;
};
type DraftLocation = {
  candidate_index: number;
  book: string;
  test: number;
  passage: number;
  title: string;
};
type Source = {
  id: number;
  book: string;
  source_name: string;
  state: string;
  candidate_count: number;
  locations?: DraftLocation[];
  published_papers?: { candidate_index: number }[];
};
function collectionName(book: string) {
  return book.replace(/\s+\d+$/, "");
}
function path(
  book?: string | null,
  test?: number | null,
  collection?: string | null,
) {
  const params = new URLSearchParams();
  if (collection || book)
    params.set("collection", collection || collectionName(book!));
  if (book) params.set("book", book);
  if (test) params.set("test", String(test));
  return `/admin/reading${params.size ? `?${params}` : ""}`;
}
export function ReadingAdminLibrary() {
  const user = useAuth(s => s.user);
  const sharedAccess = !!(user?.is_superuser || user?.role === "admin");
  const [params] = useSearchParams();
  const collection = params.get("collection");
  const book = params.get("book"),
    test = Number(params.get("test")) || null;
  const navigate = useNavigate();
  const [addingTest, setAddingTest] = useState(false);
  const papers = useQuery({
    queryKey: ["reading-admin-papers", user?.id, sharedAccess],
    queryFn: () =>
      readingCatalog<Paper>(`reading-papers/?${sharedAccess ? "" : "owned=true&"}page_size=100`),
  });
  const sources = useQuery({
    queryKey: ["reading-imports", "admin-library"],
    queryFn: () => readingCatalog<Source>("reading-imports/?page_size=100"),
    refetchInterval: (q) =>
      q.state.data?.results.some((s) => ["queued", "running"].includes(s.state))
        ? 3000
        : false,
  });
  const all = papers.data?.results || [];
  const jobs = sources.data?.results || [];
  const drafts = jobs.flatMap((job) =>
    (job.locations || [])
      .filter(
        (location) =>
          location.book &&
          Number.isInteger(location.test) &&
          Number.isInteger(location.passage) &&
          !(job.published_papers || []).some(
            (p) => p.candidate_index === location.candidate_index,
          ),
      )
      .map((location) => ({ ...location, jobId: job.id })),
  );
  const books = [
    ...new Set([
      ...all.map((p) => p.book),
      ...drafts.map((p) => p.book),
      ...jobs.map((s) => s.book).filter(Boolean),
    ]),
  ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const collections = [...new Set(books.map(collectionName))];
  const visibleBooks = books.filter(
    (name) => !collection || collectionName(name) === collection,
  );
  const inBook = all.filter((p) => p.book === book);
  const bookDrafts = drafts.filter((p) => p.book === book);
  const tests = [
    ...new Set([
      ...inBook.map((p) => p.test),
      ...bookDrafts.map((p) => p.test),
    ]),
  ].sort((a, b) => a - b);
  const selectedDrafts = bookDrafts.filter((p) => p.test === test);
  const selected = inBook
    .filter((p) => p.test === test)
    .sort((a, b) => a.passage - b.passage);
  const context = new URLSearchParams();
  if (book) context.set("book", book);
  if (test) context.set("test", String(test));
  const suffix = context.size ? `?${context}` : "";
  function prepareTest(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const number = Number(new FormData(e.currentTarget).get("test"));
    if (Number.isInteger(number) && number >= 1 && number <= 100) {
      navigate(path(book, number));
      setAddingTest(false);
    }
  }
  const steps = [
    { label: "Admin", to: "/admin" },
    { label: "Reading library", to: collection || book ? path() : undefined },
    ...(collection
      ? [
          {
            label: `${collection} Reading`,
            to: book ? path(null, null, collection) : undefined,
          },
        ]
      : []),
    ...(book ? [{ label: book, to: test ? path(book) : undefined }] : []),
    ...(test ? [{ label: `Test ${test}` }] : []),
  ];
  return (
    <section className="catalog-page reading-admin-library">
      <ResultNavigation
        steps={steps}
        back={{
          label: test
            ? "Back to tests"
            : book || collection
              ? "Back to books"
              : "Back to dashboard",
          to: test
            ? path(book)
            : book
              ? path(null, null, collection)
              : collection
                ? path()
                : "/admin",
        }}
      />
      <PageTitle
        eyebrow="ADMIN / READING LIBRARY"
        title={
          test
            ? `${book} · Test ${test}`
            : book || (collection ? `${collection} Reading` : "Reading library")
        }
        description={
          test
            ? "Add passages, review the source and publish when ready."
            : book
              ? "Choose a test or prepare a new one."
              : "Choose a book to manage its tests and passages."
        }
        action={
          <div className="editor-actions">
            {test && selected.some((p) => p.full_available) && (
              <Link
                className="button secondary"
                to={`/reading?collection=${encodeURIComponent(collection || collectionName(book!))}&book=${encodeURIComponent(book!)}&test=${test}`}
              >
                Preview Mock
              </Link>
            )}
            <Link
              className="button primary"
              to={`/admin/reading/import${suffix}`}
            >
              <Plus size={17} />
              {test
                ? "Add passage from PDF"
                : book
                  ? "Upload book PDF"
                  : "Add book from PDF"}
            </Link>
          </div>
        }
      />
      <ol className="studio-flow" aria-label="Reading content location">
        {["Book", "Volume", "Test", "Passages"].map((label, i) => (
          <li
            key={label}
            className={
              (test ? 4 : book ? 3 : collection ? 2 : 1) === i + 1
                ? "current"
                : ""
            }
            aria-current={
              (test ? 4 : book ? 3 : collection ? 2 : 1) === i + 1
                ? "step"
                : undefined
            }
          >
            <span>{i + 1}</span>
            {label}
            {i < 3 && <ChevronRight size={12} />}
          </li>
        ))}
      </ol>
      {papers.isPending || sources.isPending ? (
        <Loading />
      ) : papers.error || sources.error ? (
        <ErrorState error={papers.error || sources.error} />
      ) : (
        <>
          <div className="section-title">
            <h2>
              {test
                ? "Passages"
                : book
                  ? "Tests"
                  : collection
                    ? "Books"
                    : "Collections"}
            </h2>
            {book && !test && (
              <button
                className="button secondary"
                onClick={() => setAddingTest(!addingTest)}
              >
                <Plus size={16} />
                New test
              </button>
            )}
          </div>
          {addingTest && book && !test && (
            <form className="panel reading-new-test" onSubmit={prepareTest}>
              <label>
                Test number
                <input
                  name="test"
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={Math.min(100, Math.max(0, ...tests) + 1)}
                  required
                />
              </label>
              <p>The test is saved when you save its first passage.</p>
              <button className="button primary">Prepare test</button>
            </form>
          )}
          <div className="catalog-cards">
            {!book &&
              !collection &&
              collections.map((name) => (
                <Link
                  className="catalog-card"
                  key={name}
                  to={path(null, null, name)}
                >
                  <div className="catalog-card-top">
                    <span className="catalog-folder">
                      <BookOpen size={23} />
                    </span>
                    <span className="pill">READING</span>
                  </div>
                  <h3>{name} Reading</h3>
                  <p>
                    {books.filter((b) => collectionName(b) === name).length}{" "}
                    books
                  </p>
                  <div className="catalog-card-bottom">
                    Open books
                    <ChevronRight size={15} />
                  </div>
                </Link>
              ))}
            {!book &&
              !!collection &&
              visibleBooks.map((name) => (
                <Link className="catalog-card" key={name} to={path(name)}>
                  <div className="catalog-card-top">
                    <span className="catalog-folder">
                      <BookOpen size={23} />
                    </span>
                    <span className="pill">READING</span>
                  </div>
                  <h3>{name}</h3>
                  <p>
                    {all.filter((p) => p.book === name).length} saved passages
                  </p>
                  <div className="catalog-card-bottom">
                    Open tests
                    <ChevronRight size={15} />
                  </div>
                </Link>
              ))}
            {book &&
              !test &&
              tests.map((n) => (
                <Link className="catalog-card" key={n} to={path(book, n)}>
                  <div className="catalog-card-top">
                    <span className="catalog-folder">
                      <FileText size={23} />
                    </span>
                    <span className="pill">TEST</span>
                  </div>
                  <h3>Test {n}</h3>
                  <p>
                    {
                      inBook.filter((p) => p.test === n && p.published_version)
                        .length
                    }{" "}
                    published ·{" "}
                    {inBook.filter((p) => p.test === n && !p.published_version)
                      .length +
                      bookDrafts.filter((p) => p.test === n).length}{" "}
                    drafts
                  </p>
                  <div className="catalog-card-bottom">
                    Open passages
                    <ChevronRight size={15} />
                  </div>
                </Link>
              ))}
            {book &&
              test &&
              selected.map((p) => (
                <Link
                  className="catalog-card"
                  key={p.id}
                  to={`/admin/reading/${p.id}`}
                >
                  <div className="catalog-card-top">
                    <span className="catalog-folder">
                      <BookOpen size={23} />
                    </span>
                    <span className="pill">
                      {p.published_version ? "PUBLISHED" : "DRAFT"}
                    </span>
                  </div>
                  <h3>
                    Passage {p.passage} · {p.title || "Untitled passage"}
                  </h3>
                  <p>{p.question_count} questions</p>
                  <div className="catalog-card-bottom">
                    Review passage
                    <ChevronRight size={15} />
                  </div>
                </Link>
              ))}
            {book &&
              test &&
              selectedDrafts.map((p) => (
                <Link
                  className="catalog-card"
                  key={`draft-${p.jobId}-${p.candidate_index}`}
                  to={`/admin/reading/imports/${p.jobId}${suffix}&candidate=${p.candidate_index}`}
                >
                  <div className="catalog-card-top">
                    <span className="catalog-folder">
                      <BookOpen size={23} />
                    </span>
                    <span className="pill">DRAFT</span>
                  </div>
                  <h3>
                    Passage {p.passage} · {p.title || "Untitled passage"}
                  </h3>
                  <p>Saved source draft · Not published</p>
                  <div className="catalog-card-bottom">
                    Continue editing
                    <ChevronRight size={15} />
                  </div>
                </Link>
              ))}
          </div>
          {((!book && !books.length) ||
            (book && !test && !tests.length) ||
            (book && test && !selected.length && !selectedDrafts.length)) && (
            <Empty
              title={
                test
                  ? "No saved passages yet"
                  : book
                    ? "No saved tests yet"
                    : "No Reading books yet"
              }
              description="Upload the source PDF or open an existing source below to prepare your first passage."
            />
          )}
          {!!jobs.filter(
            (s) =>
              !book ||
              s.book === book ||
              s.locations?.some((p) => p.book === book),
          ).length && (
            <section className="reading-admin-sources">
              <div className="section-title">
                <h2>Source PDFs & drafts</h2>
                <Link
                  className="text-link"
                  to={`/admin/reading/import${suffix}`}
                >
                  Manage uploads
                </Link>
              </div>
              <div className="panel">
                {jobs
                  .filter(
                    (s) =>
                      !book ||
                      s.book === book ||
                      s.locations?.some((p) => p.book === book),
                  )
                  .map((s) => (
                    <Link
                      className="exam-history-row"
                      key={s.id}
                      to={`/admin/reading/imports/${s.id}${suffix}`}
                    >
                      <FileUp size={19} />
                      <span>
                        <strong>{s.source_name}</strong>
                        <small>
                          {s.state === "completed"
                            ? "Published"
                            : s.state === "needs_review"
                              ? "Ready for review"
                              : s.state === "failed"
                                ? "Needs attention"
                                : s.state === "queued"
                                  ? "Waiting to start"
                                  : s.state === "running"
                                    ? "Extracting text"
                                    : "Setup required"}
                        </small>
                      </span>
                      <ChevronRight size={16} />
                    </Link>
                  ))}
              </div>
            </section>
          )}
        </>
      )}
    </section>
  );
}
