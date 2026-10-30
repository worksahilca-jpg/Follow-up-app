import { isNotAnAnswer } from "@/lib/notAnAnswer";
import { isWithinSendWindow } from "@/lib/sendWindow";
import { isExitPayload } from "@/lib/quickReplies";
import { META_NUDGE_AIM_HOURS, META_NUDGE_GAP_HOURS, META_NUDGE_LATEST_HOURS } from "@/lib/metaWindow";

/**
 * Follow-up plans (A-245: approved 2026-10-14, drawn and approved the same
 * day, "Build it, merge when green").
 *
 * The founder asked for proven follow-up systems to choose from, plus one
 * the owner edits, that keep going "until the customer is booked, or until
 * it's dead":
 *
 *  - Fast: day 1, 3, 7, 14 and 30 after the customer went quiet. Most
 *    customers.
 *  - Long: the Fast days, then once a month, up to 6 months. Customers who
 *    are 6+ months away or just looking (Later, A-246).
 *  - My own: the owner picks the days, what happens after the last one, and
 *    whom it is for.
 *
 * And four rules on every plan, whatever the owner sets:
 *
 *  1. It stops when they book, reply or say no.
 *  2. It stops 6 months after their last message (Canada's anti-spam rule
 *     on implied consent from an inquiry, CRTC guidance, as the founder
 *     added it). If they write again, it starts again.
 *  3. Never more than 1 message a day, or 3 a week, to one customer.
 *  4. If they say when to come back ("try me in March"), nothing goes out
 *     before then.
 *
 * Every message is still written from the conversation, so two customers on
 * day 3 get different messages; the step only sets the angle (stepHint).
 *
 * No server imports, on purpose: Settings, the plans page and the customer
 * card show the same days, and say the same thing about who is on which
 * plan, as the engine that sends them (src/lib/automation.ts). The badge
 * disagreeing with the engine has shipped as a bug three times; one pure
 * function read by both is how it stops.
 */

export type PlanId = "fast" | "long" | "own";
export const PLAN_IDS: readonly PlanId[] = ["fast", "long", "own"];

/** What a step is for. The words come from the conversation; this only sets the angle. */
export type StepKind = "open" | "new" | "step" | "close" | "checkback" | "thanks";

/** The owner's own plan. `useFor`: whom FollowUp puts on it by itself; "picked" = only customers the owner moves onto it. */
export type OwnPlan = { days: number[]; after: "stop" | "monthly"; useFor: "most" | "later" | "picked" };

/** Business.followUpPlans: the days the owner changed, and their own plan. Absent keys are the plans as drawn. */
export type FollowUpPlans = { fast?: number[]; long?: number[]; own?: OwnPlan };

/** Fast, and the start of Long: day 1, 3, 7, 14 and 30 (research 2026-09-09 §2, the founder's plan). */
export const FAST_DAYS: readonly number[] = [1, 3, 7, 14, 30];
/** Long's rhythm after its first days. */
export const MONTH_DAYS = 30;
/** The days an owner can choose for a step: 1 to 45 (longer than that is "once a month"). */
export const MIN_PLAN_DAY = 1;
export const MAX_PLAN_DAY = 45;
/** At most this many days in one plan; past it, "once a month" carries on. */
export const MAX_PLAN_DAYS = 8;
/** Rule 3. */
export const MAX_PER_DAY = 1;
export const MAX_PER_WEEK = 3;

const DAY = 86_400_000;
const WEEK = 7 * DAY;
/** Outbound messages this close together are one touch (a split answer, a quick correction). Same as the engine's. */
export const SAME_TOUCH_MS = 12 * 3_600_000;
/** The last monthly message lands at least this long before the 6-month stop, so a send window can't push it past. */
const CAP_MARGIN = DAY;

/* ------------------------------------------------------------------ *
 * The owner's settings, read safely.
 * ------------------------------------------------------------------ */

/** Days as an owner may set them: whole numbers 1–45, no repeats, in order, at most eight. Null when nothing usable is left. */
export function cleanDays(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const days = [...new Set(value.filter((d): d is number => typeof d === "number" && Number.isInteger(d) && d >= MIN_PLAN_DAY && d <= MAX_PLAN_DAY))].sort((a, b) => a - b);
  return days.length ? days.slice(0, MAX_PLAN_DAYS) : null;
}

/**
 * Business.followUpPlans as stored, checked field by field. Anything that
 * doesn't fit is dropped, never guessed at, so a bad row reads as the plans
 * as drawn rather than as a plan nobody chose.
 */
export function readFollowUpPlans(json: unknown): FollowUpPlans {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  const v = json as Record<string, unknown>;
  const out: FollowUpPlans = {};
  const fast = cleanDays(v.fast);
  if (fast) out.fast = fast;
  const long = cleanDays(v.long);
  if (long) out.long = long;
  const own = v.own as Record<string, unknown> | undefined;
  const ownDays = own && typeof own === "object" ? cleanDays(own.days) : null;
  if (own && ownDays) {
    out.own = {
      days: ownDays,
      after: own.after === "monthly" ? "monthly" : "stop",
      useFor: own.useFor === "most" || own.useFor === "later" ? own.useFor : "picked",
    };
  }
  return out;
}

export function isPlanId(v: unknown): v is PlanId {
  return v === "fast" || v === "long" || v === "own";
}

/**
 * Which plan this customer is on. The owner's pick on the customer's page
 * wins; then their own plan, for the customers they said it is for; then
 * Later customers (A-246: 6+ months away, or just looking) go on Long and
 * everyone else on Fast. A pick of "own" after the owner deleted their own
 * plan falls back to what FollowUp would choose.
 */
export function choosePlan(plans: FollowUpPlans, override: string | null | undefined, tier: string | null | undefined): PlanId {
  if (isPlanId(override) && (override !== "own" || plans.own)) return override;
  const later = tier === "later";
  if (plans.own?.useFor === "most" && !later) return "own";
  if (plans.own?.useFor === "later" && later) return "own";
  return later ? "long" : "fast";
}

/** Which customers FollowUp puts on each plan by itself: "most", "later", or neither (only when picked). */
export function usedFor(plans: FollowUpPlans): Record<PlanId, "most" | "later" | null> {
  const own = plans.own?.useFor;
  return {
    fast: own === "most" ? null : "most",
    long: own === "later" ? null : "later",
    own: own === "most" || own === "later" ? own : null,
  };
}

/** The first days of a plan, and whether it carries on once a month after them. */
export function planDays(plans: FollowUpPlans, plan: PlanId): { days: number[]; monthly: boolean } {
  if (plan === "own" && plans.own) return { days: plans.own.days, monthly: plans.own.after === "monthly" };
  if (plan === "long") return { days: plans.long ?? [...FAST_DAYS], monthly: true };
  return { days: plans.fast ?? [...FAST_DAYS], monthly: false };
}

/* ------------------------------------------------------------------ *
 * The steps.
 * ------------------------------------------------------------------ */

export type PlanStep = { day: number; kind: StepKind };

/**
 * What each of the first days is for, as drawn: the first answers anything
 * left open, the last closes the loop ("keep going, or close their file?"),
 * and the ones between alternate between something new and one easy next
 * step. Day 1, 3, 7, 14, 30 reads: open, new, step, new, close.
 */
function fixedKinds(n: number): StepKind[] {
  if (n <= 0) return [];
  if (n === 1) return ["open"];
  return Array.from({ length: n }, (_, i) => (i === 0 ? "open" : i === n - 1 ? "close" : i % 2 === 1 ? "new" : "step"));
}

/**
 * The plan's steps for one quiet spell, as days after the message they went
 * quiet on. A monthly plan adds a message every 30 days while it still lands
 * before the 6-month stop, and its last one closes the loop ("Month 6:
 * close the loop, then stop"). `anchorMs`/`capMs` place those monthly ones;
 * without them only the first days are listed.
 */
export function planSteps(plans: FollowUpPlans, plan: PlanId, anchorMs?: number, capMs?: number): PlanStep[] {
  const { days, monthly } = planDays(plans, plan);
  const kinds = fixedKinds(days.length);
  const steps: PlanStep[] = days.map((day, i) => ({ day, kind: kinds[i] }));
  if (!monthly || anchorMs === undefined || capMs === undefined) return steps;
  let day = days[days.length - 1];
  const first = steps.length;
  for (;;) {
    day += MONTH_DAYS;
    if (anchorMs + day * DAY > capMs - CAP_MARGIN || steps.length >= first + 12) break;
    steps.push({ day, kind: "new" });
  }
  if (steps.length > first) steps[steps.length - 1] = { ...steps[steps.length - 1], kind: "close" };
  return steps;
}

/* ------------------------------------------------------------------ *
 * Where a quiet customer is in their plan.
 * ------------------------------------------------------------------ */

/** One message as the plan reads it: the engine's Prisma rows and the screens' Messages both reduce to this. */
export type TimelineMessage = {
  direction: string;
  at: number; // ms since epoch
  trigger?: string | null;
  quickReplyPayload?: string | null;
};

const isAck = (m: TimelineMessage) => m.direction === "outbound" && isNotAnAnswer(m.trigger);

/**
 * Has a welcome back already gone out since the customer last wrote? Read
 * off the thread: an outbound message after at least `deadLeadDays` of
 * silence IS one, however it went out. One that goes unanswered is the end
 * (research 2026-09-15 §6.7). Moved here from automation.ts, which
 * re-exports it.
 */
export function reactivationAlreadySent(messages: TimelineMessage[], deadLeadDays: number): boolean {
  const judged = messages.filter((m) => !isAck(m)).sort((a, b) => a.at - b.at);
  let lastInbound = -1;
  judged.forEach((m, i) => {
    if (m.direction === "inbound") lastInbound = i;
  });
  for (let i = Math.max(1, lastInbound + 1); i < judged.length; i++) {
    if (judged[i].direction === "outbound" && judged[i].at - judged[i - 1].at >= deadLeadDays * DAY) return true;
  }
  return false;
}

/** Six calendar months after `ms`, on the same day of the month or the month's last day. */
export function sixMonthsAfter(ms: number): number {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 6;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return Date.UTC(y, m, Math.min(d.getUTCDate(), last), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
}

/**
 * Rule 3: never more than 1 message a day, or 3 a week, to one customer.
 * The earliest time at or after `dueMs` that keeps to both, given what has
 * already gone to them. Messages within 12 hours of each other count as one
 * for the week (a split answer is one message to the person reading it);
 * the day is counted from the very last one.
 */
export function withinSendLimits(dueMs: number, outboundAt: number[]): number {
  const sorted = [...outboundAt].sort((a, b) => a - b);
  if (sorted.length === 0) return dueMs;
  const touches: number[] = [];
  for (const at of sorted) if (!touches.length || at - touches[touches.length - 1] >= SAME_TOUCH_MS) touches.push(at);
  let due = Math.max(dueMs, sorted[sorted.length - 1] + DAY / MAX_PER_DAY);
  if (touches.length >= MAX_PER_WEEK) due = Math.max(due, touches[touches.length - MAX_PER_WEEK] + WEEK);
  return due;
}

export type PlanLead = {
  /** Lead.followUpPlan: the owner's pick on the customer's page. */
  override?: string | null;
  /** Where they stand (A-246): "later" goes on Long. */
  tier?: string | null;
  /** Lead.followUpNotBefore, ms: a day they asked to hear back. */
  notBeforeMs?: number | null;
  /**
   * Their confirmed bookings, ms. Canceled ones are left out by the caller.
   * `outcome` is the owner's answer to "How did it go?" (A-263,
   * src/lib/meetingOutcome.ts): "deciding" means the call is over and the
   * plan carries on from it, with a thank-you the day after.
   */
  bookings?: { createdAt: number; scheduledAt: number; outcome?: string | null }[];
  /** When the customer was added, ms: where the six months count from for one who never wrote. */
  createdAtMs?: number;
  /**
   * Lead.stayInTouchAt, ms (A-260): they said yes to hearing from the
   * business when the plan closed the loop. The plan is over for them; the
   * owner's notes take its place (src/lib/stayInTouch.ts).
   */
  stayingSince?: number | null;
  /**
   * They write on Instagram or Messenger (A-304): the first follow-up goes inside Meta's 24-hour window
   * (metaNudgeAt), because after it nothing automatic can reach them there.
   */
  metaDm?: boolean;
};

const HOUR = 3_600_000;
const NUDGE_STEP = 15 * 60_000;

/**
 * When the next-day follow-up on Instagram or Messenger goes (A-304, src/lib/metaWindow.ts): 20 hours after their
 * last message, inside the send hours, and at a time the hourly run still catches inside them; when 20 hours lands
 * at night, the last such time before it, but never sooner than 4 hours after our reply. Null when no time fits
 * (we answered too late in their window): then nothing automatic goes, and the owner's own day-2–7 message takes
 * over (draftDmHandoffs).
 */
export function metaNudgeAt(lastInboundMs: number, oursMs: number, timeZone: string): number | null {
  const deadline = lastInboundMs + META_NUDGE_LATEST_HOURS * HOUR;
  const earliest = oursMs + META_NUDGE_GAP_HOURS * HOUR;
  if (earliest > deadline) return null;
  const aim = Math.max(lastInboundMs + META_NUDGE_AIM_HOURS * HOUR, earliest);
  const fits = (t: number) => isWithinSendWindow(new Date(t), timeZone) && isWithinSendWindow(new Date(t + HOUR - 60_000), timeZone);
  for (let t = aim; t <= deadline; t += NUDGE_STEP) if (fits(t)) return t;
  for (let t = aim - NUDGE_STEP; t >= earliest; t -= NUDGE_STEP) if (fits(t)) return t;
  return null;
}

export type PlanStop =
  /** All of the plan's messages have gone. */
  | "finished"
  /** They booked since they last wrote, or have a booking coming up. */
  | "booked"
  /** The next one would land more than 6 months after their last message. */
  | "six_months"
  /** A welcome back went out after the plan and nobody answered it. */
  | "welcome_back"
  /** They said yes to staying in touch (A-260): the owner's notes, not the plan, from here on. */
  | "staying";

export type PlanState = {
  plan: PlanId;
  /** 0-based index of the next message; equal to `total` once the plan is done. */
  step: number;
  /** How many messages this plan sends in this quiet spell. */
  total: number;
  /** The next message's angle; null when nothing more will go. */
  kind: StepKind | null;
  /** The next message is the plan's last. */
  final: boolean;
  /** When the next message is due, ms; null when nothing more will go. */
  dueAt: number | null;
  /** Follow-ups that have already gone in this quiet spell. */
  touches: number;
  /** Their day, while it is still ahead (rule 4). */
  heldUntil: number | null;
  /** Why nothing more will go; null while the plan runs. */
  stopped: PlanStop | null;
  /** Six months after their last message (rule 2). */
  capAt: number;
};

/**
 * Where this quiet customer is in their plan. Null when they wrote last:
 * that customer is owed a reply (the unanswered rule), not a follow-up, and
 * "stops when they reply" is this line.
 *
 * Stateless, like the cadence it replaces: the step is COUNTED from the
 * thread. The anchor is our first message after their last one (the one they
 * went quiet on), and every later outbound touch counts, whoever pressed
 * Send — a check-in the owner approved from Today advances the plan exactly
 * like an automatic one, so a holding account never gets step 1 twice.
 *
 * Their day (rule 4) moves the plan: its first message lands on that day
 * (a "you asked me to check back" message) and the rest follow on the same
 * calendar after it ("Then the Long plan carries on").
 *
 * Each message is due on the later of its calendar day and the plan's gap
 * after the previous touch, then pushed past rule 3's limits; one that
 * would land past rule 2's six months never goes.
 */
export function followUpState(
  messages: TimelineMessage[],
  fallbackAnchorMs: number,
  plans: FollowUpPlans,
  lead: PlanLead,
  nowMs: number,
  deadLeadDays: number,
  // The business's time zone: only the Instagram/Messenger first follow-up (metaNudgeAt) reads it.
  timeZone: string = "America/New_York"
): PlanState | null {
  const judged = messages.filter((m) => !isAck(m)).sort((a, b) => a.at - b.at);
  const newest = judged[judged.length - 1];
  if (newest && newest.direction === "inbound") return null;

  plans = plans ?? {};
  const plan = choosePlan(plans, lead.override, lead.tier);
  let lastInbound = -1;
  judged.forEach((m, i) => {
    if (m.direction === "inbound") lastInbound = i;
  });
  const lastInboundAt = lastInbound >= 0 ? judged[lastInbound].at : null;
  const capAt = sixMonthsAfter(lastInboundAt ?? lead.createdAtMs ?? fallbackAnchorMs);
  const ours = judged.slice(lastInbound + 1);
  const anchor = ours.length > 0 ? ours[0].at : fallbackAnchorMs;
  const done = (stopped: PlanStop, step: number, total: number, touches: number): PlanState => ({
    plan,
    step,
    total,
    kind: null,
    final: false,
    dueAt: null,
    touches,
    heldUntil: null,
    stopped,
    capAt,
  });

  // They said yes to staying in touch (A-260): no plan message and no
  // welcome back, ever, while that holds. A note goes only when the owner
  // has something new (src/lib/stayInTouch.ts).
  if (lead.stayingSince != null) return done("staying", 0, 0, 0);

  // Rule 1: a booking since they last wrote, or one still to come. A call
  // the owner answered "Still deciding" about (A-263) is over: it no longer
  // stops the plan, it starts it again (below). A call that didn't happen
  // still stops it: the owner's one note offers a new time, then waits.
  const open = (lead.bookings ?? []).filter((b) => b.outcome !== "deciding");
  const booked = open.some((b) => b.scheduledAt >= nowMs || lastInboundAt === null || b.createdAt > lastInboundAt);

  // The call they are still deciding after, when it is after the message
  // they went quiet on: the plan starts again from it, day 1 a thank-you.
  const metAt = (lead.bookings ?? [])
    .filter((b) => b.outcome === "deciding" && b.scheduledAt <= nowMs && b.scheduledAt > anchor && (lastInboundAt === null || b.scheduledAt > lastInboundAt))
    .reduce<number | null>((m, b) => (m === null || b.scheduledAt > m ? b.scheduledAt : m), null);

  // Rule 4: their day, when it is after the message they went quiet on.
  const firstDay = planDays(plans, plan).days[0];
  const theirDay = !metAt && lead.notBeforeMs && lead.notBeforeMs > anchor ? lead.notBeforeMs : null;
  const start = metAt ?? (theirDay ? theirDay - firstDay * DAY : anchor);
  const moved = metAt !== null || theirDay !== null;
  const steps = planSteps(plans, plan, start, capAt);

  // A welcome back went out instead of the plan and nobody answered it: the
  // plan does not start again on top of it. One looks like the first
  // follow-up arriving after the welcome-back wait (deadLeadDays) with
  // nothing before it, unless it was the day they asked for. Read this way
  // rather than as "any long gap", because Long's monthly messages and a
  // check-back in March are long gaps by design.
  if (!moved && ours.length > 1 && ours[1].at - anchor >= deadLeadDays * DAY) return done("welcome_back", 0, 0, 0);

  // Touches: our messages after the anchor (or, once their day moved the
  // plan, after its new start), one per 12 hours.
  let touches = 0;
  let lastTouch = start;
  for (const m of moved ? ours.filter((o) => o.at > start) : ours.slice(1)) {
    if (m.at - lastTouch >= SAME_TOUCH_MS || (moved && touches === 0)) {
      touches += 1;
      lastTouch = m.at;
    }
  }
  if (booked) return done("booked", Math.min(touches, steps.length), steps.length, touches);
  if (touches >= steps.length) return done("finished", steps.length, steps.length, touches);

  const next = steps[touches];
  const onCalendar = start + next.day * DAY;
  const afterPrevious = touches === 0 ? onCalendar : lastTouch + (next.day - steps[touches - 1].day) * DAY;
  let due = Math.max(onCalendar, afterPrevious, theirDay ?? 0);
  // Instagram and Messenger (A-304): the first follow-up goes inside Meta's window, the same day as our reply when
  // it must; the one exception to rule 3. With no time that fits, the plan goes on as drawn (and the owner's own
  // message takes over, since nothing automatic reaches them once the window shuts).
  // Not after they tapped "Not now": that means not now (the same rule as the owner's day-2–7 message).
  const saidNotNow = lastInbound >= 0 && isExitPayload(judged[lastInbound].quickReplyPayload);
  const nudge =
    lead.metaDm && touches === 0 && !moved && !saidNotNow && lastInboundAt !== null && ours.length > 0 ? metaNudgeAt(lastInboundAt, anchor, timeZone) : null;
  if (nudge !== null) due = nudge;
  else
    due = withinSendLimits(
      due,
      messages.filter((m) => m.direction === "outbound").map((m) => m.at)
    );
  // It can go no sooner than now, so a message that fell due before the six
  // months but would only go out after them never goes.
  if (Math.max(due, nowMs) > capAt) return done("six_months", touches, steps.length, touches);

  return {
    plan,
    step: touches,
    total: steps.length,
    kind: metAt && touches === 0 ? "thanks" : theirDay && touches === 0 ? "checkback" : next.kind,
    final: touches === steps.length - 1,
    dueAt: due,
    touches,
    heldUntil: theirDay && theirDay > nowMs ? theirDay : null,
    stopped: null,
    capAt,
  };
}

/**
 * What the hourly run does with a quiet customer: send their plan's next
 * message, send the one welcome back, or nothing. Shared by the engine and
 * the badge, so the two cannot disagree.
 *
 * Until the welcome-back wait (`pastWelcomeBackWait`: quiet at least the
 * dead-lead days) only the plan speaks. After it, a plan already under way
 * keeps going (Long's monthly messages, or the day they asked for, are long
 * silences by design); otherwise one welcome back, never after they booked
 * or asked to wait, and never more than six months after they last wrote.
 * Someone who wrote last and was never answered (`state` null) keeps the
 * belated answer.
 */
export function quietLeadNext(
  state: PlanState | null,
  opts: { pastWelcomeBackWait: boolean; welcomeBackOn: boolean; welcomeBackSent: boolean; nowMs: number }
): "plan" | "welcome_back" | null {
  if (state?.stopped === "staying") return null;
  const planDue = state?.dueAt != null && state.dueAt <= opts.nowMs;
  if (!opts.pastWelcomeBackWait || !opts.welcomeBackOn) return planDue ? "plan" : null;
  if (state === null) return opts.welcomeBackSent ? null : "welcome_back";
  if (state.stopped === "booked" || state.heldUntil !== null) return null;
  if (state.dueAt !== null && (state.touches > 0 || state.kind === "checkback" || state.kind === "thanks")) return planDue ? "plan" : null;
  if (state.stopped === "six_months" || opts.nowMs > state.capAt) return null;
  return opts.welcomeBackSent ? null : "welcome_back";
}

/**
 * Was the last plan message they got the one that closes the loop ("keep
 * going, or close their file?")? `state` is their plan as it stood just
 * before they answered. Day 30 on Fast and Long, and Month 6 on Long, close
 * the loop; on the owner's own plan, its last day. Read from the step
 * count, like the rest of the plan, so it needs no record of its own.
 * Used by "Stay in touch" (A-260) to know a yes answers that question.
 */
export function closedTheLoop(state: PlanState | null, plans: FollowUpPlans): boolean {
  if (!state || state.touches === 0 || state.stopped === "booked" || state.stopped === "staying") return false;
  const { days } = planDays(plans ?? {}, state.plan);
  const i = state.touches - 1;
  if (i < days.length) return fixedKinds(days.length)[i] === "close";
  // The monthly part closes on its last message.
  return state.touches === state.total && state.total > days.length;
}

/* ------------------------------------------------------------------ *
 * The angle of each message, for the writer.
 * ------------------------------------------------------------------ */

/**
 * The steer for one message of a plan, passed to the drafting prompt as its
 * messageHint (the same mechanism workflow steps and the welcome back use,
 * deliberately not a second system prompt). Each kind has its own job, so
 * no two read alike and none is "just checking in" (research 2026-09-09
 * §2). Every one repeats the three rules rather than assuming them
 * (research 2026-09-15 §5): no apology, no fact the conversation or the
 * business's facts don't contain, never the words that signal nothing new.
 */
export function stepHint(state: Pick<PlanState, "step" | "total" | "kind" | "final">, daysQuiet: number): string {
  const kind = state.kind ?? "open";
  const angles: Record<StepKind, string> = {
    open:
      "Angle for this one — answer anything left open: if they asked something that has not been fully answered, " +
      "answer it now from the conversation or from what the business has told you; if everything was answered, put " +
      "the most useful answer in front of them again in one short line, in their own terms. End with one easy question.",
    new:
      "Angle for this one — something new and useful that fits what they told you they want: another option that " +
      "matches what they described, one relevant thing the business has told you, or one detail from this " +
      // Conversation test 2026-10-30 (third run): after "Want me to look for homes like it a little lower?", day 14
      // offered to keep the search to homes easier on price.
      "conversation they may have missed. Do not restate an earlier message, and never make again an offer the " +
      "business already made. If there is nothing new you can say " +
      "without inventing it, ask one short question about something they haven't told you yet instead.",
    step:
      "Angle for this one — one easy next step they can take or ignore: offer to find a time that suits them, or one " +
      // Conversation test 2026-10-30: after "Would it help to talk it through?", day 7 offered "a quick call" again.
      "small step that fits where the conversation is, and one the business hasn't already offered: if it offered a " +
      "call or a chat, offer something smaller instead. Make no, or not yet, feel completely fine. Do not name a " +
      "specific day, time, price or figure unless it already appears in the conversation.",
    close:
      "Angle for this one — close the loop with one easy question: would they like you to keep sending them things " +
      "that fit, or close their file for now? Make either answer feel completely fine. Two short sentences at most.",
    checkback:
      "Angle for this one — they asked you to get back to them around now. Say so in one short line, in their own " +
      "terms, and ask one easy question about whether now is a good time to pick it back up. If it isn't, that is " +
      "completely fine.",
    thanks:
      "Angle for this one — you met or spoke with them yesterday and they are still deciding. Thank them for their " +
      "time in one short, specific line, then give one useful thing from the conversation (an answer, a detail they " +
      "asked about, a next step they can take or ignore) and ask one easy question about what they'd like next. Still " +
      "deciding is completely fine; say nothing that reads as pressure, and name no day, time, price or figure that " +
      "the conversation does not contain.",
  };
  const last = state.final
    ? " This is the last message about this unless they answer: no deadline, no \"last chance\", nothing that reads as pressure."
    : "";
  const which =
    kind === "checkback"
      ? `They asked you to get back to them around now; nothing from them in about ${daysQuiet} days.`
      : kind === "thanks"
      ? "You met or spoke with them yesterday and they are still deciding; this is the thank-you after it."
      : `This is follow-up ${state.step + 1} of ${state.total} to someone who went quiet after the last message here — ` +
        (daysQuiet < 1 ? "nothing from them since it, less than a day ago." : `nothing from them in about ${daysQuiet} days.`);
  return (
    `${which} ${angles[kind]}${last} ` +
    "Do not apologise: they stopped replying, nobody let them down. Never write \"just checking in\", " +
    "\"circling back\", \"touching base\", \"following up\" or anything that means the same — every message must " +
    "give them a reason to read it. Do not repeat the wording or the angle of any earlier message in this " +
    // Conversation test, 2026-10-30: "anything with a yard?" got "a private fenced yard, or a small patio?", and
    // "3 bedroom detached" got "detached only, or would a semi work?". Both read as not listening.
    // The third run: "Townhouses in Milton" got "condo townhouses too, or only freehold?".
    "conversation. Never ask again about anything they already told you, not even to narrow it, widen it or split it " +
    "into kinds (they asked for a yard: never 'a fenced yard or a patio?'; they said detached: never 'would a semi " +
    "work?'; they said townhouses: never 'freehold or condo?'), and never ask " +
    "again a question this conversation already asked; any question asks something new. Never state a price, date, " +
    "time or fact that is not already in the conversation or in what the business has told you."
  );
}

/* ------------------------------------------------------------------ *
 * "Try me in March": the day they asked to hear back.
 * ------------------------------------------------------------------ */

const MONTHS: Record<string, number> = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3, may: 4, june: 5, jun: 5,
  july: 6, jul: 6, august: 7, aug: 7, september: 8, sep: 8, sept: 8, october: 9, oct: 9, november: 10, nov: 10,
  december: 11, dec: 11,
};
/** Roughly where each season starts. */
const SEASONS: Record<string, [number, number]> = { spring: [2, 20], summer: [5, 21], fall: [8, 22], autumn: [8, 22], winter: [11, 21] };
const SEASON_AFTER: Record<string, string> = { spring: "summer", summer: "fall", fall: "winter", autumn: "winter", winter: "spring" };
const COUNTS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, "a couple of": 2, "a couple": 2, "couple of": 2, couple: 2, "a few": 3, few: 3 };

// Asking for a later contact: "try me", "check back", "reach out", "let's
// talk", "get back to me" ... in the same sentence as the time. Or holding
// off: "not looking until", "won't be ready before", "wait until".
const ASK =
  /\b(?:try|check(?:ing)? (?:back|in)|reach(?:ing)? out|contact|get(?:ting)? back|follow(?:ing)? up|talk|speak|chat|circle back|ping|message|text|e-?mail|call|touch base|come back|reconnect|connect|write|hit me up|revisit|hear from|send (?:me|us)|(?:be|get|keep) in touch)\b/i;
const HOLD = /\b(?:not|won'?t|aren'?t|isn'?t|don'?t|doesn'?t|no|nothing|wait|hold(?:ing)? off|hold on|pause|park)\b[^.?!]*\b(?:until|till|til|before|after)\b/i;
const BETTER = /\b(?:would be|is|works|will be)\s+(?:better|best|good|fine|easier)\b/i;

const WHEN = new RegExp(
  "\\b(in|around|after|until|till|til|before|from)?\\s*" +
    "(?:(early|late|mid|the start of|the beginning of|start of|beginning of|the middle of|middle of|the end of|end of)[\\s-]+)?" +
    "(?:the\\s+|this\\s+|next\\s+)?" +
    "(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec" +
    "|spring|summer|fall|autumn|winter" +
    "|(?:a couple of|a couple|couple of|couple|a few|few|an|a|one|two|three|four|five|six|\\d{1,2})\\s+(?:more\\s+)?(?:weeks?|months?)" +
    "|next\\s+(?:week|month|year)|new year|holidays)" +
    "(?:\\s+(next year|\\d{4}))?\\b",
  "gi"
);

function noon(y: number, m: number, d: number): number {
  return Date.UTC(y, m, d, 12);
}

/** One time phrase as a day, from the moment they wrote. Null when it isn't a clear day ahead. */
function resolve(prep: string, edge: string, what: string, yearWord: string, fromMs: number, hasNext: boolean): number | null {
  const from = new Date(fromMs);
  const y = from.getUTCFullYear();
  const mo = from.getUTCMonth();
  const w = what.toLowerCase().replace(/\s+/g, " ");
  const after = prep === "after";
  const explicitYear = /^\d{4}$/.test(yearWord) ? Number(yearWord) : yearWord === "next year" ? y + 1 : null;

  if (w in MONTHS) {
    // "May" is also a verb; only "in May", "until May", "early May" count.
    if (w === "may" && !prep && !edge) return null;
    let month = MONTHS[w] + (after ? 1 : 0);
    let year = explicitYear ?? y;
    if (month > 11) {
      month -= 12;
      year += 1;
    }
    const day = /late|end/.test(edge) ? 20 : /mid|middle/.test(edge) ? 15 : 1;
    if (explicitYear === null) {
      if (month < mo || (hasNext && month <= mo)) year += 1;
      else if (month === mo && !(day > from.getUTCDate())) return null; // "in October", said in October: no clear day
    }
    return noon(year, month, day);
  }
  if (w in SEASONS) {
    const season = after ? SEASON_AFTER[w] : w;
    const [m, d] = SEASONS[season];
    let at = noon(explicitYear ?? y, m, d);
    if (explicitYear === null && at <= fromMs) {
      // Already in (or past) that season this year: "in the fall", said in
      // October, is not a clear day. "Next fall" and "after the fall" are.
      if (!hasNext && !after && fromMs - at < 92 * DAY) return null;
      at = noon(y + 1, m, d);
    }
    return at;
  }
  if (/^next week$/.test(w)) return noon(y, mo, from.getUTCDate() + ((8 - from.getUTCDay()) % 7 || 7));
  if (/^next month$/.test(w)) return noon(y, mo + 1, 1);
  if (/^next year$|^new year$|^holidays$/.test(w)) return mo === 0 ? null : noon(y + 1, 0, 2);
  const count = w.match(/^(.*?)\s+(?:more\s+)?(weeks?|months?)$/);
  if (count) {
    const n = COUNTS[count[1]] ?? Number(count[1]);
    if (!Number.isFinite(n) || n <= 0) return null;
    if (count[2].startsWith("week")) return fromMs + n * WEEK;
    const t = new Date(fromMs);
    return noon(t.getUTCFullYear(), t.getUTCMonth() + n, Math.min(t.getUTCDate(), 28));
  }
  return null;
}

/**
 * The day a customer asked to hear back, from their own message: "try me
 * again in March", "check back in a few months", "we're not looking until
 * the spring", "let's talk after the holidays". Null when the message asks
 * for nothing of the kind, so "we're moving in March" or "the house we saw
 * in May" never hold anything.
 *
 * Deterministic and English-only, on purpose: a day that stops every
 * follow-up has to come from words FollowUp can point to, never from a
 * model's guess. Counted from when they wrote, so reading the same message
 * again later gives the same day. Only a day ahead and within about a year
 * counts.
 */
export function checkBackDate(text: string, sentAtMs: number): number | null {
  for (const sentence of text.split(/(?<=[.?!\n])\s*/)) {
    if (!sentence.trim()) continue;
    WHEN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = WHEN.exec(sentence))) {
      const [whole, prep = "", edge = "", what, yearWord = ""] = match;
      const end = match.index + whole.length;
      const asks = ASK.test(sentence.slice(0, match.index)) || HOLD.test(sentence.slice(0, end)) || BETTER.test(sentence.slice(end));
      if (!asks) continue;
      // A time has to be said as one: "in March", "early May", "next
      // spring", "in two months". A bare "March" or "two months" is not.
      const lower = whole.toLowerCase();
      const prefix = lower.slice(0, lower.lastIndexOf(what.toLowerCase()));
      const hasNext = /\bnext\s*$/.test(prefix);
      const relative = /(?:weeks?|months?)$/i.test(what) && !/^next\s/i.test(what);
      const named = /^(?:next\s|new year|holidays)/i.test(what);
      if (relative ? !prep : !named && !prep && !edge && !hasNext && !/\bthis\s*$/.test(prefix)) continue;
      const at = resolve(prep.toLowerCase(), edge.toLowerCase(), what, yearWord.toLowerCase(), sentAtMs, hasNext);
      if (at !== null && at > sentAtMs + DAY && at <= sentAtMs + 400 * DAY) return at;
    }
  }
  return null;
}

/**
 * The first clear time ahead in their words, however it is said: "we'll
 * talk to the bank in January", "our lease ends in March", "moving next
 * spring". Unlike checkBackDate it needs no ask: it reads a moment they
 * named, for "Their moment" (src/lib/theirMoment.ts, A-262), which decides
 * whether the sentence is about a plan of theirs at all. The sentence the
 * time sat in comes back too, so the owner can see their words. The same
 * "said as one" rule as above, so a bare "March" never counts.
 */
export function timeInWords(text: string, sentAtMs: number): { at: number; sentence: string } | null {
  for (const sentence of text.split(/(?<=[.?!\n])\s*/)) {
    if (!sentence.trim()) continue;
    WHEN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = WHEN.exec(sentence))) {
      const [whole, prep = "", edge = "", what, yearWord = ""] = match;
      const lower = whole.toLowerCase();
      const prefix = lower.slice(0, lower.lastIndexOf(what.toLowerCase()));
      const hasNext = /\bnext\s*$/.test(prefix);
      const relative = /(?:weeks?|months?)$/i.test(what) && !/^next\s/i.test(what);
      const named = /^(?:next\s|new year|holidays)/i.test(what);
      if (relative ? !prep : !named && !prep && !edge && !hasNext && !/\bthis\s*$/.test(prefix)) continue;
      const at = resolve(prep.toLowerCase(), edge.toLowerCase(), what, yearWord.toLowerCase(), sentAtMs, hasNext);
      if (at !== null && at > sentAtMs + DAY && at <= sentAtMs + 400 * DAY) return { at, sentence: sentence.trim() };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Words for the screens.
 * ------------------------------------------------------------------ */

export const PLAN_NAMES: Record<PlanId, string> = { fast: "Fast", long: "Long", own: "My own" };

/** "Day 1, 3, 7, 14, 30" / "day 2" */
export function listDays(days: number[], capital = true): string {
  const word = capital ? "Day" : "day";
  if (days.length === 0) return "";
  return `${word} ${days.join(", ")}`;
}

/** The plan FollowUp puts most customers, or Later customers, on by itself. */
export function planFor(plans: FollowUpPlans, who: "most" | "later"): PlanId {
  if (plans.own?.useFor === who) return "own";
  return who === "most" ? "fast" : "long";
}

/** A plan's days in words: "day 1, 3, 7, 14, 30" / "the Fast days, then once a month". */
export function planDaysText(plans: FollowUpPlans, plan: PlanId): string {
  const { days, monthly } = planDays(plans, plan);
  if (plan === "long" && sameDays(days, planDays(plans, "fast").days)) return "the Fast days, then once a month";
  return `${listDays(days, false)}${monthly ? ", then once a month" : ""}`;
}

/** One line for a plan, as Settings says it: "Fast: day 1, 3, 7, 14, 30." / "Long: the Fast days, then once a month." */
export function planLine(plans: FollowUpPlans, plan: PlanId): string {
  return `${PLAN_NAMES[plan]}: ${planDaysText(plans, plan)}.`;
}

export function sameDays(a: number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((d, i) => d === b[i]);
}

/**
 * What each day is for, as the plans window lists it (the drawing's words).
 * `monthly`: the once-a-month part of a plan. `realtor` adds the example
 * only a realtor's plan would have.
 */
export function stepLabel(kind: StepKind, opts: { index?: number; monthly?: boolean; realtor?: boolean } = {}): string {
  switch (kind) {
    case "open":
      return "Answer anything left open";
    case "new":
      if (opts.monthly) return opts.realtor ? "Something new each time, like a home that fits" : "Something new each time";
      return (opts.index ?? 1) <= 1 ? "Something new that fits what they want" : "Something new again";
    case "step":
      return "One easy next step";
    case "close":
      return opts.monthly ? "Close the loop, then stop" : "Close the loop: keep going, or close their file?";
    case "checkback":
      return "Back in touch on the day they asked";
    case "thanks":
      return "A thank-you the day after you met";
  }
}

/** The rows of a plan in the plans window: day | what. */
export function planRows(plans: FollowUpPlans, plan: PlanId, realtor = false): { day: string; what: string }[] {
  const { days, monthly } = planDays(plans, plan);
  const kinds = fixedKinds(days.length);
  const monthlyRows = [
    { day: "Monthly", what: stepLabel("new", { monthly: true, realtor }) },
    { day: "Month 6", what: stepLabel("close", { monthly: true }) },
  ];
  if (plan === "long" && sameDays(days, planDays(plans, "fast").days)) {
    const count = ["", "one", "two", "three", "four", "five", "six", "seven", "eight"][days.length] ?? String(days.length);
    const span = days.length > 1 ? `Day ${days[0]}–${days[days.length - 1]}` : `Day ${days[0]}`;
    return [{ day: span, what: `The same ${count} as Fast` }, ...monthlyRows];
  }
  const rows = days.map((d, i) => ({ day: `Day ${d}`, what: stepLabel(kinds[i], { index: i }) }));
  return monthly ? [...rows, ...monthlyRows] : rows;
}

const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth"];

/** "the first of 5", "the last of 5", "the 13th of 15". */
export function stepWords(step: number, total: number): string {
  if (total > 1 && step === total - 1) return `the last of ${total}`;
  return `the ${ORDINALS[step] ?? `${step + 1}th`} of ${total}`;
}

/** "First check-in", "Last check-in", "Check-in 3 of 10": the name of the next message in a list. */
export function checkInName(state: Pick<PlanState, "step" | "total" | "kind">): string {
  if (state.kind === "checkback") return "Check-in they asked for";
  if (state.kind === "thanks") return "Thank-you after your call";
  if (state.total > 1 && state.step === state.total - 1) return "Last check-in";
  if (state.step === 0) return "First check-in";
  return `Check-in ${state.step + 1} of ${state.total}`;
}

/** "in March" for the first of a month; otherwise "later". For "Tom asked to hear back in March". */
export function askedWhen(atMs: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, month: "long", day: "numeric" }).formatToParts(new Date(atMs));
  const day = Number(parts.find((p) => p.type === "day")?.value);
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  return day === 1 ? `in ${month}` : "later";
}
