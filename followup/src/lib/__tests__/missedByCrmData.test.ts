/**
 * "Missed by your CRM" (A-315), the data half: nobody is called missing before the whole CRM was checked, only
 * eligible customers are touched, an add links them and writes the note, the first Add turns on "by themselves"
 * (never after the owner turned it off), and "by themselves" only ever adds new customers.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    crmConnection: { findUnique: vi.fn(), update: vi.fn() },
    lead: { findMany: vi.fn(), updateMany: vi.fn() },
    business: { findUnique: vi.fn() },
    message: { findMany: vi.fn() },
  },
}));
const createPerson = vi.fn();
vi.mock("@/lib/crm", () => ({
  CRM_PROVIDERS: { followupboss: { label: "Follow Up Boss", client: { createPerson: (...a: unknown[]) => createPerson(...a) } } },
  isCrmProvider: (v: string) => v === "followupboss",
}));
const writeToCrm = vi.fn();
vi.mock("@/lib/crm/writes", () => ({ writeToCrm: (...a: unknown[]) => writeToCrm(...a) }));
vi.mock("@/lib/crmSync", () => ({
  normalizeCrmEmail: (e: string | null) => e?.trim().toLowerCase() || null,
  normalizeCrmPhone: (p: string | null) => (p ? `+1${p.replace(/\D/g, "").slice(-10)}` : null),
}));
vi.mock("@/lib/pilotNumbersData", () => ({ REAL_CUSTOMER: { OR: [{ source: null }, { source: { not: "Test lead" } }] } }));

import { prisma } from "@/lib/db";
import { addMissedToCrm, autoAddMissed, loadMissedByCrm, setAutoAdd } from "@/lib/missedByCrmData";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const NOW = new Date("2026-10-22T18:00:00Z");
const SYNCED = new Date("2026-10-22T17:58:00Z");

function conn(over: Record<string, unknown> = {}) {
  return { provider: "followupboss", apiKey: "key", lastSyncedAt: SYNCED, autoAddSince: null, autoAddOff: false, writesPausedAt: null, ...over };
}
function row(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    name: "Priya Shah",
    email: " Priya@Example.com ",
    phone: null,
    dmEmail: null,
    dmPhone: null,
    source: "Instagram",
    createdAt: new Date("2026-10-19T16:00:00Z"),
    crmId: null,
    crmAddedAt: null,
    conversations: [{ channel: "instagram", emailProvider: null, messages: [{ body: "Looking for a 2-bed condo", sentAt: new Date("2026-10-19T16:00:00Z") }] }],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  p.crmConnection.findUnique.mockResolvedValue(conn());
  p.crmConnection.update.mockResolvedValue({});
  p.lead.findMany.mockResolvedValue([]);
  p.lead.updateMany.mockResolvedValue({ count: 1 });
  p.business.findUnique.mockResolvedValue({ timezone: "America/Toronto" });
  p.message.findMany.mockResolvedValue([{ body: "Looking for a 2-bed condo", sentAt: new Date("2026-10-19T16:00:00Z") }]);
  createPerson.mockResolvedValue({ ok: true, externalId: "4021" });
  writeToCrm.mockResolvedValue("done");
});

describe("who is missing", () => {
  it("calls nobody missing before FollowUp has checked the whole CRM once", async () => {
    p.crmConnection.findUnique.mockResolvedValue(conn({ lastSyncedAt: null }));
    expect(await loadMissedByCrm("biz1", NOW)).toBeNull();
    p.crmConnection.findUnique.mockResolvedValue(null);
    expect(await loadMissedByCrm("biz1", NOW)).toBeNull();
    expect(p.lead.findMany).not.toHaveBeenCalled();
  });

  it("counts real customers who wrote in the last 30 days, before the last check, who never said no", async () => {
    p.lead.findMany.mockResolvedValue([row("a"), row("b", { crmId: "9", crmAddedAt: NOW })]);
    const view = await loadMissedByCrm("biz1", NOW);
    expect(view).toMatchObject({ crmLabel: "Follow Up Boss", checkedAt: SYNCED, autoAdd: false, paused: false, timeZone: "America/Toronto" });
    expect(view?.state.kind).toBe("missing");
    const where = p.lead.findMany.mock.calls[0][0].where;
    expect(where.businessId).toBe("biz1");
    expect(where.createdAt).toEqual({ gte: new Date("2026-09-22T18:00:00Z"), lte: SYNCED });
    expect(where.optedOutAt).toBeNull();
    expect(where.saidNoAt).toBeNull();
    expect(where.conversations).toEqual({ some: { messages: { some: { direction: "inbound" } } } });
    expect(where.OR).toEqual([{ crmId: null }, { crmAddedAt: { not: null } }]);
  });
});

describe("adding them", () => {
  it("adds, links, writes their messages as a note, and turns on 'by themselves'", async () => {
    p.lead.findMany.mockResolvedValue([row("a")]);
    const r = await addMissedToCrm("biz1", "all", NOW);
    expect(r).toEqual({ added: 1, failed: [] });
    expect(createPerson).toHaveBeenCalledWith("key", { firstName: "Priya", lastName: "Shah", email: "priya@example.com", phone: null });
    expect(p.lead.updateMany).toHaveBeenCalledWith({
      where: { id: "a", businessId: "biz1", crmId: null },
      data: { crmProvider: "followupboss", crmId: "4021", crmAddedAt: NOW },
    });
    const write = writeToCrm.mock.calls[0][0];
    expect(write).toMatchObject({ businessId: "biz1", leadId: "a", provider: "followupboss", crmId: "4021", kind: "note" });
    expect(write.text).toContain("FollowUp added Priya Shah. They wrote on Instagram and weren't in Follow Up Boss.");
    expect(write.text).toContain('Oct 19: "Looking for a 2-bed condo"');
    expect(p.crmConnection.update).toHaveBeenCalledWith({ where: { businessId: "biz1" }, data: { autoAddSince: NOW } });
  });

  it("only touches the ids asked for, still missing and eligible, in this business", async () => {
    await addMissedToCrm("biz1", ["a", "x"], NOW);
    const where = p.lead.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ businessId: "biz1", crmId: null, id: { in: ["a", "x"] }, saidNoAt: null, optedOutAt: null });
  });

  it("never turns 'by themselves' back on after the owner turned it off", async () => {
    p.crmConnection.findUnique.mockResolvedValue(conn({ autoAddOff: true }));
    p.lead.findMany.mockResolvedValue([row("a")]);
    await addMissedToCrm("biz1", "all", NOW);
    expect(p.crmConnection.update).not.toHaveBeenCalled();
  });

  it("adds nothing while writing to the CRM is paused", async () => {
    p.crmConnection.findUnique.mockResolvedValue(conn({ writesPausedAt: NOW }));
    expect(await addMissedToCrm("biz1", "all", NOW)).toEqual({ error: "Writing to Follow Up Boss is paused. Turn it back on in Settings, then add them." });
    expect(createPerson).not.toHaveBeenCalled();
  });

  it("says who the CRM didn't take, and links nobody for them", async () => {
    p.lead.findMany.mockResolvedValue([row("a")]);
    createPerson.mockResolvedValue({ ok: false, message: "Follow Up Boss didn't take them. Try again in a minute." });
    expect(await addMissedToCrm("biz1", "all", NOW)).toEqual({ added: 0, failed: [{ id: "a", message: "Follow Up Boss didn't take them. Try again in a minute." }] });
    expect(p.lead.updateMany).not.toHaveBeenCalled();
    expect(writeToCrm).not.toHaveBeenCalled();
    expect(p.crmConnection.update).not.toHaveBeenCalled();
  });

  it("says so when the CRM person is already another customer here, instead of merging them", async () => {
    p.lead.findMany.mockResolvedValue([row("a")]);
    p.lead.updateMany.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));
    const r = await addMissedToCrm("biz1", "all", NOW);
    expect(r).toEqual({ added: 0, failed: [{ id: "a", message: "Follow Up Boss already has them under another customer here." }] });
    expect(writeToCrm).not.toHaveBeenCalled();
  });

  it("adds a chat customer by the email they gave in the chat, with no made-up name", async () => {
    p.lead.findMany.mockResolvedValue([row("a", { name: "Instagram DM", email: null, dmEmail: "Jo@Example.com" })]);
    await addMissedToCrm("biz1", "all", NOW);
    expect(createPerson).toHaveBeenCalledWith("key", { firstName: "", lastName: "", email: "jo@example.com", phone: null });
  });
});

describe("by themselves", () => {
  it("does nothing until it is on", async () => {
    expect(await autoAddMissed("biz1", NOW)).toEqual({ added: 0, failed: [] });
    expect(p.lead.findMany).not.toHaveBeenCalled();
  });

  it("adds only customers who came after it was turned on, a few at a time", async () => {
    const since = new Date("2026-10-21T12:00:00Z");
    p.crmConnection.findUnique.mockResolvedValue(conn({ autoAddSince: since }));
    p.lead.findMany.mockResolvedValue([row("a")]);
    expect(await autoAddMissed("biz1", NOW)).toEqual({ added: 1, failed: [] });
    const args = p.lead.findMany.mock.calls[0][0];
    expect(args.where.createdAt).toEqual({ gte: since, lte: SYNCED });
    expect(args.where.crmId).toBeNull();
    expect(args.take).toBe(10);
  });

  it("stops while writing is paused", async () => {
    p.crmConnection.findUnique.mockResolvedValue(conn({ autoAddSince: NOW, writesPausedAt: NOW }));
    expect(await autoAddMissed("biz1", NOW)).toEqual({ added: 0, failed: [] });
  });

  it("turns on from now, and off as the owner's own choice", async () => {
    await setAutoAdd("biz1", true, NOW);
    expect(p.crmConnection.update).toHaveBeenLastCalledWith({ where: { businessId: "biz1" }, data: { autoAddSince: NOW, autoAddOff: false } });
    await setAutoAdd("biz1", false, NOW);
    expect(p.crmConnection.update).toHaveBeenLastCalledWith({ where: { businessId: "biz1" }, data: { autoAddSince: null, autoAddOff: true } });
  });
});
