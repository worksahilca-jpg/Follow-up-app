/**
 * Two Outlook syncs racing on a brand-new conversation must not cost the
 * lead its first reply — the Outlook half of daily-path audit F9, which
 * was fixed for Gmail only (gmailThreadRace.test.ts).
 *
 * The Outlook cron runs every two minutes with nothing stopping one run
 * from overlapping the last (a first pass, or a run that left work for the
 * next tick and so holds Graph's cursor), and "Sync now" can run beside
 * either. Both read no conversation for a new customer and both create
 * one; the conversation id is unique, so one throws. When the one that
 * throws is the sync that won the lead (the only one with isNewLead), the
 * thread ended there and acknowledgeNewLead was never reached: no instant
 * reply, and on a holding account no first-reply hold. The message writes
 * right after have the same race.
 *
 * Each test below is the moment just after the OTHER sync won one of those
 * inserts, seen from the sync that created the lead.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { prismaMock, acknowledgeNewLead } = vi.hoisted(() => ({
  acknowledgeNewLead: vi.fn(async () => undefined),
  prismaMock: {
    integration: { findFirst: vi.fn() },
    business: { findUnique: vi.fn() },
    filteredEmail: { deleteMany: vi.fn() },
    lead: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    conversation: { findUnique: vi.fn(), create: vi.fn() },
    message: { upsert: vi.fn(), findMany: vi.fn(async () => []) },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/integrations/openai", () => ({ classifyWithSecondLook: vi.fn() }));
vi.mock("@/lib/senderVerdicts", () => ({
  OWNER_SAID_NOT_CUSTOMER: "You marked this sender as not a customer.",
  ownerSaidNotCustomer: vi.fn(async () => false),
  recentCorrections: vi.fn(async () => []),
}));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn(async () => null) }));
vi.mock("@/lib/outboundWebhook", () => ({ notifyLeadEvent: vi.fn(async () => undefined) }));
vi.mock("@/lib/engagement", () => ({ checkRapidEngagement: vi.fn(async () => undefined) }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn(async () => undefined) }));
vi.mock("@/lib/acknowledge", () => ({ acknowledgeNewLead }));

import { importOutlookConversation } from "@/lib/integrations/outlook";

const uniqueViolation = () => Object.assign(new Error("Unique constraint failed on the fields: (`externalId`)"), { code: "P2002" });

const newLead = {
  id: "lead1",
  businessId: "biz1",
  name: "Jane Doe",
  email: "jane@example.com",
  company: null,
  source: "Outlook",
  dealValue: 0,
  score: 0,
  scoreReason: null,
  lastContacted: new Date(),
  nextFollowUp: null,
  notes: null,
  automationTier: "HOLD",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(global, "fetch").mockImplementation(async () =>
    Response.json({
      value: [
        {
          id: "graph-msg-1",
          conversationId: "conv-1",
          subject: "Quote for a water heater",
          body: { contentType: "text", content: "Hi, could I get a quote this week?" },
          from: { emailAddress: { name: "Jane Doe", address: "jane@example.com" } },
          receivedDateTime: new Date().toISOString(),
        },
      ],
    })
  );
  prismaMock.integration.findFirst.mockResolvedValue({
    id: "int1",
    accessToken: "access",
    refreshToken: "refresh",
    tokenExpiresAt: new Date(Date.now() + 3_600_000),
    accountEmail: "info@samsplumbing.ca",
    user: { email: "sam.smith@gmail.com" },
  });
  prismaMock.business.findUnique.mockResolvedValue({ name: "Sam's Plumbing", industry: "Plumbing", users: [] });
  prismaMock.filteredEmail.deleteMany.mockResolvedValue({ count: 0 });
  // This sync wins the lead: it is the one that must acknowledge.
  prismaMock.lead.findUnique.mockResolvedValue(null);
  prismaMock.lead.create.mockResolvedValue(newLead);
  // Neither sync has seen the conversation yet when they both look.
  prismaMock.conversation.findUnique.mockResolvedValue(null);
  prismaMock.conversation.create.mockResolvedValue({ id: "conv-mine", leadId: "lead1" });
  prismaMock.message.upsert.mockResolvedValue({});
});

afterEach(() => vi.restoreAllMocks());

describe("the Outlook sync that created the lead", () => {
  it("still acknowledges it when the other sync created the conversation first", async () => {
    prismaMock.conversation.create.mockRejectedValueOnce(uniqueViolation());
    prismaMock.conversation.findUnique
      .mockResolvedValueOnce(null) // the known-conversation check
      .mockResolvedValueOnce(null) // the read before creating
      .mockResolvedValueOnce({ id: "conv-theirs", leadId: "lead1" }); // the winner's row, after P2002

    const lead = await importOutlookConversation("biz1", "conv-1");

    expect(lead?.id).toBe("lead1");
    // Its messages go into the one conversation that exists, not a second.
    expect(prismaMock.message.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ conversationId: "conv-theirs" }) }));
    expect(acknowledgeNewLead).toHaveBeenCalledTimes(1);
    expect(acknowledgeNewLead).toHaveBeenCalledWith("lead1", expect.objectContaining({ channel: "email", emailMessageId: "graph-msg-1" }));
  });

  it("still acknowledges it when the other sync wrote the message first", async () => {
    prismaMock.message.upsert.mockRejectedValueOnce(uniqueViolation());

    const lead = await importOutlookConversation("biz1", "conv-1");

    expect(lead?.id).toBe("lead1");
    expect(acknowledgeNewLead).toHaveBeenCalledTimes(1);
  });
});

describe("what is still a real failure", () => {
  it("a database error on the conversation create still fails the conversation", async () => {
    prismaMock.conversation.create.mockRejectedValueOnce(new Error("Connection reset"));

    expect(await importOutlookConversation("biz1", "conv-1")).toBeNull();
    expect(acknowledgeNewLead).not.toHaveBeenCalled();
  });

  it("a P2002 whose winning row can't be read back still fails the conversation", async () => {
    prismaMock.conversation.create.mockRejectedValueOnce(uniqueViolation());

    expect(await importOutlookConversation("biz1", "conv-1")).toBeNull();
    expect(prismaMock.message.upsert).not.toHaveBeenCalled();
    expect(acknowledgeNewLead).not.toHaveBeenCalled();
  });

  it("a database error on a message write still fails the conversation", async () => {
    prismaMock.message.upsert.mockRejectedValueOnce(new Error("Connection reset"));

    expect(await importOutlookConversation("biz1", "conv-1")).toBeNull();
    expect(acknowledgeNewLead).not.toHaveBeenCalled();
  });
});
