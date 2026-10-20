import { CRM_TIMEOUT_MS, type CrmClient, type CrmNote, type CrmPerson } from "./types";
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

/** A note's text as plain words: GoHighLevel's note box can keep some HTML. */
export function plainNote(body: string): string {
  return body
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

/** Which of the two things FollowUp reads the key isn't allowed to (401/403). Anything else is not a permission question. */
async function missingPermissions(k: { locationId: string; token: string }): Promise<string[]> {
  const checks: Array<[string, string]> = [
    ["contacts", `${BASE}/contacts/?${new URLSearchParams({ locationId: k.locationId, limit: "1" })}`],
    ["conversations", `${BASE}/conversations/search?${new URLSearchParams({ locationId: k.locationId, limit: "1" })}`],
  ];
  const results = await Promise.all(
    checks.map(async ([name, url]) => {
      const res = await fetch(url, { headers: headers(k.token), signal: AbortSignal.timeout(CRM_TIMEOUT_MS) }).catch(() => null);
      return res && (res.status === 401 || res.status === 403) ? name : null;
    })
  );
  return results.filter((r): r is string => r !== null);
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
      // The key can open the location but still lack what FollowUp needs (a Private Integration is given its
      // permissions one by one). Asked here, so a missing one is said at connect, in words, not found later as a
      // silent empty Today. One small read of each; nothing is changed.
      const missing = await missingPermissions(k);
      if (missing.length) {
        return {
          ok: false,
          message: `This key can't read ${missing.join(" or ")}. In GoHighLevel, open the Private Integration, turn on ${missing.join(" and ")} (read and write), save, and paste the key again.`,
        };
      }
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

  // "Read my notes" (A-303): GET /contacts/{contactId}/notes, the counterpart of the POST above. The SDK names the
  // response `notes`, each with id, body and dateAdded; read defensively, like everything here.
  async listNotes(apiKey, externalId) {
    const k = parseGhlKey(apiKey);
    if (!k) return [];
    try {
      const res = await fetch(`${BASE}/contacts/${encodeURIComponent(externalId)}/notes`, { headers: headers(k.token), signal: AbortSignal.timeout(CRM_TIMEOUT_MS) });
      if (!res.ok) return [];
      const data = (await res.json().catch(() => null)) as { notes?: unknown } | null;
      const rows = Array.isArray(data?.notes) ? (data.notes as Record<string, unknown>[]) : [];
      return rows.flatMap((r): CrmNote[] => {
        const id = str(r?.id);
        const body = typeof r?.body === "string" ? plainNote(r.body) : "";
        if (!id || !body) return [];
        return [{ id, body, at: readWhen(r.dateAdded).at }];
      });
    } catch {
      return [];
    }
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

  // The one-boss rule (A-237): when GoHighLevel last wrote to this person. Read from their newest conversation's last
  // message, counted only when it says it went out from the business; anything else is "unknown", which keeps
  // FollowUp waiting for the owner. The same person is often saved twice in GoHighLevel (a form and a text make two
  // contacts), and a workflow on the other one texts them all the same, so every contact with their phone or email
  // is asked too, and the latest answer counts (GHL pain #9, research 2026-10-17).
  async lastContactedAt(apiKey, externalId, person) {
    const k = parseGhlKey(apiKey);
    if (!k) return { known: false, at: null };
    try {
      const ids = [externalId, ...(await samePersonIds(k, externalId, person))];
      let latest: Date | null = null;
      for (const id of ids) {
        const one = await lastFromBusiness(k, id);
        if (!one.known) return { known: false, at: null };
        if (one.at && (!latest || one.at > latest)) latest = one.at;
      }
      return { known: true, at: latest };
    } catch {
      return { known: false, at: null };
    }
  },

  // Do Not Disturb on everything is the owner's "never". One channel only, and a meeting booked, are handled where
  // FollowUp sends (sending.ts) and holds (oneBoss.ts).
  async standing(apiKey, externalId) {
    const k = parseGhlKey(apiKey);
    if (!k) return null;
    try {
      const res = await fetch(`${BASE}/contacts/${encodeURIComponent(externalId)}`, { headers: headers(k.token), signal: AbortSignal.timeout(CRM_TIMEOUT_MS) });
      if (!res.ok) return null;
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const c = (data.contact ?? data) as Record<string, unknown>;
      return c.dnd === true ? "never" : null;
    } catch {
      return null;
    }
  },

  // Pipelines and their stages (GET /opportunities/pipelines, from the SDK, grade B). A stage is kept as
  // "pipelineId:stageId"; with more than one pipeline its name says which.
  async listStages(apiKey) {
    const k = parseGhlKey(apiKey);
    if (!k) return [];
    try {
      const q = new URLSearchParams({ locationId: k.locationId });
      const res = await fetch(`${BASE}/opportunities/pipelines?${q.toString()}`, { headers: headers(k.token), signal: AbortSignal.timeout(CRM_TIMEOUT_MS) });
      if (!res.ok) return [];
      const data = (await res.json().catch(() => ({}))) as { pipelines?: Array<Record<string, unknown>> };
      const pipelines = data.pipelines ?? [];
      const out: { id: string; name: string }[] = [];
      for (const p of pipelines) {
        const stages = (Array.isArray(p.stages) ? p.stages.flat() : []) as Array<Record<string, unknown>>;
        for (const s of stages) {
          const pid = str(p.id);
          const sid = str(s?.id);
          const sname = str(s?.name);
          if (!pid || !sid || !sname) continue;
          out.push({ id: `${pid}:${sid}`, name: pipelines.length > 1 ? `${str(p.name) ?? "Pipeline"} · ${sname}` : sname });
        }
      }
      return out;
    } catch {
      return [];
    }
  },

  // Their card (opportunity) moves to the stage; only someone with no card at all gets a new one, so nobody ever has
  // two (founder 2026-10-20: "no new cards but if customers doesn't have card we can make a new for them"). Their
  // card already in that pipeline first, then an open one, then any; a card in another pipeline moves across.
  // (GET /opportunities/search, PUT /opportunities/{id}, POST /opportunities/, from the SDK, grade B.)
  async moveToStage(apiKey, externalId, stageId, name) {
    const k = parseGhlKey(apiKey);
    if (!k) return { ok: false, message: "GoHighLevel key is not in the expected shape." };
    const [pipelineId, pipelineStageId] = stageId.split(":");
    if (!pipelineId || !pipelineStageId) return { ok: false, message: "That stage isn't in GoHighLevel any more." };
    try {
      const q = new URLSearchParams({ location_id: k.locationId, contact_id: externalId, limit: "20" });
      const found = await fetch(`${BASE}/opportunities/search?${q.toString()}`, { headers: headers(k.token), signal: AbortSignal.timeout(CRM_TIMEOUT_MS) });
      if (!found.ok) return { ok: false, message: `GoHighLevel returned ${found.status}.` };
      const data = (await found.json().catch(() => ({}))) as { opportunities?: Array<Record<string, unknown>> };
      const cards = (data.opportunities ?? []).filter((c) => str(c?.id));
      const card = cards.find((c) => str(c.pipelineId) === pipelineId) ?? cards.find((c) => str(c.status) === "open") ?? cards[0];
      const existing = str(card?.id);
      const res = existing
        ? await fetch(`${BASE}/opportunities/${encodeURIComponent(existing)}`, {
            method: "PUT",
            headers: headers(k.token, true),
            body: JSON.stringify({ pipelineId, pipelineStageId }),
            signal: AbortSignal.timeout(CRM_TIMEOUT_MS),
          })
        : await fetch(`${BASE}/opportunities/`, {
            method: "POST",
            headers: headers(k.token, true),
            body: JSON.stringify({ pipelineId, locationId: k.locationId, name, pipelineStageId, status: "open", contactId: externalId }),
            signal: AbortSignal.timeout(CRM_TIMEOUT_MS),
          });
      return res.ok ? { ok: true } : { ok: false, message: `GoHighLevel returned ${res.status}.` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "stage move failed" };
    }
  },
};

async function lastFromBusiness(k: { token: string; locationId: string }, contactId: string): Promise<{ known: boolean; at: Date | null }> {
  const q = new URLSearchParams({ locationId: k.locationId, contactId, sortBy: "last_message_date", sort: "desc", limit: "1" });
  const res = await fetch(`${BASE}/conversations/search?${q.toString()}`, { headers: headers(k.token), signal: AbortSignal.timeout(CRM_TIMEOUT_MS) });
  if (!res.ok) return { known: false, at: null };
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!data || !Array.isArray(data.conversations)) return { known: false, at: null };
  const convo = (data.conversations as Array<Record<string, unknown>>)[0];
  if (!convo) return { known: true, at: null };
  if (convo.lastMessageDirection !== "outbound" || !("lastMessageDate" in convo)) return { known: false, at: null };
  return readWhen(convo.lastMessageDate);
}

/** At most this many other contacts are asked about, so one check stays a handful of calls. */
const MAX_DUPLICATES = 4;

const digitsOf = (phone: string) => phone.replace(/\D/g, "").slice(-10);

/**
 * Other GoHighLevel contacts with this person's phone or email. Found with the contacts list's `query` (grade C: in
 * the SDK, not yet seen on a real account). If GoHighLevel can't be asked, it's the one contact, as before.
 */
async function samePersonIds(
  k: { token: string; locationId: string },
  externalId: string,
  person: { phone: string | null; email: string | null } | undefined
): Promise<string[]> {
  // A real phone number only: an Instagram or Messenger id in the phone field (ig:…, fb:…) matches nobody here.
  const phone = person?.phone && /^\+?[\d\s().-]{7,}$/.test(person.phone) && digitsOf(person.phone).length >= 7 ? digitsOf(person.phone) : null;
  const email = person?.email?.trim().toLowerCase() || null;
  const found = new Set<string>();
  for (const term of [phone, email]) {
    if (!term) continue;
    try {
      const q = new URLSearchParams({ locationId: k.locationId, query: term, limit: "10" });
      const res = await fetch(`${BASE}/contacts/?${q.toString()}`, { headers: headers(k.token), signal: AbortSignal.timeout(CRM_TIMEOUT_MS) });
      if (!res.ok) continue;
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const rows = Array.isArray(data.contacts) ? (data.contacts as Array<Record<string, unknown>>) : [];
      for (const c of rows.map(mapGhlContact)) {
        if (!c || c.externalId === externalId) continue;
        // The search is loose; only an exact phone or email counts as the same person.
        const samePhone = phone && c.phone && digitsOf(c.phone) === phone;
        const sameEmail = email && c.email && c.email.trim().toLowerCase() === email;
        if (samePhone || sameEmail) found.add(c.externalId);
      }
    } catch {
      // Not asked: the contact itself still is.
    }
  }
  return [...found].slice(0, MAX_DUPLICATES);
}

// ---------------------------------------------------------------------------
// Messages (GHL 2, founder 2026-10-16 "yes go ahead"): FollowUp reads the customers' texts and emails that arrive in
// GoHighLevel, and its replies go out through GoHighLevel, from the owner's own number and email there.
//
// From the SDK: GET /conversations/search (locationId, sortBy, sort, limit), GET /conversations/{id}/messages (limit),
// POST /conversations/messages { type, contactId, message, subject, html } → { conversationId, messageId }, and a
// message's id, messageType, direction, body, dateAdded, contactId, conversationId.
//
// NOT confirmed (grade C, check on a real account): the messageType strings ("TYPE_SMS", "TYPE_EMAIL",
// "TYPE_FACEBOOK", "TYPE_INSTAGRAM", "TYPE_WHATSAPP") and the send types ("SMS", "Email", "FB", "IG", "WhatsApp"); whether the messages list comes back wrapped in a second `messages` object (both are read); and
// whether an email's body comes back as HTML (tags are taken out either way).
// ---------------------------------------------------------------------------

/**
 * The GoHighLevel channels FollowUp reads and answers: texts and emails, and the Facebook, Instagram and WhatsApp
 * messages that land in GoHighLevel's inbox (founder, 2026-10-17: "fix the weak points"). Calls, reviews, live chat
 * and the rest are left alone. FollowUp's own channel names, so everything downstream treats them as it treats the
 * same channel connected directly.
 */
export type GhlChannel = "text" | "email" | "messenger" | "instagram" | "whatsapp";

const READ_AS: Record<string, GhlChannel> = {
  TYPE_SMS: "text",
  SMS: "text",
  TYPE_EMAIL: "email",
  EMAIL: "email",
  TYPE_FACEBOOK: "messenger",
  FB: "messenger",
  TYPE_INSTAGRAM: "instagram",
  IG: "instagram",
  TYPE_WHATSAPP: "whatsapp",
  WHATSAPP: "whatsapp",
};

/** What POST /conversations/messages calls each channel (the `type` field). */
const SEND_AS: Record<GhlChannel, string> = { text: "SMS", email: "Email", messenger: "FB", instagram: "IG", whatsapp: "WhatsApp" };

export function ghlChannelOf(messageType: unknown): GhlChannel | null {
  if (typeof messageType !== "string") return null;
  return READ_AS[messageType.toUpperCase()] ?? null;
}

export function isGhlChannel(channel: string): channel is GhlChannel {
  return channel in SEND_AS;
}

export interface GhlMessage {
  id: string;
  conversationId: string;
  contactId: string;
  channel: GhlChannel;
  direction: "inbound" | "outbound";
  body: string;
  at: Date;
}

function plainText(raw: string): string {
  if (!/<[a-z][\s\S]*>/i.test(raw)) return raw.trim();
  return raw
    .replace(/<(br|\/p|\/div)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** One GoHighLevel message as FollowUp keeps it, or null for anything it doesn't read (a call, a DM, no text). */
export function mapGhlMessage(m: Record<string, unknown>): GhlMessage | null {
  const id = str(m.id);
  const conversationId = str(m.conversationId);
  const contactId = str(m.contactId);
  const channel = ghlChannelOf(m.messageType);
  const direction = m.direction === "inbound" || m.direction === "outbound" ? m.direction : null;
  const added = str(m.dateAdded);
  const at = added && !Number.isNaN(Date.parse(added)) ? new Date(added) : null;
  const body = typeof m.body === "string" ? plainText(m.body).slice(0, 5000) : "";
  if (!id || !conversationId || !contactId || !channel || !direction || !at || !body) return null;
  return { id, conversationId, contactId, channel, direction, body, at };
}

/** When a conversation's newest message landed (GoHighLevel writes milliseconds; a date string reads too). */
function lastMessageAt(c: Record<string, unknown>): Date | null {
  const r = readWhen(c.lastMessageDate);
  return r.known ? r.at : null;
}

/**
 * The conversations with something newer than `since`, newest first, at most `limit`. A conversation whose date
 * can't be read is kept: reading it again costs one request, missing a customer costs the customer.
 */
export async function ghlConversationsSince(apiKey: string, since: Date, limit: number): Promise<Array<{ id: string; contactId: string }>> {
  const k = parseGhlKey(apiKey);
  if (!k) throw new Error("GoHighLevel key is not in the expected shape.");
  const q = new URLSearchParams({ locationId: k.locationId, sortBy: "last_message_date", sort: "desc", limit: String(limit) });
  const res = await fetch(`${BASE}/conversations/search?${q.toString()}`, { headers: headers(k.token), signal: AbortSignal.timeout(CRM_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`GoHighLevel returned ${res.status} listing conversations.`);
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const rows = Array.isArray(data.conversations) ? (data.conversations as Array<Record<string, unknown>>) : [];
  const out: Array<{ id: string; contactId: string }> = [];
  for (const c of rows) {
    const id = str(c.id);
    const contactId = str(c.contactId);
    if (!id || !contactId) continue;
    const at = lastMessageAt(c);
    if (at && at < since) continue;
    out.push({ id, contactId });
  }
  return out;
}

/**
 * One page of conversations whose newest message is older than `before`, newest first, with that date
 * (GoHighLevel wake-up, src/lib/ghlHistory.ts). GoHighLevel pages a date-sorted search by `startAfterDate`, the
 * sort value of the last row seen (its API reference; not yet seen on a live account). Rows at or after `before`
 * are dropped here as well, so an account that ignores the parameter is never read as old. `full` says the page
 * came back full, so there may be more.
 */
export async function ghlConversationsBefore(
  apiKey: string,
  before: Date,
  limit: number
): Promise<{ rows: Array<{ id: string; contactId: string; lastMessageAt: Date }>; full: boolean }> {
  const k = parseGhlKey(apiKey);
  if (!k) throw new Error("GoHighLevel key is not in the expected shape.");
  const q = new URLSearchParams({
    locationId: k.locationId,
    sortBy: "last_message_date",
    sort: "desc",
    startAfterDate: String(before.getTime()),
    limit: String(limit),
  });
  const res = await fetch(`${BASE}/conversations/search?${q.toString()}`, { headers: headers(k.token), signal: AbortSignal.timeout(CRM_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`GoHighLevel returned ${res.status} listing conversations.`);
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const all = Array.isArray(data.conversations) ? (data.conversations as Array<Record<string, unknown>>) : [];
  const rows: Array<{ id: string; contactId: string; lastMessageAt: Date }> = [];
  for (const c of all) {
    const id = str(c.id);
    const contactId = str(c.contactId);
    const at = lastMessageAt(c);
    if (!id || !contactId || !at || at >= before) continue;
    rows.push({ id, contactId, lastMessageAt: at });
  }
  return { rows, full: all.length >= limit };
}

/** The newest messages in one conversation (texts and emails only). */
export async function ghlConversationMessages(apiKey: string, conversationId: string, limit: number): Promise<GhlMessage[]> {
  const k = parseGhlKey(apiKey);
  if (!k) throw new Error("GoHighLevel key is not in the expected shape.");
  const res = await fetch(`${BASE}/conversations/${encodeURIComponent(conversationId)}/messages?limit=${limit}`, {
    headers: headers(k.token),
    signal: AbortSignal.timeout(CRM_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`GoHighLevel returned ${res.status} reading a conversation.`);
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const inner = data.messages && !Array.isArray(data.messages) ? (data.messages as Record<string, unknown>).messages : data.messages;
  const rows = Array.isArray(inner) ? (inner as Array<Record<string, unknown>>) : [];
  return rows
    .map((m) => mapGhlMessage({ conversationId, ...m }))
    .filter((m): m is GhlMessage => m !== null);
}

/** One contact, for a customer who writes before the contact sync has brought them in. */
export async function ghlContact(apiKey: string, contactId: string): Promise<CrmPerson | null> {
  const k = parseGhlKey(apiKey);
  if (!k) return null;
  const res = await fetch(`${BASE}/contacts/${encodeURIComponent(contactId)}`, { headers: headers(k.token), signal: AbortSignal.timeout(CRM_TIMEOUT_MS) });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const c = (data.contact ?? data) as Record<string, unknown>;
  return mapGhlContact(c);
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * A reply, sent through GoHighLevel from the owner's own number or email there. Returns the message id GoHighLevel
 * gave it, so the poller's read-back of the same message lands on the row FollowUp already wrote. `status` carries
 * the HTTP status so the caller can tell a bad moment (429, 5xx) from a refusal.
 */
export async function sendGhlMessage(
  apiKey: string,
  msg: { channel: GhlChannel; contactId: string; body: string; subject?: string }
): Promise<{ success: true; messageId?: string } | { success: false; message: string; status?: number }> {
  const k = parseGhlKey(apiKey);
  if (!k) return { success: false, message: "GoHighLevel isn't connected the right way. Connect it again in Settings." };
  const payload =
    msg.channel === "email"
      ? { type: "Email", contactId: msg.contactId, subject: msg.subject, message: msg.body, html: escapeHtml(msg.body).replace(/\n/g, "<br>") }
      : { type: SEND_AS[msg.channel], contactId: msg.contactId, message: msg.body };
  const res = await fetch(`${BASE}/conversations/messages`, {
    method: "POST",
    headers: headers(k.token, true),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(CRM_TIMEOUT_MS),
  });
  if (res.status === 401 || res.status === 403)
    return { success: false, status: res.status, message: "GoHighLevel didn't accept the key. Connect it again in Settings with a key that can send messages." };
  if (!res.ok) {
    const said = await res.text().catch(() => "");
    return { success: false, status: res.status, message: ghlSendRefusal(res.status, said, msg.channel) };
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { success: true, messageId: str(data.messageId) ?? undefined };
}

// ---------------------------------------------------------------------------
// Working alongside GoHighLevel (founder 2026-10-17: "fix … the coordination").
// From the SDK (grade B, not yet called on a real account): a contact's `dnd` (everything) and `dndSettings` per
// channel ({ status: "active" | "inactive" | "permanent" }), and GET /contacts/{id}/appointments → { events:
// [{ startTime, appointmentStatus }] }. Facebook's setting stands for Instagram too (grade C).
// ---------------------------------------------------------------------------

const DND_AS: Record<GhlChannel, string> = { text: "SMS", email: "Email", whatsapp: "WhatsApp", messenger: "FB", instagram: "FB" };

/**
 * Whether the owner marked this person Do Not Disturb in GoHighLevel: for this channel, or for everything when no
 * channel is given. Null when it can't tell (GoHighLevel didn't answer). Each caller decides what that means: the
 * owner's own Send still goes (GoHighLevel refuses its own sends to them anyway), but nothing FollowUp does on its
 * own goes ahead on a "don't know" (founder 2026-10-19, before the first real account: "we cant take risk").
 */
export async function ghlDoNotDisturb(apiKey: string, contactId: string, channel?: GhlChannel): Promise<boolean | null> {
  const k = parseGhlKey(apiKey);
  if (!k) return null;
  try {
    const res = await fetch(`${BASE}/contacts/${encodeURIComponent(contactId)}`, { headers: headers(k.token), signal: AbortSignal.timeout(CRM_TIMEOUT_MS) });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const c = (data.contact ?? data) as Record<string, unknown>;
    if (c.dnd === true) return true;
    const settings = (c.dndSettings ?? {}) as Record<string, { status?: unknown } | undefined>;
    const on = (key: string) => {
      const status = settings[key]?.status;
      return status === "active" || status === "permanent";
    };
    return channel ? on(DND_AS[channel]) : Object.keys(settings).some(on);
  } catch {
    return null;
  }
}

/** Appointment states that are not a meeting still to come. */
const NOT_A_MEETING = new Set(["cancelled", "canceled", "invalid", "noshow", "no_show", "showed"]);

/** Their next meeting booked in GoHighLevel, if any. Can't tell reads as none, as before this existed. */
export async function ghlUpcomingMeeting(apiKey: string, contactId: string, now: Date = new Date()): Promise<Date | null> {
  const k = parseGhlKey(apiKey);
  if (!k) return null;
  try {
    const res = await fetch(`${BASE}/contacts/${encodeURIComponent(contactId)}/appointments`, { headers: headers(k.token), signal: AbortSignal.timeout(CRM_TIMEOUT_MS) });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const events = Array.isArray(data.events) ? (data.events as Array<Record<string, unknown>>) : [];
    let next: Date | null = null;
    for (const e of events) {
      const status = String(e.appointmentStatus ?? e.status ?? "").toLowerCase();
      if (NOT_A_MEETING.has(status)) continue;
      const at = typeof e.startTime === "string" || typeof e.startTime === "number" ? new Date(e.startTime) : null;
      if (!at || Number.isNaN(at.getTime()) || at <= now) continue;
      if (!next || at < next) next = at;
    }
    return next;
  } catch {
    return null;
  }
}

const SAYS_CHANNEL: Record<GhlChannel, string> = { text: "text", email: "email", whatsapp: "WhatsApp", messenger: "Facebook message", instagram: "Instagram message" };

/**
 * Why GoHighLevel didn't send it, in the owner's words, with what to do (GHL pain #4: "nobody tells you why").
 * Read from what GoHighLevel said back; anything it didn't explain says so plainly.
 */
export function ghlSendRefusal(status: number, said: string, channel: GhlChannel): string {
  const t = said.toLowerCase();
  const what = SAYS_CHANNEL[channel];
  if (/\bdnd\b|do not disturb/.test(t)) return `GoHighLevel didn't send this ${what}: they're marked Do Not Disturb there.`;
  if (/10dlc|a2p|not registered|registration|brand|campaign/.test(t))
    return "GoHighLevel didn't send this text: your number isn't registered for business texting yet. Finish that in GoHighLevel, or reply by email for now.";
  if (/balance|wallet|credit|insufficient|funds/.test(t)) return `GoHighLevel didn't send this ${what}: your GoHighLevel wallet is out of credit. Top it up there, then send again.`;
  if (/phone|number/.test(t) && channel !== "email") return `GoHighLevel didn't send this ${what}: it doesn't have a working number for them.`;
  if (/email/.test(t) && channel === "email") return "GoHighLevel didn't send this email: it doesn't have a working email address for them.";
  if (status === 429) return `GoHighLevel is busy right now and didn't send this ${what}. FollowUp will try again shortly.`;
  if (status >= 500) return `GoHighLevel had a problem on its side and didn't send this ${what}. FollowUp will try again shortly.`;
  return `GoHighLevel didn't send this ${what}, and didn't say why. Check the conversation in GoHighLevel.`;
}
