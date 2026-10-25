import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useBlocker,
  useSearchParams,
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
  transcriptIssues,
  adjustAdjacentTiming,
  appendInterval,
  type TranscriptIssue,
} from "./transcriptValidation";
import { BookHierarchy, StudioFlow } from "./StudioHierarchy";
import { TranscriptTimeInput } from "./TranscriptTimeInput";
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
import { QuestionStudio } from "./QuestionStudio";
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
    queryFn: () => api<{ results: Material[] }>("materials/?standalone=true"),
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
      key={id}
      material={query.data}
      onSaved={() => {
        void cache.invalidateQueries({ queryKey: ["admin-material", id] });
        void cache.invalidateQueries({ queryKey: ["admin-materials"] });
        void cache.invalidateQueries({ queryKey: ["materials"] });
        void cache.invalidateQueries({ queryKey: ["progress"] });
        void cache.invalidateQueries({ queryKey: ["studio-tree-tests"] });
        void cache.invalidateQueries({ queryKey: ["studio-test"] });
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
    m.transcript_audio_id && m.audio?.id !== m.transcript_audio_id
      ? []
      : m.segments,
  );
  const [error, setError] = useState<unknown>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [audio, setAudio] = useState(m.audio);
  const [dirty, setDirty] = useState(false);
  const [detailsDirty, setDetailsDirty] = useState(false);
  const [questionDirty, setQuestionDirty] = useState(false);
  const [stepParams, setStepParams] = useSearchParams();
  const editorStep = stepParams.get("step") || "material-details";
  const editorSteps = [
    "material-details",
    "material-audio",
    "material-questions",
    "material-review",
    "material-publish",
  ];
  function goStep(target: string) {
    const n = new URLSearchParams(stepParams);
    n.set("step", target);
    setStepParams(n, { replace: true });
  }
  const [reference, setReference] = useState("");
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [playRequest, setPlayRequest] = useState(0);
  const [removed, setRemoved] = useState<{
    segment: Segment;
    index: number;
  } | null>(null);
  const [timingNote, setTimingNote] = useState("");
  const [lastTiming, setLastTiming] = useState<{
    before: Segment[];
    indices: number[];
  } | null>(null);
  const reviewIssues = transcriptIssues(segments, audio?.duration_ms);
  const nextInterval = appendInterval(segments, audio?.duration_ms);
  const cache = useQueryClient();
  const jobQuery = useQuery({
    queryKey: ["processing", m.id],
    queryFn: () =>
      api<import("../services/api").ProcessingJob | null>(
        `materials/${m.id}/processing/`,
      ),
    enabled: !!audio,
    refetchInterval: (q) =>
      q.state.data && ["queued", "running"].includes(q.state.data.state)
        ? 2000
        : false,
  });
  const job = jobQuery.data ?? m.processing;
  const working = !!job && ["queued", "running"].includes(job.state);
  useEffect(() => {
    if (!dirty)
      setSegments(
        m.transcript_audio_id && m.audio?.id !== m.transcript_audio_id
          ? []
          : m.segments,
      );
    if (m.audio) setAudio(m.audio);
    setReviewed(false);
  }, [m.version_id, m.audio?.id, m.transcript_audio_id]);
  useEffect(() => {
    if (job?.state === "succeeded" && job.result_version !== m.version_id)
      onSaved();
  }, [job?.state, job?.result_version, m.version_id]);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      (dirty || detailsDirty || questionDirty) &&
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
      if (dirty || detailsDirty || questionDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, detailsDirty, questionDirty]);
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError(undefined);
    setMessage("");
    try {
      await action();
      setMessage(success);
    } catch (e) {
      setError(e);
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
  async function upload(e: FormEvent) {
    e.preventDefault();
    if (!audioFile) return;
    await run(async () => {
      const data = new FormData();
      data.append("file", audioFile);
      if (reference.trim()) data.append("reference_text", reference);
      if (referenceFile) data.append("reference_file", referenceFile);
      const result = await api<
        NonNullable<Material["audio"]> & {
          processing: import("../services/api").ProcessingJob;
        }
      >(`materials/${m.id}/audio/`, { method: "POST", body: data });
      setAudio(result);
      setSegments([]);
      setDirty(false);
      setReviewed(false);
      setPreviewIndex(null);
      setAudioFile(null);
      cache.setQueryData(["processing", m.id], result.processing);
      void jobQuery.refetch();
      onSaved();
    }, "Audio uploaded. The transcript and dictation chunks are being prepared automatically.");
  }
  async function retry() {
    await run(async () => {
      const data = reference.trim() || referenceFile ? new FormData() : null;
      if (data) {
        if (job?.state === "succeeded") data.append("force", "true");
        if (reference.trim()) data.append("reference_text", reference);
        if (referenceFile) data.append("reference_file", referenceFile);
      }
      const result = await api<import("../services/api").ProcessingJob>(
        `materials/${m.id}/process/`,
        data
          ? { method: "POST", body: data }
          : {
              method: "POST",
              body: JSON.stringify({ force: job?.state === "succeeded" }),
            },
      );
      cache.setQueryData(["processing", m.id], result);
      void jobQuery.refetch();
    }, "Processing queued. Your audio is preserved.");
  }
  function edit(index: number, key: keyof Segment, value: string | number) {
    if ((key === "start_ms" || key === "end_ms") && typeof value === "number") {
      const result = adjustAdjacentTiming(
        segments,
        index,
        key,
        value,
        audio?.duration_ms,
      );
      setLastTiming({
        before: segments,
        indices: [index, ...result.adjustments.map((a) => a.index)],
      });
      setSegments(result.segments);
      setTimingNote(
        result.warning ||
          result.adjustments
            .map(
              (a) =>
                `Sentence ${a.index + 1} ${a.field === "start_ms" ? "start" : "end"} → ${(a.value / 1000).toFixed(3)}s`,
            )
            .join("; "),
      );
    } else
      setSegments((old) =>
        old.map((s, i) => (i === index ? { ...s, [key]: value } : s)),
      );
    setDirty(true);
    setReviewed(false);
    setError(undefined);
    setMessage("");
  }
  function undoTiming() {
    if (!lastTiming) return;
    setSegments((old) =>
      old.map((s, i) =>
        lastTiming.indices.includes(i)
          ? {
              ...s,
              start_ms: lastTiming.before[i].start_ms,
              end_ms: lastTiming.before[i].end_ms,
            }
          : s,
      ),
    );
    setLastTiming(null);
    setTimingNote("");
    setDirty(true);
    setReviewed(false);
    setError(undefined);
    setMessage("");
  }
  function focusIssue(issue: TranscriptIssue) {
    const row = document.getElementById(
      `transcript-segment-${m.id}-${issue.index}`,
    );
    if (issue.field !== "text") {
      const details = row?.querySelector("details");
      if (details) details.open = true;
    }
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const control = row?.querySelector<HTMLElement>(
      issue.field === "text"
        ? "textarea"
        : `[aria-label="Segment ${issue.index + 1} ${issue.field === "start_ms" ? "start" : "end"}"]`,
    );
    control?.focus({ preventScroll: true });
  }
  function removeSentence(index: number) {
    setLastTiming(null);
    setTimingNote("");
    setRemoved({ segment: segments[index], index });
    setSegments((old) => old.filter((_, i) => i !== index));
    setDirty(true);
    setReviewed(false);
    setError(undefined);
    setMessage("");
    setPreviewIndex(null);
    setPlayRequest(0);
  }
  function undoRemove() {
    setLastTiming(null);
    setTimingNote("");
    if (!removed) return;
    setSegments((old) => {
      const next = [...old];
      next.splice(Math.min(removed.index, next.length), 0, removed.segment);
      return next;
    });
    setRemoved(null);
    setDirty(true);
    setReviewed(false);
    setError(undefined);
    setMessage("");
  }
  function saveCorrections() {
    if (reviewIssues.length) {
      setError(
        new Error(
          `Sentence ${reviewIssues[0].index + 1}: ${reviewIssues[0].message}`,
        ),
      );
      focusIssue(reviewIssues[0]);
      return;
    }
    void run(async () => {
      await api(`materials/${m.id}/transcript/`, {
        method: "PUT",
        body: JSON.stringify({ segments }),
      });
      setDirty(false);
      setRemoved(null);
      setLastTiming(null);
      setTimingNote("");
      onSaved();
    }, "Transcript corrections saved as a new version.");
  }
  const stageLabels: Record<string, string> = {
    queued: "Waiting for the speech service",
    preparing_audio: "Preparing the original audio",
    loading_model: "Loading the speech model — first use can take longer",
    transcribing: "Listening to the recording and generating word timestamps",
    aligning_reference: "Matching the reference transcript to recognized words",
    segmenting: "Creating sentences and playable chunks",
    saving_version: "Saving a version for your review",
    ready_for_review: "Transcript and practice ready for review",
    failed: "Processing needs attention",
    retry_wait: "Waiting to retry",
  };
  const groupId = m.test_part?.test || m.full_test || null;
  const pageTitle = (
    <PageTitle
      eyebrow="CONTENT STUDIO / UPLOAD ONCE"
      title={m.title}
      description="Upload a mock recording. Review its transcript. Practice levels are prepared automatically."
      action={<span className={`status-badge ${m.status}`}>{m.status}</span>}
    />
  );
  return (
    <div className={groupId ? "catalog-page admin-studio unified-studio" : undefined}>
      {groupId && (
        <>
          {pageTitle}
          <StudioFlow stage={4} />
        </>
      )}
      <div className={groupId ? "studio-layout studio-editor-layout" : undefined}>
      {groupId && (
        <BookHierarchy
          categoryId={m.category}
          testId={groupId}
          partNumber={m.test_part?.number}
          full={!!m.full_test}
        />
      )}
      <div className="studio-main stepped-editor" data-step={editorStep}>
        <Link
          className="back-link"
          to={
            m.test_part || m.full_test
              ? `/admin?category=${m.category}&test=${m.test_part?.test || m.full_test}`
              : "/admin/materials"
          }
        >
          <ArrowLeft size={17} />
          Back to Content Studio
        </Link>
        {!groupId && pageTitle}
        <nav className="studio-steps" aria-label="Material setup steps">
          {[
            ["material-details", "1", "Details"],
            ["material-audio", "2", "Audio"],
            ["material-questions", "3", "Questions"],
            ["material-review", "4", "Review"],
            ["material-publish", "5", "Publish"],
          ].map(([target, number, label]) => (
            <button
              key={target}
              className={editorStep === target ? "active" : ""}
              aria-current={editorStep === target ? "step" : undefined}
              onClick={() => goStep(target)}
            >
              <span>{number}</span>
              {label}
            </button>
          ))}
        </nav>
        {error != null && <ErrorState error={error} />}
        {message && (
          <div className="success" role="status">
            <Check size={18} />
            {message}
          </div>
        )}
        <div className="editor-grid">
          <div>
            <section id="material-details" className="panel form-panel">
              <h2>
                <span className="step-number">1</span>Mock details
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
                    placeholder="Original or authorized source"
                    required
                  />
                </label>
                <label>
                  License / permission
                  <input
                    name="license"
                    defaultValue={m.license}
                    placeholder="Your ownership or permission"
                    required
                  />
                </label>
                <label className="checkbox-label full">
                  <input
                    type="checkbox"
                    name="rights_confirmed"
                    defaultChecked={m.rights_confirmed}
                  />
                  I own this material or have permission to share it.
                </label>
                <div className="full">
                  <button className="button secondary" disabled={busy}>
                    <Save size={16} />
                    Save details
                  </button>
                </div>
              </form>
            </section>
            <section id="material-audio" className="panel form-panel">
              <h2>
                <span className="step-number">2</span>Upload the recording once
              </h2>
              <p className="muted">
                The site transcribes your audio and creates sentence/chunk
                boundaries. An existing transcript is optional.
              </p>
              <form onSubmit={upload}>
                <label className="upload-zone">
                  <Upload size={29} />
                  <strong>
                    {audio
                      ? "Choose replacement audio"
                      : "Choose an audio recording"}
                  </strong>
                  <span>MP3, WAV, M4A, OGG or FLAC · up to 100 MB</span>
                  <input
                    aria-label="Upload audio"
                    type="file"
                    accept=".mp3,.wav,.m4a,.ogg,.flac"
                    disabled={busy || working}
                    onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                  />
                </label>
                <details className="optional-transcript">
                  <summary>I already have the transcript (optional)</summary>
                  <p className="muted">
                    Paste the authoritative text or upload a TXT/text-based PDF.
                    Leave both empty to generate the transcript from audio.
                  </p>
                  <label>
                    Reference transcript
                    <textarea
                      aria-label="Reference transcript"
                      value={reference}
                      rows={4}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="Optional: the exact words in your recording…"
                      maxLength={100000}
                    />
                  </label>
                  <label>
                    Transcript file
                    <input
                      aria-label="Transcript file"
                      type="file"
                      accept=".txt,.pdf"
                      onChange={(e) =>
                        setReferenceFile(e.target.files?.[0] || null)
                      }
                      disabled={!!reference.trim()}
                    />
                  </label>
                </details>
                <div className="editor-actions">
                  <button
                    className="button primary"
                    disabled={!audioFile || busy || working}
                  >
                    <Upload size={16} />
                    {busy
                      ? "Uploading…"
                      : "Upload & create Practice automatically"}
                  </button>
                  {audio && (
                    <button
                      type="button"
                      className="button secondary"
                      disabled={busy || working}
                      onClick={() => void retry()}
                    >
                      Regenerate from this audio
                    </button>
                  )}
                </div>
              </form>
              {audio && (
                <>
                  <div className="audio-file-meta">
                    <FileAudio size={18} />
                    {(audio.size / 1024 / 1024).toFixed(2)} MB ·{" "}
                    {(audio.duration_ms / 1000).toFixed(1)} seconds
                  </div>
                  <AudioPlayer
                    url={audio.stream_url}
                    start={
                      previewIndex === null
                        ? 0
                        : segments[previewIndex]?.start_ms || 0
                    }
                    end={
                      previewIndex === null
                        ? undefined
                        : segments[previewIndex]?.end_ms
                    }
                    playRequest={playRequest}
                  />
                </>
              )}
              {job && (
                <div className={`processing-status ${job.state}`} role="status">
                  <div className="processing-status-title">
                    {working ? (
                      <span className="processing-spinner" />
                    ) : (
                      <Check size={18} />
                    )}
                    <strong>{stageLabels[job.stage] || job.stage}</strong>
                  </div>
                  {job.state === "failed" ? (
                    <>
                      <p>{job.error_message}</p>
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() => void retry()}
                      >
                        Retry processing
                      </button>
                    </>
                  ) : (
                    <p>
                      {working
                        ? "Your upload is saved. You can leave this page and return while the worker prepares the transcript."
                        : "Listen to the generated segments below and approve the transcript before publishing."}
                    </p>
                  )}
                </div>
              )}
              {jobQuery.error && <ErrorState error={jobQuery.error} />}
            </section>
            <QuestionStudio
              materialId={m.id}
              assignedPart={m.test_part?.number}
              audioReady={!!audio}
              audioId={audio?.id}
              onSaved={onSaved}
              onDirty={setQuestionDirty}
            />
            <section id="material-review" className="panel form-panel">
              <div className="section-title">
                <h2>
                  <span className="step-number">4</span>Review generated
                  transcript
                </h2>
                <span className="pill">{segments.length} sentences</span>
              </div>
              <div className="review-toolbar">
                <span>
                  {audio
                    ? `Recording ends at ${(audio.duration_ms / 1000).toFixed(3)}s`
                    : "Choose audio first"}
                </span>
                {removed && (
                  <button
                    className="text-link"
                    disabled={busy || working}
                    onClick={undoRemove}
                  >
                    Undo remove
                  </button>
                )}
              </div>
              <div className="review-auto-timing">
                <span>
                  Press Enter or leave a time field to adjust neighboring times
                  with a 0.05s gap.
                </span>
                {lastTiming && (
                  <button
                    className="text-link"
                    disabled={busy || working}
                    onClick={undoTiming}
                  >
                    Undo timing edit
                  </button>
                )}
              </div>
              {timingNote && (
                <p className="timing-adjustment-note" role="status">
                  {timingNote}
                </p>
              )}
              {reviewIssues.length > 0 && (
                <div className="review-validation" role="alert">
                  <span>
                    {new Set(reviewIssues.map((e) => e.index)).size} sentence(s)
                    need correction.
                  </span>
                  <button
                    className="text-link"
                    onClick={() => focusIssue(reviewIssues[0])}
                  >
                    Go to sentence {reviewIssues[0].index + 1}
                  </button>
                </div>
              )}
              {!segments.length ? (
                <div className="small-empty">
                  {working
                    ? "Sentences will appear automatically when processing finishes."
                    : "Upload audio to generate your first transcript. No manual timestamps are required."}
                </div>
              ) : (
                <>
                  <p className="muted">
                    Play each sentence and correct any recognition errors. Easy
                    chunks, single-sentence Medium, and continuous Hard practice
                    use the same recording.
                  </p>
                  {m.transcript_warnings?.map((warning, i) => (
                    <div className="hint-box" key={i}>
                      {warning}
                    </div>
                  ))}
                  <div className="segment-editor-list">
                    {segments.map((s, i) => (
                      <div
                        id={`transcript-segment-${m.id}-${i}`}
                        className={`segment-editor ${previewIndex === i ? "previewing" : ""} ${reviewIssues.some((e) => e.index === i) ? "invalid" : ""}`}
                        key={i}
                      >
                        <div className="segment-editor-number">
                          {String(i + 1).padStart(2, "0")}
                        </div>
                        <div className="segment-editor-fields">
                          <label>
                            Sentence
                            <textarea
                              aria-label={`Segment ${i + 1} text`}
                              aria-invalid={reviewIssues.some(
                                (e) => e.index === i && e.field === "text",
                              )}
                              rows={2}
                              disabled={busy || working}
                              value={s.text}
                              onChange={(e) => edit(i, "text", e.target.value)}
                            />
                          </label>
                          {reviewIssues
                            .filter((e) => e.index === i)
                            .map((e) => (
                              <p key={e.field} className="review-field-error">
                                {e.message}
                              </p>
                            ))}
                          {s.needs_review && (
                            <span className="review-warning">
                              Listen closely: recognition/alignment needs
                              review.
                            </span>
                          )}
                          {audio && (
                            <button
                              className="button subtle"
                              disabled={working}
                              onClick={() => {
                                setPreviewIndex(i);
                                setPlayRequest((n) => n + 1);
                              }}
                            >
                              <Eye size={15} />
                              Preview sentence {(s.start_ms / 1000).toFixed(1)}s
                              – {(s.end_ms / 1000).toFixed(1)}s
                            </button>
                          )}
                          <details className="advanced-timing">
                            <summary>Adjust timing (advanced)</summary>
                            <div className="segment-timing">
                              <label>
                                Start (seconds)
                                <TranscriptTimeInput
                                  label={`Segment ${i + 1} start`}
                                  disabled={busy || working}
                                  duration={audio?.duration_ms}
                                  invalid={reviewIssues.some(
                                    (e) =>
                                      e.index === i && e.field === "start_ms",
                                  )}
                                  milliseconds={s.start_ms}
                                  onCommit={(value) =>
                                    edit(i, "start_ms", value)
                                  }
                                />
                              </label>
                              <label>
                                End (seconds)
                                <TranscriptTimeInput
                                  label={`Segment ${i + 1} end`}
                                  disabled={busy || working}
                                  duration={audio?.duration_ms}
                                  invalid={reviewIssues.some(
                                    (e) =>
                                      e.index === i && e.field === "end_ms",
                                  )}
                                  milliseconds={s.end_ms}
                                  onCommit={(value) => edit(i, "end_ms", value)}
                                />
                              </label>
                            </div>
                          </details>
                          <button
                            className="text-link review-remove"
                            disabled={busy || working}
                            aria-label={`Remove segment ${i + 1}`}
                            onClick={() => removeSentence(i)}
                          >
                            <Trash2 size={13} />
                            Remove sentence
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    className="button secondary"
                    disabled={!dirty || busy || working}
                    onClick={saveCorrections}
                  >
                    <Save size={16} />
                    Save transcript corrections
                  </button>
                </>
              )}
              <details className="optional-transcript">
                <summary>Manual transcript entry (advanced recovery)</summary>
                <p className="muted">
                  Use only when recovering existing content. Automatic
                  transcription is the default workflow.
                </p>
                <button
                  className="button secondary"
                  disabled={busy || working || !nextInterval}
                  onClick={() => {
                    if (!nextInterval) return;
                    setSegments((old) => [
                      ...old,
                      { text: "", speaker: "", ...nextInterval },
                    ]);
                    setDirty(true);
                    setReviewed(false);
                    setError(undefined);
                    setMessage("");
                  }}
                >
                  <Plus size={16} />
                  Add sentence manually
                </button>
                {!nextInterval && audio && (
                  <p className="note">
                    All audio time is assigned. Adjust a sentence interval or
                    remove a sentence before adding another.
                  </p>
                )}
              </details>
            </section>
          </div>
          <aside>
            <section id="material-publish" className="panel publish-panel">
              <h2>One material. All practice levels.</h2>
              <ul className="publish-checks">
                <li>
                  <Check size={17} />
                  Easy: short chunks and visible word count
                </li>
                <li>
                  <Check size={17} />
                  Medium: one complete sentence, no word count
                </li>
                <li>
                  <Check size={17} />
                  Hard: two or three sentences continuously
                </li>
              </ul>
              <p className="muted">
                The original audio stays intact. Student sessions keep the
                transcript version they started with.
              </p>
              <label className="checkbox-label publish-review">
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                />
                I listened to the generated segments and reviewed the
                transcript.
              </label>
              <button
                className="button primary wide"
                disabled={
                  busy ||
                  working ||
                  dirty ||
                  detailsDirty ||
                  questionDirty ||
                  !reviewed ||
                  !audio ||
                  !m.version_id
                }
                onClick={() =>
                  void run(async () => {
                    await post(`materials/${m.id}/publish/`, {
                      confirm_review: true,
                    });
                    onSaved();
                  }, "Material published. Its Practice levels are available in the student library.")
                }
              >
                <ShieldCheck size={17} />
                Approve & publish Mock + Practice
              </button>
              {m.status === "published" && (
                <Link className="button secondary wide" to={`/library/${m.id}`}>
                  <Eye size={17} />
                  Open published material
                </Link>
              )}
            </section>
          </aside>
        </div>
        <div className="studio-wizard-navigation">
          <button
            className="button secondary"
            disabled={editorStep === editorSteps[0]}
            onClick={() =>
              goStep(
                editorSteps[Math.max(0, editorSteps.indexOf(editorStep) - 1)],
              )
            }
          >
            <ArrowLeft size={15} />
            Previous
          </button>
          <span>
            {Math.max(1, editorSteps.indexOf(editorStep) + 1)} / 5 steps
          </span>
          <button
            className="button primary"
            disabled={editorStep === editorSteps[4]}
            onClick={() =>
              goStep(
                editorSteps[Math.min(4, editorSteps.indexOf(editorStep) + 1)],
              )
            }
          >
            Next step
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
