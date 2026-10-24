import { useEffect, useState } from "react";
import { apiBlob } from "../services/api";
import { ErrorState } from "./ui";
export function PrivateImage({ path, alt }: { path: string; alt: string }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<unknown>();
  useEffect(() => {
    let current = true;
    let object = "";
    setUrl("");
    setError(undefined);
    void apiBlob(path)
      .then((blob) => {
        if (current) {
          object = URL.createObjectURL(blob);
          setUrl(object);
        }
      })
      .catch((e) => {
        if (current) setError(e);
      });
    return () => {
      current = false;
      if (object) URL.revokeObjectURL(object);
    };
  }, [path]);
  if (error) return <ErrorState error={error} />;
  return url ? (
    <a
      className="full-document-link"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="Open the approved page at full size"
    >
      <img className="private-document-page" src={url} alt={alt} />
      <span>Open full-size page</span>
    </a>
  ) : (
    <div className="small-empty">Loading document page…</div>
  );
}
