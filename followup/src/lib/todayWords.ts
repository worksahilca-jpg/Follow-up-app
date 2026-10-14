/**
 * Today's two plain sentences (A-243, after R-113: "how do i get to know
 * what to do"). The page says what to do before showing anything to act
 * on, and who comes next as a line, not a row to decode.
 */

/** "Ivy, Aman and 2 more": who comes after, by first name, two at most. */
export function whoIsNext(names: string[]): string | null {
  const firsts = names.map((n) => n.trim().split(/\s+/)[0] || n);
  if (firsts.length === 0) return null;
  if (firsts.length === 1) return firsts[0];
  if (firsts.length === 2) return `${firsts[0]} and ${firsts[1]}`;
  return `${firsts[0]}, ${firsts[1]} and ${firsts.length - 2} more`;
}

/** What to do, in one sentence above the customer. Nothing when nobody is waiting. */
export function todaysInstruction(waiting: number, firstName: string | null): string | null {
  if (!firstName || waiting < 1) return null;
  if (waiting === 1) return `Reply to ${firstName}, then you're done.`;
  return `Reply to them one at a time. Start with ${firstName}.`;
}
