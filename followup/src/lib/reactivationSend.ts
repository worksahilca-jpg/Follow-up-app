/**
 * Sending the reactivation batch — the part behind "Send all" and "Stop".
 *
 * `reactivation.ts` decides WHO may be messaged. This decides what actually
 * goes out, and — more importantly — what happens when the owner changes
 * their mind halfway through.
 *
 * Why Stop is the hard part
 * -------------------------
 * The owner presses Stop in one serverless invocation. The sending loop is
 * running in a different one. They share no memory, no process, and no
 * event loop; on Vercel the sending function can be frozen and thawed
 * between two sends. A boolean flag, an AbortController, an in-process
 * event emitter — none of them can cross that gap. Whatever Stop writes,
 * the loop has to be able to READ.
 *
 * So the run is a database row, and the loop re-reads its status before
 * every single send. That read is the whole mechanism. Without it, Stop
 * can only hide its own button and let the remaining 31 messages go out
 * anyway — which is the version of this feature that destroys trust, since
 * the owner watched themselves stop it.
 *
 * What is guaranteed
 * ------------------
 * 1. A lead gets AT MOST ONE reactivation message, ever. Not one per run —
 *    one, full stop. Guaranteed by an atomic claim on
 *    `Lead.reactivationSentAt`, not by any per-run bookkeeping, because
 *    runs are rows and two of them can exist at once.
 * 2. Stop takes effect within one send. Never "at the end of the batch".
 * 3. A lead who replied, opted out, or was closed AFTER the batch screen
 *    was built is re-checked at send time and skipped. The list an owner
 *    approved is a snapshot; the world moved on while they read it.
 * 4. Nothing here can send to a bucket other than COLD. Not CLOSED, not
 *    OFF_PLATFORM, not UNCLEAR, and not COLD_UNANSWERED — those people are
 *    owed an apology, which is a different message and a different consent.
 */

import { prisma } from "@/lib/db";
import { generateFollowUpMessage } from "@/lib/integrations/openai";
import { sendFollowUpToLead } from "@/lib/sending";
import { composeFollowUpEmail, latestInboundText } from "@/lib/sender";
import { recordAudit } from "@/lib/audit";
import { getVoiceSamples } from "@/lib/voice";
import { DEAD_LEAD_DEFAULT_DAYS, DEAD_LEAD_ACTION, deadLeadMessageHint } from "@/lib/automation";
import type { Message } from "@/lib/types";
import type { PipelineStage } from "@prisma/client";

const OWNER_CONCLUDED_STAGES: PipelineStage[] = ["WON", "LOST"];

/**
 * Sends are sequential, not concurrent, and that is deliberate. Blasting
 * 43 emails through one mailbox in two seconds is exactly the pattern spam
 * filters are built to catch, and getting a small business's own Gmail
 * flagged would be a far worse outcome than a batch that takes a few
 * minutes. It also makes Stop meaningful: with a concurrency pool,
 * everything already in flight when Stop lands still goes out.
 *
 * The value matters more than it looks. It started at 1.2s, which made the
 * Stop button technically real and practically useless: 43 leads would be
 * finished in 52 seconds, so an owner who pressed "Send all", read the
 * first message properly, and had second thoughts would find the batch
 * already over. A stop nobody can reach in time is the same as no stop.
 *
 * At 6s a 43-lead batch takes about four and a half minutes — long enough
 * to change your mind, short enough that nothing looks stuck — and the
 * sending pattern reads like a person working through a list rather than a
 * mail-merge. Both reasons point the same way, which is why this is set
 * here rather than tuned for throughput.
 */
const SEND_SPACING_MS = 6000;

/**
 * How many sends one invocation attempts before handing back. Serverless
 * functions have a wall-clock limit; a 300-lead batch has to survive being
 * resumed. The run row carries the progress, so the next call picks up
 * exactly where this one stopped.
 */
const SENDS_PER_INVOCATION = 40;

/**
 * Drafts one reactivation message, exactly as it would go out.
 *
 * Shared by the sender and the preview on purpose: the three drafts the
 * owner approves have to come from the same code that sends the other
 * forty, or the preview is a sales pitch rather than a sample. It reuses
 * the existing dead-lead steer (automation.ts) and the existing greeting /
 * sign-off / language framing (sender.ts) rather than re-deriving either —
 * a reactivation message that arrived without a greeting, or in the wrong
 * language, would be worse than one never sent.
 */
async function draftReactivation(
  lead: { id: string; name: string; businessId: string; lastContacted: Date | null; createdAt: Date },
  conversation: Message[],
  voiceSamples: string[]
): Promise<{ subject: string; body: string }> {
  const daysSinceContact = Math.floor(
    (Date.now() - new Date(lead.lastContacted ?? lead.createdAt).getTime()) / 86_400_000
  );
  const draft = await generateFollowUpMessage(
    { name: lead.name, conversation },
    voiceSamples,
    deadLeadMessageHint(daysSinceContact)
  );
  const body = await composeFollowUpEmail(lead.name.split(" ")[0], lead.businessId, draft.body, {
    languageSample: latestInboundText(conversation),
  });
  return { subject: draft.subject, body };
}

export type ReactivationSendResult = {
  runId: string;
  status: "RUNNING" | "STOPPED" | "COMPLETED" | "FAILED";
  sent: number;
  failed: number;
  skipped: number;
  /** Eligible leads still unsent — > 0 means call again to resume. */
  remaining: number;
};

/** Leads this business may still send a reactivation message to. */
function sendableWhere(businessId: string, cutoff: Date) {
  return {
    businessId,
    // The single bucket that may ever be messaged. COLD_UNANSWERED is
    // deliberately absent: those leads wrote to us and got nothing back,
    // and a "still interested?" to them makes it worse, not better.
    quietOutcome: "COLD" as const,
    // Never twice — see Lead.reactivationSentAt.
    reactivationSentAt: null,
    // Re-checked at send time, not just when the batch screen was built.
    // An owner can spend ten minutes reading the list, and in that time a
    // lead can reply, text STOP, or be marked won.
    optedOutAt: null,
    stage: { notIn: OWNER_CONCLUDED_STAGES },
    lastContacted: { lte: cutoff },
  };
}

async function resolveQuietDays(businessId: string): Promise<number> {
  const rule = await prisma.automation.findFirst({ where: { businessId, action: DEAD_LEAD_ACTION } });
  return rule?.triggerDays ?? DEAD_LEAD_DEFAULT_DAYS;
}

/**
 * Opens a run. Returns the row the owner's screen polls and that Stop
 * targets.
 *
 * `totalPlanned` is captured here, from the same query the sending loop
 * uses, so the number the owner was shown and the number that can actually
 * go out are the same number. A screen that says 43 and a loop that finds
 * 51 is a consent failure, not a rounding error.
 */
export async function startReactivationRun(
  businessId: string
): Promise<{ runId: string; totalPlanned: number } | { error: string }> {
  // One run at a time per business. This is a UX guard, not the safety
  // guarantee — an owner double-tapping "Send all" gets a clear refusal
  // rather than two progress bars. The guarantee that nobody is messaged
  // twice lives on the lead claim, which holds even if this check loses a
  // race.
  const existing = await prisma.reactivationRun.findFirst({
    where: { businessId, status: "RUNNING" },
    select: { id: true },
  });
  if (existing) return { error: "A reactivation batch is already running." };

  const cutoff = new Date(Date.now() - (await resolveQuietDays(businessId)) * 24 * 60 * 60 * 1000);
  const totalPlanned = await prisma.lead.count({ where: sendableWhere(businessId, cutoff) });
  if (totalPlanned === 0) return { error: "There are no cold leads to reach out to." };

  const run = await prisma.reactivationRun.create({
    data: { businessId, totalPlanned },
  });

  // The consent record. This is the row that answers "who approved
  // messaging 43 of my past customers, and when" — the question that gets
  // asked after something goes wrong, when memory is not evidence.
  void recordAudit({ businessId }, "reactivation.batch_approved", {
    targetType: "reactivation_run",
    targetId: run.id,
    meta: { totalPlanned },
  });

  return { runId: run.id, totalPlanned };
}

/**
 * Stops a running batch. One field, one UPDATE — the sending loop picks it
 * up on its next pre-send read, which is at most one message away.
 *
 * Conditional on status RUNNING so a second press, or a press that lands
 * just as the run finishes on its own, can't rewrite a COMPLETED run into
 * a STOPPED one and lose the record of what really happened.
 */
export async function stopReactivationRun(
  businessId: string,
  runId: string,
  userId?: string | null
): Promise<{ stopped: boolean }> {
  const result = await prisma.reactivationRun.updateMany({
    // businessId in the WHERE, not just the id: without it, any signed-in
    // user who learned a run id could stop another business's batch.
    where: { id: runId, businessId, status: "RUNNING" },
    data: { status: "STOPPED", endedAt: new Date(), stoppedById: userId ?? null },
  });

  if (result.count > 0) {
    void recordAudit({ businessId, userId }, "reactivation.batch_stopped", {
      targetType: "reactivation_run",
      targetId: runId,
    });
  }
  return { stopped: result.count > 0 };
}

/**
 * Works a run until it finishes, is stopped, or hits this invocation's
 * budget. Safe to call repeatedly — progress lives on the run row and the
 * per-lead claims, never in this function's local state.
 */
export async function runReactivationSend(
  businessId: string,
  runId: string,
  // Only ever overridden by tests, which must not sleep through the real
  // pacing — a suite that takes ten seconds to prove Stop works is a suite
  // people stop running.
  options: { spacingMs?: number } = {}
): Promise<ReactivationSendResult> {
  const spacingMs = options.spacingMs ?? SEND_SPACING_MS;
  const run = await prisma.reactivationRun.findFirst({ where: { id: runId, businessId } });
  if (!run) return { runId, status: "FAILED", sent: 0, failed: 0, skipped: 0, remaining: 0 };
  if (run.status !== "RUNNING") {
    return {
      runId,
      status: run.status,
      sent: run.sent,
      failed: run.failed,
      skipped: run.skipped,
      remaining: 0,
    };
  }

  const cutoff = new Date(Date.now() - (await resolveQuietDays(businessId)) * 24 * 60 * 60 * 1000);
  // Fetched once for the whole run rather than inside the loop — the same
  // set applies to every lead in this business.
  const voiceSamples = await getVoiceSamples(businessId);

  // Seeded from the run row, not from zero. A batch bigger than
  // SENDS_PER_INVOCATION is finished by a SECOND call to this function,
  // and these counters are written straight onto the run row below — so
  // starting them at 0 made invocation two OVERWRITE invocation one's
  // totals. A 120-lead batch showed the owner "40 sent", then "40 sent",
  // then "40 sent", and the reactivation.batch_completed audit event —
  // the record of how many of their past customers were actually
  // messaged on their say-so — recorded 40 instead of 120. The counts
  // this function returns are cumulative-for-the-run for the same
  // reason: a progress indicator that resets is worse than none.
  let sent = run.sent;
  let failed = run.failed;
  let skipped = run.skipped;
  let stopped = false;

  for (let i = 0; i < SENDS_PER_INVOCATION; i++) {
    // THE read that makes Stop real. Before every send, not once per
    // batch and not once per invocation — the owner pressed Stop in
    // another process and this is the only way to hear it.
    const current = await prisma.reactivationRun.findUnique({
      where: { id: runId },
      select: { status: true },
    });
    if (current?.status !== "RUNNING") {
      stopped = true;
      break;
    }

    // Re-queried each iteration rather than fetched once as a list: a
    // lead can become ineligible while the batch is running (they reply,
    // they text STOP), and a stale in-memory list would message them
    // anyway. One indexed query per send is a cheap price for that.
    const lead = await prisma.lead.findFirst({
      where: sendableWhere(businessId, cutoff),
      orderBy: { lastContacted: "asc" },
      include: { conversations: { include: { messages: { orderBy: { sentAt: "asc" } } } } },
    });
    if (!lead) break; // nothing left — the run completed

    // Claim BEFORE drafting or sending. Whoever's UPDATE matches the
    // still-null row wins; a concurrent invocation's matches nothing and
    // moves on. Claiming before the OpenAI call also means a crash
    // mid-draft costs one lead, not a duplicate message.
    const claim = await prisma.lead.updateMany({
      where: { id: lead.id, reactivationSentAt: null },
      data: { reactivationSentAt: new Date() },
    });
    if (claim.count === 0) {
      skipped += 1;
      continue;
    }

    const conversation: Message[] = lead.conversations
      .flatMap((c) =>
        c.messages.map((m) => ({
          id: m.id,
          direction: m.direction as Message["direction"],
          channel: c.channel as Message["channel"],
          body: m.body,
          date: m.sentAt.toISOString(),
          opened: m.opened,
        }))
      )
      .sort((a, b) => a.date.localeCompare(b.date));

    try {
      const draft = await draftReactivation(lead, conversation, voiceSamples);

      const result = await sendFollowUpToLead(lead.id, draft.body, {
        automated: true,
        subject: draft.subject,
        // Attributed so this shows up in the recovered-leads report as
        // what it is, rather than as ordinary silence follow-up.
        trigger: "dead_lead_reactivation",
        extraAuditMeta: { reactivationRunId: runId, quietOutcomeReason: lead.quietOutcomeReason },
      });

      if (result.success) sent += 1;
      else failed += 1;
    } catch (err) {
      console.error(`Reactivation send failed for lead ${lead.id} (run ${runId}):`, err);
      failed += 1;
      // The claim is NOT released. A send that threw after the provider
      // accepted the message is indistinguishable from one that never
      // left, and "we might have already emailed them" has to resolve to
      // "don't email them again."
    }

    // Counters written per send, so a frozen or timed-out invocation
    // leaves an accurate record instead of losing the whole tally — and
    // so the owner's progress indicator is real rather than interpolated.
    await prisma.reactivationRun.update({
      where: { id: runId },
      data: { sent, failed, skipped },
    });

    if (spacingMs > 0) await new Promise((r) => setTimeout(r, spacingMs));
  }

  const remaining = await prisma.lead.count({ where: sendableWhere(businessId, cutoff) });

  let status: ReactivationSendResult["status"] = "RUNNING";
  if (stopped) {
    status = "STOPPED"; // already written by stopReactivationRun
  } else if (remaining === 0) {
    status = "COMPLETED";
    await prisma.reactivationRun.updateMany({
      where: { id: runId, status: "RUNNING" },
      data: { status: "COMPLETED", endedAt: new Date() },
    });
    void recordAudit({ businessId }, "reactivation.batch_completed", {
      targetType: "reactivation_run",
      targetId: runId,
      meta: { sent, failed, skipped },
    });
  }

  return { runId, status, sent, failed, skipped, remaining };
}

export type ReactivationDraftPreview = {
  leadId: string;
  leadName: string;
  reason: string | null;
  subject: string;
  body: string;
};

/**
 * Three real drafts, for the same three leads that would actually be
 * messaged first, generated by the same code path that would send them.
 *
 * The founder asked for this specifically, and the reason it matters is
 * that "43 leads went cold, we've drafted a message for each" is not
 * something anyone can meaningfully consent to. Nobody approves 43
 * messages. They approve the ONE message they were shown and assume the
 * other 42 look like it — so the three shown here have to be the real
 * thing, from real threads, not a template with a name slotted in.
 *
 * Nothing is claimed or sent. A preview must never consume a lead.
 */
export async function previewReactivationDrafts(
  businessId: string,
  count = 3
): Promise<ReactivationDraftPreview[]> {
  const cutoff = new Date(Date.now() - (await resolveQuietDays(businessId)) * 24 * 60 * 60 * 1000);
  const [leads, voiceSamples] = await Promise.all([
    prisma.lead.findMany({
      where: sendableWhere(businessId, cutoff),
      orderBy: { lastContacted: "asc" },
      take: count,
      include: { conversations: { include: { messages: { orderBy: { sentAt: "asc" } } } } },
    }),
    getVoiceSamples(businessId),
  ]);

  const previews: ReactivationDraftPreview[] = [];
  for (const lead of leads) {
    const conversation: Message[] = lead.conversations
      .flatMap((c) =>
        c.messages.map((m) => ({
          id: m.id,
          direction: m.direction as Message["direction"],
          channel: c.channel as Message["channel"],
          body: m.body,
          date: m.sentAt.toISOString(),
          opened: m.opened,
        }))
      )
      .sort((a, b) => a.date.localeCompare(b.date));

    try {
      const draft = await draftReactivation(lead, conversation, voiceSamples);
      previews.push({
        leadId: lead.id,
        leadName: lead.name,
        reason: lead.quietOutcomeReason,
        subject: draft.subject,
        body: draft.body,
      });
    } catch (err) {
      // One draft failing shouldn't blank the preview — showing two real
      // drafts is better than showing none, and far better than showing a
      // placeholder the owner might mistake for the real wording.
      console.error(`Failed to draft reactivation preview for lead ${lead.id}:`, err);
    }
  }
  return previews;
}
