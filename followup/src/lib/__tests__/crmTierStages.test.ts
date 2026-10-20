/**
 * "When FollowUp sorts them" (A-303): a customer who becomes Ready, Warm or Later moves to the owner's own stage for
 * it in their CRM, once per change, with what decided it as the reason, and never while a meeting is booked. Only to
 * a stage the owner picked: until then nobody moves. Never someone FollowUp leaves alone.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ conn: vi.fn(), booking: vi.fn(), claim: vi.fn(), write: vi.fn(), listStages: vi.fn(), state: vi.fn(), hold: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { crmConnection: { findUnique: h.conn }, booking: { findFirst: h.booking }, lead: { updateMany: h.claim, findUnique: h.state } },
}));
vi.mock("@/lib/crm/writes", () => ({ writeToCrm: h.write }));
vi.mock("@/lib/crm/oneBoss", () => ({ crmHoldReason: h.hold }));

import { moveLeadForTier, readStageWrite, readTierStages, tierMoveWhy } from "@/lib/crm/stages";
import { describeWrite } from "@/lib/crm/record";
import { CRM_PROVIDERS } from "@/lib/crm";
import type { Qualification } from "@/lib/qualification";

const HIS = ["New Lead", "Hot", "Nurture", "Long-term Nurture", "Appointment Set", "Under Contract", "Closed"].map((n) => ({ id: `p1:${n}`, name: n }));
const lead = { id: "lead1", businessId: "biz1", name: "Priya Shah", crmProvider: "gohighlevel", crmId: "c1" };
const q = (items: Qualification["items"]): Qualification => ({ v: 2, template: "realtor", items });
const stage = (n: string) => ({ id: `p1:${n}`, name: n });
const PICKED = { ready: stage("Hot"), warm: stage("Nurture"), later: stage("Long-term Nurture") };

beforeEach(() => {
  vi.resetAllMocks();
  h.conn.mockResolvedValue({ provider: "gohighlevel", apiKey: "k", tierStages: PICKED });
  h.booking.mockResolvedValue(null);
  h.state.mockResolvedValue({ crmTierMoved: null, optedOutAt: null, saidNoAt: null, stage: "NEW", quietOutcome: null });
  h.hold.mockResolvedValue(null);
  h.claim.mockResolvedValue({ count: 1 });
  h.write.mockResolvedValue("done");
  vi.spyOn(CRM_PROVIDERS.gohighlevel.client, "listStages").mockImplementation(h.listStages);
  h.listStages.mockResolvedValue(HIS);
});

describe("which stage", () => {
  it("only the stage the owner picked: until then nobody moves, and the next pass after he picks moves them", async () => {
    h.conn.mockResolvedValue({ provider: "gohighlevel", apiKey: "k", tierStages: null });
    await moveLeadForTier(lead, "warm", null);
    // Nothing guessed by name, nothing asked of the CRM, nothing claimed.
    expect(h.listStages).not.toHaveBeenCalled();
    expect(h.claim).not.toHaveBeenCalled();
    expect(h.write).not.toHaveBeenCalled();
    h.conn.mockResolvedValue({ provider: "gohighlevel", apiKey: "k", tierStages: { warm: stage("New Lead") } });
    await moveLeadForTier(lead, "warm", null);
    expect(readStageWrite(h.write.mock.calls[0][0].text)).toMatchObject({ stageId: "p1:New Lead", label: "New Lead" });
    // Ready isn't picked yet: still nobody.
    h.write.mockClear();
    await moveLeadForTier(lead, "ready", null);
    expect(h.write).not.toHaveBeenCalled();
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

  it("once per change: another pass for the same tier asks nothing and writes nothing", async () => {
    h.state.mockResolvedValue({ crmTierMoved: "warm", optedOutAt: null, saidNoAt: null, stage: "NEW", quietOutcome: null });
    await moveLeadForTier(lead, "warm", null);
    expect(h.listStages).not.toHaveBeenCalled();
    expect(h.write).not.toHaveBeenCalled();
    // Two passes racing: the one that loses the claim writes nothing.
    h.state.mockResolvedValue({ crmTierMoved: null, optedOutAt: null, saidNoAt: null, stage: "NEW", quietOutcome: null });
    h.claim.mockResolvedValue({ count: 0 });
    await moveLeadForTier(lead, "warm", null);
    expect(h.write).not.toHaveBeenCalled();
  });

  it("never someone FollowUp leaves alone: said stop or no, won or lost, closed", async () => {
    const base = { crmTierMoved: null, optedOutAt: null, saidNoAt: null, stage: "NEW", quietOutcome: null };
    for (const off of [{ optedOutAt: new Date() }, { saidNoAt: new Date() }, { stage: "WON" }, { stage: "LOST" }, { quietOutcome: "CLOSED" }]) {
      h.state.mockResolvedValue({ ...base, ...off });
      await moveLeadForTier(lead, "ready", null);
    }
    expect(h.claim).not.toHaveBeenCalled();
    expect(h.write).not.toHaveBeenCalled();
  });

  it("never when the CRM says no: do not disturb, do not contact, closed, or a meeting booked there", async () => {
    h.hold.mockResolvedValue("They have a meeting booked in GoHighLevel.");
    await moveLeadForTier(lead, "warm", null);
    expect(h.hold).toHaveBeenCalledWith(lead);
    expect(h.claim).not.toHaveBeenCalled();
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

  it("\"Don't move them\": remembered, nothing asked, nothing written", async () => {
    h.conn.mockResolvedValue({ provider: "gohighlevel", apiKey: "k", tierStages: { ready: null } });
    await moveLeadForTier(lead, "ready", null);
    expect(h.claim).toHaveBeenCalled();
    expect(h.listStages).not.toHaveBeenCalled();
    expect(h.write).not.toHaveBeenCalled();
  });

  it("never throws", async () => {
    h.conn.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(moveLeadForTier(lead, "ready", null)).resolves.toBeUndefined();
  });
});
