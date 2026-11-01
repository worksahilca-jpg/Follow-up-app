import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { isOptInReply, isOptOutReply } from "@/lib/optOutKeywords";

/**
 * "Stop" by email, recorded like a STOP by text (Nov 1 2026). A customer who answered an email with just "stop" or
 * "unsubscribe" was recorded nowhere: the text, WhatsApp and Instagram capture paths set Lead.optedOutAt, the email
 * syncs didn't, so a welcome-back weeks later could email them again. Founder, 2026-10-19: someone who said STOP
 * meant stop, on every channel; sendFollowUpToLead already refuses every automatic message to an opted-out customer.
 * The owner can still write to them themselves.
 *
 * Read from the customer's newest message on ANY channel, after the email sync has stored the thread: a STOP counts
 * while it is the last thing they said, so a START (or a STOP) they sent since on another channel is never overruled by
 * an old email found on a later pass. A START by email clears only an opt-out older than it. Never throws: the sync
 * has already stored the mail, and a hiccup here is retried on the next pass.
 */
export async function recordEmailConsent(leadId: string, businessId: string): Promise<"out" | "in" | null> {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        optedOutAt: true,
        conversations: {
          select: {
            channel: true,
            messages: { where: { direction: "inbound" }, orderBy: { sentAt: "desc" }, take: 1, select: { body: true, sentAt: true } },
          },
        },
      },
    });
    if (!lead) return null;
    let newest: { channel: string; body: string; sentAt: Date } | null = null;
    for (const c of lead.conversations) {
      const m = c.messages[0];
      if (m && (!newest || m.sentAt > newest.sentAt)) newest = { channel: c.channel, body: m.body, sentAt: m.sentAt };
    }
    if (!newest || newest.channel !== "email") return null;

    if (!lead.optedOutAt && isOptOutReply(newest.body, "email")) {
      await prisma.lead.update({ where: { id: leadId }, data: { optedOutAt: new Date() } });
      void recordAudit({ businessId, userId: null }, "lead.opt_out", { targetType: "lead", targetId: leadId, meta: { channel: "email", via: "keyword" } });
      return "out";
    }
    if (lead.optedOutAt && newest.sentAt > lead.optedOutAt && isOptInReply(newest.body, "email")) {
      await prisma.lead.update({ where: { id: leadId }, data: { optedOutAt: null } });
      void recordAudit({ businessId, userId: null }, "lead.opt_in", { targetType: "lead", targetId: leadId, meta: { channel: "email", via: "keyword" } });
      return "in";
    }
    return null;
  } catch (err) {
    console.error(`Could not read an email STOP for lead ${leadId}:`, err);
    return null;
  }
}
