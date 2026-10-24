import { useEffect, useRef, useState } from "react";
import {
  getDocument,
  GlobalWorkerOptions,
  TextLayer,
  type PDFDocumentProxy,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "pdfjs-dist/web/pdf_viewer.css";
import { apiBlob, type ExamQuestion, type PdfField } from "../services/api";
import { ErrorState } from "./ui";

GlobalWorkerOptions.workerSrc = workerUrl;

export default function PdfQuestionPage({
  path,
  pageNumber,
  questions,
  answers,
  onAnswer,
  onPlace,
  selectedNumber,
  disabled = false,
}: {
  path: string;
  pageNumber: number;
  questions: ExamQuestion[];
  answers: Record<string, string | string[]>;
  onAnswer?: (number: number, answer: string | string[]) => void;
  onPlace?: (number: number, field: PdfField) => void;
  selectedNumber?: number;
  disabled?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    text = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<unknown>();
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(700);
  const [size, setSize] = useState({ width: 700, height: 950 });
  const start = useRef<{ x: number; y: number } | null>(null);
  const [selection, setSelection] = useState<PdfField | null>(null);
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(300, entry.contentRect.width)),
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<typeof getDocument> | undefined;
    setError(undefined);
    setReady(false);
    setPdf(null);
    void apiBlob(path)
      .then((blob) => blob.arrayBuffer())
      .then(async (bytes) => {
        if (cancelled) return;
        task = getDocument({
          data: new Uint8Array(bytes),
          cMapUrl: "/pdfjs/cmaps/",
          cMapPacked: true,
          standardFontDataUrl: "/pdfjs/standard_fonts/",
          wasmUrl: "/pdfjs/wasm/",
          enableXfa: false,
        });
        const doc = await task.promise;
        if (!cancelled) setPdf(doc);
      })
      .catch((e) => {
        if (!cancelled) setError(e);
      });
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [path]);
  useEffect(() => {
    if (!pdf || !canvas.current || !text.current) return;
    let cancelled = false;
    let rendering:
      | ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]>
      | undefined;
    let layer: TextLayer | undefined;
    setReady(false);
    void pdf
      .getPage(1)
      .then(async (page) => {
        if (cancelled || !canvas.current || !text.current) return;
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({
          scale: (width * zoom) / base.width,
        });
        setSize({ width: viewport.width, height: viewport.height });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const target = canvas.current;
        target.width = Math.ceil(viewport.width * ratio);
        target.height = Math.ceil(viewport.height * ratio);
        rendering = page.render({
          canvas: target,
          viewport,
          transform: [ratio, 0, 0, ratio, 0, 0],
          annotationMode: 0,
        });
        await rendering.promise;
        if (cancelled || !text.current) return;
        text.current.replaceChildren();
        layer = new TextLayer({
          textContentSource: await page.getTextContent(),
          container: text.current,
          viewport,
        });
        await layer.render();
        if (!cancelled) setReady(true);
      })
      .catch((e) => {
        if (!cancelled) setError(e);
      });
    return () => {
      cancelled = true;
      rendering?.cancel();
      layer?.cancel();
    };
  }, [pdf, width, zoom]);
  function point(e: React.PointerEvent<HTMLDivElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)),
      y: Math.max(0, Math.min(1, (e.clientY - box.top) / box.height)),
    };
  }
  return (
    <div className="pdf-interactive" ref={host}>
      <div className="pdf-zoom">
        <span>Original question paper · page {pageNumber}</span>
        <div>
          <button
            type="button"
            aria-label="Zoom out question paper"
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
          >
            −
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            aria-label="Zoom in question paper"
            onClick={() => setZoom((z) => Math.min(2, z + 0.2))}
          >
            +
          </button>
        </div>
      </div>
      {error != null && <ErrorState error={error} />}
      {!ready && error == null && (
        <p className="muted" role="status">
          Opening original PDF…
        </p>
      )}
      <div className="pdf-scroll">
        <div
          className={`pdf-original-page ${onPlace ? "pdf-placing" : ""}`}
          style={{ width: size.width, height: size.height }}
          onPointerDown={(e) => {
            if (!onPlace || !selectedNumber) return;
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            start.current = point(e);
          }}
          onPointerMove={(e) => {
            if (!start.current) return;
            const p = point(e);
            setSelection({
              page: pageNumber,
              x: Math.min(start.current.x, p.x),
              y: Math.min(start.current.y, p.y),
              width: Math.abs(p.x - start.current.x),
              height: Math.abs(p.y - start.current.y),
            });
          }}
          onPointerUp={(e) => {
            if (!start.current || !onPlace || !selectedNumber) return;
            const p = point(e);
            const x = Math.min(start.current.x, p.x),
              y = Math.min(start.current.y, p.y);
            onPlace(selectedNumber, {
              page: pageNumber,
              x,
              y,
              width: Math.min(
                1 - x,
                Math.max(0.04, Math.abs(p.x - start.current.x)),
              ),
              height: Math.min(
                1 - y,
                Math.max(0.015, Math.abs(p.y - start.current.y)),
              ),
            });
            start.current = null;
            setSelection(null);
          }}
          onPointerCancel={() => {
            start.current = null;
            setSelection(null);
          }}
        >
          <canvas
            ref={canvas}
            aria-hidden="true"
            style={{ width: size.width, height: size.height }}
          />
          <div ref={text} className="textLayer" />
          {questions.map((q) => {
            const field = q.context.pdf_field as PdfField | undefined;
            if (!field || field.page !== pageNumber) return null;
            const value = answers[String(q.number)] || "";
            const multiple =
              q.type === "multiple_choice" && (q.selections || 1) > 1;
            return (
              <div
                className={`pdf-answer ${selectedNumber === q.number ? "selected" : ""}`}
                id={`exam-question-${q.number}`}
                key={q.number}
                style={{
                  left: `${field.x * 100}%`,
                  top: `${field.y * 100}%`,
                  width: `${field.width * 100}%`,
                  height: `${field.height * 100}%`,
                  fontSize: Math.max(
                    10,
                    Math.min(24, size.height * field.height * 0.65),
                  ),
                }}
              >
                {multiple ? (
                  <fieldset aria-label={`Answer ${q.number}`}>
                    {q.options.map((o) => (
                      <label key={o.key} title={o.text}>
                        <input
                          aria-label={`${o.key}. ${o.text}`}
                          type="checkbox"
                          checked={
                            Array.isArray(value) && value.includes(o.key)
                          }
                          disabled={
                            disabled ||
                            !!onPlace ||
                            (!(value as string[]).includes(o.key) &&
                              Array.isArray(value) &&
                              value.length >= (q.selections || 1))
                          }
                          onChange={(e) => {
                            const selected = Array.isArray(value) ? value : [];
                            onAnswer?.(
                              q.number,
                              e.target.checked
                                ? [...selected, o.key]
                                : selected.filter((key) => key !== o.key),
                            );
                          }}
                        />
                        {o.key}
                      </label>
                    ))}
                  </fieldset>
                ) : ["multiple_choice", "matching"].includes(q.type) ? (
                  <select
                    aria-label={`Answer ${q.number}`}
                    disabled={disabled || !!onPlace}
                    value={typeof value === "string" ? value : ""}
                    onChange={(e) => onAnswer?.(q.number, e.target.value)}
                  >
                    <option value="">{q.number}</option>
                    {q.options.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.key}. {o.text}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    aria-label={`Answer ${q.number}`}
                    title={`Question ${q.number}`}
                    placeholder={String(q.number)}
                    value={typeof value === "string" ? value : ""}
                    maxLength={1000}
                    disabled={disabled || !!onPlace}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => onAnswer?.(q.number, e.target.value)}
                  />
                )}
              </div>
            );
          })}
          {selection && (
            <div
              className="pdf-drawn-field"
              style={{
                left: `${selection.x * 100}%`,
                top: `${selection.y * 100}%`,
                width: `${selection.width * 100}%`,
                height: `${selection.height * 100}%`,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
