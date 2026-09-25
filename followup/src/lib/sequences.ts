/**
 * Workflow builder — multi-step automated follow-up sequences.
 *
 * A Sequence is an ordered list of SequenceSteps a business builds once
 * (see /workflows); leads are then enrolled into it individually. This is
 * deliberately kept separate from the single silence-triggered rule in
 * src/lib/automation.ts (Settings' "Auto follow-up on silence" +
 * Lead.automationTier): a lead enrolled in an active sequence is excluded
 * from that other path (see the query in automation.ts) so the two never
 * both try to message the same lead on the same day.
 *
 * Step timing: each step's delay counts from when the PREVIOUS step ran
 * (or from enrollment, for step 0) — not from a fixed calendar date. The
 * unit is HOURS (SequenceStep.delayHours) since 2026-09-16; delayDays is the
 * older column, still written for anything reading it, and read only as a
 * fallback for rows from before the backfill. stepDelayHours() is the one
 * place the two are reconciled. Why hours: Meta shuts the Instagram /
 * Messenger door 24 h after the lead's last message, and a plan that can
 * only count in days cannot place a second touch inside it at all.
 * Lead.sequenceStepDueAt is recomputed after every step runs, so the cron
 * executor is a plain "is anything due right now" scan instead of having
 * to replay delays at read time.
 *
 * Multi-tenant: every function here takes an explicit businessId and
 * scopes its query to it — a sequence id or lead id alone is never enough
 * to act on, since either could belong to another business.
 */

import { prisma } from "@/lib/db";
import { generateFollowUpMessage, assessSendRisk } from "@/lib/integrations/openai";
import { composeFollowUpEmail, latestInboundText } from "@/lib/sender";
import { sendFollowUpToLead, detectNonEmailChannel, metaWindowFor } from "@/lib/sending";
import { requireActiveBilling, checkAiEligibility } from "@/lib/billing";
import { leadLanguageOf } from "@/lib/leadLanguage";
import { canSendOn, hasAnySendChannel } from "@/lib/sendChannels";
import { META_DM_WINDOW_HOURS } from "@/lib/metaWindow";
import { mapWithConcurrency } from "@/lib/concurrency";
import { flushHoldNotices, type HoldNotice } from "@/lib/holdNotices";
import { getVoiceSamples } from "@/lib/voice";
import { recordAudit } from "@/lib/audit";
import { isWithinSendWindow } from "@/lib/sendWindow";
import type { Prisma, SequenceAction, PipelineStage } from "@prisma/client";
import type { Message } from "@/lib/types";
import { HOLD_ALL_SEQUENCE_REASON, RISK_CHECK_FAILED_REASON } from "@/lib/holdReasons";

export interface SequenceStepInput {
  /** Hours after the previous step (or enrollment). Preferred. */
  delayHours?: number;
  /** Older clients send days. Accepted and converted; at least one of the two is required. */
  delayDays?: number;
  action: SequenceAction;
  stageTo?: PipelineStage | null;
  messageHint?: string | null;
}

/** Longest a single step may wait: 90 days, the same ceiling delayDays had. */
export const MAX_STEP_DELAY_HOURS = 90 * 24;

/**
 * How long a step waits, in hours — from either column, whichever is set.
 * The single reconciliation point for the hours/days split: the scheduler,
 * the summary the UI reads, and the writes below all go through it, so a
 * row from before the backfill (delayHours null) and a row written today
 * schedule identically.
 */
export function stepDelayHours(step: { delayHours?: number | null; delayDays?: number | null }): number {
  if (typeof step.delayHours === "number") return step.delayHours;
  return (step.delayDays ?? 0) * 24;
}

/** What a step is stored as: both columns, kept in step, from one number. */
function toStepRow(s: SequenceStepInput, order: number) {
  const delayHours = stepDelayHours(s);
  return {
    order,
    delayHours,
    delayDays: Math.floor(delayHours / 24),
    action: s.action,
    stageTo: s.stageTo ?? null,
    messageHint: s.messageHint ?? null,
  };
}

export interface SequenceSummary {
  id: string;
  name: string;
  active: boolean;
  enrolledCount: number;
  steps: {
    id: string;
    order: number;
    delayHours: number;
    /** Derived: floor(delayHours / 24). Kept so older readers see a number, not the unit change. */
    delayDays: number;
    action: SequenceAction;
    stageTo: PipelineStage | null;
    messageHint: string | null;
  }[];
}

const sequenceInclude = {
  steps: { orderBy: { order: "asc" } },
  _count: { select: { leads: true } },
} satisfies Prisma.SequenceInclude;

function toSummary(seq: Prisma.SequenceGetPayload<{ include: typeof sequenceInclude }>): SequenceSummary {
  return {
    id: seq.id,
    name: seq.name,
    active: seq.active,
    enrolledCount: seq._count.leads,
    steps: seq.steps.map((s) => ({
      id: s.id,
      order: s.order,
      delayHours: stepDelayHours(s),
      delayDays: Math.floor(stepDelayHours(s) / 24),
      action: s.action,
      stageTo: s.stageTo,
      messageHint: s.messageHint,
    })),
  };
}

export async function getSequences(businessId: string): Promise<SequenceSummary[]> {
  const sequences = await prisma.sequence.findMany({
    where: { businessId },
    include: sequenceInclude,
    orderBy: { createdAt: "asc" },
  });
  return sequences.map(toSummary);
}

export async function getSequenceById(id: string, businessId: string): Promise<SequenceSummary | null> {
  const seq = await prisma.sequence.findUnique({ where: { id }, include: sequenceInclude });
  if (!seq || seq.businessId !== businessId) return null;
  return toSummary(seq);
}

function validateSteps(steps: SequenceStepInput[]): string | null {
  if (steps.length === 0) return "A workflow needs at least one step.";
  if (steps.length > 20) return "That's a lot of steps — keep it to 20 or fewer.";
  for (const s of steps) {
    if (typeof s.delayHours !== "number" && typeof s.delayDays !== "number") {
      return "Each step needs a wait time.";
    }
    const hours = stepDelayHours(s);
    if (!Number.isInteger(hours) || hours < 0 || hours > MAX_STEP_DELAY_HOURS) {
      return `Each step's wait must be a whole number of hours, 0–${MAX_STEP_DELAY_HOURS} (90 days).`;
    }
    if (s.action === "CHANGE_STAGE" && !s.stageTo) {
      return "A \"change stage\" step needs a target stage.";
    }
  }
  return null;
}

export async function createSequence(
  businessId: string,
  name: string,
  steps: SequenceStepInput[]
): Promise<{ success: true; sequence: SequenceSummary } | { success: false; message: string }> {
  const trimmedName = name.trim();
  if (!trimmedName) return { success: false, message: "Name this workflow first." };
  const validationError = validateSteps(steps);
  if (validationError) return { success: false, message: validationError };

  const seq = await prisma.sequence.create({
    data: {
      businessId,
      name: trimmedName,
      steps: { create: steps.map(toStepRow) },
    },
    include: sequenceInclude,
  });
  return { success: true, sequence: toSummary(seq) };
}

/** Replaces a sequence's name/steps wholesale — simplest correct model for a visual builder that saves the whole list at once. */
export async function updateSequence(
  id: string,
  businessId: string,
  updates: { name?: string; active?: boolean; steps?: SequenceStepInput[] }
): Promise<{ success: true; sequence: SequenceSummary } | { success: false; message: string }> {
  const existing = await prisma.sequence.findUnique({ where: { id } });
  if (!existing || existing.businessId !== businessId) {
    return { success: false, message: "Workflow not found." };
  }

  if (updates.steps) {
    const validationError = validateSteps(updates.steps);
    if (validationError) return { success: false, message: validationError };
  }
  const trimmedName = updates.name?.trim();
  if (updates.name !== undefined && !trimmedName) {
    return { success: false, message: "Name this workflow first." };
  }

  const seq = await prisma.$transaction(async (tx) => {
    if (updates.steps) {
      // Replace-all rather than diffing — a builder that saves its whole
      // step list at once has no partial-update case to get right, and
      // @@unique([sequenceId, order]) means a diffed update would need its
      // own two-phase dance anyway to avoid colliding on order.
      await tx.sequenceStep.deleteMany({ where: { sequenceId: id } });
    }
    return tx.sequence.update({
      where: { id },
      data: {
        ...(trimmedName !== undefined ? { name: trimmedName } : {}),
        ...(updates.active !== undefined ? { active: updates.active } : {}),
        ...(updates.steps ? { steps: { create: updates.steps.map(toStepRow) } } : {}),
      },
      include: sequenceInclude,
    });
  });

  return { success: true, sequence: toSummary(seq) };
}

export async function deleteSequence(id: string, businessId: string): Promise<{ success: boolean }> {
  const existing = await prisma.sequence.findUnique({ where: { id } });
  if (!existing || existing.businessId !== businessId) return { success: false };
  // Enrolled leads' sequenceId is SET NULL by the FK (onDelete: SetNull) —
  // clear their step-tracking fields too so a stale sequenceStepDueAt
  // doesn't linger with nothing to act on it.
  await prisma.$transaction([
    prisma.lead.updateMany({
      where: { sequenceId: id },
      data: { sequenceId: null, sequenceStepIndex: 0, sequenceStepDueAt: null, sequenceStepScheduledAt: null },
    }),
    prisma.sequence.delete({ where: { id } }),
  ]);
  return { success: true };
}

export async function enrollLead(
  leadId: string,
  businessId: string,
  sequenceId: string
): Promise<{ success: true } | { success: false; message: string }> {
  const [lead, sequence] = await Promise.all([
    prisma.lead.findUnique({ where: { id: leadId } }),
    prisma.sequence.findUnique({ where: { id: sequenceId }, include: { steps: { orderBy: { order: "asc" } } } }),
  ]);
  if (!lead || lead.businessId !== businessId) return { success: false, message: "Lead not found." };
  if (!sequence || sequence.businessId !== businessId) return { success: false, message: "Workflow not found." };
  if (sequence.steps.length === 0) return { success: false, message: "This workflow has no steps yet." };

  // Same Free-tier restrictions runAutomationForBusiness() already applies
  // to the silence-based automation (automation.ts) and scoreAndDraftForLead()
  // applies at capture time (scoring.ts): a lead that's past the monthly cap,
  // or came in on a channel Free doesn't cover, doesn't get AI-driven
  // processing — a workflow's EMAIL step is exactly that (and can itself
  // escalate to a non-email channel — see the escalation logic in
  // runSequencesForBusiness below), so enrollment is refused up front rather
  // than silently accepted and skipped by the cron forever.
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { tier: true } });
  const enrollTier = (business?.tier ?? "free") as "free" | "plus" | "pro";
  const enrollEligible = await checkAiEligibility(businessId, lead, enrollTier);
  if (!enrollEligible.ok) {
    return {
      success: false,
      // Only Free has an upgrade to sell. On a paid tier this is a circuit
      // breaker, and telling a Pro customer to upgrade out of it would be
      // both useless and untrue.
      message:
        enrollTier === "free"
          ? `This lead is ${enrollEligible.reason} — upgrade in Settings → Billing to enroll it in a workflow.`
          : enrollEligible.reason,
    };
  }

  const firstStep = sequence.steps[0];
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      sequenceId,
      sequenceStepIndex: 0,
      sequenceStepDueAt: new Date(Date.now() + stepDelayHours(firstStep) * 60 * 60 * 1000),
      sequenceStepScheduledAt: new Date(),
      // A lead can't be run by both the silence-based automation and a
      // workflow at once — enrolling turns the former off for this lead so
      // the workflow's own cadence is the only thing steering it.
      automationTier: "OFF",
    },
  });
  return { success: true };
}

export interface LeadEnrollment {
  enrolled: boolean;
  sequenceId?: string;
  sequenceName?: string;
  stepIndex?: number; // 0-based index of the step that runs next
  totalSteps?: number;
  dueAt?: string; // ISO date
}

/** What a lead's own detail page needs to show its current workflow enrollment, if any. */
export async function getLeadEnrollment(leadId: string, businessId: string): Promise<LeadEnrollment | null> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      businessId: true,
      sequenceId: true,
      sequenceStepIndex: true,
      sequenceStepDueAt: true,
      sequence: { select: { name: true, _count: { select: { steps: true } } } },
    },
  });
  if (!lead || lead.businessId !== businessId) return null;
  if (!lead.sequenceId || !lead.sequence) return { enrolled: false };

  return {
    enrolled: true,
    sequenceId: lead.sequenceId,
    sequenceName: lead.sequence.name,
    stepIndex: lead.sequenceStepIndex,
    totalSteps: lead.sequence._count.steps,
    dueAt: lead.sequenceStepDueAt?.toISOString(),
  };
}

export async function unenrollLead(leadId: string, businessId: string): Promise<{ success: boolean }> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.businessId !== businessId) return { success: false };
  await prisma.lead.update({
    where: { id: leadId },
    data: { sequenceId: null, sequenceStepIndex: 0, sequenceStepDueAt: null, sequenceStepScheduledAt: null },
  });
  return { success: true };
}

interface SequenceRunResult {
  checked: number;
  advanced: number; // steps that ran successfully (email sent or stage changed)
  completed: number; // leads that finished their last step
  pausedForReply: number; // unenrolled because the lead replied and hasn't been answered yet
  // Outside the business's local send window (see sendWindow.ts) — an
  // EMAIL step deferred to the next hourly cron tick rather than sent
  // immediately. Only EMAIL steps can defer; CHANGE_STAGE never contacts
  // the lead, so it always runs on schedule regardless of the hour.
  deferred: number;
  // Risk-gated: the step's draft was saved as the lead's suggestedMessage
  // and the lead unenrolled from the sequence, same as pausedForReply,
  // instead of being sent — see the risk check below.
  held: number;
  skipped: string[]; // "{lead name}: {why}"
  heldReasons: string[]; // "{lead name}: {why it was held}", one per held lead
}

const EMPTY_RUN: SequenceRunResult = {
  checked: 0,
  advanced: 0,
  completed: 0,
  pausedForReply: 0,
  deferred: 0,
  held: 0,
  skipped: [],
  heldReasons: [],
};

/**
 * research/product/2026-09-09-followup-cadence-best-practices.md §4:
 * generateFollowUpMessage()'s body is already greeting/sign-off-free
 * (composeFollowUpEmail adds those separately for the email case), so it
 * reads fine as a text as-is — this just tells the model it's writing
 * one, since a text that reads like a shortened email ("per my previous
 * message...") is an obvious tell.
 */
function nonEmailStepHint(stepHint: string | null): string {
  const base =
    "This is going out as a text message, not an email — keep it noticeably shorter and more " +
    "conversational than an email would be, and never reference an inbox, attachment, or anything email-specific.";
  return stepHint?.trim() ? `${base} ${stepHint.trim()}` : base;
}

/**
 * Tells the assigned person a workflow step's draft needed a human look
 * before it went out — same "held, not sent" idea as the silence-based
 * automation's own notifyNeglect() (automation.ts), for a workflow step
 * specifically. The lead is already unenrolled by the time this fires
 * (see the risk check in runSequencesForBusiness below), so this points
 * at sending the draft manually from the lead's page rather than
 * "approving" a workflow that isn't running anymore.
 */
// Shared by every "a workflow step needs a human, right now" case — a
// held draft awaiting approval, or a step that couldn't actually run
// (no reachable channel, or the send itself failed). None of these
// should ever fail silently: the alternative is a step that just quietly
// retries every hour forever with nobody aware anything's wrong.
async function notifySequenceIssue(
  lead: { id: string; name: string; businessId: string; assignedToId: string | null },
  message: string
): Promise<void> {
  try {
    // Same unassigned-lead fallback as notifyNeglect(): nobody to hand
    // this off to individually, so every admin on the business hears
    // about it instead of the hold going unnoticed.
    const userIds = lead.assignedToId
      ? [lead.assignedToId]
      : (await prisma.user.findMany({ where: { businessId: lead.businessId, role: "ADMIN" }, select: { id: true } })).map((u) => u.id);
    for (const userId of userIds) {
      await prisma.notification.create({ data: { userId, leadId: lead.id, message } });
    }
  } catch (err) {
    console.error(`Sequence-issue notification failed for lead ${lead.id}:`, err);
  }
}

/** What a real scheduler calls for one business — see runSequencesForAllBusinesses() below for the fan-out. */
export async function runSequencesForBusiness(businessId: string): Promise<SequenceRunResult> {
  // Same paid-feature gate as the silence-based automation — a workflow
  // enrollment left over from a lapsed subscription shouldn't keep sending.
  if (!(await requireActiveBilling(businessId))) return EMPTY_RUN;
  // And the same "nothing connected, no drafting" rule as automation.ts —
  // a workflow step drafted for an account that cannot send is spend
  // with no message at the end of it. See hasAnySendChannel.
  if (!(await hasAnySendChannel(businessId))) return EMPTY_RUN;

  const due = await prisma.lead.findMany({
    where: {
      businessId,
      sequenceId: { not: null },
      sequenceStepDueAt: { lte: new Date() },
      stage: { notIn: ["WON", "LOST"] },
    },
    include: {
      sequence: { include: { steps: { orderBy: { order: "asc" } } } },
      conversations: { include: { messages: { orderBy: { sentAt: "asc" } } } },
    },
  });

  const active = due.filter((lead) => lead.sequence?.active);
  if (active.length === 0) return { ...EMPTY_RUN, checked: due.length };

  const voiceSamples = await getVoiceSamples(businessId);
  // Fetched once for the whole run — every lead here belongs to the same
  // business, so the send-window check below (EMAIL steps only) always
  // resolves against the same timezone.
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { timezone: true, tier: true, holdAllForApproval: true },
  });
  const timezone = business?.timezone ?? "America/New_York";
  const tier = (business?.tier ?? "plus") as "free" | "plus" | "pro";
  // Business.holdAllForApproval. Read here for the same reason
  // runAutomationForBusiness reads it: it is an account-wide promise that
  // nothing reaches a customer unreviewed, and a workflow step is a thing
  // that reaches a customer. This file did not read the column at all
  // until 2026-09-20 — automation.ts honoured it, sequences.ts did not, so
  // a tester who enrolled a lead in a workflow got AI-drafted mail sent in
  // their name on the next cron tick, which is precisely what the flag is
  // switched on to prevent (schema.prisma names the instant ack as its
  // ONLY exception).
  const holdAll = business?.holdAllForApproval ?? false;

  // Held-step notifications, gathered rather than written as they happen.
  // Since holdAllForApproval became the default for every account
  // (2026-09-21), EVERY workflow step is held — so a business with forty
  // enrolled leads got forty notifications on one tick. Same burst, and
  // the same fix, as the hold-time notification in automation.ts; see
  // src/lib/holdNotices.ts.
  //
  // Only the hold case is batched. "No reachable channel" and "the send
  // failed" stay individual: those are faults rather than a queue, they
  // are rare, and a count would strip the one thing that makes them
  // actionable — which lead, and what went wrong.
  const heldNotices: HoldNotice[] = [];

  const outcomes = await mapWithConcurrency(active, 3, async (lead) => {
    // Atomic check-and-claim before anything else — same reasoning as
    // runAutomationForBusiness()'s claim, and the same missing-guard shape
    // this file used to have: the eligibility query above is a plain SELECT,
    // and every write below it used to run unconditionally, so a manual
    // "run now" click racing the hourly cron (or two overlapping cron ticks)
    // could both see this lead as due and both send its step. Locking
    // sequenceStepDueAt a few minutes into the future claims the row; the
    // real post-step update further down overwrites this lock with the
    // actual next-due date (or clears it) once processing finishes. If
    // processing throws, the lock expires on its own well before the next
    // scheduled run, so the lead is simply retried then.
    const claim = await prisma.lead.updateMany({
      where: { id: lead.id, sequenceStepIndex: lead.sequenceStepIndex, sequenceStepDueAt: { lte: new Date() } },
      data: { sequenceStepDueAt: new Date(Date.now() + 5 * 60 * 1000) },
    });
    if (claim.count === 0) return { kind: "claimed" as const };

    const sequence = lead.sequence!; // filtered above
    const step = sequence.steps[lead.sequenceStepIndex];
    if (!step) {
      // Enrolled past the last step somehow (steps edited out from under
      // it) — clear enrollment rather than looping on a step that's gone.
      // Deliberately NOT stamping sequenceCompletedAt here: this lead
      // didn't actually finish the sequence as built, its step list just
      // changed size underneath it, so counting it as a real completion
      // in analytics would overstate the metric.
      //
      // Try/catch here (and on the stop-on-reply write just below) — not
      // just around the EMAIL-send branch further down — because a DB
      // error thrown from either of these writes used to propagate out of
      // this whole callback uncaught: mapWithConcurrency has no per-item
      // catch of its own, so that rejection aborted the shared Promise.all
      // and, with it, every OTHER lead still in flight for this business's
      // batch, silently dropping their already-computed outcomes. This
      // file's own earlier comment claimed "same reasoning" as
      // automation.ts's per-lead try/catch, but didn't actually cover the
      // same scope — this closes that gap without restructuring the whole
      // function into one large try block.
      try {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { sequenceId: null, sequenceStepIndex: 0, sequenceStepDueAt: null, sequenceStepScheduledAt: null },
        });
      } catch (err) {
        return { kind: "skipped" as const, note: `${lead.name}: ${err instanceof Error ? err.message : "unknown error"}` };
      }
      return { kind: "completed" as const };
    }

    // Stop on reply — a sequence step that fires after the lead has
    // already responded (and nobody's answered them yet) is exactly the
    // tone-deaf automation failure this whole feature exists to avoid.
    // "Replied" here means the single most recent message across every
    // one of this lead's conversations is inbound — if a human (or the
    // AI, on an AUTONOMOUS lead) already answered it, the last message is
    // outbound again and the sequence is free to continue normally.
    //
    // AND it arrived after the workflow last acted. Without that second
    // clause, a lead enrolled while their newest message was already
    // unanswered — every DM, SMS and email lead at the moment of capture —
    // was "replied mid-sequence" at step 0 and cancelled before anything
    // ran, owner notified of a reply that predated the plan (audit
    // 2026-09-16, F4). A null stamp is a row from before the column; it
    // keeps the old rule, which errs towards stopping.
    const allMessages = lead.conversations.flatMap((c) => c.messages);
    const lastMessage =
      allMessages.length > 0 ? allMessages.reduce((latest, m) => (m.sentAt > latest.sentAt ? m : latest)) : null;
    const repliedSinceScheduled =
      lastMessage?.direction === "inbound" &&
      (lead.sequenceStepScheduledAt == null || lastMessage.sentAt > lead.sequenceStepScheduledAt);

    if (repliedSinceScheduled) {
      // See the "step gone" branch above for why this is wrapped — same
      // failure mode (an uncaught DB error here aborts every other lead in
      // this business's batch, not just this one).
      try {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { sequenceId: null, sequenceStepIndex: 0, sequenceStepDueAt: null, sequenceStepScheduledAt: null },
        });
        if (lead.assignedToId) {
          await prisma.notification.create({
            data: {
              userId: lead.assignedToId,
              leadId: lead.id,
              message: `${lead.name} replied mid-sequence — "${sequence.name}" stopped so you can take it from here.`,
            },
          });
        }
      } catch (err) {
        return { kind: "skipped" as const, note: `${lead.name}: ${err instanceof Error ? err.message : "unknown error"}` };
      }
      return { kind: "paused" as const, note: `${lead.name}: replied — sequence stopped` };
    }

    try {
      if (step.action === "CHANGE_STAGE" && step.stageTo) {
        await prisma.lead.update({ where: { id: lead.id }, data: { stage: step.stageTo } });
      } else if (step.action === "EMAIL") {
        // Outside the business's local send window (e.g. 3am) — return
        // immediately, before the "no email address" skip check even, so
        // this never falls through to the advance-to-next-step logic
        // below. The 5-minute claim lock above self-expires well before
        // the next hourly cron tick, so nothing needs to be explicitly
        // reset for this lead to be reconsidered once it's daytime.
        //
        // Only where something could actually SEND. On a holding account
        // every step is drafted and held for the owner, and holding is not
        // sending: the draft should be on Today whenever the step comes
        // due, 3am included (founder's follow-up strategy, 2026-09-25 —
        // "drafting and holding happen at any hour"). Where the step could
        // go out on its own, the window is still checked here, BEFORE the
        // draft: this file keeps no cached draft to reuse, so deferring
        // after drafting would buy the same draft again every hour of the
        // night.
        if (!holdAll && !isWithinSendWindow(new Date(), timezone)) {
          return { kind: "deferred" as const };
        }

        // Free tier's AI processing pause (@/lib/billing) applies to a
        // workflow's EMAIL step the same way it already does to the
        // silence-based automation (automation.ts) — enrollLead() refuses
        // this case up front, but this is the belt to that route's
        // suspenders: it also covers a lead enrolled before this fix
        // shipped, or one that crossed the cap after enrolling. Left
        // enrolled (not unenrolled) so it's automatically reconsidered the
        // moment the business upgrades — same reasoning as the send-window
        // defer above, just re-checked hourly instead of on a timer.
        const stepEligible = await checkAiEligibility(businessId, lead, tier);
        if (!stepEligible.ok) {
          // Stored on the lead as well as noted in the run summary, for
          // the same reason as the two gates in automation.ts and
          // scoring.ts: a lead sitting on a plan whose steps will never
          // fire has to be able to say so on its own page. This is the
          // worst of the three to leave silent — the badge says "On a
          // follow-up plan, next step in 2d", which is a dated promise.
          await prisma.lead.updateMany({ where: { id: lead.id }, data: { aiPausedReason: stepEligible.ownerMessage } });
          return { kind: "skipped" as const, note: `${lead.name}: ${stepEligible.reason}` };
        }
        // research/product/2026-09-09-followup-cadence-best-practices.md
        // §4: this step is labeled "Send email" in the workflow builder —
        // a deliberate choice, not "send whatever channel this lead
        // happens to be on" — but a hard EMAIL-only lock has two real
        // costs: a lead with no email at all (captured via SMS, a missed
        // call, Instagram, or Messenger) gets skipped outright forever,
        // and a lead whose email genuinely isn't landing gets the exact
        // same channel repeated at every later step too. Escalate to a
        // non-email channel instead, gated on the lead actually being
        // reachable one: no email on file at all, OR an earlier EMAIL
        // step in THIS sequence already ran with no reply since — the
        // stop-on-reply check above guarantees "no reply since" for any
        // enrolled lead reaching this point, since a reply unenrolls it
        // immediately rather than letting the sequence continue quietly.
        const triedEmailAlready = sequence.steps.slice(0, lead.sequenceStepIndex).some((s) => s.action === "EMAIL");
        const nonEmailChannel = !lead.email || triedEmailAlready ? await detectNonEmailChannel(lead) : null;
        // No non-email channel available (no phone/DM on file, or one
        // exists but nothing to fall back to) — stick with email if the
        // lead has one even on a later step, rather than skip a send
        // that email could still reach.
        const channel = nonEmailChannel ?? (lead.email ? "email" : null);
        if (!channel) {
          // Structural, not transient — no reachable channel at all isn't
          // going to fix itself by retrying next hour, indefinitely, with
          // nobody told. Every other dead-end in this function (step
          // gone, lead replied, draft held for risk) already unenrolls
          // and notifies exactly once instead of leaving the lead to
          // silently re-enter this same check on every future cron tick
          // forever — this was the one exception, and the inconsistency
          // was the actual bug: it used to just return "skipped" and stay
          // enrolled, so it retried hourly forever with no one told.
          try {
            await prisma.lead.update({
              where: { id: lead.id },
              data: { sequenceId: null, sequenceStepIndex: 0, sequenceStepDueAt: null, sequenceStepScheduledAt: null },
            });
          } catch (err) {
            return { kind: "skipped" as const, note: `${lead.name}: ${err instanceof Error ? err.message : "unknown error"}` };
          }
          await notifySequenceIssue(
            lead,
            `"${sequence.name}" stopped for ${lead.name} — no email or phone number on file to send the next step to.`
          );
          // Kept as "skipped" (not a new outcome kind, and deliberately
          // not "paused" — that kind is specifically counted as
          // pausedForReply below, which this isn't) so the existing
          // summary shape and its one call site don't need to change;
          // what changed is that the lead is now actually unenrolled and
          // a human notified, not just silently retried forever.
          return { kind: "skipped" as const, note: `${lead.name}: this step sends a follow-up, but the lead has no email or phone number on file` };
        }
        const conversation: Message[] = lead.conversations.flatMap((c) =>
          c.messages.map((m) => ({
            id: m.id,
            direction: m.direction as Message["direction"],
            channel: c.channel as Message["channel"],
            body: m.body,
            date: m.sentAt.toISOString(),
            opened: m.opened,
          }))
        );
        // Never an automatic text or WhatsApp to someone who has not
        // written to the business (security pass 2026-09-25 F1):
        // sendFollowUpToLead refuses it, and a refusal here would stay
        // enrolled and re-draft at OpenAI cost every hour. Structural, like
        // the no-channel case above, so it exits the same way: once, told.
        if ((channel === "text" || channel === "whatsapp") && !conversation.some((m) => m.direction === "inbound")) {
          try {
            await prisma.lead.update({
              where: { id: lead.id },
              data: { sequenceId: null, sequenceStepIndex: 0, sequenceStepDueAt: null, sequenceStepScheduledAt: null },
            });
          } catch (err) {
            return { kind: "skipped" as const, note: `${lead.name}: ${err instanceof Error ? err.message : "unknown error"}` };
          }
          await notifySequenceIssue(
            lead,
            `"${sequence.name}" stopped for ${lead.name} — they haven't messaged you yet, so FollowUp won't text or WhatsApp them on its own. The first message is yours to send.`
          );
          return { kind: "skipped" as const, note: `${lead.name}: has never written, so no automatic text or WhatsApp` };
        }
        // The Instagram / Messenger form of the check above (security pass
        // 2026-09-25, F8). sendFollowUpToLead refuses an automated DM to a
        // lead who has never written on that channel — an echo lead, filed
        // because the owner DM'd them first — or who last wrote more than
        // 24 hours ago; Meta would refuse it anyway. That refusal used to
        // come AFTER a draft and a risk check, and left the lead enrolled on
        // the same step, so the owner heard "couldn't send" every hour,
        // forever: two OpenAI calls and a notification an hour. Judged by
        // metaWindowFor, the clock the send itself uses, so the two cannot
        // disagree; the silence rule skips on the same test before drafting
        // (automation.ts).
        //
        // Stopped rather than left waiting, the same call as the text and
        // WhatsApp case above: only the lead writing can reopen the window,
        // and a lead who writes is already handed to the owner by
        // stop-on-reply. Waiting would ask the same question every hour
        // with nothing that could turn it into a yes on its own.
        if (channel === "instagram" || channel === "messenger") {
          const { hoursSinceLead } = await metaWindowFor(lead.id, channel);
          if (hoursSinceLead === null || hoursSinceLead > META_DM_WINDOW_HOURS) {
            const platform = channel === "instagram" ? "Instagram" : "Messenger";
            try {
              await prisma.lead.update({
                where: { id: lead.id },
                data: { sequenceId: null, sequenceStepIndex: 0, sequenceStepDueAt: null, sequenceStepScheduledAt: null },
              });
            } catch (err) {
              return { kind: "skipped" as const, note: `${lead.name}: ${err instanceof Error ? err.message : "unknown error"}` };
            }
            await notifySequenceIssue(
              lead,
              hoursSinceLead === null
                ? `"${sequence.name}" stopped for ${lead.name} — they haven't messaged you on ${platform} yet, so Meta doesn't allow a message to them there. They'll need to write first.`
                : `"${sequence.name}" stopped for ${lead.name} — Meta's 24-hour window on ${platform} has closed, so an automatic follow-up can't go out now.`
            );
            return {
              kind: "skipped" as const,
              note:
                hoursSinceLead === null
                  ? `${lead.name}: has never written on ${platform}, so Meta allows no message there`
                  : `${lead.name}: Meta's 24-hour window on ${platform} has closed`,
            };
          }
        }
        // The channel itself has to be connected, not just "something"
        // (daily-path bug hunt 2026-09-25, F5). hasAnySendChannel at the top
        // of this function asks only whether anything is; with Gmail dead
        // and an Instagram token still stored, an email step drafted,
        // risk-checked and failed at the send on every hourly tick (the
        // claim above expires in five minutes), with a "couldn't send"
        // notification each time — up to ten OpenAI rounds and ten
        // notifications per enrolled lead per day.
        //
        // Paused, not stopped: unlike the three exits above, this one is
        // fixed by the owner reconnecting, and every beta account loses
        // Gmail on day 7 (same audit, F6) — cancelling each of its workflows
        // would be the wrong answer to a token expiring. Left enrolled on
        // the same step, like the eligibility gate above: the look each
        // hour is a query, with no draft and no notification, and the step
        // runs on the first tick after the reconnect.
        if (!(await canSendOn(businessId, channel))) {
          return {
            kind: "skipped" as const,
            note: `${lead.name}: nothing connected can send on ${channel} — step paused until it is reconnected`,
          };
        }
        const draft = await generateFollowUpMessage(
          { name: lead.name, conversation },
          voiceSamples,
          channel === "email" ? step.messageHint ?? undefined : nonEmailStepHint(step.messageHint),
          undefined,
          // Step 4 of a plan must sound like step 1 — see leadLanguage.ts.
          leadLanguageOf(lead)
        );
        const message =
          channel === "email"
            ? await composeFollowUpEmail(lead.name.split(" ")[0], businessId, draft.body, { languageSample: latestInboundText(conversation), leadLanguage: leadLanguageOf(lead) })
            : draft.body;

        // Every other automated-send path in this codebase (automation.ts's
        // silence rule, acknowledge.ts's instant ack) gates its draft on a
        // risk check before sending unreviewed — this one didn't, which
        // meant a workflow step's freshly-generated draft went straight out
        // with nobody looking at it, for every enrolled lead regardless of
        // trust tier (enrollLead() always sets automationTier to OFF, so
        // there's no ASSISTED/AUTONOMOUS distinction to key off here the
        // way automation.ts has). Same gate, same fallback-to-medium on a
        // failed check: sending something that shouldn't have gone out is
        // worse than an unnecessary manual review.
        let risk: { riskLevel: "low" | "medium" | "high"; reason: string };
        if (holdAll) {
          // The classifier decides whether something is safe to send
          // WITHOUT review. On an account where nothing sends without
          // review, it has nothing to decide, so its cost is not worth
          // paying — the hold below happens either way. Same skip, same
          // reasoning, as runAutomationForBusiness.
          // Both reasons finish ApprovalQueue's "Held because <reason>."
          // — hence lowercase and no full stop. They used to be written
          // as standalone sentences and rendered as "Held because Your
          // account holds…".
          risk = { riskLevel: "medium", reason: HOLD_ALL_SEQUENCE_REASON };
        } else {
          try {
            risk = await assessSendRisk({ conversation }, message);
          } catch (err) {
            console.error(`Risk assessment failed for lead ${lead.id} (workflow step):`, err);
            risk = { riskLevel: "medium", reason: RISK_CHECK_FAILED_REASON };
          }
        }

        if (holdAll || risk.riskLevel !== "low") {
          // Unenrolled rather than left "stuck" on this step: the normal
          // approval-queue send (POST /api/leads/[id]/send) knows nothing
          // about sequence bookkeeping, so a hold that stayed enrolled
          // would either re-draft and re-hold the same step every cron
          // tick forever, or need new plumbing to advance the sequence on
          // approval. Mirrors the stop-on-reply case just above: something
          // needs a human now, so the automated script stops cleanly and
          // hands the lead fully to the owner, same as it already does
          // when the lead replies mid-sequence.
          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              sequenceId: null,
              sequenceStepIndex: 0,
              sequenceStepDueAt: null, sequenceStepScheduledAt: null,
              suggestedMessage: message,
              suggestedSubject: draft.subject,
              suggestedDraftKind: null,
              // A new draft is unjudged (audit 2026-09-25 F2).
              suggestedRiskLevel: null,
              suggestedRiskReason: null,
            },
          });
          // Awaited, and tried twice: this row is the queue entry, not a
          // note about it (daily-path sweep 2026-09-25 #5). The notice below
          // still goes either way — the draft is on the lead's page.
          const hold = () =>
            recordAudit({ businessId, userId: null }, "ai.hold", {
              targetType: "lead",
              targetId: lead.id,
              meta: { riskLevel: risk.riskLevel, reason: risk.reason, trigger: "sequence", sequenceName: sequence.name },
            });
          if ((await hold()) === false && (await hold()) === false) {
            console.error(`Held workflow step for lead ${lead.id} could not be added to Approvals.`);
          }
          // Two different facts, so two different sentences. "Needs your
          // OK" on a hold-everything account would read as "this one
          // looked risky", which is untrue and teaches the owner to
          // distrust a setting they chose.
          heldNotices.push({
            leadId: lead.id,
            businessId,
            assignedToId: lead.assignedToId,
            message: holdAll
              ? `"${sequence.name}" drafted a reply for ${lead.name}. Your account holds every follow-up for approval, so it's waiting for you — the workflow stopped here.`
              : `"${sequence.name}" drafted a reply for ${lead.name} that needs your OK before it goes out — the workflow stopped here so you can review it.`,
          });
          return { kind: "held" as const, note: `${lead.name}: ${risk.reason}` };
        }

        const result = await sendFollowUpToLead(lead.id, message, {
          automated: true,
          trigger: "sequence",
          subject: channel === "email" ? draft.subject : undefined,
          channel,
        });
        // A transient provider failure is parked in OutboundSend and delivered
        // by the retry worker (queuedRetryAt set) — the queue owns it from
        // here, exactly as acknowledge.ts treats the same result. It must
        // advance the step like a success. Left on the same step, the next
        // hourly tick found the retry's own outbound message as "ours, no
        // reply since", re-drafted the SAME step and sent it again: two
        // follow-ups an hour apart in the owner's name (audit 2026-09-16,
        // F1). hasSendInFlight only guards while the queue row is unresolved.
        if (!result.success && !result.queuedRetryAt) {
          // Deliberately left enrolled (unlike the no-channel case above)
          // rather than unenrolled — a single failed send attempt (a
          // Twilio blip, a rate limit) is plausibly transient and worth
          // retrying next hour rather than giving up on the whole
          // workflow over it. The real gap this closes: a human now
          // actually hears about it, every time it happens — before this,
          // a persistently failing send (bad credentials, say) retried
          // hourly forever, silently, each attempt re-running the AI
          // draft above at real OpenAI cost, with nobody ever told.
          // Genuine backoff/give-up-after-N-failures is real follow-up
          // work this doesn't attempt.
          await notifySequenceIssue(lead, `"${sequence.name}" couldn't send ${lead.name}'s next follow-up: ${result.message ?? "send failed"}.`);
          return { kind: "skipped" as const, note: `${lead.name}: ${result.message ?? "send failed"}` };
        }
      }

      const nextIndex = lead.sequenceStepIndex + 1;
      const nextStep = sequence.steps[nextIndex];
      await prisma.lead.update({
        where: { id: lead.id },
        data: nextStep
          ? {
              sequenceStepIndex: nextIndex,
              sequenceStepDueAt: new Date(Date.now() + stepDelayHours(nextStep) * 60 * 60 * 1000),
              sequenceStepScheduledAt: new Date(),
            }
          : {
              // Finished the sequence — the one exit path that gets a
              // persisted timestamp (see Lead.sequenceCompletedAt), so
              // getAnalytics()'s sequence-health metric can honestly count
              // real completions instead of conflating them with early
              // unenroll (manual, sequence deleted, or the stop-on-reply
              // pause above, none of which set this).
              sequenceId: null,
              sequenceStepIndex: 0,
              sequenceStepDueAt: null, sequenceStepScheduledAt: null,
              sequenceCompletedAt: new Date(),
            },
      });
      return { kind: nextStep ? ("advanced" as const) : ("completed" as const) };
    } catch (err) {
      return { kind: "skipped" as const, note: `${lead.name}: ${err instanceof Error ? err.message : "unknown error"}` };
    }
  });

  // One line per person when several steps were held at once, each lead
  // named when only a few were. Never allowed to fail the run.
  await flushHoldNotices(heldNotices).catch((err) =>
    console.error(`Workflow hold notifications failed for business ${businessId}:`, err)
  );

  const heldOutcomes = outcomes.filter((o): o is { kind: "held"; note: string } => o.kind === "held");

  return {
    checked: due.length,
    advanced: outcomes.filter((o) => o.kind === "advanced" || o.kind === "completed").length,
    completed: outcomes.filter((o) => o.kind === "completed").length,
    pausedForReply: outcomes.filter((o) => o.kind === "paused").length,
    deferred: outcomes.filter((o) => o.kind === "deferred").length,
    held: heldOutcomes.length,
    skipped: outcomes.filter((o): o is { kind: "skipped"; note: string } => o.kind === "skipped").map((o) => o.note),
    heldReasons: heldOutcomes.map((o) => o.note),
  };
}

/** Every business with at least one active sequence, in one pass — called by the same cron as the silence-based automation. */
export async function runSequencesForAllBusinesses(): Promise<SequenceRunResult> {
  const businesses = await prisma.sequence.findMany({
    where: { active: true },
    distinct: ["businessId"],
    select: { businessId: true },
  });

  const results = await mapWithConcurrency(businesses, 3, async ({ businessId }) => {
    try {
      return await runSequencesForBusiness(businessId);
    } catch (err) {
      console.error(`Sequence run failed for business ${businessId}:`, err);
      return {
        ...EMPTY_RUN,
        skipped: [`Business ${businessId}: ${err instanceof Error ? err.message : "unknown error"}`],
      } satisfies SequenceRunResult;
    }
  });

  const totals: SequenceRunResult = { ...EMPTY_RUN, skipped: [], heldReasons: [] };
  for (const r of results) {
    totals.checked += r.checked;
    totals.advanced += r.advanced;
    totals.completed += r.completed;
    totals.pausedForReply += r.pausedForReply;
    totals.deferred += r.deferred;
    totals.held += r.held;
    totals.skipped.push(...r.skipped);
    totals.heldReasons.push(...r.heldReasons);
  }
  return totals;
}
