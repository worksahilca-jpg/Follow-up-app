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
    lead: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
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
import { normalizeCrmEmail, normalizeCrmPhone, syncCrmForBusiness } from "@/lib/crmSync";

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
  p.lead.findFirst.mockResolvedValue(null);
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

// Founder, 2026-09-29: "they will clash and make confusion". The same
// person in the CRM and the inbox must be one customer.
describe("one person, one customer, across the CRM and the inbox", () => {
  it("brings CRM emails and phone numbers to the form the other channels use", () => {
    expect(normalizeCrmEmail("  John@Example.COM ")).toBe("john@example.com");
    expect(normalizeCrmEmail("   ")).toBeNull();
    expect(normalizeCrmPhone("(416) 555-0199")).toBe("+14165550199");
    expect(normalizeCrmPhone("1-416-555-0199")).toBe("+14165550199");
    expect(normalizeCrmPhone("+44 20 7946 0958")).toBe("+442079460958");
    expect(normalizeCrmPhone("ext 12")).toBeNull();
  });

  it("links an existing inbox customer to their CRM record instead of creating a second one", async () => {
    p.lead.findFirst.mockResolvedValue({ id: "gmail-lead", crmProvider: null, crmId: null, email: "john@example.com", phone: null });
    fetchPage.mockResolvedValueOnce({
      people: [person("201", { email: "John@Example.com", phone: "(416) 555-0199" })],
      nextCursor: null,
      hasMore: false,
    });
    const r = await syncCrmForBusiness("biz1");
    expect(p.lead.create).not.toHaveBeenCalled();
    expect(r).toMatchObject({ imported: 0, touched: 1 });
    expect(p.lead.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          businessId: "biz1",
          OR: [{ email: { equals: "john@example.com", mode: "insensitive" } }, { phone: "+14165550199" }],
        },
      })
    );
    expect(p.lead.update).toHaveBeenCalledWith({
      where: { id: "gmail-lead" },
      data: { crmProvider: "followupboss", crmId: "201", phone: "+14165550199" },
    });
  });

  it("leaves a customer already tied to a different CRM record alone", async () => {
    p.lead.findFirst.mockResolvedValue({ id: "l1", crmProvider: "followupboss", crmId: "999", email: "a@example.com", phone: null });
    fetchPage.mockResolvedValueOnce({ people: [person("201", { email: "a@example.com" })], nextCursor: null, hasMore: false });
    await syncCrmForBusiness("biz1");
    expect(p.lead.update).not.toHaveBeenCalled();
    expect(p.lead.create).not.toHaveBeenCalled();
  });

  it("creates new CRM customers with the normalized email and phone", async () => {
    fetchPage.mockResolvedValueOnce({ people: [person("301", { email: "New@Example.com", phone: "416.555.0100" })], nextCursor: null, hasMore: false });
    await syncCrmForBusiness("biz1");
    expect(p.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: "new@example.com", phone: "+14165550100" }) })
    );
  });
});
