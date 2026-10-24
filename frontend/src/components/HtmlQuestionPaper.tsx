import { createElement, type ReactNode } from "react";
import type { ExamQuestion, PaperSection } from "../services/api";

const allowed = new Set([
  "p",
  "div",
  "section",
  "span",
  "h2",
  "h3",
  "h4",
  "h5",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "br",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "caption",
  "sup",
  "sub",
  "label",
]);
const dropped = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "svg",
  "audio",
  "video",
  "button",
  "template",
  "noscript",
]);

export function HtmlQuestionPaper({
  sections,
  questions,
  answers,
  onAnswer,
  disabled = false,
}: {
  sections: PaperSection[];
  questions: ExamQuestion[];
  answers: Record<string, string | string[]>;
  onAnswer: (number: number, answer: string | string[]) => void;
  disabled?: boolean;
}) {
  const usedIds = new Set<number>();
  function answer(number: number, key: string | undefined, index: number) {
    const q = questions.find((item) => item.number === number);
    if (!q) return null;
    const value = answers[String(number)] || "";
    const multiple = q.type === "multiple_choice" && (q.selections || 1) > 1;
    const selected = Array.isArray(value) ? value : [];
    const attrs = { disabled, autoComplete: "off", spellCheck: false };
    const first = !usedIds.has(number);
    usedIds.add(number);
    let control: ReactNode;
    if (key) {
      const option = q.options.find((o) => o.key === key);
      if (!option) return null;
      control = (
        <input
          type={multiple ? "checkbox" : "radio"}
          name={`native-question-${number}`}
          aria-label={`${number}: ${key}. ${option.text}`}
          checked={multiple ? selected.includes(key) : value === key}
          disabled={
            disabled ||
            (multiple &&
              !selected.includes(key) &&
              selected.length >= (q.selections || 1))
          }
          onChange={(e) =>
            onAnswer(
              number,
              multiple
                ? e.target.checked
                  ? [...selected, key]
                  : selected.filter((v) => v !== key)
                : key,
            )
          }
        />
      );
    } else if (multiple) {
      control = (
        <span role="group" aria-label={`Answer ${number}`}>
          {q.options.map((o) => (
            <label className="native-paper-option" key={o.key}>
              <input
                type="checkbox"
                aria-label={`${number}: ${o.key}. ${o.text}`}
                checked={selected.includes(o.key)}
                disabled={
                  disabled ||
                  (!selected.includes(o.key) &&
                    selected.length >= (q.selections || 1))
                }
                onChange={(e) =>
                  onAnswer(
                    number,
                    e.target.checked
                      ? [...selected, o.key]
                      : selected.filter((key) => key !== o.key),
                  )
                }
              />
              {o.key}. {o.text}
            </label>
          ))}
        </span>
      );
    } else if (["multiple_choice", "matching"].includes(q.type)) {
      control = (
        <select
          aria-label={`Answer ${number}`}
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onChange={(e) => onAnswer(number, e.target.value)}
        >
          <option value="">{number}</option>
          {q.options.map((o) => (
            <option value={o.key} key={o.key}>
              {o.key}. {o.text}
            </option>
          ))}
        </select>
      );
    } else
      control = (
        <input
          {...attrs}
          type="text"
          aria-label={`Answer ${number}`}
          placeholder={String(number)}
          maxLength={1000}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onAnswer(number, e.target.value)}
        />
      );
    return (
      <span
        key={`answer-${index}`}
        className={`native-paper-answer ${key ? "native-choice" : ""}`}
        id={first ? `exam-question-${number}` : undefined}
      >
        {control}
      </span>
    );
  }
  function text(value: string): ReactNode[] {
    const tokens = value.split(/(\{\{\d{1,3}(?::[A-Za-z0-9]{1,8})?\}\})/g);
    return tokens.map((token, i) => {
      const match = /^\{\{(\d+)(?::([A-Za-z0-9]+))?\}\}$/.exec(token);
      return match ? answer(Number(match[1]), match[2], i) : token;
    });
  }
  function node(item: Node, index: number): ReactNode {
    if (item.nodeType === Node.TEXT_NODE) return text(item.textContent || "");
    if (!(item instanceof Element)) return null;
    const tag = item.tagName.toLowerCase();
    if (dropped.has(tag)) return null;
    const children = Array.from(item.childNodes).map(node);
    if (!allowed.has(tag)) return children;
    const props: Record<string, unknown> = { key: index };
    if (tag === "td" || tag === "th")
      for (const name of ["colspan", "rowspan"]) {
        const n = Number(item.getAttribute(name));
        if (n >= 1 && n <= 20)
          props[name === "colspan" ? "colSpan" : "rowSpan"] = n;
      }
    if (tag === "label") props.className = "native-paper-option";
    return createElement(tag, props, tag === "br" ? undefined : children);
  }
  return (
    <div className="native-question-paper">
      {sections.map((section, i) => {
        const doc = new DOMParser().parseFromString(section.html, "text/html");
        return (
          <section key={i} aria-label={`Part ${section.part} question paper`}>
            {Array.from(doc.body.childNodes).map(node)}
          </section>
        );
      })}
    </div>
  );
}
