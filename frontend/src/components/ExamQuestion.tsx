import { Flag } from "lucide-react";
import type { ExamQuestion } from "../services/api";

export function hasAnswer(value: string | string[] | undefined) {
  return Array.isArray(value) ? value.length > 0 : !!value?.trim();
}

export function QuestionControl({
  question: q,
  value,
  onChange,
  disabled,
  flagged = false,
  onFlag,
}: {
  question: ExamQuestion;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  disabled: boolean;
  flagged?: boolean;
  onFlag?: () => void;
}) {
  const choice = q.type === "multiple_choice" || q.type === "matching";
  const multiple = q.type === "multiple_choice" && (q.selections || 1) > 1;
  const selected = Array.isArray(value) ? value : [];
  let placed = false;
  const input = () => (
    <input
      className="exam-answer-input"
      type="text"
      aria-label={`Answer ${q.number}`}
      aria-describedby={`question-instructions-${q.number}`}
      value={typeof value === "string" ? value : ""}
      disabled={disabled}
      maxLength={1000}
      placeholder={String(q.number)}
      autoComplete="off"
      spellCheck={false}
      onChange={(e) => onChange(e.target.value)}
    />
  );
  function inline(text: string) {
    if (choice || placed) return text;
    const blank = /_{2,}|\.{3,}|\{\{answer\}\}/.exec(text);
    if (!blank) return text;
    placed = true;
    return (
      <>
        {text.slice(0, blank.index)}
        {input()}
        {text.slice(blank.index + blank[0].length)}
      </>
    );
  }
  const prompt = inline(q.prompt);
  const table = Array.isArray(q.context.table)
    ? (q.context.table as unknown[]).filter(Array.isArray)
    : [];
  const tableRows = table.map((row, i) => (
    <tr key={i}>
      {(row as unknown[]).map((cell, j) =>
        i === 0 ? (
          <th scope="col" key={j}>
            {String(cell)}
          </th>
        ) : (
          <td key={j}>{inline(String(cell))}</td>
        ),
      )}
    </tr>
  ));
  return (
    <article
      className={`exam-question-control ${flagged ? "marked-review" : ""}`}
      id={`exam-question-${q.number}`}
    >
      <span
        className="exam-question-number"
        aria-label={`Question ${q.number}`}
      >
        {q.number}
      </span>
      <div className="exam-question-body">
        <div className="question-tools">
          <span className="question-kind">{q.type.replaceAll("_", " ")}</span>
          {onFlag && (
            <button
              className="review-toggle"
              aria-label={`Mark question ${q.number} for review`}
              aria-pressed={flagged}
              onClick={onFlag}
            >
              <Flag size={14} />
              {flagged ? "Marked for review" : "Review"}
            </button>
          )}
        </div>
        <p
          className="exam-instructions"
          id={`question-instructions-${q.number}`}
        >
          {q.instructions ||
            (choice
              ? "Choose your answer."
              : `Write no more than ${q.max_words} words.`)}
          {multiple && ` Select ${q.selections} answers.`}
        </p>
        {typeof q.context.body === "string" && q.context.body && (
          <p className="question-context">{q.context.body}</p>
        )}
        <div className="exam-prompt" id={`question-${q.number}`}>
          {prompt}
        </div>
        {table.length > 0 && (
          <div className="question-table">
            <table>
              <caption className="sr-only">Question {q.number} table</caption>
              <tbody>{tableRows}</tbody>
            </table>
          </div>
        )}
        {q.type === "multiple_choice" ? (
          <fieldset className="exam-options">
            <legend className="sr-only">Answer {q.number}</legend>
            {q.options.map((o) => (
              <label
                key={o.key}
                className={
                  (multiple ? selected.includes(o.key) : value === o.key)
                    ? "selected"
                    : ""
                }
              >
                <input
                  type={multiple ? "checkbox" : "radio"}
                  name={`question-${q.number}`}
                  value={o.key}
                  checked={
                    multiple ? selected.includes(o.key) : value === o.key
                  }
                  disabled={
                    disabled ||
                    (multiple &&
                      !selected.includes(o.key) &&
                      selected.length >= (q.selections || 1))
                  }
                  onChange={(e) =>
                    onChange(
                      multiple
                        ? e.target.checked
                          ? [...selected, o.key]
                          : selected.filter((v) => v !== o.key)
                        : o.key,
                    )
                  }
                />
                <span>
                  <strong>{o.key}.</strong> {o.text}
                </span>
              </label>
            ))}
          </fieldset>
        ) : q.type === "matching" ? (
          <select
            aria-label={`Answer ${q.number}`}
            disabled={disabled}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">Select a match</option>
            {q.options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.key}. {o.text}
              </option>
            ))}
          </select>
        ) : (
          !placed && <div className="standalone-answer">{input()}</div>
        )}
      </div>
    </article>
  );
}
