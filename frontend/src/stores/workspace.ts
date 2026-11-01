import { useLocation } from "react-router-dom";
import { useAuth } from "./auth";

// The URL keeps refreshes and direct links deterministic. This is presentation,
// never a substitute for the server's account permissions.
export function useWorkspace() {
  const location = useLocation();
  const canEdit = useAuth((s) => !!s.user?.can_edit);
  const admin = canEdit && (
    /^\/admin(?:\/|$)/.test(location.pathname) ||
    new URLSearchParams(location.search).get("workspace") === "admin"
  );
  return { admin, profilePath: admin ? "/profile?workspace=admin" : "/profile" };
}
