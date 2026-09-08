import type { CrmClient, CrmPerson } from "./types";

/**
 * HubSpot — a private app access token (Settings → Integrations → Private
 * Apps in their portal; needs the crm.objects.contacts.read/write and
 * crm.objects.notes.write scopes), Bearer auth. Uses the documented CRM
 * Search API (developers.hubspot.com/docs/api-reference) filtered on
 * `lastmodifieddate`, paginated via the response's `paging.next.after`
 * cursor — a real incremental sync, unlike Follow Up Boss above.
 */
const BASE = "https://api.hubapi.com";
const PAGE_SIZE = 100;
const PROPERTIES = ["firstname", "lastname", "email", "phone", "createdate", "lastmodifieddate"];

function mapContact(c: { id: string; properties: Record<string, string | null> }): CrmPerson | null {
  if (!c.id) return null;
  const p = c.properties ?? {};
  const name = [p.firstname, p.lastname].filter(Boolean).join(" ").trim() || p.email || "HubSpot contact";
  return {
    externalId: c.id,
    name,
    email: p.email ?? null,
    phone: p.phone ?? null,
    createdAt: p.createdate ? new Date(p.createdate) : new Date(),
  };
}

export const hubspotClient: CrmClient = {
  async testConnection(token) {
    try {
      const res = await fetch(`${BASE}/crm/v3/objects/contacts?limit=1`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return { ok: false, message: res.status === 401 ? "That access token was rejected." : `HubSpot returned ${res.status}.` };
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Couldn't reach HubSpot." };
    }
  },

  async fetchPage(token, cursor, since) {
    const body: Record<string, unknown> = {
      limit: PAGE_SIZE,
      properties: PROPERTIES,
      sorts: [{ propertyName: "lastmodifieddate", direction: "ASCENDING" }],
    };
    if (cursor) body.after = cursor;
    if (since) {
      body.filterGroups = [
        { filters: [{ propertyName: "lastmodifieddate", operator: "GTE", value: String(since.getTime()) }] },
      ];
    }
    const res = await fetch(`${BASE}/crm/v3/objects/contacts/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HubSpot returned ${res.status} fetching contacts.`);
    const data = await res.json().catch(() => ({}));
    const rows: Array<{ id: string; properties: Record<string, string | null> }> = Array.isArray(data?.results) ? data.results : [];
    const people = rows.map(mapContact).filter((p): p is CrmPerson => p !== null);
    const nextCursor: string | null = data?.paging?.next?.after ?? null;
    return { people, nextCursor, hasMore: !!nextCursor };
  },

  async pushNote(token, externalId, text) {
    try {
      const res = await fetch(`${BASE}/crm/v3/objects/notes`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          properties: { hs_note_body: text, hs_timestamp: new Date().toISOString() },
          // 202 is HubSpot's own documented Note→Contact association type id.
          associations: [{ to: { id: externalId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }] }],
        }),
      });
      if (!res.ok) return { ok: false, message: `HubSpot returned ${res.status}.` };
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "note push failed" };
    }
  },
};
