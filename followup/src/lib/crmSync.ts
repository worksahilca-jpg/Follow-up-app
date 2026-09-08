import { prisma } from "@/lib/db";
import { hasActiveAccess } from "@/lib/billing";
import { pickAssignee } from "@/lib/assignment";
import { applySourceRouting } from "@/lib/sourceRouting";
import { notifyLeadEvent } from "@/lib/outboundWebhook";
import { scoreAndDraftForLead } from "@/lib/scoring";
import { CRM_PROVIDERS, isCrmProvider } from "@/lib/crm";
import type { CrmPerson } from "@/lib/crm/types";

// Per-run page cap — same reasoning as Gmail's MAX_CLASSIFICATIONS_PER_RUN
// (src/lib/gmailSync.ts): a run FINISHES and stamps itself instead of
// timing out mid-import. A CRM with thousands of contacts backfills over
// several ticks; a business's own future contacts are always caught the
// same tick they change (HubSpot) or within a few (Follow Up Boss — see
// the "not confirmed" note in src/lib/crm/followupboss.ts).
const MAX_PAGES_PER_RUN = 5;

export interface CrmSyncResult { imported: number; touched: number; truncated: boolean }
const EMPTY: CrmSyncResult = { imported: 0, touched: 0, truncated: false };

/**
 * Imports people/contacts from a business's connected CRM as Leads —
 * FollowUp working ALONGSIDE the CRM the business already runs, not
 * replacing it (research/market/2026-09-07-why-followup-evidence-for-and-against.md:
 * roughly half of small businesses already have one). A lead's CRM
 * identity (crmProvider/crmId) makes re-import a no-op and is how a note
 * gets pushed back after FollowUp sends (see sendFollowUpToLead).
 *
 * Deliberately does NOT run the instant-acknowledgement path (src/lib/
 * acknowledge.ts) — a CRM contact is very often someone already spoken
 * to, sometimes years ago; "thanks for reaching out, I'll get back to you
 * shortly" would be a lie. It IS scored and drafted like any other lead,
 * so it still surfaces on the dashboard and gets the silence/neglect
 * follow-up passes once it's genuinely gone quiet.
 */
export async function syncCrmForBusiness(businessId: string): Promise<CrmSyncResult> {
  const conn = await prisma.crmConnection.findUnique({ where: { businessId } });
  if (!conn?.apiKey || !isCrmProvider(conn.provider)) return EMPTY;
  if (!(await hasBillingAccess(businessId))) return EMPTY;

  const { client } = CRM_PROVIDERS[conn.provider];
  const since = conn.lastSyncedAt;
  const startedAt = new Date();

  let imported = 0;
  let touched = 0;
  let truncated = false;
  let cursor: string | null = null;
  let pages = 0;

  try {
    do {
      const page = await client.fetchPage(conn.apiKey, cursor, since);
      for (const person of page.people) {
        const result = await upsertCrmLead(businessId, conn.provider, person);
        if (result === "imported") imported++;
        else if (result === "touched") touched++;
      }
      cursor = page.nextCursor;
      pages++;
      if (pages >= MAX_PAGES_PER_RUN && page.hasMore) {
        truncated = true;
        break;
      }
    } while (cursor);

    await prisma.crmConnection.update({
      where: { businessId },
      data: { lastSyncedAt: truncated ? conn.lastSyncedAt : startedAt, lastSyncError: null },
    });
  } catch (err) {
    console.error(`CRM sync failed for business ${businessId} (${conn.provider}):`, err);
    await prisma.crmConnection.update({
      where: { businessId },
      data: { lastSyncError: `${new Date().toISOString()} ${err instanceof Error ? err.message : String(err)}`.slice(0, 1000) },
    });
  }

  return { imported, touched, truncated };
}

async function upsertCrmLead(businessId: string, provider: string, person: CrmPerson): Promise<"imported" | "touched" | "skipped"> {
  if (!person.email && !person.phone) return "skipped"; // nothing to reach them on
  const existing = await prisma.lead.findUnique({
    where: { businessId_crmProvider_crmId: { businessId, crmProvider: provider, crmId: person.externalId } },
  });
  if (existing) {
    if (existing.lastContacted && existing.lastContacted >= person.createdAt) return "skipped";
    await prisma.lead.update({ where: { id: existing.id }, data: { lastContacted: person.createdAt } });
    await scoreAndDraftForLead(existing.id).catch((err) => console.error(`CRM lead re-score failed ${existing.id}:`, err));
    return "touched";
  }

  try {
    const lead = await prisma.lead.create({
      data: {
        businessId,
        name: person.name,
        email: person.email,
        phone: person.phone,
        source: CRM_PROVIDERS[provider as keyof typeof CRM_PROVIDERS]?.label ?? provider,
        crmProvider: provider,
        crmId: person.externalId,
        stage: "NEW",
        lastContacted: person.createdAt,
        assignedToId: await pickAssignee(businessId),
      },
    });
    void notifyLeadEvent(businessId, "lead.created", lead);
    await applySourceRouting(businessId, lead.id, lead.source ?? provider);
    await scoreAndDraftForLead(lead.id).catch((err) => console.error(`CRM lead score failed ${lead.id}:`, err));
    return "imported";
  } catch (err) {
    // Two identities landing on the same email/phone (e.g. also a Gmail
    // lead) — Lead's (businessId, email) / (businessId, phone) unique
    // constraints win; not treated as a failure, just not a NEW lead.
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") return "skipped";
    throw err;
  }
}

async function hasBillingAccess(businessId: string): Promise<boolean> {
  const b = await prisma.business.findUnique({ where: { id: businessId }, select: { subscriptionStatus: true } });
  return hasActiveAccess(b?.subscriptionStatus);
}

export async function syncCrmForAllBusinesses(): Promise<{ businesses: number; imported: number; failed: number }> {
  const connections = await prisma.crmConnection.findMany({ where: { apiKey: { not: null } }, select: { businessId: true } });
  let imported = 0;
  let failed = 0;
  for (const { businessId } of connections) {
    try {
      const r = await syncCrmForBusiness(businessId);
      imported += r.imported;
    } catch (err) {
      failed++;
      console.error(`CRM sync loop failed for business ${businessId}:`, err);
    }
  }
  return { businesses: connections.length, imported, failed };
}
