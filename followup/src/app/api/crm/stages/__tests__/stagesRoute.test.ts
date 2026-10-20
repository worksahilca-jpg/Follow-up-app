/**
 * /api/crm/stages (A-275, A-303): where a booking, and Ready, Warm and Later, move a customer in the owner's CRM, and
 * "Read my notes". Admins only; a stage is only ever one the CRM lists now; and when a GoHighLevel key can't see the
 * stages, the window says what to turn on.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getSessionContext, requireAdmin } = vi.hoisted(() => ({ getSessionContext: vi.fn(), requireAdmin: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));
const { recordAudit } = vi.hoisted(() => ({ recordAudit: vi.fn<(ctx: unknown, action: string, details: { meta?: unknown }) => Promise<boolean>>(async () => true) }));
vi.mock("@/lib/audit", () => ({ recordAudit }));
const { prismaMock } = vi.hoisted(() => ({ prismaMock: { crmConnection: { findUnique: vi.fn(), update: vi.fn() } } }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { GET, PUT } from "../route";
import { CRM_PROVIDERS } from "@/lib/crm";

const HIS = ["New Lead", "Hot", "Nurture", "Long-term Nurture", "Appointment Set"].map((n) => ({ id: `p1:${n}`, name: n }));
const conn = (over: Record<string, unknown> = {}) => ({
  provider: "gohighlevel",
  apiKey: "LOC|key",
  bookedStage: null,
  bookedStageLabel: null,
  tierStages: null,
  readNotes: true,
  ...over,
});
const put = (body: unknown) =>
  new NextRequest("http://localhost/api/crm/stages", { method: "PUT", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "u1" });
  requireAdmin.mockResolvedValue(true);
  prismaMock.crmConnection.findUnique.mockResolvedValue(conn());
  prismaMock.crmConnection.update.mockResolvedValue({});
  vi.spyOn(CRM_PROVIDERS.gohighlevel.client, "listStages").mockResolvedValue(HIS);
});

describe("reading the CRM window", () => {
  it("each tier's stage: the owner's pick, \"Don't move them\", or not picked yet (nothing guessed)", async () => {
    prismaMock.crmConnection.findUnique.mockResolvedValue(conn({ tierStages: { ready: { id: "p1:New Lead", name: "New Lead" }, later: null } }));
    const body = await (await GET()).json();
    expect(body.tiers).toEqual({
      ready: { chosen: { id: "p1:New Lead", name: "New Lead" }, dontMove: false },
      warm: { chosen: null, dontMove: false },
      later: { chosen: null, dontMove: true },
    });
    expect(body).toMatchObject({ readNotes: true, notesAvailable: true, stagesHelp: null });
  });

  it("when a GoHighLevel key can't see the stages, says what to turn on", async () => {
    vi.spyOn(CRM_PROVIDERS.gohighlevel.client, "listStages").mockResolvedValue([]);
    const body = await (await GET()).json();
    expect(body.stagesHelp).toMatch(/turn on Opportunities \(read and write\)/);
  });

  it("notes only where the CRM's notes can be read", async () => {
    prismaMock.crmConnection.findUnique.mockResolvedValue(conn({ provider: "hubspot" }));
    vi.spyOn(CRM_PROVIDERS.hubspot.client, "listStages").mockResolvedValue([]);
    const body = await (await GET()).json();
    expect(body).toMatchObject({ notesAvailable: false, stagesHelp: null });
  });
});

describe("choosing a stage", () => {
  it("for a tier: kept with the other tiers, and audited", async () => {
    prismaMock.crmConnection.findUnique.mockResolvedValue(conn({ tierStages: { ready: { id: "p1:Hot", name: "Hot" } } }));
    const res = await PUT(put({ stageId: "p1:Long-term Nurture", for: "later" }));
    expect(res.status).toBe(200);
    expect(prismaMock.crmConnection.update.mock.calls[0][0].data).toEqual({
      tierStages: { ready: { id: "p1:Hot", name: "Hot" }, later: { id: "p1:Long-term Nurture", name: "Long-term Nurture" } },
    });
    expect(recordAudit.mock.calls[0][1]).toBe("integration.crm.tier_stage");
    expect(recordAudit.mock.calls[0][2].meta).toEqual({ tier: "later", stage: "Long-term Nurture" });
  });

  it("\"Don't move them\" for a tier is kept as none", async () => {
    await PUT(put({ stageId: null, for: "warm" }));
    expect(prismaMock.crmConnection.update.mock.calls[0][0].data).toEqual({ tierStages: { warm: null } });
  });

  it("only a stage the CRM lists now", async () => {
    const res = await PUT(put({ stageId: "p1:Made up", for: "ready" }));
    expect(res.status).toBe(400);
    expect(prismaMock.crmConnection.update).not.toHaveBeenCalled();
  });

  it("without a tier it is still the booking's stage", async () => {
    await PUT(put({ stageId: "p1:Appointment Set" }));
    expect(prismaMock.crmConnection.update.mock.calls[0][0].data).toEqual({ bookedStage: "p1:Appointment Set", bookedStageLabel: "Appointment Set" });
  });
});

describe("Read my notes", () => {
  it("turns off and on, audited", async () => {
    const res = await PUT(put({ readNotes: false }));
    expect(await res.json()).toEqual({ success: true, readNotes: false });
    expect(prismaMock.crmConnection.update.mock.calls[0][0]).toEqual({ where: { businessId: "biz1" }, data: { readNotes: false } });
    expect(recordAudit.mock.calls[0][2].meta).toEqual({ on: false });
  });
});

describe("who may", () => {
  it("only an admin, signed in, with a CRM connected", async () => {
    requireAdmin.mockResolvedValue(false);
    expect((await GET()).status).toBe(403);
    expect((await PUT(put({ readNotes: false }))).status).toBe(403);
    requireAdmin.mockResolvedValue(true);
    getSessionContext.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "u1" });
    prismaMock.crmConnection.findUnique.mockResolvedValue(null);
    expect((await PUT(put({ readNotes: false }))).status).toBe(400);
    expect(prismaMock.crmConnection.update).not.toHaveBeenCalled();
  });
});
