import { CRM_TIMEOUT_MS, type CrmClient, type CrmPerson } from "./types";
import { readWhen } from "./dates";

/**
 * HubSpot — a service key (Settings → search "service key" in their portal),
 * or an older account's private app access token: both are Bearer auth on
 * the same API (founder's HubSpot test, 2026-10-15: new accounts can't make
 * private apps any more). Needs crm.objects.contacts.read and .write; a note
 * needs only contacts write (HubSpot's notes reference). Uses the documented
 * CRM Search API (developers.hubspot.com/docs/api-reference) filtered on
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
      const res = await fetch(`${BASE}/crm/v3/objects/contacts?limit=1`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(CRM_TIMEOUT_MS) });
      if (!res.ok) return { ok: false, message: res.status === 401 ? "HubSpot didn't accept that key. Copy it again from Settings → Service keys in HubSpot." : `HubSpot returned ${res.status}. Try again in a minute.` };
      return { ok: true };
    } catch (err) {
      console.error("HubSpot connect check failed:", err);
      return { ok: false, message: "Couldn't reach HubSpot. Try again in a minute." };
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
      signal: AbortSignal.timeout(CRM_TIMEOUT_MS),
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
        signal: AbortSignal.timeout(CRM_TIMEOUT_MS),
      });
      if (!res.ok) return { ok: false, message: `HubSpot returned ${res.status}.` };
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "note push failed" };
    }
  },

  // "Last contacted" (notes_last_contacted): HubSpot sets it from calls,
  // one-to-one emails, meetings, chats and logged SMS/WhatsApp messages.
  // Notes don't count, so FollowUp's own notes never make it look active.
  async lastContactedAt(token, externalId) {
    try {
      const res = await fetch(`${BASE}/crm/v3/objects/contacts/${encodeURIComponent(externalId)}?properties=notes_last_contacted`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(CRM_TIMEOUT_MS),
      });
      if (!res.ok) return { known: false, at: null };
      const data = (await res.json().catch(() => null)) as { properties?: Record<string, unknown> } | null;
      if (!data?.properties) return { known: false, at: null };
      return readWhen(data.properties.notes_last_contacted ?? null);
    } catch {
      return { known: false, at: null };
    }
  },
};
