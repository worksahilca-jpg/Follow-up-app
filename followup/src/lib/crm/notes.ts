import { shownItems, type Qualification, type Template } from "@/lib/qualification";
import { writeToCrm } from "@/lib/crm/writes";

/**
 * Writes a note on the person's own record in the CRM they came from
 * (Follow Up Boss, HubSpot; src/lib/crmSync.ts links them), on record and
 * tried again if the CRM doesn't take it (src/lib/crm/writes.ts, A-252).
 * Never throws, so a CRM hiccup can never fail the send or the reply step
 * that called it. Only when the business is still connected to that same
 * CRM, so a note never lands in a CRM the owner has since left.
 */
export async function pushCrmNote(
  lead: { id: string; businessId: string; crmProvider: string; crmId: string },
  text: string
): Promise<void> {
  await writeToCrm({ businessId: lead.businessId, leadId: lead.id, provider: lead.crmProvider, crmId: lead.crmId, kind: "note", text });
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
