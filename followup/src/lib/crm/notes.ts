import { prisma } from "@/lib/db";
import { CRM_PROVIDERS, isCrmProvider } from "@/lib/crm";
import { shownItems, type Qualification, type Template } from "@/lib/qualification";

/**
 * Writes a note on the person's own record in the CRM they came from
 * (Follow Up Boss, HubSpot; src/lib/crmSync.ts links them). Best-effort:
 * never throws, so a CRM hiccup can never fail the send or the reply step
 * that called it. Only when the business is still connected to that same
 * CRM, so a note never lands in a CRM the owner has since left.
 */
export async function pushCrmNote(businessId: string, provider: string, crmId: string, text: string): Promise<void> {
  try {
    if (!isCrmProvider(provider)) return;
    const conn = await prisma.crmConnection.findUnique({ where: { businessId } });
    if (!conn?.apiKey || conn.provider !== provider) return;
    const result = await CRM_PROVIDERS[provider].client.pushNote(conn.apiKey, crmId, text);
    if (!result.ok) console.error(`CRM note push failed for business ${businessId}: ${result.message}`);
  } catch (err) {
    console.error(`CRM note push errored for business ${businessId}:`, err);
  }
}

/**
 * The ready card as a CRM note (founder, 2026-10-12, A-237): when a
 * customer FollowUp is watching becomes ready, the owner's CRM gets what
 * FollowUp learned, each line with the customer's own words beside it, so
 * whoever picks it up in the CRM sees why without opening FollowUp.
 *
 *   FollowUp: Nadia Khan looks ready to talk.
 *   Area: Near a good school in Oakville ("near a good school in Oakville")
 *   Money: Pre-approved to $650k ("pre-approved up to 650")
 */
export function readyNote(name: string, template: Template, q: Qualification): string {
  const lines = shownItems(template, q).map(({ criterion, item }) => {
    const words = item.quote.trim() ? ` ("${item.quote.trim()}")` : item.source === "booking" ? " (booked through your booking link)" : "";
    return `${criterion.label}: ${item.value.trim()}${words}`;
  });
  return [`FollowUp: ${name} looks ready to talk.`, ...lines].join("\n");
}
