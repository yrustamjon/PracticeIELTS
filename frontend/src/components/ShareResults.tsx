import { useState } from "react";
import { Share2 } from "lucide-react";

export function ShareResults({ text }: { text: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function share() {
    setBusy(true);
    setMessage("");
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title: "My PracticeIELTS results", text });
          setMessage("Ulashildi.");
          return;
        } catch (error) {
          if (error && typeof error === "object" && "name" in error && error.name === "AbortError") return;
        }
      }
      try {
        await navigator.clipboard.writeText(text);
        setMessage("Nusxalandi.");
      } catch {
        const previousFocus = document.activeElement;
        const field = document.createElement("textarea");
        field.value = text;
        field.readOnly = true;
        field.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
        document.body.appendChild(field);
        try {
          field.select();
          field.setSelectionRange(0, text.length);
          setMessage(document.execCommand("copy") ? "Nusxalandi." : "Nusxalanmadi. Qayta urinib ko‘ring.");
        } catch {
          setMessage("Nusxalanmadi. Qayta urinib ko‘ring.");
        } finally {
          field.remove();
          if (previousFocus instanceof HTMLElement) previousFocus.focus();
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="share-results">
      <button className="button secondary" disabled={busy} onClick={() => void share()}>
        <Share2 size={17} aria-hidden="true" />
        {busy ? "Sharing…" : "Share results"}
      </button>
      <p className="muted" role="status">{message}</p>

    </div>
  );
}
