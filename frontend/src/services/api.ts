import { useAuth } from "../stores/auth";
export type User = {
  id: number;
  username: string;
  email: string;
  role: string;
  can_edit: boolean;
};
export type Category = {
  id: number;
  name: string;
  description: string;
  parent: number | null;
  position: number;
  material_count: number;
};
export type Segment = {
  text: string;
  speaker: string;
  start_ms: number;
  end_ms: number;
  position?: number;
  confidence?: number | null;
  needs_review?: boolean;
};
export type Audio = {
  id: number;
  duration_ms: number;
  mime_type: string;
  size: number;
  stream_url: string;
};
export type ProcessingJob = {
  id: number;
  audio: number;
  state: "queued" | "running" | "succeeded" | "failed";
  stage: string;
  attempts: number;
  error_code: string;
  error_message: string;
  warnings: string[];
  result_version: number | null;
};
export type Material = {
  id: number;
  title: string;
  description: string;
  category: number;
  category_name: string;
  source: string;
  license: string;
  rights_confirmed: boolean;
  status: string;
  mock_available?: boolean;
  question_count?: number;
  transcript_audio_id?: number | null;
  audio: Audio | null;
  segments: Segment[];
  version_id: number | null;
  processing?: ProcessingJob | null;
  transcript_origin?: string;
  transcript_warnings?: string[];
};
export type Session = {
  id: number;
  material: number;
  title: string;
  version: number;
  difficulty: string;
  position: number;
  drafts: Record<string, string>;
  groups: {
    start_ms: number;
    end_ms: number;
    speaker: string;
    word_count?: number;
  }[];
  audio: Audio;
  checked_positions: number[];
};
export type Comparison = {
  accuracy: number;
  reference: string;
  tokens: {
    status: string;
    expected: string;
    actual: string;
    reason: string | null;
  }[];
};
export type CheckedResponse = {
  id: number;
  session: number;
  position: number;
  title: string;
  answer: string;
  result: Comparison;
  created_at: string;
};
export type Progress = {
  accuracy: number | null;
  sentences_completed: number;
  exercises_completed: number;
  attempts: number;
  weekly_activity: { day: string; date: string; count: number }[];
  resume: Session | null;
  material_count: number;
};
let csrfToken = "";
export async function initCsrf() {
  const r = await fetch("/api/v1/auth/csrf/", { credentials: "include" });
  const d = await r.json();
  csrfToken = d.csrfToken;
}
let refreshRequest: Promise<void> | null = null;
export function restore() {
  if (!refreshRequest)
    refreshRequest = refreshSession().finally(() => {
      refreshRequest = null;
    });
  return refreshRequest;
}
async function refreshSession() {
  await initCsrf();
  const r = await fetch("/api/v1/auth/refresh/", {
    method: "POST",
    credentials: "include",
    headers: { "X-CSRFToken": csrfToken },
  });
  if (r.ok) {
    const d = await r.json();
    useAuth.getState().set(d.access, d.user);
  } else useAuth.getState().clear();
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const token = useAuth.getState().token;
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (csrfToken) headers.set("X-CSRFToken", csrfToken);
  const r = await fetch(`/api/v1/${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
  if (r.status === 401 && retry && !path.startsWith("auth/")) {
    await restore();
    if (useAuth.getState().token) return api<T>(path, options, false);
    useAuth.getState().clear();
  }
  if (!r.ok) {
    let detail = "Something went wrong. Please try again.";
    try {
      const data = await r.json();
      detail = Object.entries(data)
        .map(
          ([key, value]) =>
            `${key === "detail" ? "" : key + ": "}${Array.isArray(value) ? value.join(" ") : String(value)}`,
        )
        .join(" ");
    } catch {
      /* non-JSON service error */
    }
    throw new Error(detail);
  }
  return r.status === 204 ? (undefined as T) : r.json();
}
export const post = <T>(path: string, data: unknown = {}) =>
  api<T>(path, { method: "POST", body: JSON.stringify(data) });

export async function apiBlob(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<Blob> {
  const headers = new Headers(options.headers);
  const token = useAuth.getState().token;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const r = await fetch(`/api/v1/${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
  if (r.status === 401 && retry) {
    await restore();
    if (useAuth.getState().token) return apiBlob(path, options, false);
  }
  if (!r.ok) {
    let message = "Unable to load this private file.";
    try {
      const data = await r.json();
      message = data.detail || Object.values(data).flat().join(" ");
    } catch {}
    throw new Error(message);
  }
  return r.blob();
}
export type QuestionType =
  | "multiple_choice"
  | "matching"
  | "form_completion"
  | "note_completion"
  | "table_completion"
  | "sentence_completion"
  | "short_answer"
  | "map_label"
  | "diagram_label";
export type ExamQuestion = {
  number: number;
  part: number;
  type: QuestionType;
  prompt: string;
  instructions: string;
  options: { key: string; text: string }[];
  answers?: (string | string[])[];
  max_words: number;
  context: Record<string, unknown>;
  selections?: number;
};
export type QuestionSet = {
  id: number;
  audio: number;
  document: number | null;
  document_pages: number[];
  duration_seconds: number;
  published_at: string | null;
  questions: ExamQuestion[];
};
export type QuestionDocument = {
  id: number;
  page_count: number;
  extraction_state: string;
  extracted_text: string;
};
export type MockAttempt = {
  id: number;
  material: number;
  title: string;
  timing: "timed" | "untimed";
  started_at: string;
  deadline: string | null;
  server_now: string;
  submitted_at: string | null;
  answers: Record<string, string | string[]>;
  audio_started: boolean;
  questions: ExamQuestion[];
  document_pages: number[];
  score: number | null;
  total: number;
  results?: {
    number: number;
    correct: boolean;
    answer: string | string[];
    accepted_answers: (string | string[])[];
  }[];
};
