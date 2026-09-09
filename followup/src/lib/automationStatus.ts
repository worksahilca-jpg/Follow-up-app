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

import { UNANSWERED_ACTION, UNANSWERED_DEFAULT_HOURS, UNANSWERED_FIRST_REPLY_HOURS, DEAD_LEAD_ACTION, DEAD_LEAD_DEFAULT_DAYS } from "@/lib/automation";
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
  conversation: Message[];
  // FollowUp.trigger values for every FollowUp this lead has ever had,
  // regardless of status — only used to tell "the instant-ack template is
  // the only thing that's gone out" from "a real reply already went out,"
  // same distinction findUnansweredLeads() draws in automation.ts.
  followUpTriggers: string[];
  sequence: { name: string; active: boolean; dueAt: string | null } | null;
}

export function computeAutomationStatus(
  lead: AutomationStatusLead,
  rules: BusinessAutomationRules,
  now: Date = new Date()
): AutomationStatus {
  if (lead.stage === "won" || lead.stage === "lost") return { kind: "closed" };

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

  const last = mostRecentMessage(lead.conversation);
  const lastIsInbound = last?.direction === "inbound";

  // Priority order mirrors automation.ts's own merge: unanswered (the lead
  // wrote and got ignored) beats dead-lead reactivation, which beats plain
  // silence — the same de-duplication runAutomationForBusiness() does when
  // building its eligible list.
  let due: "unanswered" | "dead_lead" | "silence" | null = null;
  let etaHours: number | null = null;

  if (lastIsInbound && rules.unansweredEnabled) {
    const hasSubstantiveFollowUp = lead.followUpTriggers.some((t) => t !== "instant_ack");
    const thresholdHours = hasSubstantiveFollowUp ? rules.unansweredHours : UNANSWERED_FIRST_REPLY_HOURS;
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
