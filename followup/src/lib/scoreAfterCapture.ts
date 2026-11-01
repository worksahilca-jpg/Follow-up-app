import { prisma } from "@/lib/db";
import { scoreAndDraftForLead } from "@/lib/scoring";

/**
 * scoreAndDraftForLead for a customer's message that is already stored, from a webhook or form. Never throws: an AI
 * outage or a refused call (no credit left, Oct 30 2026) used to fail the whole delivery, so a Meta delivery carrying
 * several messages stopped at the first and the rest were never read, and a website form's instant reply was never
 * sent. The message is safe on disk; the lead is scored again by scoreUnscoredLeads (hourly, every channel).
 */
export async function scoreAndDraftAfterCapture(leadId: string): Promise<boolean> {
  try {
    return await scoreAndDraftForLead(leadId);
  } catch (err) {
    console.error(`Scoring after capture failed for lead ${leadId}; the hourly catch-up tries again:`, err instanceof Error ? err.message : "unknown error");
    return false;
  }
}

/** How far back the hourly catch-up looks for leads that were never scored. */
const CATCH_UP_DAYS = 7;

/**
 * Leads with messages that were never scored (an outage, a cut-short run), oldest first, scored now. The inbox syncs
 * already do this for their own businesses on every tick; this covers every channel (Instagram, Messenger, WhatsApp,
 * forms) from the hourly automation run. Only the last week, a few per business, so a lead that can never be scored is
 * not retried for ever.
 */
export async function scoreUnscoredLeadsForAllBusinesses(perBusiness = 5): Promise<{ businesses: number; scored: number }> {
  const since = new Date(Date.now() - CATCH_UP_DAYS * 86_400_000);
  const waiting = await prisma.lead.groupBy({
    by: ["businessId"],
    where: { scoreReason: null, createdAt: { gte: since }, conversations: { some: { messages: { some: {} } } } },
  });
  let scored = 0;
  for (const { businessId } of waiting) {
    const leads = await prisma.lead.findMany({
      where: { businessId, scoreReason: null, createdAt: { gte: since }, conversations: { some: { messages: { some: {} } } } },
      orderBy: { createdAt: "asc" },
      take: perBusiness,
      select: { id: true },
    });
    for (const { id } of leads) if (await scoreAndDraftAfterCapture(id)) scored += 1;
  }
  return { businesses: waiting.length, scored };
}
