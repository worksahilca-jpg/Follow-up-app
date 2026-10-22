/**
 * "Tell FollowUp about your business" (A-311; built as drawn on the founder's "Sure", 2026-10-22). A conversation in
 * which FollowUp asks what a new assistant would ask, one thing at a time, and the owner answers in their own words.
 *
 *  - The questions are the ones FollowUp can already use: "What you do" first, then the trade's questions
 *    (src/lib/teachQuestions.ts). Each answer becomes facts drafts quote word for word (src/lib/factLines.ts).
 *  - Every value is the owner's own words, copied: FollowUp splits an answer, it never rewrites one.
 *  - A 5-minute meeting (A-314, after R-139): the owner only answers. What FollowUp takes from each answer waits in a
 *    draft (`TellDraft`, on the business) and is played back once at the end, over the whole business; nothing is
 *    quoted to a customer until the owner says "Looks right".
 *  - Progress needs no record of its own: a question is answered when FollowUp knows a fact under its name (in use, or
 *    in the draft), and set aside when it is in `questionsSkipped`, where A-101 then leaves it for when a real
 *    customer asks.
 *  - Offered once on Today, with the same quiet rules as the one question a day (A-101), and any time from
 *    Settings › Your business.
 *  - Like a conversation (A-313): the topics stay this short fixed list, so it ends, but FollowUp words each question
 *    from what the owner already said, and asks once more when an answer can't help a customer ("depends"). Its own
 *    wording is checked here (`checkedWording`); the plain question below is used whenever it fails.
 */
import { labelKey, MAX_FACTS, MAX_LABEL, MAX_VALUE, squash, type FactLine } from "@/lib/factLines";
import { teachQuestions, WHO_LABEL, type TeachQuestion } from "@/lib/teachQuestions";
import { whatYouDoQuestion } from "@/lib/dailyQuestion";

export { exampleLine, knowsLine, MAX_ANSWER } from "@/lib/tellLines";

export type TellTopic = TeachQuestion;

/** What FollowUp takes from one answer, at most. */
export const MAX_ROWS = 4;
/** The card on Today is offered only while this many are still to ask; one or two left are the daily question's (A-101). */
export const CARD_MIN_OPEN = 3;

export { WHO_LABEL } from "@/lib/teachQuestions";
/** What the business doesn't do (A-313): replies can say so politely, instead of leaving the customer waiting. */
export const NOT_OFFERED_LABEL = "What you don't do";

const WHO: TellTopic = {
  label: WHO_LABEL,
  question: "Who are your customers, usually?",
  example: "e.g. Families and small businesses in Mississauga",
};
const NOT_OFFERED: TellTopic = {
  label: NOT_OFFERED_LABEL,
  question: "Is there anything people ask for that you don't do?",
  example: "e.g. We don't take jobs outside the GTA",
};

/** Every question, in the order FollowUp asks them: what the business does and for whom, the trade's own, then what it doesn't do. */
export function tellTopics(trade: string | null | undefined): TellTopic[] {
  const trades = teachQuestions(trade);
  // A realtor is already asked who they work with (buyers, sellers or both), in the trade's own words.
  const hasWho = trades.some((t) => labelKey(t.label) === labelKey(WHO_LABEL));
  return [whatYouDoQuestion(trade), ...(hasWho ? [] : [WHO]), ...trades, NOT_OFFERED];
}

/** The question to ask now: the first still open that wasn't set aside on this visit. */
export function currentTopic(state: TellState, setAside: readonly string[] = []): TellTopic | null {
  const aside = new Set(setAside.map(labelKey));
  const label = state.open.find((l) => !aside.has(labelKey(l)));
  return label ? (state.topics.find((t) => t.label === label) ?? null) : null;
}

/** How long FollowUp's own question and example may be: one short question, one short example. */
const MAX_QUESTION = 200;
const MAX_EXAMPLE = 140;

/**
 * FollowUp's own wording of a question (A-313), kept only when it is short and plain: no markup, no link, no
 * exclamation, at most two questions ("How do you price it? Set packages, or a quote?"). The example must start "e.g." so it reads as one.
 * Null means: use the plain question.
 */
export function checkedWording(proposed: { question?: unknown; example?: unknown } | null, topic: TellTopic): TellTopic | null {
  const question = typeof proposed?.question === "string" ? squash(proposed.question) : "";
  const example = typeof proposed?.example === "string" ? squash(proposed.example) : "";
  if (!question || question.length > MAX_QUESTION || !question.includes("?")) return null;
  if (/[<>{}[\]!]|https?:\/\//.test(question) || (question.match(/\?/g) ?? []).length > 2) return null;
  const okExample = example.length > 5 && example.length <= MAX_EXAMPLE && /^e\.g\./i.test(example) && !/[<>{}]/.test(example);
  return { label: topic.label, question, example: okExample ? example : topic.example };
}

export type TellState = {
  topics: TellTopic[];
  /** Still to ask, in order. */
  open: string[];
  /** Set aside with "Skip this one", and not answered since. */
  skipped: string[];
  /** Everything FollowUp knows about the business, in use. */
  facts: FactLine[];
  /** What this meeting has taken so far, waiting for "Looks right" (A-314). */
  draft: FactLine[];
};

/**
 * Where the conversation is. `again` puts back what was skipped, for "Answer the ones you skipped".
 * `facts` are the ones in use: something learned from a reply that still waits for the owner's OK doesn't count.
 * `draft` is what this meeting already took (A-314): answered, so not asked again, though not in use yet.
 */
export function tellState(
  trade: string | null | undefined,
  facts: readonly FactLine[],
  questionsSkipped: readonly string[],
  again = false,
  draft: readonly FactLine[] = []
): TellState {
  const topics = tellTopics(trade);
  const known = new Set([...facts, ...draft].map((f) => labelKey(f.label)));
  const set = new Set(questionsSkipped.map(labelKey));
  const unanswered = topics.filter((t) => !known.has(labelKey(t.label)));
  return {
    topics,
    open: unanswered.filter((t) => again || !set.has(labelKey(t.label))).map((t) => t.label),
    skipped: unanswered.filter((t) => set.has(labelKey(t.label))).map((t) => t.label),
    facts: [...facts],
    draft: [...draft],
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
 * What FollowUp takes from one answer: the answer to the question asked, under that question's name, then up
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

/** The meeting so far (A-314), as kept on the business: what FollowUp took from the answers, and its read of them. */
export type TellDraft = { rows: FactLine[]; read?: string };

/** The draft as stored, checked again: it comes back from the database as plain JSON. */
export function parseTellDraft(raw: unknown): TellDraft {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rows: FactLine[] = [];
  for (const r of Array.isArray(o.rows) ? o.rows : []) {
    if (rows.length >= MAX_FACTS) break;
    if (!r || typeof r !== "object") continue;
    const label = typeof (r as FactLine).label === "string" ? squash((r as FactLine).label) : "";
    const value = typeof (r as FactLine).value === "string" ? squash((r as FactLine).value) : "";
    if (!label || label.length > MAX_LABEL || !value || value.length > MAX_VALUE) continue;
    if (rows.some((x) => labelKey(x.label) === labelKey(label))) continue;
    rows.push({ label, value });
  }
  const read = typeof o.read === "string" && o.read.trim() ? o.read : undefined;
  return read ? { rows, read } : { rows };
}

/** `add` over `base`: the same name is replaced where it stands, a new one goes at the end. */
export function mergeRows(base: readonly FactLine[], add: readonly FactLine[]): FactLine[] {
  const out = [...base];
  for (const a of add) {
    const i = out.findIndex((r) => labelKey(r.label) === labelKey(a.label));
    if (i >= 0) out[i] = a;
    else if (out.length < MAX_FACTS) out.push(a);
  }
  return out;
}

/** One line of the play-back: `fresh` when it comes from this meeting (new, or a new value for a known name). */
export type PlaybackRow = FactLine & { fresh: boolean };

/** The end of the meeting (A-314): the whole business as FollowUp understands it. */
export type Playback = {
  /** FollowUp's read of the business, a short paragraph that only repeats what the owner said. Null when there is none. */
  read: string | null;
  rows: PlaybackRow[];
  /** "Asked the price" / "it answers with …": what FollowUp will do with it, never a promise it can't keep. */
  uses: [string, string][];
  /** Still to learn: skipped, left for when a customer asks (A-101). */
  skipped: string[];
};

/**
 * Everything FollowUp knows plus what this meeting took, the meeting's words winning, in the order the questions are
 * asked and then the rest as they were learned.
 */
export function playbackRows(facts: readonly FactLine[], draft: readonly FactLine[], topicLabels: readonly string[]): PlaybackRow[] {
  const rows: PlaybackRow[] = facts.map((f) => ({ label: f.label, value: f.value, fresh: false }));
  for (const d of draft) {
    const i = rows.findIndex((r) => labelKey(r.label) === labelKey(d.label));
    if (i < 0) rows.push({ label: d.label, value: d.value, fresh: true });
    else if (rows[i].value !== d.value) rows[i] = { label: d.label, value: d.value, fresh: true };
  }
  const order = (r: PlaybackRow) => {
    const at = topicLabels.findIndex((l) => labelKey(l) === labelKey(r.label));
    return at < 0 ? topicLabels.length : at;
  };
  return rows.map((r, i) => ({ r, i })).sort((a, b) => order(a.r) - order(b.r) || a.i - b.i).map((x) => x.r);
}

const PRICE_LABELS = ["Prices", "Commission", "Fees", "Quotes"].map(labelKey);
const BOOK_LABELS = ["How to book", "How to book a call", "How to book a viewing"].map(labelKey);

/** A value short enough to quote inside one line, cut at a word. */
function quoted(value: string): string {
  const v = squash(value);
  if (v.length <= 90) return `“${v}”`;
  const cut = v.slice(0, 90);
  return `“${cut.slice(0, Math.max(cut.lastIndexOf(" "), 60)).replace(/[\s,;:.]+$/, "")}…”`;
}

/**
 * How FollowUp will use what it knows, in at most three plain lines (A-314). Only what it really does: a fact is
 * quoted to a customer who asks about it, word for word, and what it doesn't know waits for the owner (A-101).
 */
export function usageLines(rows: readonly FactLine[], skipped: readonly string[]): [string, string][] {
  const find = (keys: readonly string[]) => rows.find((r) => keys.includes(labelKey(r.label)));
  const out: [string, string][] = [];
  const price = find(PRICE_LABELS);
  if (price) out.push(["Asked the price", `it answers with ${quoted(price.value)}.`]);
  const not = find([labelKey(NOT_OFFERED_LABEL)]);
  if (not) out.push(["Asked for something you don't do", `it answers with ${quoted(not.value)}.`]);
  if (skipped[0]) out.push([`Asked about ${skipped[0].toLowerCase()}`, "it doesn't know yet, so it waits for you."]);
  const book = find(BOOK_LABELS);
  if (book) out.push(["Ready to talk", `it answers with ${quoted(book.value)}.`]);
  const area = find([labelKey("Area you cover")]);
  if (area) out.push(["Asked where you work", `it answers with ${quoted(area.value)}.`]);
  return out.slice(0, 3);
}

/** How long FollowUp's read of the business may be: a short paragraph. */
const MAX_READ = 600;
/** Capitalised words FollowUp may use that the owner didn't: its own name. */
const OWN_WORDS = new Set(["FollowUp", "I"]);

/**
 * FollowUp's read of the business (A-314), kept only when it repeats what the owner said: plain sentences, every
 * figure one the owner gave, every name (a capitalised word inside a sentence) one the owner used. Null means: show no
 * read, never a guess.
 */
export function checkedRead(text: unknown, rows: readonly FactLine[]): string | null {
  const t = typeof text === "string" ? squash(text) : "";
  if (t.length < 20 || t.length > MAX_READ) return null;
  if (/[<>{}[\]!]|https?:\/\/|www\./i.test(t)) return null;
  const said = rows.map((r) => r.value).join(" \n ").toLowerCase();
  for (const n of t.match(/\d+(?:[.,]\d+)*/g) ?? []) if (!said.includes(n)) return null;
  const inside = t.split(/(?<=[.?])\s+/).flatMap((sentence) => sentence.split(/\s+/).slice(1));
  for (const w of inside) {
    const m = w.match(/^[“"(‘']?(\p{Lu}[\p{L}'’-]*)/u);
    if (!m) continue;
    const name = m[1].replace(/['’]s$/, "");
    if (!OWN_WORDS.has(name) && !said.includes(name.toLowerCase())) return null;
  }
  return t;
}

/**
 * What the owner's "Anything wrong or missing?" changes (A-314): each thing they stated, under a name FollowUp already
 * uses when it is the same thing, its value copied from what they wrote or dropped.
 */
export function correctionRows(text: string, proposed: unknown, labels: readonly string[]): FactLine[] {
  const haystack = squash(text).toLowerCase();
  const named = new Map(labels.map((l) => [labelKey(l), l]));
  const out: FactLine[] = [];
  for (const c of Array.isArray(proposed) ? proposed : []) {
    if (out.length >= MAX_ROWS) break;
    if (!c || typeof c !== "object") continue;
    const rawLabel = typeof (c as FactLine).label === "string" ? squash((c as FactLine).label) : "";
    const value = typeof (c as FactLine).value === "string" ? squash((c as FactLine).value) : "";
    if (!rawLabel || rawLabel.length > MAX_LABEL || !value || value.length > MAX_VALUE) continue;
    if (!haystack.includes(value.toLowerCase())) continue;
    const label = named.get(labelKey(rawLabel)) ?? rawLabel;
    if (out.some((r) => labelKey(r.label) === labelKey(label))) continue;
    out.push({ label, value });
  }
  return out;
}

/**
 * What "Looks right" saves (A-314): the meeting's lines, with the owner's edits, and any known line they changed.
 * An edit is the owner typing, so it is their words; it may only name a line of the play-back. An empty edit leaves a
 * line from this meeting out; a line already in use is changed only to a new value (Settings removes it). Null when an
 * edit names something that isn't there.
 */
export function confirmedRows(rows: readonly PlaybackRow[], edits: readonly FactLine[]): FactLine[] | null {
  const byKey = new Map<string, string>();
  for (const e of edits) {
    const key = labelKey(e.label);
    if (!rows.some((r) => labelKey(r.label) === key)) return null;
    const value = squash(e.value);
    if (value.length > MAX_VALUE) return null;
    byKey.set(key, value);
  }
  const out: FactLine[] = [];
  for (const r of rows) {
    const edit = byKey.get(labelKey(r.label));
    if (edit === undefined) {
      if (r.fresh) out.push({ label: r.label, value: r.value });
    } else if (edit) {
      if (r.fresh || edit !== r.value) out.push({ label: r.label, value: edit });
    } else if (!r.fresh) {
      return null;
    }
  }
  return out;
}
