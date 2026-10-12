import { prisma } from "@/lib/db";
import { CRM_PROVIDERS, isCrmProvider } from "@/lib/crm";

/**
 * One boss per customer (founder, 2026-10-12, A-237): when a customer is
 * also in the owner's CRM and the CRM is following up with them, FollowUp
 * only watches: anything it writes waits for the owner, and it tells them
 * when the customer is ready. When the CRM is not following up, FollowUp
 * does, as for anyone else. The customer is never messaged twice.
 *
 * Before this, every customer linked to a CRM waited for the owner,
 * whatever the CRM was doing (founder, 2026-09-29), because FollowUp
 * couldn't see the CRM's own follow-ups. Now it asks the CRM when it last
 * contacted them.
 */

/** The CRM counts as following up if it contacted them within this many days. */
export const CRM_ACTIVE_DAYS = 14;

/**
 * Activity in the CRM this soon after FollowUp's own send is FollowUp's:
 * every send writes a note there (src/lib/crm/notes.ts), and Follow Up
 * Boss may count a note as activity.
 */
export const OWN_ACTIVITY_MINUTES = 15;

/**
 * Whether the CRM is following up with this customer, so FollowUp should
 * only watch. Anything uncertain answers yes, which is how it behaved
 * before: the CRM can't be asked, didn't say, or the business is no longer
 * connected to it.
 */
export async function crmIsFollowingUp(
  lead: { businessId: string; crmProvider: string | null; crmId: string | null },
  ourLastSentAt: Date | null,
  now: Date = new Date()
): Promise<boolean> {
  if (!lead.crmProvider || !lead.crmId || !isCrmProvider(lead.crmProvider)) return false;
  let answer: { known: boolean; at: Date | null };
  try {
    const conn = await prisma.crmConnection.findUnique({ where: { businessId: lead.businessId }, select: { provider: true, apiKey: true } });
    if (!conn?.apiKey || conn.provider !== lead.crmProvider) return true;
    answer = await CRM_PROVIDERS[lead.crmProvider].client.lastContactedAt(conn.apiKey, lead.crmId);
  } catch {
    return true;
  }
  const { known, at } = answer;
  if (!known) return true;
  if (!at) return false;
  if (now.getTime() - at.getTime() > CRM_ACTIVE_DAYS * 86_400_000) return false;
  if (ourLastSentAt) {
    const sinceOurs = at.getTime() - ourLastSentAt.getTime();
    if (sinceOurs >= 0 && sinceOurs <= OWN_ACTIVITY_MINUTES * 60_000) return false;
  }
  return true;
}
