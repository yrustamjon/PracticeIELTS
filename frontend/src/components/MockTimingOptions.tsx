export function MockTimingOptions({
  timing,
  onChange,
}: {
  timing: "timed" | "untimed";
  onChange: (timing: "timed" | "untimed") => void;
}) {
  return (
    <div className="difficulty-options exam-timing-options">
      {(
        [
          [
            "timed",
            "Real Exam · Timed",
            "A server-enforced countdown. Answers are submitted when the time ends.",
          ],
          [
            "untimed",
            "Mock · No time limit",
            "Take as long as you need. Submit your answers when you are ready.",
          ],
        ] as const
      ).map(([value, title, description]) => (
        <label className={timing === value ? "selected" : ""} key={value}>
          <input
            type="radio"
            name="exam-timing"
            checked={timing === value}
            onChange={() => onChange(value)}
          />
          <span>
            <strong>{title}</strong>
            <small>{description}</small>
          </span>
        </label>
      ))}
    </div>
  );
}
