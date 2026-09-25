/**
 * "What is FollowUp actually doing with this lead, and when" — a status a
 * business owner can read at a glance, on every lead, everywhere leads are
 * listed.
 *
 * Task #63 follow-up: the single most confusing thing hit this session was
 * a lead that qualified for an automated reply for *hours* with nothing
 * visibly happening anywhere in the product — the real reason (the
 * account's master "Auto follow-up on silence" switch was off) was only
 * findable by querying the database directly. This exists so that reason
 * (or whatever the real reason is) shows up right on the lead instead.
 *
 * Deliberately a PURE function with no Prisma calls of its own, reading the
 * same rules runAutomationForBusiness() (automation.ts) uses to decide
 * whether to actually claim/draft/send — but it never does any of those
 * things itself. It just answers "what would happen" for a page render
 * across every already-loaded lead, without the side effects (or the
 * database round-trips) a real automation pass needs. The two intentionally
 * read the same constants (imported from automation.ts, not redeclared)
 * so they can't quietly drift apart on what "3 hours" or "45 days" means —
 * but automation.ts itself is never imported the other way, and this file
 * is never called from it, so nothing here can affect what actually sends.
 */

import {
  UNANSWERED_ACTION,
  UNANSWERED_DEFAULT_HOURS,
  DEAD_LEAD_ACTION,
  DEAD_LEAD_DEFAULT_DAYS,
  effectiveUnansweredHours,
  quietReminderPlan,
  reactivationAlreadySent,
  isConsentKeyword,
  type TimelineMessage,
} from "@/lib/automation";
import { isExitPayload } from "@/lib/quickReplies";
import { prisma } from "@/lib/db";
import { hasAnySendChannel } from "@/lib/sendChannels";
import { META_DM_WINDOW_HOURS, META_HUMAN_AGENT_MAX_HOURS, UNANSWERED_META_DM_MAX_HOURS } from "@/lib/metaWindow";
import type { Message, PipelineStage, AutomationTier } from "@/lib/types";

export interface BusinessAutomationRules {
  /**
   * Is anything connected that a message could go out through?
   * hasAnySendChannel (src/lib/sendChannels.ts), asked once per page
   * render like the rest of this object — not once per lead.
   */
  canSend: boolean;
  /**
   * Business.holdAllForApproval — the account-wide "nothing sends without
   * my OK" setting, `@default(true)` since 2026-09-21.
   *
   * It does NOT stop a lead being picked up, and it does not stop a draft
   * being written. It stops the send, short-circuiting ahead of the lead's
   * own automationTier in all three send paths (automation.ts,
   * acknowledge.ts, sequences.ts). So it is not another `masterEnabled`:
   * with the master off nothing happens at all, while with this on
   * everything happens except the last step.
   *
   * Which is why it is a flag on the timing states below rather than a
   * state of its own — "paused" would be as wrong as "following up soon".
   */
  holdAllForApproval: boolean;
  masterEnabled: boolean;
  silenceTriggerDays: number;
  unansweredEnabled: boolean;
  unansweredHours: number;
  deadLeadEnabled: boolean;
  deadLeadDays: number;
}

/**
 * One query, once per page render (not once per lead) — every lead on a
 * page belongs to the same business, so these three rules apply to all of
 * them identically. Absence of the master "auto_send" row means OFF, the
 * same as automation.ts's own gate (`if (!automation || !automation.enabled)`)
 * — NOT the "on by default" the Settings page shows while a business has
 * never touched the toggle, since every real business gets that row seeded
 * at signup (see auth.ts) and an absent row in practice only ever means "no
 * automated sends have ever run here," which this status must not paper
 * over by claiming they're about to.
 */
export async function getBusinessAutomationRules(businessId: string): Promise<BusinessAutomationRules> {
  const [rows, canSend, business] = await Promise.all([
    prisma.automation.findMany({
      where: { businessId, action: { in: ["auto_send", UNANSWERED_ACTION, DEAD_LEAD_ACTION] } },
    }),
    hasAnySendChannel(businessId),
    // Defaults to held, matching the column's own `@default(true)`: if the
    // row cannot be read, the safe answer is the one that promises less.
    prisma.business.findUnique({ where: { id: businessId }, select: { holdAllForApproval: true } }),
  ]);
  const master = rows.find((r) => r.action === "auto_send");
  const unanswered = rows.find((r) => r.action === UNANSWERED_ACTION);
  const deadLead = rows.find((r) => r.action === DEAD_LEAD_ACTION);
  return {
    canSend,
    holdAllForApproval: business?.holdAllForApproval ?? true,
    masterEnabled: master?.enabled ?? false,
    silenceTriggerDays: master?.triggerDays ?? 5,
    unansweredEnabled: unanswered?.enabled ?? true,
    unansweredHours: unanswered?.triggerHours ?? UNANSWERED_DEFAULT_HOURS,
    deadLeadEnabled: deadLead?.enabled ?? true,
    deadLeadDays: deadLead?.triggerDays ?? DEAD_LEAD_DEFAULT_DAYS,
  };
}

export type AutomationStatus =
  | { kind: "closed" } // WON/LOST — automation never touches these regardless of anything else
  // FollowUp refused to read this lead or write anything for it, and said
  // why (Lead.aiPausedReason, written by checkAiEligibility's three call
  // sites). Ranked above every timing state below on purpose: while this
  // is set, nothing drafts and nothing sends on ANY path — automation,
  // workflow step or the owner's own suggested reply — so every one of
  // those states would be describing a follow-up that is not coming.
  | { kind: "ai_paused"; reason: string }
  // Nothing is connected that FollowUp could send with — no inbox, no
  // Instagram, no WhatsApp, no number (src/lib/sendChannels.ts). An
  // account-wide fact, shown per lead because that is where the false
  // promise was: runAutomationForBusiness and runSequencesForBusiness
  // both return empty immediately in this state, so every timing state
  // below is describing a follow-up that cannot happen.
  | { kind: "no_send_channel" }
  // The per-lead form of no_send_channel: everything is connected, and
  // Meta still will not carry a message to THIS person right now.
  //
  // Found 2026-09-23 on the founder's own Instagram lead. It had sat 64
  // hours since the lead last wrote, and the badge read "Next automation
  // check drafts this — they wrote and haven't heard back. It waits in
  // your approvals until you send it." Every clause of that was false.
  // Past 24 hours Meta refuses an automated send outright, and the
  // manual one needs an app permission this app does not yet have, so
  // the draft the sentence promised had nowhere to go.
  //
  // This is the same defect as "Following up soon" on a held account,
  // fixed that morning: the badge built to stop an unexplained non-send
  // became the thing asserting the send.
  //
  // `hoursLeftForPerson` is what is left of Meta's 7-day human-agent
  // window — the only route still open — or null once that has gone too.
  // Perishable, which is why it is a number and not a boolean: "4 days
  // left" is a reason to go and do something now.
  | { kind: "meta_window_closed"; channel: "Instagram" | "Messenger"; hoursLeftForPerson: number | null }
  // The hours before that, when it can still be saved.
  //
  // The number is not a guess. automation.ts drafts a DM follow-up at
  // UNANSWERED_META_DM_MAX_HOURS (20), and the window shuts at 24 — and
  // holdAllForApproval defaults to true, so on a fresh account that
  // draft lands in the approval queue with FOUR HOURS to live and
  // nothing anywhere saying so. Miss them and the draft is not late, it
  // is void: the lead cannot be messaged again until they write first.
  //
  // So this fires exactly when FollowUp has written something and the
  // clock has become the owner's problem rather than the engine's.
  // `heldForApproval` for the same reason the three timing states carry
  // it: it changes who has to act. On a holding account the draft waits
  // for the owner and dies at 24h if they do not come. On an account
  // that sends for itself the engine handles it at hour 20 and the
  // deadline is ours, not theirs — the badge must not order someone to
  // go and do something already in hand.
  | { kind: "meta_window_closing"; channel: "Instagram" | "Messenger"; hoursLeft: number; heldForApproval: boolean }
  | { kind: "workflow"; sequenceName: string; dueInDays: number } // enrolled in an active Sequence
  | { kind: "workflow_paused"; sequenceName: string } // enrolled, but the Sequence itself is paused
  | { kind: "off" } // Lead.automationTier === "off" — nobody but a human will ever message this lead
  // Would be eligible for an automated send right now, but the business's
  // master switch is off — the exact "why is nothing happening" case.
  // `heldForApproval` on the three states below is the account's
  // holdAllForApproval. It changes what the next tick DOES, not whether
  // one comes: the lead is still picked up and a reply is still written,
  // it just waits in the approval queue instead of going out. Each of
  // these three sentences promised a send before this existed.
  | { kind: "account_paused"; reason: "unanswered" | "dead_lead" | "silence"; heldForApproval: boolean }
  // Eligible now — the next hourly cron tick (or a manual "Run automation
  // check now") will pick this lead up.
  | { kind: "due_soon"; reason: "unanswered" | "dead_lead" | "silence"; heldForApproval: boolean }
  | { kind: "waiting"; etaHours: number | null; heldForApproval: boolean } // not yet due; etaHours is a rough estimate, not a promise
  | { kind: "sent" }; // we already replied and nothing is currently due

export interface AutomationStatusLead {
  stage: PipelineStage;
  automationTier: AutomationTier;
  lastContacted: string; // ISO date — already coalesced with createdAt by the caller
  // Each outbound carries Message.trigger, so "the instant ack is the only
  // thing that has gone out" is readable here directly — no separate list
  // of FollowUp triggers, which could not tell an owner's reply synced from
  // Gmail (no FollowUp row) from nothing having gone out at all.
  conversation: Message[];
  sequence: { name: string; active: boolean; dueAt: string | null } | null;
  // Lead.aiPausedReason — the whole owner-facing sentence, or null when
  // nothing is paused. Passed in rather than looked up because this
  // function stays pure and does no queries of its own.
  aiPausedReason: string | null;
}

/**
 * Meta's reply window for this lead, or null when it is not in the way.
 *
 * Read off the most recent INBOUND message, which is also what decides
 * whether the window is relevant at all: a lead who wrote on Instagram
 * and then emailed is reachable by email, and the newest inbound being
 * an email is exactly how that shows up here. There is deliberately no
 * email fallback for a shut DM window (R-003), so the reverse case —
 * newest inbound on Instagram, email address on file — really is blocked
 * and really should say so.
 */
function describeMetaWindow(conversation: Message[], now: Date): AutomationStatus | null {
  let newestInbound: Message | null = null;
  for (const m of conversation) {
    if (m.direction !== "inbound") continue;
    if (!newestInbound || new Date(m.date) > new Date(newestInbound.date)) newestInbound = m;
  }
  if (!newestInbound) return null;
  if (newestInbound.channel !== "instagram" && newestInbound.channel !== "messenger") return null;

  const hoursSince = (now.getTime() - new Date(newestInbound.date).getTime()) / 3_600_000;
  if (hoursSince <= META_DM_WINDOW_HOURS) return null;

  const left = META_HUMAN_AGENT_MAX_HOURS - hoursSince;
  return {
    kind: "meta_window_closed",
    channel: newestInbound.channel === "instagram" ? "Instagram" : "Messenger",
    hoursLeftForPerson: left > 0 ? Math.floor(left) : null,
  };
}

/**
 * The last few hours of an open window, when a reply is still owed.
 *
 * Only when nobody has answered since they wrote — a conversation the
 * owner has already replied to is not at risk, whatever the clock says.
 * The instant acknowledgement does not count as an answer, the same
 * exclusion findUnansweredLeads() and the states below both make: a lead
 * who wrote once and got the boilerplate has still not been replied to.
 */
function describeMetaWindowClosing(conversation: Message[], now: Date, heldForApproval: boolean): AutomationStatus | null {
  const judged = conversation.filter((m) => !(m.direction === "outbound" && m.trigger === "instant_ack"));
  const newest = mostRecentMessage(judged);
  if (!newest || newest.direction !== "inbound") return null;
  if (newest.channel !== "instagram" && newest.channel !== "messenger") return null;

  const hoursSince = (now.getTime() - new Date(newest.date).getTime()) / 3_600_000;
  if (hoursSince < UNANSWERED_META_DM_MAX_HOURS || hoursSince > META_DM_WINDOW_HOURS) return null;

  return {
    kind: "meta_window_closing",
    channel: newest.channel === "instagram" ? "Instagram" : "Messenger",
    // Rounded DOWN, so the badge never offers an hour that has gone.
    hoursLeft: Math.max(0, Math.floor(META_DM_WINDOW_HOURS - hoursSince)),
    heldForApproval,
  };
}

export function computeAutomationStatus(
  lead: AutomationStatusLead,
  rules: BusinessAutomationRules,
  now: Date = new Date()
): AutomationStatus {
  if (lead.stage === "won" || lead.stage === "lost") return { kind: "closed" };

  // Before every timing rule below, and before the workflow branch: a
  // paused lead is not waiting, not due, and not on a plan that will
  // run. It is stopped, and the one useful thing to say about it is why.
  // Won/lost still wins, because a closed lead is not waiting on
  // FollowUp for anything.
  if (lead.aiPausedReason) return { kind: "ai_paused", reason: lead.aiPausedReason };

  // Above the workflow branch and every timing state below, for the same
  // reason ai_paused is: with nothing connected, automation.ts and
  // sequences.ts both return empty before they look at a single lead, so
  // "Following up soon" and "next step in 2d" are promises the engine
  // cannot keep. Ranked BELOW ai_paused only because that one is specific
  // to this lead while this is true of every lead in the account.
  if (!rules.canSend) return { kind: "no_send_channel" };

  // Directly below no_send_channel and above everything else, including
  // the workflow branch and the owner's own "off".
  //
  // Above workflow and off because this is the one state here that also
  // governs what the OWNER can do by hand. Every state below describes
  // what FollowUp will do automatically; a shut Meta window closes the
  // manual route as well, and it closes it on a clock. An owner reading
  // "you turned this off" learns something they already knew and can
  // undo whenever they like. An owner reading "three days left to reply
  // at all" learns something that expires.
  const metaWindow = describeMetaWindow(lead.conversation, now);
  if (metaWindow) return metaWindow;

  // Checked before automationTier: enrollLead() (sequences.ts) always sets
  // a lead's automationTier to "off" the moment it enrolls, specifically so
  // the two automated paths never both try to message the same lead — so
  // "off" alone would misreport every actively-enrolled lead as having no
  // automation at all, when a workflow is exactly what's running it.
  if (lead.sequence) {
    if (!lead.sequence.active) return { kind: "workflow_paused", sequenceName: lead.sequence.name };
    const dueInDays = lead.sequence.dueAt
      ? Math.max(0, Math.ceil((new Date(lead.sequence.dueAt).getTime() - now.getTime()) / 86_400_000))
      : 0;
    return { kind: "workflow", sequenceName: lead.sequence.name, dueInDays };
  }

  if (lead.automationTier === "off") return { kind: "off" };

  // Below "off" and below the workflow branch, unlike meta_window_closed
  // above. The difference is what each one is FOR: closed states a fact
  // about reachability that holds however the lead is configured, while
  // this is a nudge to go and do something. An owner who switched a lead
  // off has said they do not want nudges about it, and a coral "4 hours
  // left" on a lead they deliberately parked is noise that teaches them
  // to ignore the colour.
  const closing = describeMetaWindowClosing(lead.conversation, now, rules.holdAllForApproval);
  if (closing) return closing;

  // The instant ack is transparent here exactly as in findUnansweredLeads():
  // the judgment runs over everything except that boilerplate. Before this,
  // a lead who wrote once and got the ack read "sent" on their own page
  // while the engine (which had the same bug) never picked them up either
  // — see Message.trigger in schema.prisma.
  const isAck = (m: Message) => m.direction === "outbound" && m.trigger === "instant_ack";
  const judged = lead.conversation.filter((m) => !isAck(m));
  const last = mostRecentMessage(judged);
  // A tap on the honest-no chip ends the automatic follow-ups (the same
  // rule as findUnansweredLeads(), and it must stay the same rule): the
  // badge must not count down to a message the engine will never send.
  // A bare STOP/START is consent, not a question — the engine never drafts
  // a reply to one (findUnansweredLeads, freshInboundToAnswer), so neither
  // may the badge count down to one.
  const lastIsInbound = last?.direction === "inbound" && !isExitPayload(last.quickReplyPayload) && !isConsentKeyword(last.body);
  const timeline: TimelineMessage[] = lead.conversation.map((m) => ({
    direction: m.direction,
    at: new Date(m.date).getTime(),
    trigger: m.trigger ?? null,
    quickReplyPayload: m.quickReplyPayload ?? null,
  }));

  // Priority order mirrors automation.ts's own merge: unanswered (the lead
  // wrote and got ignored) beats dead-lead reactivation, which beats plain
  // silence — the same de-duplication runAutomationForBusiness() does when
  // building its eligible list.
  let due: "unanswered" | "dead_lead" | "silence" | null = null;
  let etaHours: number | null = null;

  if (lastIsInbound && rules.unansweredEnabled) {
    // "Substantive" is any outbound that is not the ack — the same rule as
    // findUnansweredLeads(), and it must stay the same rule, because this
    // badge disagreeing with the engine has shipped twice now (once over an
    // Instagram echo, once over the ack itself). It includes a Meta echo
    // (source set) and an owner's reply synced from Gmail/Outlook (nothing
    // set at all); only the ack is excluded.
    const hasSubstantiveOutbound = lead.conversation.some((m) => m.direction === "outbound" && !isAck(m));
    // Shared with findUnansweredLeads() rather than recomputed, so the badge
    // cannot promise time that the engine is not going to give. That matters
    // more since the Meta ceiling landed: on an Instagram or Messenger lead
    // the wait is capped below whatever the business configured, and a badge
    // still counting down from 24 hours would say "Following up in 3h" on a
    // lead the next cron tick is about to send.
    const thresholdHours = effectiveUnansweredHours(rules.unansweredHours, hasSubstantiveOutbound, last!.channel);
    const hoursSince = (now.getTime() - new Date(last!.date).getTime()) / 3_600_000;
    // The fresh-reply worker (founder's follow-up strategy, 2026-09-25)
    // answers or holds a new message within minutes, so from the moment
    // they write this lead IS due — counting down "3 hours" would promise
    // a wait the engine no longer makes. The two exceptions are the ones
    // freshInboundToAnswer makes: a message the instant acknowledgement
    // already answered (the fuller reply then follows the first-reply
    // rule, which is what the countdown describes), and a voicemail or
    // call, which stays on the hourly rule.
    const ackAnsweredIt = lead.conversation.some((m) => isAck(m) && new Date(m.date) >= new Date(last!.date));
    const freshPassOwnsIt = !ackAnsweredIt && last!.channel !== "call";
    if (freshPassOwnsIt || hoursSince >= thresholdHours) due = "unanswered";
    else etaHours = thresholdHours - hoursSince;
  }

  if (!due) {
    const daysSinceContact = (now.getTime() - new Date(lead.lastContacted).getTime()) / 86_400_000;
    // The quiet-lead cadence, read by the same pure function the engine
    // uses (quietReminderPlan) — four reminders, then nothing until the
    // welcome back. Null when they spoke last, which the unanswered branch
    // above has already described.
    const plan = quietReminderPlan(timeline, new Date(lead.lastContacted).getTime(), rules.silenceTriggerDays, rules.deadLeadDays);
    if (rules.deadLeadEnabled && daysSinceContact >= rules.deadLeadDays && !reactivationAlreadySent(timeline, rules.deadLeadDays)) {
      due = "dead_lead";
    } else if (plan?.dueAt && plan.dueAt.getTime() <= now.getTime()) {
      due = "silence";
    } else if (etaHours === null && plan?.dueAt) {
      // Only fills in an ETA here when the unanswered branch above didn't
      // already set a more urgent (and more relevant, since it's the
      // branch actually governing this lead) one. With the cadence
      // finished there is no ETA at all, and the lead reads as "sent"
      // below — nothing more is coming until it reaches the dead-lead
      // threshold.
      etaHours = (plan.dueAt.getTime() - now.getTime()) / 3_600_000;
    }
  }

  const heldForApproval = rules.holdAllForApproval;
  if (due) {
    return rules.masterEnabled
      ? { kind: "due_soon", reason: due, heldForApproval }
      : { kind: "account_paused", reason: due, heldForApproval };
  }
  if (!lastIsInbound) return { kind: "sent" };
  return { kind: "waiting", etaHours: etaHours !== null ? Math.max(1, Math.ceil(etaHours)) : null, heldForApproval };
}

function mostRecentMessage(conversation: Message[]): Message | null {
  if (conversation.length === 0) return null;
  return conversation.reduce((latest, m) => (new Date(m.date) > new Date(latest.date) ? m : latest));
}
