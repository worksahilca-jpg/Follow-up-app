import { CRM_TIMEOUT_MS, type CrmClient, type CrmPerson } from "./types";
import { readWhen } from "./dates";

/**
 * GoHighLevel (founder, 2026-10-16: "lets build ghl too", then "ok go with A"): the owner makes a Private
 * Integration in their own GoHighLevel sub-account and pastes its key here with the sub-account's Location ID. No
 * Marketplace app, no OAuth (that is option B, later).
 *
 * Confirmed from HighLevel's own SDK (@gohighlevel/api-client 3.1.1, read 2026-10-16; marketplace.gohighlevel.com
 * doesn't load here): base URL https://services.leadconnectorhq.com, a Bearer token, a `Version` header (the SDK's
 * default is 2023-02-21), GET /locations/{locationId}, GET /contacts/ with locationId, limit, startAfterId and
 * startAfter (marked deprecated in favour of a search endpoint whose body the SDK doesn't type), POST
 * /contacts/{contactId}/notes with { body }, GET /conversations/search with locationId and contactId.
 *
 * NOT confirmed: the exact fields on a contact (the SDK's types leave out name and phone) and on a conversation
 * (lastMessageDate, lastMessageDirection). Everything is read defensively; a field that isn't there is "unknown",
 * never a guess.
 */
const BASE = "https://services.leadconnectorhq.com";
const VERSION = "2023-02-21";
const PAGE_SIZE = 100;

/** What the owner pastes: the Location ID and the key, kept together (encrypted as one, src/lib/db.ts). */
export function packGhlKey(locationId: string, token: string): string {
  return `${locationId.trim()}|${token.trim()}`;
}

export function parseGhlKey(apiKey: string): { locationId: string; token: string } | null {
  const i = apiKey.indexOf("|");
  if (i <= 0 || i === apiKey.length - 1) return null;
  const locationId = apiKey.slice(0, i).trim();
  const token = apiKey.slice(i + 1).trim();
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(locationId) || token.length < 10) return null;
  return { locationId, token };
}

function headers(token: string, json = false): Record<string, string> {
  return { Authorization: `Bearer ${token}`, Version: VERSION, Accept: "application/json", ...(json ? { "Content-Type": "application/json" } : {}) };
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

export function mapGhlContact(c: Record<string, unknown>): CrmPerson | null {
  const id = str(c.id);
  if (!id) return null;
  const name =
    str(c.contactName) ??
    ([str(c.firstName), str(c.lastName)].filter(Boolean).join(" ").trim() || null) ??
    str(c.name) ??
    "GoHighLevel contact";
  const added = str(c.dateAdded);
  return { externalId: id, name, email: str(c.email), phone: str(c.phone), createdAt: added && !Number.isNaN(Date.parse(added)) ? new Date(added) : new Date() };
}

export const goHighLevelClient: CrmClient = {
  async testConnection(apiKey) {
    const k = parseGhlKey(apiKey);
    if (!k) return { ok: false, message: "Paste both the Location ID and the key." };
    try {
      const res = await fetch(`${BASE}/locations/${encodeURIComponent(k.locationId)}`, { headers: headers(k.token), signal: AbortSignal.timeout(CRM_TIMEOUT_MS) });
      if (res.status === 401 || res.status === 403)
        return { ok: false, message: "GoHighLevel didn't accept that key for this Location ID. Check both, and that the key can read contacts and conversations." };
      if (res.status === 404 || res.status === 400) return { ok: false, message: "GoHighLevel doesn't know that Location ID. Copy it again from Settings → Business Profile." };
      if (!res.ok) return { ok: false, message: `GoHighLevel returned ${res.status}. Try again in a minute.` };
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const loc = (data.location ?? data) as Record<string, unknown>;
      return { ok: true, accountLabel: str(loc.name) ?? undefined };
    } catch (err) {
      console.error("GoHighLevel connect check failed:", err instanceof Error ? err.message : err);
      return { ok: false, message: "Couldn't reach GoHighLevel. Try again in a minute." };
    }
  },

  // Newest pages are not promised by this endpoint; it pages with startAfterId/startAfter from the response's meta.
  // The cursor is those two, joined. Re-seeing a known contact is a no-op (Lead's crm unique key, src/lib/crmSync.ts).
  async fetchPage(apiKey, cursor) {
    const k = parseGhlKey(apiKey);
    if (!k) throw new Error("GoHighLevel key is not in the expected shape.");
    const q = new URLSearchParams({ locationId: k.locationId, limit: String(PAGE_SIZE) });
    if (cursor) {
      const [afterId, after] = cursor.split("|");
      if (afterId) q.set("startAfterId", afterId);
      if (after) q.set("startAfter", after);
    }
    const res = await fetch(`${BASE}/contacts/?${q.toString()}`, { headers: headers(k.token), signal: AbortSignal.timeout(CRM_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`GoHighLevel returned ${res.status} fetching contacts.`);
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const rows = Array.isArray(data.contacts) ? (data.contacts as Array<Record<string, unknown>>) : [];
    const people = rows.map(mapGhlContact).filter((p): p is CrmPerson => p !== null);
    const meta = (data.meta ?? {}) as Record<string, unknown>;
    const afterId = str(meta.startAfterId);
    const after = typeof meta.startAfter === "number" ? String(meta.startAfter) : null;
    const hasMore = rows.length === PAGE_SIZE && Boolean(afterId || after);
    return { people, nextCursor: hasMore ? `${afterId ?? ""}|${after ?? ""}` : null, hasMore };
  },

  async pushNote(apiKey, externalId, text) {
    const k = parseGhlKey(apiKey);
    if (!k) return { ok: false, message: "GoHighLevel key is not in the expected shape." };
    try {
      const res = await fetch(`${BASE}/contacts/${encodeURIComponent(externalId)}/notes`, {
        method: "POST",
        headers: headers(k.token, true),
        body: JSON.stringify({ body: text }),
        signal: AbortSignal.timeout(CRM_TIMEOUT_MS),
      });
      if (!res.ok) return { ok: false, message: `GoHighLevel returned ${res.status}.` };
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "note push failed" };
    }
  },

  // The one-boss rule (A-237): when GoHighLevel last wrote to this person. Read from their conversation's last
  // message, counted only when it says it went out from the business; anything else is "unknown", which keeps
  // FollowUp waiting for the owner.
  async lastContactedAt(apiKey, externalId) {
    const k = parseGhlKey(apiKey);
    if (!k) return { known: false, at: null };
    try {
      const q = new URLSearchParams({ locationId: k.locationId, contactId: externalId, limit: "1" });
      const res = await fetch(`${BASE}/conversations/search?${q.toString()}`, { headers: headers(k.token), signal: AbortSignal.timeout(CRM_TIMEOUT_MS) });
      if (!res.ok) return { known: false, at: null };
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      const convo = Array.isArray(data?.conversations) ? (data!.conversations as Array<Record<string, unknown>>)[0] : undefined;
      if (!data || !Array.isArray(data.conversations)) return { known: false, at: null };
      if (!convo) return { known: true, at: null };
      if (convo.lastMessageDirection !== "outbound" || !("lastMessageDate" in convo)) return { known: false, at: null };
      return readWhen(convo.lastMessageDate);
    } catch {
      return { known: false, at: null };
    }
  },
};
