/**
 * "Missed by your CRM" (A-315): adding a customer to each CRM. Checked against what each CRM documents (Follow Up Boss
 * /people with deduplicate, HubSpot contacts with its 409 for a taken email, HighLevel's SDK upsert); no real CRM is
 * called.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { followUpBossClient } from "@/lib/crm/followupboss";
import { hubspotClient } from "@/lib/crm/hubspot";
import { goHighLevelClient, packGhlKey } from "@/lib/crm/gohighlevel";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const PRIYA = { firstName: "Priya", lastName: "Shah", email: "priya@example.com", phone: "+14165550101" };
const body = () => JSON.parse(fetchMock.mock.calls[0][1].body as string);

describe("Follow Up Boss", () => {
  it("adds a person, finding an existing one instead of a second copy, without starting action plans", async () => {
    fetchMock.mockResolvedValue(reply(201, { id: 4021, firstName: "Priya" }));
    expect(await followUpBossClient.createPerson("key", PRIYA)).toEqual({ ok: true, externalId: "4021" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.followupboss.com/v1/people?deduplicate=true");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from("key:").toString("base64")}`);
    expect(body()).toEqual({ firstName: "Priya", lastName: "Shah", emails: [{ value: "priya@example.com" }], phones: [{ value: "+14165550101" }], source: "FollowUp" });
  });

  it("sends no name when there is none", async () => {
    fetchMock.mockResolvedValue(reply(200, { id: 7 }));
    await followUpBossClient.createPerson("key", { firstName: "", lastName: "", email: null, phone: "+14165550101" });
    expect(body()).toEqual({ phones: [{ value: "+14165550101" }], source: "FollowUp" });
  });

  it("says what to do when it didn't take them, never a status code, and never throws", async () => {
    fetchMock.mockResolvedValue(reply(401, {}));
    expect(await followUpBossClient.createPerson("key", PRIYA)).toEqual({ ok: false, message: "Follow Up Boss didn't accept FollowUp's key. Connect it again in Settings, under Connected apps." });
    fetchMock.mockResolvedValue(reply(200, {}));
    expect((await followUpBossClient.createPerson("key", PRIYA)).ok).toBe(false);
    fetchMock.mockRejectedValue(new Error("network down"));
    expect(await followUpBossClient.createPerson("key", PRIYA)).toEqual({ ok: false, message: "Couldn't reach Follow Up Boss. Try again in a minute." });
  });
});

describe("HubSpot", () => {
  it("adds a contact with its properties", async () => {
    fetchMock.mockResolvedValue(reply(201, { id: "901" }));
    expect(await hubspotClient.createPerson("tok", PRIYA)).toEqual({ ok: true, externalId: "901" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.hubapi.com/crm/v3/objects/contacts");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(body()).toEqual({ properties: { firstname: "Priya", lastname: "Shah", email: "priya@example.com", phone: "+14165550101" } });
  });

  it("uses the contact HubSpot already has for that email", async () => {
    fetchMock.mockResolvedValue(reply(409, { status: "error", message: "Contact already exists. Existing ID: 55501" }));
    expect(await hubspotClient.createPerson("tok", PRIYA)).toEqual({ ok: true, externalId: "55501" });
  });

  it("says so when HubSpot won't say which contact it is", async () => {
    fetchMock.mockResolvedValue(reply(409, { message: "Conflict" }));
    expect(await hubspotClient.createPerson("tok", PRIYA)).toEqual({ ok: false, message: "HubSpot already has this email under another contact." });
    fetchMock.mockResolvedValue(reply(500, {}));
    expect(await hubspotClient.createPerson("tok", PRIYA)).toEqual({ ok: false, message: "HubSpot didn't take them. Try again in a minute." });
  });
});

describe("GoHighLevel", () => {
  const KEY = packGhlKey("loc123ABC", "pit-0000-1111-2222");

  it("upserts the contact in the owner's location", async () => {
    fetchMock.mockResolvedValue(reply(200, { new: true, contact: { id: "ghl-77" } }));
    expect(await goHighLevelClient.createPerson(KEY, PRIYA)).toEqual({ ok: true, externalId: "ghl-77" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://services.leadconnectorhq.com/contacts/upsert");
    expect(init.headers).toMatchObject({ Authorization: "Bearer pit-0000-1111-2222", Version: "2023-02-21" });
    expect(body()).toEqual({ locationId: "loc123ABC", firstName: "Priya", lastName: "Shah", email: "priya@example.com", phone: "+14165550101", source: "FollowUp" });
  });

  it("refuses a key in the wrong shape and a reply with no contact", async () => {
    expect((await goHighLevelClient.createPerson("only-a-key", PRIYA)).ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValue(reply(200, { new: false }));
    expect((await goHighLevelClient.createPerson(KEY, PRIYA)).ok).toBe(false);
  });
});
