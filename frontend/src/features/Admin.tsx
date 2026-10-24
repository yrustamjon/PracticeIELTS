import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useBlocker,
} from "react-router-dom";
import {
  Plus,
  FolderPlus,
  Upload,
  Check,
  ChevronRight,
  FileAudio,
  ShieldCheck,
  Trash2,
  Save,
  Eye,
  ArrowLeft,
} from "lucide-react";
import {
  api,
  post,
  type Category,
  type Material,
  type Segment,
} from "../services/api";
import { useAuth } from "../stores/auth";
import { Loading, ErrorState, Empty, PageTitle } from "../components/ui";
import { AudioPlayer } from "../components/AudioPlayer";
export function Admin() {
  const user = useAuth((s) => s.user);
  if (!user?.can_edit) return <Navigate to="/" replace />;
  return <Studio />;
}
function Studio() {
  const { id } = useParams();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [error, setError] = useState<unknown>();
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newMaterial, setNewMaterial] = useState(false);
  const [busy, setBusy] = useState(false);
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<{ results: Category[] }>("categories/"),
  });
  const materials = useQuery({
    queryKey: ["admin-materials"],
    queryFn: () => api<{ results: Material[] }>("materials/"),
  });
  async function categorySave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    setBusy(true);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (editingCategory)
        await api(`categories/${editingCategory.id}/`, {
          method: "PATCH",
          body: JSON.stringify({
            ...data,
            parent: data.parent ? Number(data.parent) : null,
            position: Number(data.position || 0),
          }),
        });
      else
        await post("categories/", {
          ...data,
          parent: data.parent ? Number(data.parent) : null,
        });
      await cache.invalidateQueries({ queryKey: ["categories"] });
      setCategoryOpen(false);
      setEditingCategory(null);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const m = await post<Material>("materials/", {
        ...data,
        category: Number(data.category),
      });
      void cache.invalidateQueries({ queryKey: ["admin-materials"] });
      setNewMaterial(false);
      navigate(`/admin/${m.id}`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  async function removeCategory(c: Category) {
    if (
      !window.confirm(
        `Delete “${c.name}”? Categories containing materials or children cannot be deleted.`,
      )
    )
      return;
    try {
      await api(`categories/${c.id}/`, { method: "DELETE" });
      void cache.invalidateQueries({ queryKey: ["categories"] });
    } catch (err) {
      setError(err);
    }
  }
  if (id) return <MaterialEditor id={id} key={id} />;
  return (
    <>
      <PageTitle
        eyebrow="ADMIN PANEL / CONTENT STUDIO"
        title="Make space for better learning"
        description="Create collections, prepare listening materials and publish with confidence."
        action={
          <button
            className="button primary"
            onClick={() => setNewMaterial(!newMaterial)}
          >
            <Plus size={18} />
            New material
          </button>
        }
      />
      <div className="studio-notice">
        <ShieldCheck size={20} />
        <span>
          Only upload audio and transcripts you own or have permission to use.
          New materials stay private until you publish.
        </span>
      </div>
      {error != null && <ErrorState error={error} />}
      {newMaterial && (
        <section className="panel form-panel">
          <h2>Create a listening material</h2>
          <form onSubmit={create} className="form-grid">
            <label>
              Title
              <input
                name="title"
                required
                maxLength={200}
                placeholder="e.g. A conversation at the library"
              />
            </label>
            <label>
              Collection
              <select name="category" required>
                <option value="">Select a collection</option>
                {categories.data?.results.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="full">
              Description
              <textarea
                name="description"
                rows={2}
                placeholder="What will your students practise?"
              />
            </label>
            <div className="full">
              <button className="button primary" disabled={busy}>
                Create draft
                <ChevronRight size={17} />
              </button>
              <button
                type="button"
                className="button subtle"
                onClick={() => setNewMaterial(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}
      <div className="admin-grid">
        <section className="panel">
          <div className="workspace-heading">
            <h2>Listening materials</h2>
            <span className="pill">
              {materials.data?.results.length || 0} materials
            </span>
          </div>
          {materials.isPending ? (
            <Loading />
          ) : materials.error ? (
            <ErrorState error={materials.error} />
          ) : materials.data.results.length ? (
            <div className="admin-material-list">
              {materials.data.results.map((m) => (
                <Link key={m.id} to={`/admin/${m.id}`}>
                  <span className="file-icon">
                    <FileAudio size={24} />
                  </span>
                  <div>
                    <strong>{m.title}</strong>
                    <small>{m.category_name}</small>
                  </div>
                  <span className={`status-badge ${m.status}`}>{m.status}</span>
                  <ChevronRight size={17} />
                </Link>
              ))}
            </div>
          ) : (
            <Empty
              title="Your first material starts here"
              description="Create a collection, add a recording and prepare a transcript for your students."
              action={
                <button
                  className="button secondary"
                  onClick={() => setNewMaterial(true)}
                >
                  <Plus size={17} />
                  Create material
                </button>
              }
            />
          )}
        </section>
        <section className="panel">
          <div className="workspace-heading">
            <h2>Collections</h2>
            <button
              className="icon-button"
              aria-label="Add collection"
              onClick={() => {
                setEditingCategory(null);
                setCategoryOpen(!categoryOpen);
              }}
            >
              <FolderPlus size={21} />
            </button>
          </div>
          {categoryOpen && (
            <form
              className="category-form"
              onSubmit={categorySave}
              key={editingCategory?.id || "new"}
            >
              <label>
                Collection name
                <input
                  name="name"
                  defaultValue={editingCategory?.name}
                  required
                  placeholder="e.g. Everyday English"
                />
              </label>
              <label>
                Parent collection
                <select
                  name="parent"
                  defaultValue={editingCategory?.parent || ""}
                >
                  <option value="">None — top level</option>
                  {categories.data?.results
                    .filter((c) => c.id !== editingCategory?.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Description
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={editingCategory?.description}
                />
              </label>
              {editingCategory && (
                <label>
                  Order
                  <input
                    type="number"
                    name="position"
                    min="0"
                    defaultValue={editingCategory.position}
                  />
                </label>
              )}
              <button className="button primary" disabled={busy}>
                {editingCategory ? "Save changes" : "Create collection"}
              </button>
            </form>
          )}
          <div className="category-list">
            {categories.data?.results.map((c) => (
              <div key={c.id}>
                <button
                  aria-label={`Edit ${c.name}`}
                  onClick={() => {
                    setEditingCategory(c);
                    setCategoryOpen(true);
                  }}
                >
                  <FolderPlus size={17} />
                  <span>
                    {c.name}
                    <small>
                      {c.parent ? "Subcollection" : "Top level"} ·{" "}
                      {c.material_count} materials
                    </small>
                  </span>
                </button>
                <button
                  className="icon-button"
                  aria-label={`Delete ${c.name}`}
                  onClick={() => void removeCategory(c)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          {!categories.data?.results.length && !categoryOpen && (
            <div className="small-empty">
              Organise materials your way.
              <br />
              <button
                className="text-link"
                onClick={() => setCategoryOpen(true)}
              >
                Create your first collection
                <Plus size={15} />
              </button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
function MaterialEditor({ id }: { id: string }) {
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["admin-material", id],
    queryFn: () => api<Material>(`materials/${id}/`),
  });
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} />;
  return (
    <Editor
      key={`${id}-${query.data.version_id}`}
      material={query.data}
      onSaved={() => {
        void cache.invalidateQueries({ queryKey: ["admin-material", id] });
        void cache.invalidateQueries({ queryKey: ["admin-materials"] });
        void cache.invalidateQueries({ queryKey: ["materials"] });
        void cache.invalidateQueries({ queryKey: ["progress"] });
      }}
    />
  );
}
function Editor({
  material: m,
  onSaved,
}: {
  material: Material;
  onSaved: () => void;
}) {
  const [segments, setSegments] = useState<Segment[]>(
    m.segments.length
      ? m.segments
      : [
          {
            text: "",
            speaker: "",
            start_ms: 0,
            end_ms: m.audio?.duration_ms || 1000,
          },
        ],
  );
  const [error, setError] = useState<unknown>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [audio, setAudio] = useState(m.audio);
  const [dirty, setDirty] = useState(false);
  const [detailsDirty, setDetailsDirty] = useState(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      (dirty || detailsDirty) &&
      currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (blocker.state === "blocked") {
      if (window.confirm("Leave with unsaved changes?")) blocker.proceed();
      else blocker.reset();
    }
  }, [blocker]);
  useEffect(() => {
    function warn(e: BeforeUnloadEvent) {
      if (dirty || detailsDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, detailsDirty]);
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError(undefined);
    setMessage("");
    try {
      await action();
      setMessage(success);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  async function metadata(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await run(async () => {
      await api(`materials/${m.id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          ...Object.fromEntries(f),
          rights_confirmed: f.get("rights_confirmed") === "on",
        }),
      });
      setDetailsDirty(false);
      onSaved();
    }, "Details saved.");
  }
  function edit(index: number, key: keyof Segment, value: string | number) {
    setSegments((old) =>
      old.map((s, i) => (i === index ? { ...s, [key]: value } : s)),
    );
    setDirty(true);
  }
  return (
    <>
      <Link
        className="back-link"
        to="/admin"
        onClick={(e) => {
          if (
            dirty &&
            !window.confirm("Leave with unsaved transcript changes?")
          )
            e.preventDefault();
        }}
      >
        <ArrowLeft size={17} />
        Back to Content Studio
      </Link>
      <PageTitle
        eyebrow="CONTENT STUDIO / MATERIAL EDITOR"
        title={m.title}
        description="Prepare the audio. Refine the transcript. Share something worth listening to."
        action={<span className={`status-badge ${m.status}`}>{m.status}</span>}
      />
      <div className="wizard-steps">
        {["Details", "Audio", "Transcript", "Review & publish"].map((s, i) => (
          <div key={s}>
            <span>{i + 1}</span>
            {s}
            {i < 3 && <ChevronRight size={16} />}
          </div>
        ))}
      </div>
      {error != null && <ErrorState error={error} />}{" "}
      {message && (
        <div className="success" role="status">
          <Check size={18} />
          {message}
        </div>
      )}
      <div className="editor-grid">
        <div>
          <section className="panel form-panel">
            <h2>
              <span className="step-number">1</span>Material details
            </h2>
            <form
              className="form-grid"
              onSubmit={metadata}
              onChange={() => setDetailsDirty(true)}
            >
              <label className="full">
                Title
                <input name="title" defaultValue={m.title} required />
              </label>
              <label className="full">
                Description
                <textarea
                  name="description"
                  defaultValue={m.description}
                  rows={2}
                />
              </label>
              <label>
                Content source
                <input
                  name="source"
                  defaultValue={m.source}
                  placeholder="e.g. Original recording by…"
                  required
                />
              </label>
              <label>
                License / permission
                <input
                  name="license"
                  defaultValue={m.license}
                  placeholder="e.g. CC BY 4.0 or self-owned"
                  required
                />
              </label>
              <label className="checkbox-label full">
                <input
                  type="checkbox"
                  name="rights_confirmed"
                  defaultChecked={m.rights_confirmed}
                />
                I own this content or have permission to share it.
              </label>
              <div className="full">
                <button className="button secondary" disabled={busy}>
                  <Save size={16} />
                  Save details
                </button>
              </div>
            </form>
          </section>
          <section className="panel form-panel">
            <h2>
              <span className="step-number">2</span>Listening audio
            </h2>
            <p className="muted">
              Upload your original recording. MP3, WAV, M4A, OGG or FLAC · up to
              100 MB.
            </p>
            <label className="upload-zone">
              <Upload size={29} />
              <strong>
                {audio
                  ? "Replace audio recording"
                  : "Choose an audio recording"}
              </strong>
              <span>
                Validated privately before it becomes available to students.
              </span>
              <input
                aria-label="Upload audio"
                type="file"
                accept=".mp3,.wav,.m4a,.ogg,.flac"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const data = new FormData();
                    data.append("file", file);
                    void run(async () => {
                      const a = await api<NonNullable<Material["audio"]>>(
                        `materials/${m.id}/audio/`,
                        { method: "POST", body: data },
                      );
                      setAudio(a);
                      if (!m.segments.length)
                        setSegments([
                          {
                            text: "",
                            speaker: "",
                            start_ms: 0,
                            end_ms: a.duration_ms,
                          },
                        ]);
                      setDirty(true);
                    }, "Audio uploaded. Review and save transcript timing for this audio.");
                  }
                }}
              />
            </label>
            {audio && (
              <>
                <div className="audio-file-meta">
                  <FileAudio size={18} />
                  {(audio.size / 1024 / 1024).toFixed(2)} MB ·{" "}
                  {(audio.duration_ms / 1000).toFixed(1)} seconds
                </div>
                <AudioPlayer url={audio.stream_url} />
              </>
            )}
          </section>
          <section className="panel form-panel">
            <div className="section-title">
              <h2>
                <span className="step-number">3</span>Manual transcript
              </h2>
              <span className="pill">{segments.length} segments</span>
            </div>
            <p className="muted">
              Enter the reference text and segment boundaries in seconds.
              Original audio is preserved. Automatic transcription and alignment
              are planned for the next milestone.
            </p>
            <div className="segment-editor-list">
              {segments.map((s, i) => (
                <div className="segment-editor" key={i}>
                  <div className="segment-editor-number">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="segment-editor-fields">
                    <label>
                      Transcript
                      <textarea
                        aria-label={`Segment ${i + 1} text`}
                        value={s.text}
                        rows={2}
                        onChange={(e) => edit(i, "text", e.target.value)}
                        placeholder="What is said in this segment?"
                      />
                    </label>
                    <div className="segment-timing">
                      <label>
                        Start (seconds)
                        <input
                          aria-label={`Segment ${i + 1} start`}
                          type="number"
                          min="0"
                          step="0.001"
                          value={s.start_ms / 1000}
                          onChange={(e) =>
                            edit(
                              i,
                              "start_ms",
                              Math.round(Number(e.target.value) * 1000),
                            )
                          }
                        />
                      </label>
                      <label>
                        End (seconds)
                        <input
                          aria-label={`Segment ${i + 1} end`}
                          type="number"
                          min="0"
                          step="0.001"
                          value={s.end_ms / 1000}
                          onChange={(e) =>
                            edit(
                              i,
                              "end_ms",
                              Math.round(Number(e.target.value) * 1000),
                            )
                          }
                        />
                      </label>
                      <label>
                        Speaker
                        <input
                          aria-label={`Segment ${i + 1} speaker`}
                          value={s.speaker}
                          onChange={(e) => edit(i, "speaker", e.target.value)}
                          placeholder="Optional"
                        />
                      </label>
                      <button
                        className="icon-button"
                        aria-label={`Remove segment ${i + 1}`}
                        disabled={segments.length === 1}
                        onClick={() => {
                          setSegments((old) =>
                            old.filter((_, index) => index !== i),
                          );
                          setDirty(true);
                        }}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="editor-actions">
              <button
                className="button secondary"
                onClick={() => {
                  setSegments([
                    ...segments,
                    {
                      text: "",
                      speaker: "",
                      start_ms: segments.at(-1)?.end_ms || 0,
                      end_ms: Math.min(
                        audio?.duration_ms || 0,
                        (segments.at(-1)?.end_ms || 0) + 1000,
                      ),
                    },
                  ]);
                  setDirty(true);
                }}
              >
                <Plus size={16} />
                Add segment
              </button>
              <button
                className="button primary"
                disabled={busy || !audio}
                onClick={() =>
                  void run(async () => {
                    await api(`materials/${m.id}/transcript/`, {
                      method: "PUT",
                      body: JSON.stringify({ segments }),
                    });
                    setDirty(false);
                    onSaved();
                  }, "Transcript saved as a new version.")
                }
              >
                <Save size={16} />
                Save transcript version
              </button>
            </div>
          </section>
        </div>
        <aside>
          <section className="panel publish-panel">
            <h2>
              <span className="step-number">4</span>Ready to share?
            </h2>
            <p className="muted">
              Review the audio and transcript before publishing. Previous
              student results keep their original transcript version.
            </p>
            <ul className="publish-checks">
              <li>
                <Check size={17} />
                Add source and licensing details
              </li>
              <li>
                <Check size={17} />
                Upload playable audio
              </li>
              <li>
                <Check size={17} />
                Check every segment and timestamp
              </li>
              <li>
                <Check size={17} />
                Save your transcript version
              </li>
            </ul>
            <button
              className="button secondary wide"
              onClick={() => setPreview(!preview)}
            >
              <Eye size={17} />
              Preview segments
            </button>
            <button
              className="button primary wide"
              disabled={
                busy || dirty || detailsDirty || !audio || !m.version_id
              }
              onClick={() =>
                void run(async () => {
                  await post(`materials/${m.id}/publish/`);
                  onSaved();
                }, "Material published. It is now available in the student library.")
              }
            >
              <ShieldCheck size={17} />
              Publish material
            </button>
            {dirty && (
              <small className="muted">
                Save your changes before publishing.
              </small>
            )}
          </section>
          {preview && audio && (
            <section className="panel preview-panel">
              <h3>Segment preview</h3>
              {segments.map((s, i) => (
                <div key={i}>
                  <p>
                    <strong>{i + 1}.</strong> {s.text}
                  </p>
                  <AudioPlayer
                    url={audio.stream_url}
                    start={s.start_ms}
                    end={s.end_ms}
                  />
                </div>
              ))}
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
