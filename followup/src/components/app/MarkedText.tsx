/**
 * A reply with the words to check underlined in place (research round 2,
 * #1; drawn and approved 2026-10-07). An orange underline, the same "your
 * turn" colour as the dot (A-091), so the eye goes to exactly the price,
 * time or day nobody wrote, instead of reading a sentence about it under
 * the reply. Nothing else about the text changes.
 */
export default function MarkedText({ text, words }: { text: string; words: readonly string[] }) {
  const marks = words.filter((w) => w && text.includes(w));
  if (marks.length === 0) return <>{text}</>;
  const pattern = new RegExp(`(${marks.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  return (
    <>
      {text.split(pattern).map((part, i) =>
        marks.includes(part) ? (
          <mark
            key={i}
            className="bg-transparent text-inherit"
            style={{ textDecoration: "underline", textDecorationColor: "var(--state-needs)", textDecorationThickness: 2, textUnderlineOffset: 4 }}
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
