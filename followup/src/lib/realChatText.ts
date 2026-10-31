/**
 * Turning a pasted real conversation into a test case (night plan A2, 2026-10-31; src/lib/realChats.ts keeps them).
 *
 * The founder pastes a chat a business owner agreed to share, one message per line, each starting with who wrote it
 * ("Customer:" or "Me:"). Before anything is kept, everything that could point at a person is taken out: the names the
 * founder lists, every email address, phone number, postal code, link and @handle. The cleaned chat is shown before
 * it is saved, so whatever this misses (a street address, a workplace) can be taken out by hand.
 *
 * No database and no model here, so the page can show the cleaned chat as it is typed.
 */

export type RealLine = { who: "in" | "out"; text: string; daysAgo: number };
export type RealNext = { kind: "reply" } | { kind: "followup"; daysQuiet: number } | { kind: "stop"; shouldStop: boolean };

/** The name every customer gets in the tests, and the one for the business's own people. */
export const CUSTOMER_STAND_IN = "Sam";
export const BUSINESS_STAND_IN = "Alex";

export const LIMITS = { lines: 40, lineChars: 2000, totalChars: 20_000, names: 10, nameChars: 60, list: 8, itemChars: 200, expectChars: 400 } as const;

const IN = /^(?:customer|lead|client|them|they|buyer|seller|c)\s*:\s*/i;
const OUT = /^(?:me|business|agent|realtor|owner|us|we|b|i)\s*:\s*/i;

/** One message per prefixed line; a line with no prefix carries on the message above it. */
export function parseChat(pasted: string): { lines: { who: "in" | "out"; text: string }[]; error?: string } {
  const out: { who: "in" | "out"; text: string }[] = [];
  for (const raw of pasted.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (IN.test(line)) out.push({ who: "in", text: line.replace(IN, "") });
    else if (OUT.test(line)) out.push({ who: "out", text: line.replace(OUT, "") });
    else if (out.length) out[out.length - 1].text += `\n${line}`;
    else return { lines: [], error: "Start each message with who wrote it: \"Customer:\" or \"Me:\"." };
  }
  const kept = out.filter((l) => l.text.trim());
  if (!kept.some((l) => l.who === "in")) return { lines: [], error: "There's no message from the customer. Start their lines with \"Customer:\"." };
  if (kept.length > LIMITS.lines) return { lines: [], error: `That's ${kept.length} messages; keep it to the last ${LIMITS.lines}.` };
  if (kept.some((l) => l.text.length > LIMITS.lineChars)) return { lines: [], error: "One message is very long; cut it down to the part that matters." };
  if (kept.reduce((n, l) => n + l.text.length, 0) > LIMITS.totalChars) return { lines: [], error: "That chat is very long; keep the part that matters." };
  return { lines: kept };
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Takes out what could point at a person: the names given (each replaced by the stand-in, whole words only, any case),
 * then emails, links, @handles, postal codes and phone numbers. Prices ("$1,149,000", "900k") and dates stay.
 */
export function scrub(text: string, names: { customer: string[]; business: string[] }): string {
  let s = text;
  const swap = (list: string[], to: string) => {
    // Longest first, so "Priya Shah" goes before "Priya" leaves "Sam Shah" behind.
    for (const n of list.map((x) => x.trim()).filter((x) => x.length >= 2).sort((a, b) => b.length - a.length)) {
      s = s.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escape(n)}(?![\\p{L}\\p{N}])`, "giu"), to);
    }
  };
  swap(names.customer, CUSTOMER_STAND_IN);
  swap(names.business, BUSINESS_STAND_IN);
  s = s.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[email]");
  // A link or handle never takes the full stop or comma that ends the sentence after it.
  s = s.replace(/\bhttps?:\/\/\S+|\bwww\.\S+/gi, (m) => "[link]" + (m.match(/[.,!?;:)]+$/)?.[0] ?? ""));
  s = s.replace(/(^|[\s(])@[\w.]*\w/g, "$1[handle]");
  s = s.replace(/\b[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d\b/gi, "[postal code]");
  s = s.replace(/(?<![\w$])\+?\d[\d ().-]{7,}\d(?!\w)/g, (m) => (m.replace(/\D/g, "").length >= 9 ? "[phone]" : m));
  return s;
}

/** Splits the founder's list fields ("one per line or comma") into short, non-empty items. */
export function splitList(text: string, max: number = LIMITS.list): string[] {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max)
    .map((s) => s.slice(0, LIMITS.itemChars));
}

/**
 * Which follow-up of the usual plan a quiet spell is (day 1, 3, 7, 14, 30: src/lib/followUpPlans.ts), so a real
 * follow-up is written with the same instruction a live one would get.
 */
export function stepForDays(daysQuiet: number): { step: number; angle: "open" | "new" | "step" | "close" } {
  if (daysQuiet <= 1) return { step: 0, angle: "open" };
  if (daysQuiet <= 3) return { step: 1, angle: "new" };
  if (daysQuiet <= 7) return { step: 2, angle: "step" };
  if (daysQuiet <= 14) return { step: 3, angle: "new" };
  return { step: 4, angle: "close" };
}

/** Whether the chat ends the way the task needs: a reply or a "no" check answers the customer; a follow-up comes after the business. */
export function endsRight(lines: { who: "in" | "out" }[], next: RealNext): string | null {
  const last = lines[lines.length - 1]?.who;
  if (next.kind === "followup" && last !== "out") return "A follow-up comes after the business's last message: end the chat with a \"Me:\" line.";
  if (next.kind !== "followup" && last !== "in") return "End the chat with the customer's message that FollowUp should answer.";
  return null;
}

/** The whole chat as kept: cleaned, dated so the last message is today (or the quiet days ago for a follow-up). */
export function cleanChat(
  lines: { who: "in" | "out"; text: string }[],
  names: { customer: string[]; business: string[] },
  next: RealNext
): RealLine[] {
  const ago = next.kind === "followup" ? next.daysQuiet : 0;
  return lines.map((l) => ({ who: l.who, text: scrub(l.text, names), daysAgo: ago }));
}
