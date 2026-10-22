/**
 * The words and limits "Tell FollowUp about your business" shows in the browser (A-312), kept apart from
 * src/lib/tellFollowUp.ts so the page doesn't carry server code with it.
 */

/** How long an answer can be: a few sentences, said the way the owner would say them. */
export const MAX_ANSWER = 500;

/** "e.g. Toronto and Mississauga" → "For example: Toronto and Mississauga", the line under FollowUp's question. */
export function exampleLine(example: string): string {
  const e = example.replace(/\s+/g, " ").trim().replace(/^e\.g\.\s*/i, "");
  return e ? `For example: ${e}` : "";
}

/** The card's small line: what FollowUp knows so far. */
export function knowsLine(count: number): string {
  if (count <= 0) return "Your business";
  return `FollowUp knows ${count} ${count === 1 ? "thing" : "things"} about your business`;
}
