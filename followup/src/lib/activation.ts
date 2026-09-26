import { ACTIVATION_WINDOW_MS } from "@/lib/firstValue";

/**
 * Who reaches first value, and where the rest stop (design brain A-047,
 * the Amplitude study). Pure: the dates come from activation-data.ts,
 * everything here is arithmetic on them, so it can be tested without a
 * database.
 *
 * The steps run in order. A tester counts at a step once they have reached
 * it or any later one (someone who typed a customer in by hand never
 * "connected a source", but is past that door), so the counts only go down.
 * Medians are of the time between two steps, over testers for whom both
 * dates are known; "unknown" means the step happened before FollowUp
 * recorded when (an old connection), so it counts but isn't timed.
 */
export const STEPS = ["invited", "signedIn", "connected", "firstCustomer", "replyReady", "replySent", "answered"] as const;
export type Step = (typeof STEPS)[number];
export type StepAt = Date | "unknown" | null;

export const STEP_LABELS: Record<Step, string> = {
  invited: "Invited",
  signedIn: "Signed in",
  connected: "Connected a source",
  firstCustomer: "First customer",
  replyReady: "First reply ready",
  replySent: "First reply sent",
  answered: "Customer answered",
};

// "8 signed in, 5 connected" — what the testers at each step did.
const DID: Record<Step, string> = {
  invited: "invited",
  signedIn: "signed in",
  connected: "connected",
  firstCustomer: "had a customer",
  replyReady: "had a reply ready",
  replySent: "sent one",
  answered: "heard back",
};

// "a median of 2 days after the reply was ready" — the step before, as a time.
const AFTER: Record<Step, string> = {
  invited: "",
  signedIn: "the invite",
  connected: "signing in",
  firstCustomer: "connecting",
  replyReady: "the first customer",
  replySent: "the reply was ready",
  answered: "the reply went out",
};

const STUCK_REASON: Record<Step, string> = {
  invited: "Hasn’t signed in yet.",
  signedIn: "Hasn’t connected anything yet.",
  connected: "No customers have come in yet.",
  firstCustomer: "No reply has been written yet.",
  replyReady: "A reply is ready and waiting for an OK.",
  replySent: "",
  answered: "",
};

export interface TesterJourney {
  id: string;
  name: string;
  email: string;
  business: string | null;
  at: Record<Step, StepAt>;
  // Gmail or Outlook was connected once and isn't now.
  inboxDisconnected: boolean;
  // Did anyone from the business do something 7–14 days after first
  // value? Null until that's known (not activated, or the window is open
  // and nothing has happened yet).
  cameBackWeek2: boolean | null;
}

export interface FunnelStep {
  step: Step | "week2";
  label: string;
  count: number;
  medianMs: number | null;
}

export interface StuckTester {
  id: string;
  name: string;
  email: string;
  business: string | null;
  lastStep: string;
  reason: string;
  days: number;
}

export interface Activation {
  testers: number;
  signedIn: number;
  activated: number;
  medianToValueMs: number | null;
  week2: { came: number; of: number };
  answered: number;
  funnel: FunnelStep[];
  summary: string;
  stuck: StuckTester[];
}

const DAY = 24 * 60 * 60 * 1000;

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** "20 min", "4 h", "1 day", "3 days". */
export function formatSpan(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  if (ms < DAY) return `${Math.round(ms / 3_600_000)} h`;
  const days = Math.round(ms / DAY);
  return days === 1 ? "1 day" : `${days} days`;
}

/** Index of the furthest step reached, -1 if none. */
export function furthestStep(j: TesterJourney): number {
  for (let i = STEPS.length - 1; i >= 0; i--) if (j.at[STEPS[i]] !== null) return i;
  return -1;
}

function asDate(v: StepAt): Date | null {
  return v instanceof Date ? v : null;
}

export function isActivated(j: TesterJourney): boolean {
  const sent = asDate(j.at.replySent);
  const signedIn = asDate(j.at.signedIn);
  return !!sent && !!signedIn && sent.getTime() - signedIn.getTime() <= ACTIVATION_WINDOW_MS;
}

export function buildActivation(journeys: TesterJourney[], now: Date): Activation {
  const furthest = journeys.map(furthestStep);

  const funnel: FunnelStep[] = STEPS.map((step, i) => {
    const count = furthest.filter((f) => f >= i).length;
    let medianMs: number | null = null;
    if (i > 0) {
      const spans: number[] = [];
      for (const j of journeys) {
        const from = asDate(j.at[STEPS[i - 1]]);
        const to = asDate(j.at[step]);
        if (from && to && to >= from) spans.push(to.getTime() - from.getTime());
      }
      medianMs = median(spans);
    }
    return { step, label: STEP_LABELS[step], count, medianMs };
  });

  const activatedJourneys = journeys.filter(isActivated);
  const known = activatedJourneys.filter((j) => j.cameBackWeek2 !== null);
  const week2 = { came: known.filter((j) => j.cameBackWeek2).length, of: known.length };
  funnel.push({ step: "week2", label: "Back in week 2", count: week2.came, medianMs: null });

  const toValue: number[] = [];
  for (const j of journeys) {
    const sent = asDate(j.at.replySent);
    const signedIn = asDate(j.at.signedIn);
    if (sent && signedIn && sent >= signedIn) toValue.push(sent.getTime() - signedIn.getTime());
  }

  return {
    testers: journeys.length,
    signedIn: funnel[1].count,
    activated: activatedJourneys.length,
    medianToValueMs: median(toValue),
    week2,
    answered: funnel[STEPS.indexOf("answered")].count,
    funnel,
    summary: summarize(funnel),
    stuck: findStuck(journeys, now),
  };
}

/**
 * One sentence: where most testers stop (the biggest fall between two
 * steps, up to first value) and which step takes longest (the biggest
 * median). Ties go to the earlier step, the one to fix first.
 */
export function summarize(funnel: FunnelStep[]): string {
  const upToValue = Math.min(STEPS.indexOf("replySent"), funnel.length - 1);
  let drop: { i: number; by: number } | null = null;
  for (let i = 1; i <= upToValue; i++) {
    const by = funnel[i - 1].count - funnel[i].count;
    if (by > 0 && (!drop || by > drop.by)) drop = { i, by };
  }
  let slow: { i: number; ms: number } | null = null;
  for (let i = 1; i < Math.min(STEPS.length, funnel.length); i++) {
    const ms = funnel[i].medianMs;
    if (ms !== null && (!slow || ms > slow.ms)) slow = { i, ms };
  }

  const parts: string[] = [];
  if (drop) {
    const before = STEPS[drop.i - 1];
    const step = STEPS[drop.i];
    parts.push(
      `The biggest drop is at ${STEP_LABELS[step]}: ${funnel[drop.i - 1].count} ${DID[before]}, ${funnel[drop.i].count} ${DID[step]}.`
    );
  }
  if (slow) {
    const step = STEPS[slow.i];
    parts.push(`The slowest step is ${STEP_LABELS[step]}: a median of ${formatSpan(slow.ms)} after ${AFTER[step]}.`);
  }
  return parts.join(" ") || "Not enough yet to say where testers stop.";
}

/**
 * Everyone short of first value, with how long since they last moved,
 * longest first. Someone who moved today isn't stuck.
 */
export function findStuck(journeys: TesterJourney[], now: Date): StuckTester[] {
  const valueIndex = STEPS.indexOf("replySent");
  const out: StuckTester[] = [];
  for (const j of journeys) {
    const f = furthestStep(j);
    if (f < 0 || f >= valueIndex) continue;
    let since: Date | null = null;
    for (let i = f; i >= 0 && !since; i--) since = asDate(j.at[STEPS[i]]);
    if (!since) continue;
    const days = Math.floor((now.getTime() - since.getTime()) / DAY);
    if (days < 1) continue;
    const step = STEPS[f];
    const reason = step === "connected" && j.inboxDisconnected ? "Gmail or Outlook is disconnected." : STUCK_REASON[step];
    out.push({ id: j.id, name: j.name, email: j.email, business: j.business, lastStep: STEP_LABELS[step], reason, days });
  }
  return out.sort((a, b) => b.days - a.days);
}
