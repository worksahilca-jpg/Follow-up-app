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
 * Step timing: each step's delayDays counts from when the PREVIOUS step
 * ran (or from enrollment, for step 0) — not from a fixed calendar date.
 * Lead.sequenceStepDueAt is recomputed after every step runs, so the cron
 * executor is a plain "is anything due right now" scan instead of having
 * to replay delays at read time.
 *
 * Multi-tenant: every function here takes an explicit businessId and
 * scopes its query to it — a sequence id or lead id alone is never enough
 * to act on, since either could belong to another business.
 */

import { prisma } from "@/lib/db";
import { generateFollowUpMessage } from "@/lib/integrations/openai";
import { composeFollowUpEmail, latestInboundText } from "@/lib/sender";
import { sendFollowUpToLead, detectNonEmailChannel } from "@/lib/sending";
import { requireActiveBilling } from "@/lib/billing";
import { mapWithConcurrency } from "@/lib/concurrency";
import { getVoiceSamples } from "@/lib/voice";
import { isWithinSendWindow } from "@/lib/sendWindow";
import type { Prisma, SequenceAction, PipelineStage } from "@prisma/client";
import type { Message } from "@/lib/types";

export interface SequenceStepInput {
  delayDays: number;
  action: SequenceAction;
  stageTo?: PipelineStage | null;
  messageHint?: string | null;
}

export interface SequenceSummary {
  id: string;
  name: string;
  active: boolean;
  enrolledCount: number;
  steps: {
    id: string;
    order: number;
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
      delayDays: s.delayDays,
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
    if (!Number.isInteger(s.delayDays) || s.delayDays < 0 || s.delayDays > 90) {
      return "Each step's delay must be a whole number of days, 0–90.";
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
      steps: { create: steps.map((s, i) => ({ order: i, ...s })) },
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
        ...(updates.steps ? { steps: { create: updates.steps.map((s, i) => ({ order: i, ...s })) } } : {}),
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
      data: { sequenceId: null, sequenceStepIndex: 0, sequenceStepDueAt: null },
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

  const firstStep = sequence.steps[0];
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      sequenceId,
      sequenceStepIndex: 0,
      sequenceStepDueAt: new Date(Date.now() + firstStep.delayDays * 24 * 60 * 60 * 1000),
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
    data: { sequenceId: null, sequenceStepIndex: 0, sequenceStepDueAt: null },
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
  skipped: string[]; // "{lead name}: {why}"
}

const EMPTY_RUN: SequenceRunResult = { checked: 0, advanced: 0, completed: 0, pausedForReply: 0, deferred: 0, skipped: [] };

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

/** What a real scheduler calls for one business — see runSequencesForAllBusinesses() below for the fan-out. */
export async function runSequencesForBusiness(businessId: string): Promise<SequenceRunResult> {
  // Same paid-feature gate as the silence-based automation — a workflow
  // enrollment left over from a lapsed subscription shouldn't keep sending.
  if (!(await requireActiveBilling(businessId))) return EMPTY_RUN;

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
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { timezone: true } });
  const timezone = business?.timezone ?? "America/New_York";

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
      await prisma.lead.update({
        where: { id: lead.id },
        data: { sequenceId: null, sequenceStepIndex: 0, sequenceStepDueAt: null },
      });
      return { kind: "completed" as const };
    }

    // Stop on reply — a sequence step that fires after the lead has
    // already responded (and nobody's answered them yet) is exactly the
    // tone-deaf automation failure this whole feature exists to avoid.
    // "Replied" here means the single most recent message across every
    // one of this lead's conversations is inbound — if a human (or the
    // AI, on an AUTONOMOUS lead) already answered it, the last message is
    // outbound again and the sequence is free to continue normally.
    const allMessages = lead.conversations.flatMap((c) => c.messages);
    const lastMessage =
      allMessages.length > 0 ? allMessages.reduce((latest, m) => (m.sentAt > latest.sentAt ? m : latest)) : null;

    if (lastMessage?.direction === "inbound") {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { sequenceId: null, sequenceStepIndex: 0, sequenceStepDueAt: null },
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
        if (!isWithinSendWindow(new Date(), timezone)) {
          return { kind: "deferred" as const };
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
        const draft = await generateFollowUpMessage(
          { name: lead.name, conversation },
          voiceSamples,
          channel === "email" ? step.messageHint ?? undefined : nonEmailStepHint(step.messageHint)
        );
        const message =
          channel === "email"
            ? await composeFollowUpEmail(lead.name.split(" ")[0], businessId, draft.body, { languageSample: latestInboundText(conversation) })
            : draft.body;
        const result = await sendFollowUpToLead(lead.id, message, {
          automated: true,
          trigger: "sequence",
          subject: channel === "email" ? draft.subject : undefined,
          channel,
        });
        if (!result.success) {
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
              sequenceStepDueAt: new Date(Date.now() + nextStep.delayDays * 24 * 60 * 60 * 1000),
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
              sequenceStepDueAt: null,
              sequenceCompletedAt: new Date(),
            },
      });
      return { kind: nextStep ? ("advanced" as const) : ("completed" as const) };
    } catch (err) {
      return { kind: "skipped" as const, note: `${lead.name}: ${err instanceof Error ? err.message : "unknown error"}` };
    }
  });

  return {
    checked: due.length,
    advanced: outcomes.filter((o) => o.kind === "advanced" || o.kind === "completed").length,
    completed: outcomes.filter((o) => o.kind === "completed").length,
    pausedForReply: outcomes.filter((o) => o.kind === "paused").length,
    deferred: outcomes.filter((o) => o.kind === "deferred").length,
    skipped: outcomes.filter((o): o is { kind: "skipped"; note: string } => o.kind === "skipped").map((o) => o.note),
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
      return { ...EMPTY_RUN, skipped: [`Business ${businessId}: ${err instanceof Error ? err.message : "unknown error"}`] };
    }
  });

  const totals: SequenceRunResult = { ...EMPTY_RUN, skipped: [] };
  for (const r of results) {
    totals.checked += r.checked;
    totals.advanced += r.advanced;
    totals.completed += r.completed;
    totals.pausedForReply += r.pausedForReply;
    totals.deferred += r.deferred;
    totals.skipped.push(...r.skipped);
  }
  return totals;
}
