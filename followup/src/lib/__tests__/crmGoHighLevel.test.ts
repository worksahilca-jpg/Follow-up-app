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
