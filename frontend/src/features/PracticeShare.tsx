import "./sharedResults.css";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Session } from "../services/api";
import { ShareResults } from "../components/ShareResults";
import { ErrorState } from "../components/ui";

export function PracticeShare({
  session,
  writeShare,
}: {
  session: Session;
  writeShare: (remove: boolean) => Promise<{ token: string | null }>;
}) {
  const complete =
    session.groups.length > 0 &&
    session.groups.every((_, index) =>
      session.checked_positions.includes(index),
    );
  const key = ["practice-share", session.id];
  const cache = useQueryClient();
  const q = useQuery({
    queryKey: key,
    queryFn: () =>
      api<{ token: string | null }>(`sessions/${session.id}/share/`),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  async function change(remove = false) {
    setBusy(true);
    setError(undefined);
    try {
      const data = await writeShare(remove);
      cache.setQueryData(key, data);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  const level =
    session.difficulty.charAt(0).toUpperCase() + session.difficulty.slice(1);
  const url = q.data?.token
    ? `${window.location.origin}/shared/practice/${q.data.token}`
    : "";
  return (
    <section className="panel practice-completed-share">
      <span className="pill">
        {complete ? "PRACTICE COMPLETED" : "PRACTICE IN PROGRESS"}
      </span>
      <h2>Share this {level} practice</h2>
      <p className="muted">
        {session.title} · {session.checked_positions.length} /{" "}
        {session.groups.length} exercises checked. Your live link updates as you
        check answers, including after completion. It shows only this practice,
        your checked answers and corrections. Anyone with the link can view it.
        Each Part and difficulty has its own link.
      </p>
      {(error || q.error) != null && <ErrorState error={error || q.error} />}
      {url ? (
        <>
          <label>
            Public practice link
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
            />
          </label>
          <div className="editor-actions">
            <ShareResults text={url} />
            <a
              className="text-link"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              Open shared practice
            </a>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void change(true)}
            >
              Stop sharing
            </button>
          </div>
        </>
      ) : (
        <button
          className="button primary"
          disabled={busy || q.isPending || !!q.error}
          onClick={() => void change()}
        >
          {busy ? "Creating link…" : "Create live practice link"}
        </button>
      )}
    </section>
  );
}
