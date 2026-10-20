/**
 * "When FollowUp sorts them" (A-303): a customer who becomes Ready, Warm or Later moves to the owner's own stage for
 * it in their CRM, once per change, with what decided it as the reason, and never while a meeting is booked. Until
 * the owner chooses, FollowUp picks the stage whose name reads like it.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ conn: vi.fn(), booking: vi.fn(), claim: vi.fn(), write: vi.fn(), listStages: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { crmConnection: { findUnique: h.conn }, booking: { findFirst: h.booking }, lead: { updateMany: h.claim } },
}));
vi.mock("@/lib/crm/writes", () => ({ writeToCrm: h.write }));

import { moveLeadForTier, readStageWrite, readTierStages, tierMoveWhy, tierStage, tierStageByName } from "@/lib/crm/stages";
import { describeWrite } from "@/lib/crm/record";
import { CRM_PROVIDERS } from "@/lib/crm";
import type { Qualification } from "@/lib/qualification";

const HIS = ["New Lead", "Hot", "Nurture", "Long-term Nurture", "Appointment Set", "Under Contract", "Closed"].map((n) => ({ id: `p1:${n}`, name: n }));
const lead = { id: "lead1", businessId: "biz1", name: "Priya Shah", crmProvider: "gohighlevel", crmId: "c1" };
const q = (items: Qualification["items"]): Qualification => ({ v: 2, template: "realtor", items });

beforeEach(() => {
  vi.resetAllMocks();
  h.conn.mockResolvedValue({ provider: "gohighlevel", apiKey: "k", tierStages: null });
  h.booking.mockResolvedValue(null);
  h.claim.mockResolvedValue({ count: 1 });
  h.write.mockResolvedValue("done");
  vi.spyOn(CRM_PROVIDERS.gohighlevel.client, "listStages").mockImplementation(h.listStages);
  h.listStages.mockResolvedValue(HIS);
});

describe("which stage", () => {
  it("until the owner chooses: the one whose name reads like it", () => {
    expect(tierStageByName("ready", HIS)?.name).toBe("Hot");
    expect(tierStageByName("warm", HIS)?.name).toBe("Nurture");
    expect(tierStageByName("later", HIS)?.name).toBe("Long-term Nurture");
    expect(tierStageByName("warm", [{ id: "a", name: "Cold leads" }, { id: "b", name: "Warm leads" }])?.name).toBe("Warm leads");
    expect(tierStageByName("ready", [{ id: "a", name: "New" }, { id: "b", name: "Closed" }])).toBeNull();
  });

  it("the owner's choice wins, and \"Don't move them\" is none", async () => {
    const conn = { provider: "gohighlevel", apiKey: "k", tierStages: { ready: { id: "p1:New Lead", name: "New Lead" }, warm: null } };
    expect(await tierStage(conn, "ready")).toEqual({ id: "p1:New Lead", name: "New Lead" });
    expect(await tierStage(conn, "warm")).toBeNull();
    expect(await tierStage(conn, "later")).toEqual({ id: "p1:Long-term Nurture", name: "Long-term Nurture" });
  });

  it("a stored choice is read defensively", () => {
    expect(readTierStages({ ready: { id: "x", name: "X" }, warm: null, later: { id: 3 }, agent: { id: "y", name: "Y" } })).toEqual({ ready: { id: "x", name: "X" }, warm: null });
    expect(readTierStages("nope")).toEqual({});
  });
});

describe("why they moved", () => {
  it("quotes what decided it, and says when it was the owner's own note", () => {
    const later = q([{ key: "timing", value: "In about 3 months", quote: "probably in about 3 months", bucket: "months" }]);
    expect(tierMoveWhy(later, "warm")).toBe("They said: “probably in about 3 months”");
    const fromNote = q([{ key: "financing", value: "Pre-approved", quote: "pre-approved, wants to see places this weekend", bucket: "sorted", source: "note" }]);
    expect(tierMoveWhy(fromNote, "ready")).toBe("From your note: “pre-approved, wants to see places this weekend”");
    expect(tierMoveWhy(q([]), "ready")).toBeNull();
    expect(tierMoveWhy(later, "agent")).toBeNull();
  });

  it("shows on the record under the move", () => {
    const w = describeWrite("stage", JSON.stringify({ stageId: "p1:Nurture", label: "Nurture", name: "Priya Shah", why: "They said: “probably in about 3 months”" }), "Priya Shah");
    expect(w).toEqual({ title: "Moved Priya Shah to Nurture", quote: "They said: “probably in about 3 months”" });
    expect(readStageWrite(JSON.stringify({ stageId: "a", label: "b", name: "c", why: 5 }))).toEqual({ stageId: "a", label: "b", name: "c" });
  });
});

describe("moving a customer when their tier changes", () => {
  it("moves them to the stage for it, on record, with the reason", async () => {
    await moveLeadForTier(lead, "warm", "They said: “probably in about 3 months”");
    expect(h.claim).toHaveBeenCalledWith({
      where: { id: "lead1", OR: [{ crmTierMoved: null }, { crmTierMoved: { not: "warm" } }] },
      data: { crmTierMoved: "warm" },
    });
    expect(h.write).toHaveBeenCalledTimes(1);
    const input = h.write.mock.calls[0][0];
    expect(input).toMatchObject({ businessId: "biz1", leadId: "lead1", provider: "gohighlevel", crmId: "c1", kind: "stage" });
    expect(readStageWrite(input.text)).toEqual({ stageId: "p1:Nurture", label: "Nurture", name: "Priya Shah", why: "They said: “probably in about 3 months”" });
  });

  it("once per change: another pass for the same tier writes nothing", async () => {
    h.claim.mockResolvedValue({ count: 0 });
    await moveLeadForTier(lead, "warm", null);
    expect(h.write).not.toHaveBeenCalled();
  });

  it("never while a meeting is booked: the booking's stage stays", async () => {
    h.booking.mockResolvedValue({ id: "b1" });
    await moveLeadForTier(lead, "ready", null);
    expect(h.claim).not.toHaveBeenCalled();
    expect(h.write).not.toHaveBeenCalled();
  });

  it("not for someone with an agent, nor for no tier", async () => {
    await moveLeadForTier(lead, "agent", null);
    await moveLeadForTier(lead, undefined, null);
    expect(h.conn).not.toHaveBeenCalled();
    expect(h.write).not.toHaveBeenCalled();
  });

  it("only in the CRM the business is still connected to", async () => {
    h.conn.mockResolvedValue({ provider: "hubspot", apiKey: "k", tierStages: null });
    await moveLeadForTier(lead, "ready", null);
    expect(h.write).not.toHaveBeenCalled();
  });

  it("\"Don't move them\", or no stage that fits: remembered, nothing written", async () => {
    h.conn.mockResolvedValue({ provider: "gohighlevel", apiKey: "k", tierStages: { ready: null } });
    await moveLeadForTier(lead, "ready", null);
    expect(h.claim).toHaveBeenCalled();
    expect(h.write).not.toHaveBeenCalled();
  });

  it("never throws", async () => {
    h.conn.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(moveLeadForTier(lead, "ready", null)).resolves.toBeUndefined();
  });
});
