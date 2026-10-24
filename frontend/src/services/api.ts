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
};
export type Audio = {
  id: number;
  duration_ms: number;
  mime_type: string;
  size: number;
  stream_url: string;
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
  audio: Audio | null;
  segments: Segment[];
  version_id: number | null;
};
export type Session = {
  id: number;
  material: number;
  title: string;
  version: number;
  difficulty: string;
  position: number;
  drafts: Record<string, string>;
  groups: { start_ms: number; end_ms: number; speaker: string }[];
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
