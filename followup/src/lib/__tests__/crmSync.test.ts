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
  p.crmConnection.findUnique.mockResolvedValue({ businessId: "biz1", provider: "followupboss", apiKey: "key", lastSyncedAt: null, syncCursor: null });
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

  it("stops at the page budget, does not advance lastSyncedAt, and persists the cursor to resume from when truncated", async () => {
    for (let i = 0; i < 6; i++) fetchPage.mockResolvedValueOnce({ people: [person(String(i))], nextCursor: String(i + 1), hasMore: true });
    const r = await syncCrmForBusiness("biz1");
    expect(r.truncated).toBe(true);
    expect(fetchPage).toHaveBeenCalledTimes(5);
    // 5 pages ran (cursor "0".."4" as each page's OWN cursor argument),
    // the 5th page returned nextCursor "5" — that's what should persist.
    expect(p.crmConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastSyncedAt: null, syncCursor: "5" }) })
    );
  });

  it("resumes from a previously-persisted cursor instead of restarting at page 1", async () => {
    p.crmConnection.findUnique.mockResolvedValue({ businessId: "biz1", provider: "followupboss", apiKey: "key", lastSyncedAt: null, syncCursor: "500" });
    fetchPage.mockResolvedValueOnce({ people: [person("501")], nextCursor: null, hasMore: false });
    await syncCrmForBusiness("biz1");
    expect(fetchPage).toHaveBeenCalledWith("key", "500", null);
  });

  it("clears the persisted cursor once a run completes a full, untruncated pass", async () => {
    p.crmConnection.findUnique.mockResolvedValue({ businessId: "biz1", provider: "followupboss", apiKey: "key", lastSyncedAt: null, syncCursor: "500" });
    fetchPage.mockResolvedValueOnce({ people: [person("501")], nextCursor: null, hasMore: false });
    await syncCrmForBusiness("biz1");
    expect(p.crmConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ syncCursor: null }) })
    );
  });

  /**
   * Follow Up Boss pages by numeric OFFSET, so its client always returns a
   * non-empty nextCursor string ("100", "200", and "0" for an empty first
   * page — every one of them truthy in JS); only `hasMore` ever goes
   * false. Every other test in this file uses HubSpot's shape
   * (nextCursor: null at the end), which is precisely why looping on the
   * cursor instead of on hasMore went unnoticed: it spun forever
   * re-fetching the same past-the-end offset until the cron function hit
   * its 120s ceiling, so the run never stamped lastSyncedAt, never
   * cleared syncCursor, and — because syncCrmForAllBusinesses() walks
   * businesses sequentially — every business after the first Follow Up
   * Boss connection never got synced at all.
   *
   * Without the fix this test does not fail, it HANGS (mockResolvedValue,
   * not Once, so the page repeats indefinitely) — the timeout is the
   * assertion, alongside the call count below.
   */
  it("stops when hasMore is false even though the provider's cursor is always a truthy offset string", async () => {
    fetchPage.mockResolvedValue({ people: [person("101")], nextCursor: "100", hasMore: false });

    const r = await syncCrmForBusiness("biz1");

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(r.truncated).toBe(false);
    // A completed pass: the watermark advances and the resume cursor clears.
    expect(p.crmConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastSyncedAt: expect.any(Date), syncCursor: null }) })
    );
  }, 5000);

  it("stops on an empty past-the-end page whose offset cursor is the string \"0\"", async () => {
    fetchPage.mockResolvedValue({ people: [], nextCursor: "0", hasMore: false });

    await syncCrmForBusiness("biz1");

    expect(fetchPage).toHaveBeenCalledTimes(1);
  }, 5000);

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
