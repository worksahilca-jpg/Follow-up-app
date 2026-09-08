/**
 * Guarantees of CRM import (src/lib/crmSync.ts): a known CRM contact is
 * never re-created, only real contacts (with an email or phone) become
 * leads, a run stops at its page budget rather than timing out, and the
 * instant acknowledgement never fires for an imported CRM contact.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    crmConnection: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    lead: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    business: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/billing", () => ({ hasActiveAccess: vi.fn(() => true) }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn(async () => "user1") }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn() }));
vi.mock("@/lib/outboundWebhook", () => ({ notifyLeadEvent: vi.fn() }));
vi.mock("@/lib/scoring", () => ({ scoreAndDraftForLead: vi.fn(async () => true) }));

const fetchPage = vi.fn();
vi.mock("@/lib/crm", () => ({
  CRM_PROVIDERS: { followupboss: { label: "Follow Up Boss", client: { fetchPage: (...a: unknown[]) => fetchPage(...a) } } },
  isCrmProvider: (v: string) => v === "followupboss" || v === "hubspot",
}));

import { prisma } from "@/lib/db";
import { syncCrmForBusiness } from "@/lib/crmSync";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;

function person(externalId: string, over: Record<string, unknown> = {}) {
  return { externalId, name: `Lead ${externalId}`, email: `${externalId}@example.com`, phone: null, createdAt: new Date(), ...over };
}

beforeEach(() => {
  fetchPage.mockReset();
  p.crmConnection.findUnique.mockResolvedValue({ businessId: "biz1", provider: "followupboss", apiKey: "key", lastSyncedAt: null });
  p.crmConnection.update.mockResolvedValue({});
  p.lead.findUnique.mockResolvedValue(null);
  p.lead.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "new-lead", ...data }));
  p.lead.update.mockResolvedValue({});
});

describe("CRM sync", () => {
  it("imports a real contact once, keyed by (businessId, crmProvider, crmId)", async () => {
    fetchPage.mockResolvedValueOnce({ people: [person("101")], nextCursor: null, hasMore: false });
    const r = await syncCrmForBusiness("biz1");
    expect(r.imported).toBe(1);
    expect(p.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ crmProvider: "followupboss", crmId: "101", source: "Follow Up Boss" }) })
    );
  });

  it("never re-creates a lead it already imported", async () => {
    p.lead.findUnique.mockResolvedValue({ id: "existing", lastContacted: new Date("2020-01-01") });
    fetchPage.mockResolvedValueOnce({ people: [person("101")], nextCursor: null, hasMore: false });
    const r = await syncCrmForBusiness("biz1");
    expect(r.imported).toBe(0);
    expect(r.touched).toBe(1);
    expect(p.lead.create).not.toHaveBeenCalled();
  });

  it("skips a contact with no email and no phone — nothing to reach them on", async () => {
    fetchPage.mockResolvedValueOnce({ people: [person("101", { email: null, phone: null })], nextCursor: null, hasMore: false });
    const r = await syncCrmForBusiness("biz1");
    expect(r.imported).toBe(0);
    expect(p.lead.create).not.toHaveBeenCalled();
  });

  it("stops at the page budget and does not advance lastSyncedAt when truncated", async () => {
    for (let i = 0; i < 6; i++) fetchPage.mockResolvedValueOnce({ people: [person(String(i))], nextCursor: String(i + 1), hasMore: true });
    const r = await syncCrmForBusiness("biz1");
    expect(r.truncated).toBe(true);
    expect(fetchPage).toHaveBeenCalledTimes(5);
    expect(p.crmConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastSyncedAt: null }) })
    );
  });

  it("records the error and never throws when the provider call fails", async () => {
    fetchPage.mockRejectedValue(new Error("rate limited"));
    const r = await syncCrmForBusiness("biz1");
    expect(r.imported).toBe(0);
    expect(p.crmConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastSyncError: expect.stringContaining("rate limited") }) })
    );
  });

  it("does nothing when there is no connection", async () => {
    p.crmConnection.findUnique.mockResolvedValue(null);
    const r = await syncCrmForBusiness("biz1");
    expect(r).toEqual({ imported: 0, touched: 0, truncated: false });
    expect(fetchPage).not.toHaveBeenCalled();
  });
});
