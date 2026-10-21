import { describeMoment } from "@/lib/theirMoment";
import { askedWhen, followUpState, PLAN_NAMES, stepWords, type PlanId, type PlanState } from "@/lib/followUpPlans";
import type { BusinessAutomationRules } from "@/lib/automationStatus";
import type { Lead } from "@/lib/types";
import { stayEvery } from "@/lib/stayInTouch";

/**
 * What the customer's page says about their follow-up plan (A-245, drawn
 * and approved 2026-10-14): "On the Fast plan", then one sentence, from the
 * same followUpState the engine sends by, so the card can't promise a
 * message the engine won't send.
 *
 * When nothing can go out the sentence says so and why, instead of a date
 * (app analysis 2026-10-14, fix 2): a paused plan that still showed "Next
 * message Thursday" was the same false promise the badge was rebuilt to
 * stop making.
 */
export type PlanCard = {
  plan: PlanId;
  /** "On the Fast plan". */
  title: string;
  /** The one sentence under it. */
  sentence: string;
  /** The owner picked this plan on this customer's page. */
  picked: boolean;
  /** The day they asked for, while it is ahead: "Mar 1". */
  waitingFor: string | null;
  /** Short, for the row in Details: "next Thu, Oct 15", "paused", "done". */
  status: string;
  /** When the next message is due, ms, while one is. */
  nextAt: number | null;
  /** They said yes to staying in touch (A-260): "Change" offers to stop that instead of a plan. */
  staying?: boolean;
  /** "Their moment" (A-262): their words, when FollowUp brings them up ("in the first week of January"), and the day. */
  moment?: { quote: string; when: string; at: number } | null;
};

const DAY = 86_400_000;

export function planCard(lead: Lead, rules: BusinessAutomationRules, now: Date, timeZone: string): PlanCard | null {
  const status = lead.automationStatus;
  if (!status || status.kind === "closed") return null;
  const first = lead.name.trim().split(/\s+/)[0] || lead.name;
  const state: PlanState | null = followUpState(
    lead.conversation.map((m) => ({ direction: m.direction, at: Date.parse(m.date), trigger: m.trigger ?? null, quickReplyPayload: m.quickReplyPayload ?? null })),
    Date.parse(lead.lastContacted),
    rules.followUpPlans,
    lead.followUp ?? {},
    now.getTime(),
    rules.deadLeadDays,
    rules.timeZone ?? timeZone
  );
  const plan: PlanId = state?.plan ?? (lead.followUp?.override === "long" || lead.followUp?.override === "own" ? lead.followUp.override : lead.followUp?.tier === "later" ? "long" : "fast");
  const name = PLAN_NAMES[plan];
  const staying = lead.followUp?.stayingSince != null;
  const base = {
    plan,
    title: staying ? "Staying in touch" : plan === "own" ? "On your own plan" : `On the ${name} plan`,
    staying,
    moment: lead.moment ? { quote: lead.moment.quote, when: describeMoment(new Date(lead.moment.at), timeZone), at: Date.parse(lead.moment.at) } : null,
    picked: Boolean(lead.followUp?.override),
    waitingFor: null as string | null,
    nextAt: null as number | null,
  };
  const day = (ms: number, long: boolean) =>
    new Intl.DateTimeFormat("en-US", long ? { timeZone, weekday: "long", month: "short", day: "numeric" } : { timeZone, weekday: "short", month: "short", day: "numeric" }).format(new Date(ms));
  const paused = (sentence: string) => ({ ...base, sentence, status: "paused" });

  // Nothing can go out at all, or not on its own: said first, with the fix.
  if (!rules.canSend || status.kind === "no_send_channel") return paused("Paused: nothing can go out until you reconnect your email or Instagram in Settings.");
  if (status.kind === "workflow" || status.kind === "workflow_paused") {
    return { ...base, title: "On a special plan", sentence: `“${status.sequenceName}” runs instead of the usual plan.`, status: "special plan" };
  }
  if (staying) {
    const since = lead.stayInTouch?.since ? new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric" }).format(new Date(lead.stayInTouch.since)) : null;
    return {
      ...base,
      sentence:
        `${first} said yes${since ? ` on ${since}` : ""}. FollowUp writes one useful note ${stayEvery(rules.stayInTouchDays ?? 30)}, only when you have ` +
        `something new that fits what ${first} wants. Each note says how to stop, and waits for your OK on Today.`,
      status: "staying in touch",
    };
  }
  if (status.kind === "off") return paused(`Paused: you turned FollowUp off for ${first}, so nothing goes out on its own.`);
  if (status.kind === "talked") return paused(`You spoke with ${first}, so nothing goes out until they write again.`);
  if (status.kind === "ai_paused") return paused(status.reason);
  if (!rules.masterEnabled) return paused("Paused: check-ins are switched off in Settings.");
  if (status.kind === "meta_window_closed") return paused(`${status.channel} only lets a person write to ${first} now, so FollowUp won’t.`);

  if (state === null) return { ...base, sentence: `It starts once ${first} has had your reply.`, status: "after your reply" };
  if (state.stopped === "booked") return { ...base, sentence: `${first} booked, so the plan stopped. If they write again, it starts again.`, status: "stopped, booked" };
  if (state.stopped === "six_months") return { ...base, sentence: `It stopped 6 months after ${first}’s last message. If they write again, it starts again.`, status: "stopped" };
  if (state.stopped === "welcome_back") return { ...base, sentence: `A welcome back went out, so nothing more unless ${first} writes.`, status: "done" };
  if (state.stopped === "finished" || state.dueAt === null) {
    return { ...base, sentence: `All ${state.total} messages have gone. If ${first} writes again, it starts again.`, status: "done" };
  }

  const yours = rules.holdAllForApproval ? " Each one waits for your OK on Today." : " Nothing for you to do.";
  if (state.heldUntil !== null) {
    return {
      ...base,
      waitingFor: day(state.heldUntil, false).replace(/^\w+, /, ""),
      nextAt: state.dueAt,
      sentence: `${first} asked to hear back ${askedWhen(state.heldUntil, timeZone)}, so nothing goes out before ${day(state.heldUntil, true)}. Then the ${name} plan carries on.${yours}`,
      status: `waiting for ${day(state.heldUntil, false).replace(/^\w+, /, "")}`,
    };
  }
  const when = state.dueAt <= now.getTime() + DAY / 24 ? "is due now" : day(state.dueAt, true);
  // After a call they are still deciding about (A-263): the thank-you first, then the plan.
  if (state.kind === "thanks") {
    const goes = when === "is due now" ? "is due now" : `goes ${when}`;
    return {
      ...base,
      nextAt: state.dueAt,
      sentence: `A thank-you after your call ${goes}, then the ${name} plan carries on. It stops when they book, reply or say no.${yours}`,
      status: when === "is due now" ? "due now" : `next ${day(state.dueAt, false)}`,
    };
  }
  const sentence =
    when === "is due now"
      ? `The next message, ${stepWords(state.step, state.total)}, is due now. It stops when they book, reply or say no.${yours}`
      : `Next message ${when}, ${stepWords(state.step, state.total)}. It stops when they book, reply or say no.${yours}`;
  return { ...base, nextAt: state.dueAt, sentence, status: when === "is due now" ? "due now" : `next ${day(state.dueAt, false)}` };
}
