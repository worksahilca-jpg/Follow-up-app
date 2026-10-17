/**
 * GoHighLevel, option A (founder, 2026-10-16): a Private Integration key plus the Location ID, pasted once. The
 * requests below are checked against what HighLevel's own SDK sends; no real GoHighLevel account is called.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { goHighLevelClient, mapGhlContact, packGhlKey, parseGhlKey } from "@/lib/crm/gohighlevel";

const KEY = packGhlKey(" loc123ABC ", " pit-0000-1111-2222 ");
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe("the pasted key", () => {
  it("keeps the Location ID and the key together and reads them back", () => {
    expect(KEY).toBe("loc123ABC|pit-0000-1111-2222");
    expect(parseGhlKey(KEY)).toEqual({ locationId: "loc123ABC", token: "pit-0000-1111-2222" });
  });

  it("refuses anything that isn't both", () => {
    expect(parseGhlKey("pit-0000-1111-2222")).toBeNull();
    expect(parseGhlKey("loc123ABC|")).toBeNull();
    expect(parseGhlKey("bad id!|pit-0000-1111-2222")).toBeNull();
  });
});

describe("testConnection", () => {
  it("asks for the location with a Bearer key and the Version header, and names it", async () => {
    fetchMock.mockResolvedValue(reply(200, { location: { name: "Priya Sharma Realty" } }));
    const r = await goHighLevelClient.testConnection(KEY);
    expect(r).toEqual({ ok: true, accountLabel: "Priya Sharma Realty" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://services.leadconnectorhq.com/locations/loc123ABC");
    expect(init.headers).toMatchObject({ Authorization: "Bearer pit-0000-1111-2222", Version: "2023-02-21" });
  });

  it("says what to fix in plain words", async () => {
    fetchMock.mockResolvedValue(reply(401, {}));
    expect((await goHighLevelClient.testConnection(KEY)).message).toMatch(/didn't accept that key/);
    fetchMock.mockResolvedValue(reply(404, {}));
    expect((await goHighLevelClient.testConnection(KEY)).message).toMatch(/doesn't know that Location ID/);
    expect((await goHighLevelClient.testConnection("only-a-key")).message).toMatch(/both/);
  });
});

describe("contacts", () => {
  it("reads a contact defensively", () => {
    expect(mapGhlContact({ id: "c1", firstName: "Raj", lastName: "Malhotra", email: "raj@example.com", phone: "+14165550101", dateAdded: "2026-10-13T19:32:00Z" })).toEqual({
      externalId: "c1",
      name: "Raj Malhotra",
      email: "raj@example.com",
      phone: "+14165550101",
      createdAt: new Date("2026-10-13T19:32:00Z"),
    });
    expect(mapGhlContact({ id: "c2", contactName: "Lin Wei" })?.name).toBe("Lin Wei");
    expect(mapGhlContact({ id: "c3" })?.name).toBe("GoHighLevel contact");
    expect(mapGhlContact({})).toBeNull();
  });

  it("pages with the location and the cursor GoHighLevel returned", async () => {
    const full = Array.from({ length: 100 }, (_, i) => ({ id: `c${i}` }));
    fetchMock.mockResolvedValue(reply(200, { contacts: full, meta: { startAfterId: "c99", startAfter: 1760000000000 } }));
    const page = await goHighLevelClient.fetchPage(KEY, null, null);
    expect(page.people).toHaveLength(100);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe("c99|1760000000000");
    expect(fetchMock.mock.calls[0][0]).toBe("https://services.leadconnectorhq.com/contacts/?locationId=loc123ABC&limit=100");

    fetchMock.mockResolvedValue(reply(200, { contacts: [{ id: "c100" }], meta: {} }));
    const last = await goHighLevelClient.fetchPage(KEY, page.nextCursor, null);
    expect(fetchMock.mock.calls[1][0]).toContain("startAfterId=c99&startAfter=1760000000000");
    expect(last).toMatchObject({ hasMore: false, nextCursor: null });
  });
});

describe("notes and the one-boss rule", () => {
  it("adds a note on the contact", async () => {
    fetchMock.mockResolvedValue(reply(201, {}));
    expect(await goHighLevelClient.pushNote(KEY, "c1", "FollowUp replied.")).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://services.leadconnectorhq.com/contacts/c1/notes");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ body: "FollowUp replied." });
  });

  it("counts only a message that went out from the business", async () => {
    fetchMock.mockResolvedValue(reply(200, { conversations: [{ lastMessageDirection: "outbound", lastMessageDate: "2026-10-15T10:00:00Z" }] }));
    expect(await goHighLevelClient.lastContactedAt(KEY, "c1")).toEqual({ known: true, at: new Date("2026-10-15T10:00:00Z") });
    fetchMock.mockResolvedValue(reply(200, { conversations: [{ lastMessageDirection: "inbound", lastMessageDate: "2026-10-15T10:00:00Z" }] }));
    expect(await goHighLevelClient.lastContactedAt(KEY, "c1")).toEqual({ known: false, at: null });
    fetchMock.mockResolvedValue(reply(200, { conversations: [] }));
    expect(await goHighLevelClient.lastContactedAt(KEY, "c1")).toEqual({ known: true, at: null });
    fetchMock.mockResolvedValue(reply(500, {}));
    expect(await goHighLevelClient.lastContactedAt(KEY, "c1")).toEqual({ known: false, at: null });
  });
});

// GHL 2: reading texts and emails, and replying through GoHighLevel.
import { ghlChannelOf, ghlConversationMessages, ghlConversationsSince, mapGhlMessage, sendGhlMessage } from "@/lib/crm/gohighlevel";

describe("a GoHighLevel message", () => {
  const base = { id: "m1", conversationId: "c1", contactId: "ct1", messageType: "TYPE_SMS", direction: "inbound", body: "Is it still for sale?", dateAdded: "2026-10-16T20:00:00.000Z" };

  it("reads texts, emails, Facebook, Instagram and WhatsApp, and leaves calls and the rest alone", () => {
    expect(ghlChannelOf("TYPE_SMS")).toBe("text");
    expect(ghlChannelOf("TYPE_EMAIL")).toBe("email");
    expect(ghlChannelOf("TYPE_FACEBOOK")).toBe("messenger");
    expect(ghlChannelOf("TYPE_INSTAGRAM")).toBe("instagram");
    expect(ghlChannelOf("TYPE_WHATSAPP")).toBe("whatsapp");
    expect(ghlChannelOf("TYPE_CALL")).toBeNull();
    expect(ghlChannelOf("TYPE_GMB")).toBeNull();
    expect(ghlChannelOf(undefined)).toBeNull();
  });

  it("sends Facebook, Instagram and WhatsApp replies with GoHighLevel's own type names", async () => {
    fetchMock.mockResolvedValue(reply(201, { messageId: "x" }));
    for (const [channel, type] of [["messenger", "FB"], ["instagram", "IG"], ["whatsapp", "WhatsApp"]] as const) {
      await sendGhlMessage(KEY, { channel, contactId: "ct1", body: "Hi" });
      expect(JSON.parse(fetchMock.mock.calls.at(-1)![1].body)).toEqual({ type, contactId: "ct1", message: "Hi" });
    }
  });

  it("keeps the words, the side and the time", () => {
    expect(mapGhlMessage(base)).toEqual({
      id: "m1",
      conversationId: "c1",
      contactId: "ct1",
      channel: "text",
      direction: "inbound",
      body: "Is it still for sale?",
      at: new Date("2026-10-16T20:00:00.000Z"),
    });
  });

  it("takes the tags out of an email that comes back as HTML", () => {
    const m = mapGhlMessage({ ...base, messageType: "TYPE_EMAIL", body: "<p>Hi Priya,</p><p>Can we see it Saturday?&nbsp;Thanks</p>" });
    expect(m?.body).toBe("Hi Priya,\nCan we see it Saturday? Thanks");
  });

  it("skips anything it can't place: no words, no time, no side", () => {
    expect(mapGhlMessage({ ...base, body: "" })).toBeNull();
    expect(mapGhlMessage({ ...base, dateAdded: "not a date" })).toBeNull();
    expect(mapGhlMessage({ ...base, direction: "sideways" })).toBeNull();
    expect(mapGhlMessage({ ...base, messageType: "TYPE_CALL" })).toBeNull();
  });
});

describe("reading conversations", () => {
  it("asks for the newest first and keeps only those with something new (or no readable date)", async () => {
    const since = new Date("2026-10-16T20:00:00.000Z");
    fetchMock.mockResolvedValue(
      reply(200, {
        conversations: [
          { id: "new", contactId: "a", lastMessageDate: Date.parse("2026-10-16T20:05:00.000Z") },
          { id: "unknown", contactId: "b" },
          { id: "old", contactId: "c", lastMessageDate: Date.parse("2026-10-16T19:00:00.000Z") },
          { id: "no-contact" },
        ],
      })
    );
    expect(await ghlConversationsSince(KEY, since, 25)).toEqual([
      { id: "new", contactId: "a" },
      { id: "unknown", contactId: "b" },
    ]);
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe("/conversations/search");
    expect(Object.fromEntries(url.searchParams)).toEqual({ locationId: "loc123ABC", sortBy: "last_message_date", sort: "desc", limit: "25" });
  });

  it("reads messages whether GoHighLevel wraps the list or not", async () => {
    const msg = { id: "m1", contactId: "ct1", messageType: "TYPE_SMS", direction: "inbound", body: "Hi", dateAdded: "2026-10-16T20:00:00.000Z" };
    fetchMock.mockResolvedValueOnce(reply(200, { messages: { lastMessageId: "m1", nextPage: false, messages: [msg] } }));
    fetchMock.mockResolvedValueOnce(reply(200, { messages: [msg] }));
    expect((await ghlConversationMessages(KEY, "c1", 20)).map((m) => m.conversationId)).toEqual(["c1"]);
    expect((await ghlConversationMessages(KEY, "c1", 20)).map((m) => m.id)).toEqual(["m1"]);
    expect(fetchMock.mock.calls[0][0]).toBe("https://services.leadconnectorhq.com/conversations/c1/messages?limit=20");
  });

  it("says so when GoHighLevel refuses, so the tick doesn't count it as nothing new", async () => {
    fetchMock.mockResolvedValue(reply(401, {}));
    await expect(ghlConversationsSince(KEY, new Date(), 25)).rejects.toThrow("401");
  });
});

describe("replying through GoHighLevel", () => {
  it("sends a text as SMS to the contact", async () => {
    fetchMock.mockResolvedValue(reply(201, { conversationId: "c1", messageId: "sent1" }));
    expect(await sendGhlMessage(KEY, { channel: "text", contactId: "ct1", body: "Saturday works." })).toEqual({ success: true, messageId: "sent1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://services.leadconnectorhq.com/conversations/messages");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ type: "SMS", contactId: "ct1", message: "Saturday works." });
  });

  it("sends an email with a subject and safe HTML", async () => {
    fetchMock.mockResolvedValue(reply(201, { messageId: "sent2" }));
    await sendGhlMessage(KEY, { channel: "email", contactId: "ct1", body: "Hi <Nadia>\nSee you Saturday.", subject: "Saturday" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      type: "Email",
      contactId: "ct1",
      subject: "Saturday",
      message: "Hi <Nadia>\nSee you Saturday.",
      html: "Hi &lt;Nadia&gt;<br>See you Saturday.",
    });
  });

  it("passes the status back, and says what to do when the key is refused", async () => {
    fetchMock.mockResolvedValue(reply(401, {}));
    const r = await sendGhlMessage(KEY, { channel: "text", contactId: "ct1", body: "x" });
    expect(r).toMatchObject({ success: false, status: 401 });
    expect(r.success ? "" : r.message).toContain("Connect it again");
    fetchMock.mockResolvedValue(reply(503, {}));
    expect(await sendGhlMessage(KEY, { channel: "text", contactId: "ct1", body: "x" })).toMatchObject({ success: false, status: 503 });
  });
});

describe("connect checks what the key can read", () => {
  it("says which permission is missing, in words, before saving", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes("/conversations/") ? reply(403, {}) : reply(200, { location: { name: "Priya Sharma Realty" }, contacts: [] })
    );
    const r = await goHighLevelClient.testConnection(KEY);
    expect(r.ok).toBe(false);
    expect(r.message).toContain("conversations");
    expect(r.message).not.toContain("contacts or");
  });

  it("connects when both can be read", async () => {
    fetchMock.mockResolvedValue(reply(200, { location: { name: "Priya Sharma Realty" } }));
    expect(await goHighLevelClient.testConnection(KEY)).toEqual({ ok: true, accountLabel: "Priya Sharma Realty" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
