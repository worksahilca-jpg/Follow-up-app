/**
 * Sending the routine half of the approval queue in one press.
 *
 * Founder, 2026-09-23: "for those who need less attention he should let
 * them know that we can follow up in one click only if they want and they
 * are safe to send… but we need to take care about the restriction of
 * sending mails and messages of each source."
 *
 * Both halves of that sentence are load-bearing, and the second is the
 * one that makes this hard. A button that sends 90 messages is easy. A
 * button that sends 90 messages without getting the owner's mailbox
 * suspended, without breaking Meta's messaging rules, and without lying
 * about what it did, is the actual job.
 *
 * ## What this does NOT do
 *
 * **It never trusts the caller for the list.** The browser sends a source
 * at most; the set of drafts is re-derived here from the same queue the
 * screen was built from, and each one is re-checked with
 * `isSafeToSendInBulk`. A list of lead ids posted from a page is a list
 * of leads somebody could edit.
 *
 * **It never passes `humanSend`.** That option exists for the one place a
 * signed-in person has a whole message in front of them and taps Send,
 * and it is what lets an Instagram or Messenger reply go out under Meta's
 * human-agent allowance between 24 hours and 7 days. Nobody has read
 * these messages individually — that is the entire point of the feature —
 * so claiming a human is handling each conversation would be untrue, and
 * it is untrue to the one party whose rules can take the channel away.
 *
 * The consequence is deliberate and is the per-source restriction the
 * founder asked for: a DM lead past Meta's 24-hour window is refused by
 * `sendFollowUpToLead` itself, with the sentence it already writes for
 * that case, and shows up here as a skip. Those conversations stay in the
 * queue for the owner to answer personally, which is what Meta's rule
 * actually asks for.
 *
 * Nothing here re-implements a window or a channel rule. Every such rule
 * already lives in the send path and is tested there; this layer's job is
 * to collect what that path refuses and say so out loud.
 */
import { prisma } from "@/lib/db";
import { getPendingApprovals } from "@/lib/pendingApprovals";
import { isSafeToSendInBulk } from "@/lib/approvalGroups";
import { sendFollowUpToLead } from "@/lib/sending";
import { DAILY_AUTOMATED_SEND_CAP } from "@/lib/sendCaps";
import { mapWithConcurrency } from "@/lib/concurrency";

export type BulkApproveOutcome = {
  /** Messages that actually reached a customer. */
  sent: number;
  /**
   * Drafts that were offered to the send path and refused, each with the
   * sentence that path wrote. Named rather than counted: "12 were
   * skipped" tells an owner nothing they can act on, and the commonest
   * reason — a closed DM window — is specifically something they CAN act
   * on, by replying to that person themselves.
   */
  skipped: Array<{ leadId: string; leadName: string; reason: string }>;
  /**
   * Safe drafts this press did not attempt, because the ceiling stopped
   * it. Reported so the button can say "send the next N" rather than
   * quietly doing less than it appeared to.
   */
  remaining: number;
};

export type BulkApproveInput = {
  businessId: string;
  /** One source only ("Gmail"), or every source when omitted. */
  source?: string | null;
  /**
   * How many to attempt in this press. Defaults to the product's own
   * daily automated ceiling — the number it already treats as a volume a
   * sending domain survives (see sendCaps.ts, where it is derived rather
   * than picked). A single press should not be able to exceed what a
   * whole day of automation may.
   */
  limit?: number;
};

export async function sendSafeApprovals({ businessId, source, limit }: BulkApproveInput): Promise<BulkApproveOutcome> {
  const ceiling = Math.max(0, limit ?? DAILY_AUTOMATED_SEND_CAP);

  const queue = await getPendingApprovals(businessId);
  const safe = queue
    .filter((a) => isSafeToSendInBulk(a))
    .filter((a) => (source ? a.source === source : true))
    // Highest score first, so a press truncated by the ceiling spends
    // what it has on the leads worth the most rather than on whichever
    // order the queue happened to arrive in.
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : b.heldAt.getTime() - a.heldAt.getTime()));

  const batch = safe.slice(0, ceiling);
  const skipped: BulkApproveOutcome["skipped"] = [];
  let sent = 0;

  // Same concurrency the automation loop uses. Sequential would be
  // needlessly slow on a few hundred, and anything higher starts to look
  // like a burst to the provider — which is the thing this whole file is
  // trying not to be.
  await mapWithConcurrency(batch, 3, async (approval) => {
    // Re-read the lead at the moment of sending. The queue was built a
    // moment ago from the draft as it was then; if the customer has written
    // since that draft was written, or the draft itself has been rewritten,
    // what would go out answers a conversation that no longer exists
    // (daily-path sweep 2026-09-25 #4). The single-send route refuses the
    // same case with the same sentence.
    const stale = await staleReason(approval);
    if (stale) {
      skipped.push({ leadId: approval.leadId, leadName: approval.leadName, reason: stale });
      return;
    }
    const result = await sendFollowUpToLead(approval.leadId, approval.draftMessage, {
      // Approved by a person, exactly as the single-draft path records
      // it — this is not FollowUp deciding to send, it is the owner
      // releasing what FollowUp wrote.
      trigger: "manual",
      ...(approval.draftSubject ? { subject: approval.draftSubject } : {}),
      // No `humanSend`. See the header: nobody read this one.
    });
    if (result.success) {
      sent += 1;
      return;
    }
    skipped.push({
      leadId: approval.leadId,
      leadName: approval.leadName,
      // The send path's own sentence, verbatim. It already explains the
      // closed-window case in words an owner can act on, and rewriting
      // it here would be a second copy to drift.
      reason: result.message ?? "FollowUp couldn't send this one.",
    });
  });

  return { sent, skipped, remaining: Math.max(0, safe.length - batch.length) };
}

async function staleReason(approval: {
  leadId: string;
  leadName: string;
  heldAt: Date;
  draftMessage: string;
}): Promise<string | null> {
  const first = approval.leadName.split(" ")[0] || "This lead";
  const lead = await prisma.lead.findUnique({
    where: { id: approval.leadId },
    select: { suggestedMessage: true, suggestedDraftedFor: true },
  });
  if (!lead || lead.suggestedMessage !== approval.draftMessage) {
    return `${first}'s draft changed while this was sending. Nothing was sent — check the new draft.`;
  }
  // The draft answers everything up to suggestedDraftedFor; an older draft
  // without it answers everything up to the hold.
  const cutoff = lead.suggestedDraftedFor ?? approval.heldAt;
  const newer = await prisma.message.findFirst({
    where: { direction: "inbound", sentAt: { gt: cutoff }, conversation: { leadId: approval.leadId } },
    select: { id: true },
  });
  if (newer) {
    return `${first} wrote again after this draft was written. Nothing was sent — read their new message first.`;
  }
  return null;
}
