/**
 * One boss per customer (founder, 2026-10-12, A-237): FollowUp asks the CRM
 * when it last contacted a customer, and steps back only while the CRM is
 * following up. Anything it can't find out counts as "following up", which
 * is how it behaved before.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const h = vi.hoisted(() => ({ conn: vi.fn(), lastContactedAt: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: { crmConnection: { findUnique: h.conn } } }));
vi.mock("@/lib/crm", () => ({
  isCrmProvider: (v: string) => v === "followupboss" || v === "hubspot",
  CRM_PROVIDERS: {
    followupboss: { label: "Follow Up Boss", client: { lastContactedAt: h.lastContactedAt } },
    hubspot: { label: "HubSpot", client: { lastContactedAt: h.lastContactedAt } },
  },
}));

import { crmIsFollowingUp } from "@/lib/crm/oneBoss";
import { followUpBossClient } from "@/lib/crm/followupboss";
import { hubspotClient } from "@/lib/crm/hubspot";

const now = new Date("2026-10-12T15:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
const lead = { businessId: "biz1", crmProvider: "followupboss", crmId: "fub-1" };

beforeEach(() => {
  vi.resetAllMocks();
  h.conn.mockResolvedValue({ provider: "followupboss", apiKey: "key" });
});

describe("crmIsFollowingUp", () => {
  it("is following up when the CRM contacted them in the last two weeks", async () => {
    h.lastContactedAt.mockResolvedValue({ known: true, at: daysAgo(3) });
    expect(await crmIsFollowingUp(lead, null, now)).toBe(true);
    expect(h.lastContactedAt).toHaveBeenCalledWith("key", "fub-1");
  });

  it("is not when the CRM last contacted them over two weeks ago, or never", async () => {
    h.lastContactedAt.mockResolvedValue({ known: true, at: daysAgo(20) });
    expect(await crmIsFollowingUp(lead, null, now)).toBe(false);
    h.lastContactedAt.mockResolvedValue({ known: true, at: null });
    expect(await crmIsFollowingUp(lead, null, now)).toBe(false);
  });

  it("doesn't count FollowUp's own note, written just after its send", async () => {
    const ourSend = daysAgo(2);
    h.lastContactedAt.mockResolvedValue({ known: true, at: new Date(ourSend.getTime() + 60_000) });
    expect(await crmIsFollowingUp(lead, ourSend, now)).toBe(false);
  });

  it("counts the CRM's own contact after that", async () => {
    const ourSend = daysAgo(5);
    h.lastContactedAt.mockResolvedValue({ known: true, at: daysAgo(1) });
    expect(await crmIsFollowingUp(lead, ourSend, now)).toBe(true);
  });

  it("waits for the owner when it can't find out", async () => {
    h.lastContactedAt.mockResolvedValue({ known: false, at: null });
    expect(await crmIsFollowingUp(lead, null, now)).toBe(true);
    h.lastContactedAt.mockRejectedValue(new Error("down"));
    expect(await crmIsFollowingUp(lead, null, now)).toBe(true);
    h.conn.mockResolvedValue(null);
    expect(await crmIsFollowingUp(lead, null, now)).toBe(true);
    h.conn.mockResolvedValue({ provider: "hubspot", apiKey: "key" });
    expect(await crmIsFollowingUp(lead, null, now)).toBe(true);
  });

  it("is not asked for a customer who isn't in a CRM", async () => {
    expect(await crmIsFollowingUp({ businessId: "biz1", crmProvider: null, crmId: null }, null, now)).toBe(false);
    expect(h.conn).not.toHaveBeenCalled();
  });
});

describe("asking each CRM", () => {
  const fetchMock = vi.fn();
  beforeEach(() => vi.stubGlobal("fetch", fetchMock));
  afterEach(() => vi.unstubAllGlobals());
  const reply = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });

  it("Follow Up Boss: the person's lastActivity, only when it is there", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { id: 7, lastActivity: "2026-10-10T12:00:00Z" }));
    expect(await followUpBossClient.lastContactedAt("key", "7")).toEqual({ known: true, at: new Date("2026-10-10T12:00:00Z") });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.followupboss.com/v1/people/7");

    fetchMock.mockResolvedValueOnce(reply(200, { id: 7 }));
    expect(await followUpBossClient.lastContactedAt("key", "7")).toEqual({ known: false, at: null });
    fetchMock.mockResolvedValueOnce(reply(404, {}));
    expect(await followUpBossClient.lastContactedAt("key", "7")).toEqual({ known: false, at: null });
  });

  it("HubSpot: Last contacted, where null means never", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { id: "9", properties: { notes_last_contacted: "2026-10-01T09:30:00.000Z" } }));
    expect(await hubspotClient.lastContactedAt("tok", "9")).toEqual({ known: true, at: new Date("2026-10-01T09:30:00.000Z") });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.hubapi.com/crm/v3/objects/contacts/9?properties=notes_last_contacted");

    fetchMock.mockResolvedValueOnce(reply(200, { id: "9", properties: { notes_last_contacted: null } }));
    expect(await hubspotClient.lastContactedAt("tok", "9")).toEqual({ known: true, at: null });
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    expect(await hubspotClient.lastContactedAt("tok", "9")).toEqual({ known: false, at: null });
  });
});
