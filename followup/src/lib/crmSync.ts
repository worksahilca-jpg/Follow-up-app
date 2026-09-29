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
  // Resume from wherever the last truncated run left off, instead of
  // always restarting at page 1 — see CrmConnection.syncCursor in
  // schema.prisma and research/audit/2026-09-08-newer-surface-audit.md
  // finding #2. Null (no prior backfill in progress, or the last one
  // finished) behaves exactly as before this fix.
  let cursor: string | null = conn.syncCursor;
  let pages = 0;
  // `hasMore`, NOT a truthy `cursor`, is what ends this loop — see
  // CrmClient.fetchPage's own contract ("callers page until `hasMore` is
  // false"). Looping on the cursor instead only *happened* to terminate
  // for HubSpot, whose nextCursor goes null at exactly the moment
  // hasMore goes false. Follow Up Boss pages by numeric offset and so
  // always returns a non-empty cursor string ("200", and "0" for an
  // empty first page — both truthy in JS), which made a completed pass
  // spin forever re-fetching the same past-the-end offset until the cron
  // function hit its 120s ceiling: the run never stamped lastSyncedAt,
  // never cleared syncCursor, and — because syncCrmForAllBusinesses()
  // walks businesses sequentially — every business ordered after the
  // first Follow Up Boss connection never got synced at all.
  let hasMore = true;

  try {
    while (hasMore) {
      const page = await client.fetchPage(conn.apiKey, cursor, since);
      for (const person of page.people) {
        const result = await upsertCrmLead(businessId, conn.provider, person);
        if (result === "imported") imported++;
        else if (result === "touched") touched++;
      }
      cursor = page.nextCursor;
      hasMore = page.hasMore && cursor !== null;
      pages++;
      if (pages >= MAX_PAGES_PER_RUN && hasMore) {
        truncated = true;
        break;
      }
    }

    await prisma.crmConnection.update({
      where: { businessId },
      data: {
        lastSyncedAt: truncated ? conn.lastSyncedAt : startedAt,
        // Persist where to resume next tick while a backfill is still in
        // progress; cleared the moment a run actually reaches the end
        // (hasMore: false) rather than just hitting the page budget.
        syncCursor: truncated ? cursor : null,
        lastSyncError: null,
      },
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

/**
 * The same person in the CRM and in the inbox must be one customer, not
 * two — two means two check-ins to one person (founder, 2026-09-29: "they
 * will clash and make confusion"). Lead's unique keys are exact, so a CRM
 * that stores "John@Example.com" or "(416) 555-0199" used to create a
 * second lead beside the Gmail one ("john@example.com") or the text one
 * ("+14165550199"). Both are brought to the form the other channels use.
 */
export function normalizeCrmEmail(email: string | null): string | null {
  const e = email?.trim().toLowerCase();
  return e ? e : null;
}

/**
 * Digits in E.164, the form Twilio and WhatsApp numbers arrive in. Ten
 * digits are read as North American (+1), the only market FollowUp serves
 * today; anything already starting with + keeps its country code. A number
 * too short to be real is dropped rather than guessed at.
 */
export function normalizeCrmPhone(phone: string | null): string | null {
  if (!phone) return null;
  const hasPlus = phone.trim().startsWith("+");
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return null;
  if (hasPlus) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

async function upsertCrmLead(businessId: string, provider: string, raw: CrmPerson): Promise<"imported" | "touched" | "skipped"> {
  const person: CrmPerson = { ...raw, email: normalizeCrmEmail(raw.email), phone: normalizeCrmPhone(raw.phone) };
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

  // Already a customer here from the inbox, a DM or a form: link them to
  // their CRM record instead of skipping them. Skipping left the lead with
  // no CRM identity, so FollowUp's replies never reached the CRM as notes,
  // and the "also in your CRM" hold (src/lib/automation.ts) never applied.
  // Matched case-insensitively on email, then on the normalized phone.
  const match = await prisma.lead.findFirst({
    where: {
      businessId,
      OR: [
        ...(person.email ? [{ email: { equals: person.email, mode: "insensitive" as const } }] : []),
        ...(person.phone ? [{ phone: person.phone }] : []),
      ],
    },
    select: { id: true, crmProvider: true, crmId: true, email: true, phone: true },
  });
  if (match) {
    // Already tied to a different CRM record: leave it. Two CRM contacts
    // for one person is the CRM's duplicate to resolve, not ours to pick.
    if (match.crmId) return "skipped";
    await prisma.lead.update({
      where: { id: match.id },
      data: {
        crmProvider: provider,
        crmId: person.externalId,
        // Fill a gap, never overwrite what the customer told us directly.
        ...(match.email ? {} : person.email ? { email: person.email } : {}),
        ...(match.phone ? {} : person.phone ? { phone: person.phone } : {}),
      },
    });
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
    // A lead created between the match above and this insert (a sync
    // racing this one): the unique keys win, and the next tick links it.
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
