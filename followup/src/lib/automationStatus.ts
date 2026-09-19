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

import { UNANSWERED_ACTION, UNANSWERED_DEFAULT_HOURS, DEAD_LEAD_ACTION, DEAD_LEAD_DEFAULT_DAYS, effectiveUnansweredHours } from "@/lib/automation";
import { isExitPayload } from "@/lib/quickReplies";
import { prisma } from "@/lib/db";
import type { Message, PipelineStage, AutomationTier } from "@/lib/types";

export interface BusinessAutomationRules {
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
  const rows = await prisma.automation.findMany({
    where: { businessId, action: { in: ["auto_send", UNANSWERED_ACTION, DEAD_LEAD_ACTION] } },
  });
  const master = rows.find((r) => r.action === "auto_send");
  const unanswered = rows.find((r) => r.action === UNANSWERED_ACTION);
  const deadLead = rows.find((r) => r.action === DEAD_LEAD_ACTION);
  return {
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
  | { kind: "workflow"; sequenceName: string; dueInDays: number } // enrolled in an active Sequence
  | { kind: "workflow_paused"; sequenceName: string } // enrolled, but the Sequence itself is paused
  | { kind: "off" } // Lead.automationTier === "off" — nobody but a human will ever message this lead
  // Would be eligible for an automated send right now, but the business's
  // master switch is off — the exact "why is nothing happening" case.
  | { kind: "account_paused"; reason: "unanswered" | "dead_lead" | "silence" }
  // Eligible now — the next hourly cron tick (or a manual "Run automation
  // check now") will pick this lead up.
  | { kind: "due_soon"; reason: "unanswered" | "dead_lead" | "silence" }
  | { kind: "waiting"; etaHours: number | null } // not yet due; etaHours is a rough estimate, not a promise
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
  const lastIsInbound = last?.direction === "inbound" && !isExitPayload(last.quickReplyPayload);

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
    if (hoursSince >= thresholdHours) due = "unanswered";
    else etaHours = thresholdHours - hoursSince;
  }

  if (!due) {
    const daysSinceContact = (now.getTime() - new Date(lead.lastContacted).getTime()) / 86_400_000;
    if (rules.deadLeadEnabled && daysSinceContact >= rules.deadLeadDays) {
      due = "dead_lead";
    } else if (daysSinceContact >= rules.silenceTriggerDays) {
      due = "silence";
    } else if (etaHours === null) {
      // Only fills in an ETA here when the unanswered branch above didn't
      // already set a more urgent (and more relevant, since it's the
      // branch actually governing this lead) one.
      etaHours = (rules.silenceTriggerDays - daysSinceContact) * 24;
    }
  }

  if (due) return rules.masterEnabled ? { kind: "due_soon", reason: due } : { kind: "account_paused", reason: due };
  if (!lastIsInbound) return { kind: "sent" };
  return { kind: "waiting", etaHours: etaHours !== null ? Math.max(1, Math.ceil(etaHours)) : null };
}

function mostRecentMessage(conversation: Message[]): Message | null {
  if (conversation.length === 0) return null;
  return conversation.reduce((latest, m) => (new Date(m.date) > new Date(latest.date) ? m : latest));
}
