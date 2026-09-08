import type { CrmClient, CrmPerson } from "./types";

/**
 * Follow Up Boss (docs.followupboss.com/reference) — Basic auth with the
 * account's API key as the username, blank password. Confirmed from their
 * docs: base URL https://api.followupboss.com/v1/, offset/limit pagination
 * (default 10, max 100), response carries `_metadata.total`.
 *
 * NOT confirmed (their reference pages return no result in this
 * environment): a documented "give me people updated since X" filter.
 * Rather than guess a query-parameter name that might silently no-op,
 * this walks pages by offset and relies on Lead's
 * (businessId, crmProvider, crmId) unique key to make re-seeing a known
 * person a cheap no-op — the same "known thread skips work" shape the
 * Gmail sync already uses. `since` is accepted for interface symmetry
 * with HubSpot but not sent as a request filter here.
 *
 * Sort stays `-created` (newest-first) — a deliberate call, not an
 * oversight, after research/audit/2026-09-08-newer-surface-audit.md
 * finding #2 (fixed via CrmConnection.syncCursor, see src/lib/crmSync.ts)
 * flagged switching to oldest-first as worth considering: newest-first is
 * what lets a fully-caught-up connection notice a brand new contact
 * within its next few ticks at all, since there's no reliable `since`
 * filter here to catch it otherwise — oldest-first would trade that for
 * only ever converging a historical backfill, at the cost of a large,
 * still-growing account needing to re-walk its entire contact list before
 * reaching anything new again. A contact landing near the current resume
 * offset just as new contacts arrive gets re-processed (a harmless,
 * already-idempotent no-op), not skipped, since new contacts insert
 * ahead of the resume point, not behind it.
 */
const BASE = "https://api.followupboss.com/v1";
const PAGE_SIZE = 100;

function authHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

function mapPerson(p: Record<string, unknown>): CrmPerson | null {
  const id = p.id;
  if (id === undefined || id === null) return null;
  const emails = Array.isArray(p.emails) ? (p.emails as Array<{ value?: string }>) : [];
  const phones = Array.isArray(p.phones) ? (p.phones as Array<{ value?: string }>) : [];
  const name = [p.firstName, p.lastName].filter(Boolean).join(" ").trim() || (p.name as string) || "Follow Up Boss contact";
  return {
    externalId: String(id),
    name,
    email: emails[0]?.value ?? null,
    phone: phones[0]?.value ?? null,
    createdAt: typeof p.created === "string" ? new Date(p.created) : new Date(),
  };
}

export const followUpBossClient: CrmClient = {
  async testConnection(apiKey) {
    try {
      const res = await fetch(`${BASE}/me`, { headers: { Authorization: authHeader(apiKey) } });
      if (!res.ok) return { ok: false, message: res.status === 401 ? "That API key was rejected." : `Follow Up Boss returned ${res.status}.` };
      const data = await res.json().catch(() => ({}));
      const label = typeof data?.account?.name === "string" ? data.account.name : undefined;
      return { ok: true, accountLabel: label };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Couldn't reach Follow Up Boss." };
    }
  },

  async fetchPage(apiKey, cursor) {
    const offset = cursor ? Number(cursor) : 0;
    const url = `${BASE}/people?limit=${PAGE_SIZE}&offset=${offset}&sort=-created`;
    const res = await fetch(url, { headers: { Authorization: authHeader(apiKey) } });
    if (!res.ok) throw new Error(`Follow Up Boss returned ${res.status} fetching people.`);
    const data = await res.json().catch(() => ({}));
    const rows: Array<Record<string, unknown>> = Array.isArray(data?.people) ? data.people : [];
    const people = rows.map(mapPerson).filter((p): p is CrmPerson => p !== null);
    const total = typeof data?._metadata?.total === "number" ? data._metadata.total : offset + rows.length;
    const nextOffset = offset + rows.length;
    return { people, nextCursor: String(nextOffset), hasMore: rows.length === PAGE_SIZE && nextOffset < total };
  },

  async pushNote(apiKey, externalId, text) {
    try {
      const res = await fetch(`${BASE}/notes`, {
        method: "POST",
        headers: { Authorization: authHeader(apiKey), "Content-Type": "application/json" },
        body: JSON.stringify({ personId: Number(externalId), subject: "FollowUp", body: text }),
      });
      if (!res.ok) return { ok: false, message: `Follow Up Boss returned ${res.status}.` };
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "note push failed" };
    }
  },
};
