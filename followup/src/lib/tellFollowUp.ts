/**
 * "Tell FollowUp about your business" (A-311; built as drawn on the founder's "Sure", 2026-10-22). A conversation in
 * which FollowUp asks what a new assistant would ask, one thing at a time, and the owner answers in their own words.
 *
 *  - The questions are the ones FollowUp can already use: "What you do" first, then the trade's questions
 *    (src/lib/teachQuestions.ts). Each answer becomes facts drafts quote word for word (src/lib/factLines.ts).
 *  - After each answer FollowUp shows what it took from it, and nothing is saved until the owner says "Use these"
 *    (A-308's pattern). Every value is the owner's own words, copied: FollowUp splits an answer, it never rewrites one.
 *  - Progress needs no record of its own: a question is answered when FollowUp knows a fact under its name, and set
 *    aside when it is in `questionsSkipped`, where A-101 then leaves it for when a real customer asks.
 *  - Offered once on Today, with the same quiet rules as the one question a day (A-101), and any time from
 *    Settings › Your business.
 */
import { labelKey, MAX_LABEL, MAX_VALUE, squash, type FactLine } from "@/lib/factLines";
import { teachQuestions, type TeachQuestion } from "@/lib/teachQuestions";
import { whatYouDoQuestion } from "@/lib/dailyQuestion";

export { exampleLine, knowsLine, MAX_ANSWER } from "@/lib/tellLines";

export type TellTopic = TeachQuestion;

/** What FollowUp takes from one answer, at most. */
export const MAX_ROWS = 4;
/** The card on Today is offered only while this many are still to ask; one or two left are the daily question's (A-101). */
export const CARD_MIN_OPEN = 3;

/** Every question, in the order FollowUp asks them. */
export function tellTopics(trade: string | null | undefined): TellTopic[] {
  return [whatYouDoQuestion(trade), ...teachQuestions(trade)];
}

export type TellState = {
  topics: TellTopic[];
  /** Still to ask, in order. */
  open: string[];
  /** Set aside with "Skip this one", and not answered since. */
  skipped: string[];
  /** Everything FollowUp knows about the business, in use. */
  facts: FactLine[];
};

/**
 * Where the conversation is. `again` puts back what was skipped, for "Answer the ones you skipped".
 * `facts` are the ones in use: something learned from a reply that still waits for the owner's OK doesn't count.
 */
export function tellState(
  trade: string | null | undefined,
  facts: readonly FactLine[],
  questionsSkipped: readonly string[],
  again = false
): TellState {
  const topics = tellTopics(trade);
  const known = new Set(facts.map((f) => labelKey(f.label)));
  const set = new Set(questionsSkipped.map(labelKey));
  const unanswered = topics.filter((t) => !known.has(labelKey(t.label)));
  return {
    topics,
    open: unanswered.filter((t) => again || !set.has(labelKey(t.label))).map((t) => t.label),
    skipped: unanswered.filter((t) => set.has(labelKey(t.label))).map((t) => t.label),
    facts: [...facts],
  };
}

/** The one question with this name, or null: the route only takes the questions this conversation asks. */
export function tellTopic(trade: string | null | undefined, label: string): TellTopic | null {
  const key = labelKey(label);
  return tellTopics(trade).find((t) => labelKey(t.label) === key) ?? null;
}

/** Offered once on Today (A-311), while enough is still to ask. The page decides when it's quiet enough (A-101). */
export function showTellCard(open: number, closedAt: Date | null): boolean {
  return !closedAt && open >= CARD_MIN_OPEN;
}

/**
 * The answer as one fact when FollowUp can't split it: the whole answer, or as many whole sentences as fit, so the
 * value is still the owner's words. Null when nothing fits.
 */
export function wholeAnswer(answer: string): string | null {
  const a = squash(answer);
  if (!a) return null;
  if (a.length <= MAX_VALUE) return a;
  let out = "";
  for (const s of a.split(/(?<=[.!?])\s+/)) {
    const next = out ? `${out} ${s}` : s;
    if (next.length > MAX_VALUE) break;
    out = next;
  }
  return out || null;
}

/** What the model proposes for one answer (src/lib/integrations/openai.ts, proposeTellFacts). */
export type ProposedTell = { main?: unknown; also?: unknown };

/**
 * What FollowUp shows it took from one answer: the answer to the question asked, under that question's name, then up
 * to three more things the owner said in passing (an area, a language), under another question's name when it is the
 * same thing, so that question isn't asked again. Every value is copied from the answer or dropped. With nothing
 * usable from the model, the whole answer under the question's name.
 */
export function tellRows(topic: TellTopic, answer: string, proposed: ProposedTell | null, topicLabels: readonly string[]): FactLine[] {
  const a = squash(answer);
  const haystack = a.toLowerCase();
  const inAnswer = (v: string) => v.length > 0 && v.length <= MAX_VALUE && haystack.includes(v.toLowerCase());
  const main = typeof proposed?.main === "string" ? squash(proposed.main) : "";
  const first = inAnswer(main) ? main : wholeAnswer(a);
  if (!first) return [];
  const rows: FactLine[] = [{ label: topic.label, value: first }];
  const named = new Map(topicLabels.map((l) => [labelKey(l), l]));
  for (const c of Array.isArray(proposed?.also) ? proposed.also : []) {
    if (rows.length >= MAX_ROWS) break;
    if (!c || typeof c !== "object") continue;
    const rawLabel = typeof (c as FactLine).label === "string" ? squash((c as FactLine).label) : "";
    const value = typeof (c as FactLine).value === "string" ? squash((c as FactLine).value) : "";
    if (!rawLabel || rawLabel.length > MAX_LABEL || !inAnswer(value)) continue;
    const label = named.get(labelKey(rawLabel)) ?? rawLabel;
    if (rows.some((r) => labelKey(r.label) === labelKey(label) || r.value.toLowerCase() === value.toLowerCase())) continue;
    rows.push({ label, value });
  }
  return rows;
}

/**
 * The rows the owner OK'd, as the page sends them back: the same checks again, since the page is not trusted. Null
 * when any row isn't the owner's words, or the question's own row is missing.
 */
export function checkedRows(topic: TellTopic, answer: string, rows: readonly FactLine[]): FactLine[] | null {
  const haystack = squash(answer).toLowerCase();
  if (rows.length === 0 || rows.length > MAX_ROWS) return null;
  const out: FactLine[] = [];
  for (const r of rows) {
    const label = squash(r.label);
    const value = squash(r.value);
    if (!label || label.length > MAX_LABEL || !value || value.length > MAX_VALUE) return null;
    if (!haystack.includes(value.toLowerCase())) return null;
    if (out.some((o) => labelKey(o.label) === labelKey(label))) return null;
    out.push({ label, value });
  }
  return labelKey(out[0].label) === labelKey(topic.label) ? out : null;
}
