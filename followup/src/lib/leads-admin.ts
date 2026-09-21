/**
 * Destructive lead-management helpers shared by the single-lead delete
 * route and the bulk cleanup route — kept in one place so the cascade
 * (everything that has a leadId FK) can't drift out of sync between them.
 */

import { prisma } from "@/lib/db";

/**
 * Deletes one lead and every row that hangs off it, in a single transaction.
 *
 * `businessId` is optional only because the single-lead delete route has
 * already loaded the lead and checked ownership itself. Pass it from any
 * caller that hasn't: this is the last function before rows are gone for
 * good, and a delete-by-id with no tenant check is the shape a
 * cross-tenant wipe takes. Throws rather than returning quietly on a
 * mismatch — a caller that asked to delete another tenant's lead has a bug
 * that must not look like success.
 */
export async function deleteLeadCascade(leadId: string, businessId?: string): Promise<void> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { conversations: true } });
  if (!lead) return;
  if (businessId && lead.businessId !== businessId) {
    throw new Error(`Refusing to delete lead ${leadId}: it belongs to another business.`);
  }

  const conversationIds = lead.conversations.map((c) => c.id);

  await prisma.$transaction([
    prisma.message.deleteMany({ where: { conversationId: { in: conversationIds } } }),
    prisma.conversation.deleteMany({ where: { leadId } }),
    prisma.deal.deleteMany({ where: { leadId } }),
    prisma.followUp.deleteMany({ where: { leadId } }),
    prisma.task.deleteMany({ where: { leadId } }),
    prisma.booking.deleteMany({ where: { leadId } }),
    prisma.aIInsight.deleteMany({ where: { leadId } }),
    // Both of these reference Lead with ON DELETE RESTRICT, so the delete
    // below fails outright if either is left behind — which is not a
    // hypothetical for OutboundSend: any lead with a send parked after a
    // provider failure could not be deleted at all until this line existed
    // (found 2026-09-21 while adding SendClaim, which has the same shape).
    prisma.outboundSend.deleteMany({ where: { leadId } }),
    prisma.sendClaim.deleteMany({ where: { leadId } }),
    prisma.lead.delete({ where: { id: leadId } }),
  ]);
}

/** The minimum a lead has to carry for its mailbox threads to be archivable. */
export type ArchivableLead = {
  id: string;
  name: string;
  email: string | null;
  conversations: {
    channel: string;
    externalId: string | null;
    emailProvider: string | null;
    messages: { sentAt: Date }[];
  }[];
};

/**
 * Writes a FilteredEmail row for each mailbox thread a lead holds, BEFORE
 * that lead is deleted — the same record the sync writes when the same
 * classifier reaches the same verdict on the same thread during import.
 *
 * Why reuse FilteredEmail instead of inventing an archive table: the rows
 * a clean-up deletion destroys that the owner could actually want back are
 * the mailbox ones, and those are not really destroyed — they are still in
 * Gmail/Outlook. A FilteredEmail row makes the deletion appear in Settings
 * with the classifier's own reason and a one-click "this was a lead" that
 * re-imports the thread and (since the restore route now stamps
 * Lead.classificationOverriddenAt) permanently exempts it from being
 * judged again. That is a real undo built out of a path that already
 * exists, already has a UI, and is already the mechanism owners are told
 * to use for exactly this mistake.
 *
 * It is deliberately written before the delete, not inside the same
 * transaction: a crash between the two leaves a visible, restorable record
 * of a lead that still exists, which costs an owner one confusing row —
 * the opposite order would lose the record of a lead that is already gone.
 * A stale row does not disturb the sync either, since that check
 * (src/lib/integrations/gmail.ts) only consults FilteredEmail for threads
 * it doesn't already have a Conversation for.
 *
 * Returns how many threads were archived, so a caller can tell a
 * restorable deletion from one that only the audit trail records.
 */
export async function archiveLeadThreadsAsFiltered(
  businessId: string,
  lead: ArchivableLead,
  reason: string
): Promise<number> {
  const threads = lead.conversations.filter((c) => c.channel === "email" && c.externalId);

  let archived = 0;
  for (const c of threads) {
    // Newest message in the thread. Not messages[messages.length - 1]:
    // the caller's ordering is its own business, and this value decides
    // whether a later sync treats the thread as re-opened by a new reply.
    const lastMessageAt = c.messages.reduce<Date | null>(
      (newest, m) => (newest === null || m.sentAt > newest ? m.sentAt : newest),
      null
    );
    await prisma.filteredEmail.upsert({
      where: { businessId_threadId: { businessId, threadId: c.externalId! } },
      update: { reason, lastMessageAt: lastMessageAt ?? new Date() },
      create: {
        businessId,
        threadId: c.externalId!,
        provider: c.emailProvider ?? "gmail",
        senderName: lead.name,
        // FilteredEmail.senderEmail is non-null and this is display-only
        // (restore keys on threadId), so a lead with no stored address
        // still gets an archived, restorable row.
        senderEmail: lead.email ?? "unknown",
        subject: null,
        reason,
        lastMessageAt: lastMessageAt ?? new Date(),
      },
    });
    archived += 1;
  }
  return archived;
}
