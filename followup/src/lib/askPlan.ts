import type { CriterionKey } from "@/lib/qualification";

/**
 * What the owner asks a new buyer, in their own words and order (A-302,
 * approved 2026-10-20: "yes build it").
 *
 * The first realtor (research/customers/2026-10-20-first-realtor-interview.md)
 * asks about money first and the area last, the opposite of FollowUp's order
 * (A-299), and the founder: "every realtor has different approach right".
 * So the owner says it once, the way they'd tell a new assistant, and
 * FollowUp asks their questions in their order (src/lib/qualification.ts).
 *
 * A model reads the owner's words into a proposed list (proposeAskPlan in
 * src/lib/integrations/openai.ts); everything below is the fixed part, which
 * decides what is kept:
 *
 *  - a question that names a thing FollowUp already knows how to read
 *    (area, when, the lender, a price range, the kind of home, an agent, a
 *    viewing) uses FollowUp's own careful wording for it (A-299). Anything
 *    else becomes the owner's own question;
 *  - income is never asked as a number. It becomes the lender question;
 *  - some things are never asked in writing (immigration status, religion,
 *    age, family, health ...). They are kept "For your call". Flagged by the
 *    founder's decision, not a legal opinion: a written question about them
 *    from a business may carry legal risk in Ontario;
 *  - when, the lender and an agent are added when the owner left them out,
 *    marked "Added": when and the lender sort the customer (Ready, Warm,
 *    Later), and the agent question is what stops FollowUp writing to
 *    someone who already has one (A-246).
 *
 * Buyers only. Renters and sellers keep FollowUp's order.
 */

/** The things FollowUp already knows how to read and ask, by their checklist key. */
export type KnownKey = "area" | "timing" | "financing" | "budget" | "kind" | "agent" | "viewing";
export const KNOWN_KEYS: readonly KnownKey[] = ["area", "timing", "financing", "budget", "kind", "agent", "viewing"];

/** The name the one-question card (A-101) files this question under, for "Not now". */
export const ASK_PLAN_LABEL = "What you ask a new buyer";
export const MAX_WORDS = 600;
/** At most this many questions from the owner's words, of which at most MAX_OWN are the owner's own. */
export const MAX_STEPS = 8;
export const MAX_OWN = 5;
export const MAX_FOR_CALL = 4;
const MAX_LABEL = 40;
const MAX_QUESTION = 140;
const MAX_ASK = 160;
const MAX_FIND = 300;

/**
 * FollowUp's own question for each thing it knows how to ask, as the owner sees it on "What FollowUp asks". Written to
 * match what the reply writer is told to ask (src/lib/qualification.ts, A-299), so the page says what will happen.
 */
export const KNOWN_QUESTION: Readonly<Record<KnownKey, string>> = {
  area: "Which areas are you hoping to buy in?",
  timing: "When are you hoping to move?",
  financing: "Have you spoken with a lender yet?",
  budget: "What price range should I keep an eye on?",
  kind: "What kind of place are you after?",
  agent: "Are you working with an agent already?",
  viewing: "Would you like to see it, or have a quick call?",
};

/** What each is called on "What FollowUp asks" when it is FollowUp's own (FollowUp's order, or added). */
export const KNOWN_LABEL: Readonly<Record<KnownKey, string>> = {
  area: "Area",
  timing: "When",
  financing: "Pre-approval",
  budget: "Price range",
  kind: "Kind of home",
  agent: "Their agent",
  viewing: "A viewing",
};

/** Added when the owner's words leave them out, in this order. */
const ADDED: readonly KnownKey[] = ["timing", "financing", "agent"];

export type AskStep = {
  /** A known key, or "own:<words>" for one of the owner's own questions. */
  key: CriterionKey;
  /** A short name: "Down payment". */
  label: string;
  /** The question as the owner sees it, in quotes: "How much have you put aside for a down payment?". */
  question: string;
  /** The owner's own questions only: what the reply writer asks about, and what counts as answered, for the reader. */
  ask?: string;
  find?: string;
  /** FollowUp added it; the owner didn't say it. */
  added?: true;
};

export type AskPlan = {
  v: 1;
  /** What the owner wrote, as they wrote it. */
  words: string;
  steps: AskStep[];
  /** What FollowUp won't ask in writing, by name: "Immigration status". */
  forCall: string[];
  madeAt: string;
};

/** What the model proposes, before any of the checks here. */
export type ProposedStep = { kind: KnownKey | "own"; label: string; question: string; ask: string; find: string };
export type ProposedPlan = { steps: ProposedStep[]; forCall: string[] };

/**
 * Never asked in a message. Status in Canada, religion, origin, age, family, health and public assistance: what the
 * Ontario Human Rights Code names for housing, plus immigration status, which the first realtor asks first.
 * Deliberately broad: a question wrongly kept for the call costs nothing; one wrongly sent can't be taken back.
 */
const NEVER_IN_WRITING =
  /\b(immigra\w*|citizen\w*|visas?|permits?|pr|permanent residen\w*|refugee\w*|asylum|status in canada|newcomers?|religio\w*|church|mosque|temple|gurdwara|ethnic\w*|race|racial|nationalit\w*|country of origin|from originally|originally from|where (?:are )?(?:you|they)(?: are|'re)? from|accent|age|how old|born|birth\w*|married|marital|spouse|wife|husband|partner|divorc\w*|kids|children|child|pregnan\w*|disab\w*|health|medical|wheelchair|social assistance|welfare|odsp|ontario works|employment insurance)\b/i;

/** Money as a number: what someone earns is asked as the lender question, never a figure. */
const INCOME = /\b(income|salary|salaries|earn\w*|paycheque|paycheck|wages?)\b/i;

export function neverInWriting(...texts: string[]): boolean {
  return NEVER_IN_WRITING.test(texts.join(" "));
}

const clean = (text: unknown, max: number) =>
  typeof text === "string" ? text.replace(/\s+/g, " ").trim().slice(0, max).trim() : "";

/** The key for one of the owner's own questions: its name, made safe. "Down payment" → "own:down-payment". */
export function ownKey(label: string): CriterionKey {
  const slug = label
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return `own:${slug || "question"}`;
}

export const isOwnKey = (key: string): key is `own:${string}` => /^own:[a-z0-9-]{1,40}$/.test(key);
const isKnownKey = (key: unknown): key is KnownKey => typeof key === "string" && (KNOWN_KEYS as readonly string[]).includes(key);

/** "own:down-payment" → "down payment", for anywhere the name itself isn't to hand. */
export function ownWords(key: string): string {
  return key.replace(/^own:/, "").replace(/-/g, " ");
}

function addForCall(list: string[], label: string) {
  const name = clean(label, MAX_LABEL);
  if (name && list.length < MAX_FOR_CALL && !list.some((l) => l.toLowerCase() === name.toLowerCase())) list.push(name);
}

/**
 * The plan to keep, from the owner's words and what the model proposed. Null when nothing in it can be asked: the
 * owner is asked to try again rather than given an empty list.
 */
export function finishPlan(words: string, proposed: ProposedPlan, now: Date = new Date()): AskPlan | null {
  const steps: AskStep[] = [];
  const forCall: string[] = [];
  let own = 0;
  for (const p of proposed.steps ?? []) {
    if (steps.length >= MAX_STEPS) break;
    const label = clean(p?.label, MAX_LABEL);
    if (!label) continue;
    const question = clean(p.question, MAX_QUESTION);
    const ask = clean(p.ask, MAX_ASK);
    const find = clean(p.find, MAX_FIND);
    if (neverInWriting(label, question, ask, find)) {
      addForCall(forCall, label);
      continue;
    }
    let step: AskStep | null = null;
    if (isKnownKey(p.kind)) {
      step = { key: p.kind, label, question: KNOWN_QUESTION[p.kind] };
    } else if (p.kind === "own" && INCOME.test(`${label} ${question} ${ask}`)) {
      // "Their income" is the lender question (founder's drawing: "Income and pre-approval").
      step = { key: "financing", label, question: KNOWN_QUESTION.financing };
    } else if (p.kind === "own" && question && ask && find && own < MAX_OWN) {
      step = { key: ownKey(label), label, question, ask, find };
    }
    if (!step || steps.some((s) => s.key === step.key)) continue;
    if (isOwnKey(step.key)) own++;
    steps.push(step);
  }
  for (const f of proposed.forCall ?? []) addForCall(forCall, f);
  if (steps.length === 0) return null;
  for (const key of ADDED) {
    if (!steps.some((s) => s.key === key)) steps.push({ key, label: KNOWN_LABEL[key], question: KNOWN_QUESTION[key], added: true });
  }
  return { v: 1, words: clean(words, MAX_WORDS), steps, forCall, madeAt: now.toISOString() };
}

/** A stored plan, read defensively: anything off-shape is dropped, and a plan with nothing the owner said is none. */
export function readAskPlan(value: unknown): AskPlan | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.v !== 1 || !Array.isArray(v.steps)) return null;
  const steps: AskStep[] = [];
  for (const s of v.steps) {
    if (!s || typeof s !== "object") continue;
    const r = s as Record<string, unknown>;
    const key = typeof r.key === "string" ? r.key : "";
    const label = clean(r.label, MAX_LABEL);
    const question = clean(r.question, MAX_QUESTION);
    if (!label || !question || steps.some((x) => x.key === key)) continue;
    if (isKnownKey(key)) {
      steps.push({ key, label, question: KNOWN_QUESTION[key], ...(r.added === true ? { added: true as const } : {}) });
    } else if (isOwnKey(key)) {
      const ask = clean(r.ask, MAX_ASK);
      const find = clean(r.find, MAX_FIND);
      if (!ask || !find || neverInWriting(label, question, ask, find)) continue;
      steps.push({ key, label, question, ask, find });
    }
  }
  if (!steps.some((s) => !s.added)) return null;
  const forCall = Array.isArray(v.forCall) ? v.forCall.map((f) => clean(f, MAX_LABEL)).filter(Boolean).slice(0, MAX_FOR_CALL) : [];
  return {
    v: 1,
    words: clean(v.words, MAX_WORDS),
    steps,
    forCall,
    madeAt: typeof v.madeAt === "string" ? v.madeAt : new Date(0).toISOString(),
  };
}

/** The plan in a new order the owner dragged it into, or null when `keys` isn't exactly its questions. */
export function reorderPlan(plan: AskPlan, keys: readonly string[]): AskPlan | null {
  if (keys.length !== plan.steps.length || new Set(keys).size !== keys.length) return null;
  const steps = keys.map((k) => plan.steps.find((s) => s.key === k));
  if (steps.some((s) => !s)) return null;
  return { ...plan, steps: steps as AskStep[] };
}

/** FollowUp's own order for a buyer, as the page lists it before the owner gives theirs. */
export function followUpOrder(rounds: readonly (readonly CriterionKey[])[]): { key: CriterionKey; label: string; question: string }[] {
  return rounds.flat().flatMap((key) => (isKnownKey(key) ? [{ key, label: KNOWN_LABEL[key], question: KNOWN_QUESTION[key] }] : []));
}

/** The buyer's rounds, in the owner's order: two questions at a time, joined in one sentence (A-246). */
export function planRounds(plan: AskPlan): CriterionKey[][] {
  const rounds: CriterionKey[][] = [];
  for (let i = 0; i < plan.steps.length; i += 2) rounds.push(plan.steps.slice(i, i + 2).map((s) => s.key));
  return rounds;
}
