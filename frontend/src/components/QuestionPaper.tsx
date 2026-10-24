import type { ExamQuestion } from "../services/api";
import { QuestionControl } from "./ExamQuestion";

function instructions(q: ExamQuestion) {
  const choice = q.type === "multiple_choice" || q.type === "matching";
  const text =
    q.instructions.trim() ||
    (choice
      ? "Choose your answer."
      : `Write no more than ${q.max_words} words.`);
  return q.type === "multiple_choice" && (q.selections || 1) > 1
    ? `${text} Select ${q.selections} answers.`
    : text;
}

export function QuestionPaper({
  questions,
  answers,
  disabled,
  flags,
  onAnswer,
}: {
  questions: ExamQuestion[];
  answers: Record<string, string | string[]>;
  disabled: boolean;
  flags: number[];
  onAnswer: (number: number, answer: string | string[]) => void;
}) {
  // Presentation only: do not infer missing headings, alter prompts or remap keys.
  const groups: { instruction: string; questions: ExamQuestion[] }[] = [];
  for (const question of questions) {
    const instruction = instructions(question);
    const previous = groups.at(-1);
    const choice = ["multiple_choice", "matching"].includes(question.type);
    const sameFamily =
      previous &&
      ["multiple_choice", "matching"].includes(previous.questions[0].type) ===
        choice;
    if (previous && previous.instruction === instruction && sameFamily)
      previous.questions.push(question);
    else groups.push({ instruction, questions: [question] });
  }
  return (
    <div className="reference-question-paper">
      {groups.map((group) => {
        const first = group.questions[0],
          last = group.questions.at(-1)!;
        const id = `paper-instructions-${first.number}`;
        const body =
          typeof first.context.body === "string"
            ? first.context.body.trim()
            : "";
        const sharedBody =
          body &&
          group.questions.every(
            (q) =>
              typeof q.context.body === "string" &&
              q.context.body.trim() === body,
          );
        return (
          <section
            key={first.number}
            className="reference-question-group"
            aria-labelledby={`paper-range-${first.number}`}
          >
            <h3 id={`paper-range-${first.number}`}>
              {first.number === last.number
                ? `Question ${first.number}`
                : `Questions ${first.number}–${last.number}`}
            </h3>
            <p className="paper-shared-instructions" id={id}>
              {group.instruction}
            </p>
            {sharedBody && <p className="paper-shared-context">{body}</p>}
            {group.questions.map((q) => (
              <QuestionControl
                key={q.number}
                question={q}
                value={answers[String(q.number)] || ""}
                disabled={disabled}
                flagged={flags.includes(q.number)}
                compact
                instructionId={id}
                showContext={!sharedBody}
                onChange={(value) => onAnswer(q.number, value)}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}
