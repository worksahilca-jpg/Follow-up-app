/**
 * The two halves of "a human's decision about a lead is not reversible by
 * a model":
 *
 *  1. Restoring a filtered email ("this was a lead") used to leave no
 *     trace. The importer tags the restored lead source "Gmail" like any
 *     other and deletes the FilteredEmail row holding the verdict, so the
 *     retroactive clean-up pass re-judged the same thread with the same
 *     classifier the owner had just overruled — and could delete it.
 *  2. A clean-up deletion used to destroy the lead with nothing written
 *     down per lead. archiveLeadThreadsAsFiltered puts the thread back in
 *     the filtered list, where the owner can see it and restore it — which
 *     then stamps the override from (1), so the same lead cannot be
 *     deleted twice.
 *
 * Plus the tenant guard on the last call before rows are gone for good.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    filteredEmail: { findFirst: vi.fn(), upsert: vi.fn(async () => ({})) },
    lead: { updateMany: vi.fn(async () => ({ count: 1 })), findUnique: vi.fn(), delete: vi.fn() },
    message: { deleteMany: vi.fn() },
    conversation: { deleteMany: vi.fn() },
    deal: { deleteMany: vi.fn() },
    followUp: { deleteMany: vi.fn() },
    task: { deleteMany: vi.fn() },
    booking: { deleteMany: vi.fn() },
    aIInsight: { deleteMany: vi.fn() },
    $transaction: vi.fn(async () => []),
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

const { getSessionContext } = vi.hoisted(() => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionContext }));

vi.mock("@/lib/billing", () => ({
  requireActiveBilling: vi.fn(async () => true),
  billingLockedMessage: vi.fn(async () => "locked"),
}));

const { importGmailThread } = vi.hoisted(() => ({ importGmailThread: vi.fn() }));
vi.mock("@/lib/integrations/gmail", () => ({ importGmailThread }));
vi.mock("@/lib/integrations/outlook", () => ({ importOutlookConversation: vi.fn() }));
vi.mock("@/lib/scoring", () => ({ scoreAndDraftForLead: vi.fn(async () => {}) }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn(async () => {}) }));

/** First argument of the first call to a mock, or a failure that says so. */
function firstArg<T>(calls: unknown[][]): T {
  const [args] = calls;
  if (!args || args.length === 0) throw new Error("expected the mock to have been called");
  return args[0] as T;
}

import { POST as restore } from "@/app/api/integrations/gmail/filtered/[id]/restore/route";
import { archiveLeadThreadsAsFiltered, deleteLeadCascade } from "@/lib/leads-admin";

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "user1" });
  prismaMock.lead.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.filteredEmail.upsert.mockResolvedValue({});
});

describe('restoring a filtered email ("this was a lead")', () => {
  it("records the human override on the lead itself", async () => {
    prismaMock.filteredEmail.findFirst.mockResolvedValue({
      id: "f1",
      businessId: "biz1",
      threadId: "thread-9",
      provider: "gmail",
      reason: "Looks like a recruiter.",
    });
    importGmailThread.mockResolvedValue({ id: "lead9" });

    const res = await restore(new Request("http://localhost"), { params: Promise.resolve({ id: "f1" }) });

    expect(res.status).toBe(200);
    const write = firstArg<{ where: Record<string, unknown>; data: { classificationOverriddenAt?: Date } }>(
      prismaMock.lead.updateMany.mock.calls
    );
    // Stamped, and stamped tenant-scoped.
    expect(write.where).toEqual({ id: "lead9", businessId: "biz1" });
    expect(write.data.classificationOverriddenAt).toBeInstanceOf(Date);
  });

  it("writes nothing when the thread is gone from the mailbox", async () => {
    prismaMock.filteredEmail.findFirst.mockResolvedValue({
      id: "f1",
      businessId: "biz1",
      threadId: "thread-9",
      provider: "gmail",
      reason: "Looks like a recruiter.",
    });
    importGmailThread.mockResolvedValue(null);

    await restore(new Request("http://localhost"), { params: Promise.resolve({ id: "f1" }) });

    expect(prismaMock.lead.updateMany).not.toHaveBeenCalled();
  });
});

describe("archiveLeadThreadsAsFiltered", () => {
  const lead = {
    id: "lead1",
    name: "Dana Reyes",
    email: "dana@example.com",
    conversations: [
      {
        channel: "email",
        externalId: "thread-1",
        emailProvider: "outlook",
        messages: [
          { sentAt: new Date("2026-01-01T09:00:00Z") },
          { sentAt: new Date("2026-02-01T09:00:00Z") },
        ],
      },
      // Not a mailbox thread: nothing to restore from, nothing to write.
      { channel: "text", externalId: null, emailProvider: null, messages: [{ sentAt: new Date() }] },
    ],
  };

  it("writes a restorable record for every mailbox thread before the lead is deleted", async () => {
    const archived = await archiveLeadThreadsAsFiltered("biz1", lead, "Recruiter outreach.");

    expect(archived).toBe(1);
    expect(prismaMock.filteredEmail.upsert).toHaveBeenCalledTimes(1);
    const call = firstArg<{
      where: Record<string, unknown>;
      create: { provider: string; reason: string; lastMessageAt: Date };
    }>(prismaMock.filteredEmail.upsert.mock.calls);
    expect(call.where).toEqual({ businessId_threadId: { businessId: "biz1", threadId: "thread-1" } });
    // The provider decides which importer "restore" calls — a thread
    // archived as gmail when it lives in Outlook cannot be restored.
    expect(call.create.provider).toBe("outlook");
    expect(call.create.reason).toBe("Recruiter outreach.");
    // The newest message, so a later reply re-opens the thread for sync.
    expect(call.create.lastMessageAt).toEqual(new Date("2026-02-01T09:00:00Z"));
  });
});

describe("deleteLeadCascade", () => {
  it("refuses to delete a lead belonging to another business", async () => {
    prismaMock.lead.findUnique.mockResolvedValue({ id: "lead1", businessId: "otherBiz", conversations: [] });

    await expect(deleteLeadCascade("lead1", "biz1")).rejects.toThrow(/another business/);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("deletes when the tenant matches", async () => {
    prismaMock.lead.findUnique.mockResolvedValue({ id: "lead1", businessId: "biz1", conversations: [] });

    await deleteLeadCascade("lead1", "biz1");

    expect(prismaMock.$transaction).toHaveBeenCalled();
  });
});
