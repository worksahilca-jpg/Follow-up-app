/**
 * The pilot's numbers (founder, 2026-10-22: "do 2"; PRODUCT_DIRECTION.md, "The pilot"): for each business, whether
 * FollowUp's calls were right, how much of the owner's work it took, whether its next steps worked, what came of the
 * appointments, and how the business answered customers before FollowUp compared with since.
 *
 * Pure: the admin loader (pilotNumbersData.ts) hands the rows in. Counts only; no customer's words.
 */

const DAY = 86_400_000;

/**
 * Minutes behind "about N minutes saved". A GUESS, said as one on the page, until testers time themselves:
 * writing a reply by hand, checking one FollowUp wrote before Send, and changing one before Send.
 */
export const MINUTES = { write: 4, check: 0.5, change: 2 } as const;

/** One reply that went out in the window. */
export type SentRow = { automated: boolean; draftEdited: boolean | null; trigger: string | null; replied: boolean };

/** What FollowUp chose to do next, by what started the send (FollowUp.trigger). */
export type Step = "first_reply" | "follow_up" | "bring_back";

const STEP_OF: Record<string, Step> = {
  instant_ack: "first_reply",
  unanswered: "first_reply",
  holding: "first_reply",
  dm_handoff: "first_reply",
  silence: "follow_up",
  sequence: "follow_up",
  cron: "follow_up",
  no_answer: "follow_up",
  meeting_missed: "follow_up",
  dead_lead_reactivation: "bring_back",
  their_moment: "bring_back",
  stay_in_touch: "bring_back",
};

export function stepOf(trigger: string | null): Step | null {
  return trigger ? STEP_OF[trigger] ?? null : null;
}

export type Replies = {
  asWritten: number;
  changed: number;
  onItsOwn: number;
  /** A guess from MINUTES: never shown without saying so. */
  minutesSaved: number;
  steps: Record<Step, { sent: number; wroteBack: number }>;
};

export function countReplies(rows: readonly SentRow[]): Replies {
  const steps: Replies["steps"] = {
    first_reply: { sent: 0, wroteBack: 0 },
    follow_up: { sent: 0, wroteBack: 0 },
    bring_back: { sent: 0, wroteBack: 0 },
  };
  let asWritten = 0;
  let changed = 0;
  let onItsOwn = 0;
  for (const r of rows) {
    if (r.automated) onItsOwn++;
    else if (r.draftEdited === false) asWritten++;
    else if (r.draftEdited === true) changed++;
    const step = stepOf(r.trigger);
    if (step) {
      steps[step].sent++;
      if (r.replied) steps[step].wroteBack++;
    }
  }
  const minutesSaved = Math.round(
    onItsOwn * MINUTES.write + asWritten * (MINUTES.write - MINUTES.check) + changed * (MINUTES.write - MINUTES.change)
  );
  return { asWritten, changed, onItsOwn, minutesSaved, steps };
}

/** A customer who came in during the window. */
export type NewCustomer = { tier: string | null; won: boolean; booked: boolean };

/** What the owner corrected in the window: customers they set aside, and messages FollowUp kept out that they brought back. */
export type OwnerCorrections = { setAside: number; keptOut: number; broughtBack: number };

export type Calls = {
  /** Customers FollowUp let in, and how many of them the owner then said weren't customers. */
  letIn: number;
  setAside: number;
  /** Messages FollowUp kept out as not a customer, and how many of them the owner brought back. */
  keptOut: number;
  broughtBack: number;
  /** Calls the owner didn't correct, out of every call. Null with nothing to judge yet. */
  rightPercent: number | null;
  /** Customers FollowUp called Ready, and how many of them booked or were won. */
  ready: number;
  readyBookedOrWon: number;
};

/**
 * Whether FollowUp's calls were right. A customer the owner sets aside is deleted (not-customer route), so the ones
 * let in are the customers still here plus the ones set aside, less the ones the owner brought back from "kept out".
 */
export function countCalls(customers: readonly NewCustomer[], owner: OwnerCorrections): Calls {
  const ready = customers.filter((c) => c.tier === "ready");
  const letIn = Math.max(0, customers.length - owner.broughtBack) + owner.setAside;
  const keptOut = owner.keptOut + owner.broughtBack;
  const all = letIn + keptOut;
  return {
    letIn,
    setAside: owner.setAside,
    keptOut,
    broughtBack: owner.broughtBack,
    rightPercent: all === 0 ? null : Math.round(((all - owner.setAside - owner.broughtBack) / all) * 100),
    ready: ready.length,
    readyBookedOrWon: ready.filter((c) => c.booked || c.won).length,
  };
}

/** A booking made in the window, and what the owner said happened (Booking.outcome, A-263). */
export type BookingRow = { scheduledAt: Date; outcome: string | null };

export type Appointments = { booked: number; happened: number; didnt: number; notAnswered: number; upcoming: number };

export function countAppointments(rows: readonly BookingRow[], now: Date): Appointments {
  const a: Appointments = { booked: rows.length, happened: 0, didnt: 0, notAnswered: 0, upcoming: 0 };
  for (const b of rows) {
    if (b.outcome === "didnt_happen") a.didnt++;
    else if (b.outcome) a.happened++;
    else if (b.scheduledAt.getTime() > now.getTime()) a.upcoming++;
    else a.notAnswered++;
  }
  return a;
}

/** One message in the business's inbox history, for before-and-since. */
export type HistoryMessage = { leadId: string; direction: string; at: Date };

export type Answering = { wrote: number; answered: number; medianHours: number | null };

/**
 * How the business answered the customers who wrote in [from, to): how many got any reply from the business before
 * `to`, and the median time to that first reply. Before FollowUp, every reply is the owner's own.
 */
export function answering(messages: readonly HistoryMessage[], from: Date, to: Date): Answering {
  const byLead = new Map<string, HistoryMessage[]>();
  for (const m of messages) {
    if (m.at.getTime() < from.getTime() || m.at.getTime() >= to.getTime()) continue;
    const list = byLead.get(m.leadId) ?? [];
    list.push(m);
    byLead.set(m.leadId, list);
  }
  let wrote = 0;
  let answered = 0;
  const waits: number[] = [];
  for (const list of byLead.values()) {
    list.sort((x, y) => x.at.getTime() - y.at.getTime());
    const first = list.find((m) => m.direction === "inbound");
    if (!first) continue;
    wrote++;
    const reply = list.find((m) => m.direction === "outbound" && m.at.getTime() > first.at.getTime());
    if (reply) {
      answered++;
      waits.push((reply.at.getTime() - first.at.getTime()) / 3_600_000);
    }
  }
  waits.sort((x, y) => x - y);
  const medianHours = waits.length === 0 ? null : waits.length % 2 ? waits[(waits.length - 1) / 2] : (waits[waits.length / 2 - 1] + waits[waits.length / 2]) / 2;
  return { wrote, answered, medianHours: medianHours === null ? null : Math.round(medianHours * 10) / 10 };
}

/** The 90 days before FollowUp started reading the inbox, and the time since (at most the window). */
export function beforeAndSince(messages: readonly HistoryMessage[], connectedAt: Date, now: Date, windowDays: number) {
  const sinceFrom = new Date(Math.max(connectedAt.getTime(), now.getTime() - windowDays * DAY));
  return {
    before: answering(messages, new Date(connectedAt.getTime() - 90 * DAY), connectedAt),
    since: answering(messages, sinceFrom, now),
  };
}

/** What the owner said on the setup call about how they work today (A-308 pilot): their own numbers, as told. */
export type OwnerBaseline = { inquiriesPerMonth: number | null; appointmentsPerMonth: number | null; hoursPerWeek: number | null };

export function readOwnerBaseline(value: unknown): OwnerBaseline | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : null);
  const b = { inquiriesPerMonth: n(v.inquiriesPerMonth), appointmentsPerMonth: n(v.appointmentsPerMonth), hoursPerWeek: n(v.hoursPerWeek) };
  return b.inquiriesPerMonth === null && b.appointmentsPerMonth === null && b.hoursPerWeek === null ? null : b;
}

/** Hours, said plainly: "40 min", "3 h", "2 days". */
export function hoursWords(h: number | null): string {
  if (h === null) return "—";
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} days`;
}

export function percent(part: number, whole: number): string {
  return whole === 0 ? "—" : `${Math.round((part / whole) * 100)}%`;
}
