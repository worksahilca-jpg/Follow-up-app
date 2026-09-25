/**
 * A push sync and a cron tick racing on a brand-new thread must not cost
 * the lead its first reply (daily-path audit 2026-09-25 F9).
 *
 * The push path's lock only excludes other push syncs, so a new lead's
 * email arriving as the ten-minute tick runs can be processed twice at
 * once. The lead create was already race-safe: the loser catches P2002
 * and carries on as "existing". The conversation create after it was not.
 * Both syncs read no conversation and both create one; the thread id is
 * unique, so one throws. When the one that throws is the sync that won
 * the lead (the only one with isNewLead), its thread ends there and
 * acknowledgeNewLead is never reached: no instant reply, and on a holding
 * account no first-reply hold until the three-hour pass. The message
 * writes right after have the same race.
 *
 * Each test below is the moment just after the OTHER sync won one of those
 * inserts, seen from the sync that created the lead.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { threadsGet, prismaMock, acknowledgeNewLead } = vi.hoisted(() => ({
  threadsGet: vi.fn(),
  acknowledgeNewLead: vi.fn(async () => undefined),
  prismaMock: {
    integration: { findFirst: vi.fn() },
    business: { findUnique: vi.fn() },
    filteredEmail: { deleteMany: vi.fn() },
    lead: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    conversation: { findUnique: vi.fn(), create: vi.fn() },
    message: { upsert: vi.fn() },
  },
}));

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: class {
        setCredentials() {}
      },
    },
    gmail: () => ({ users: { threads: { get: threadsGet } } }),
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/integrations/openai", () => ({ classifyAsProspect: vi.fn() }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn(async () => null) }));
vi.mock("@/lib/outboundWebhook", () => ({ notifyLeadEvent: vi.fn(async () => undefined) }));
vi.mock("@/lib/engagement", () => ({ checkRapidEngagement: vi.fn(async () => undefined) }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn(async () => undefined) }));
vi.mock("@/lib/acknowledge", () => ({ acknowledgeNewLead }));

import { importGmailThread } from "@/lib/integrations/gmail";

const uniqueViolation = () => Object.assign(new Error("Unique constraint failed on the fields: (`externalId`)"), { code: "P2002" });

const newLead = {
  id: "lead1",
  name: "Jane Doe",
  email: "jane@example.com",
  company: null,
  source: "Gmail",
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
  vi.stubEnv("GOOGLE_CLIENT_ID", "client");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
  vi.stubEnv("GOOGLE_REDIRECT_URI", "https://followupbase.io/api/integrations/gmail/callback");
  vi.stubEnv("OPENAI_API_KEY", "");

  threadsGet.mockResolvedValue({
    data: {
      id: "thread-1",
      messages: [
        {
          id: "msg-1",
          payload: {
            mimeType: "text/plain",
            headers: [
              { name: "From", value: "Jane Doe <jane@example.com>" },
              { name: "Date", value: new Date().toUTCString() },
              { name: "Subject", value: "Quote for a water heater" },
              { name: "Message-ID", value: "<jane-1@example.com>" },
            ],
            body: { data: Buffer.from("Hi, could I get a quote this week?").toString("base64") },
          },
        },
      ],
    },
  });
  prismaMock.integration.findFirst.mockResolvedValue({
    id: "int1",
    refreshToken: "refresh",
    accountEmail: "info@samsplumbing.ca",
    watchExpiration: null,
    user: { email: "sam.smith@gmail.com" },
  });
  prismaMock.business.findUnique.mockResolvedValue({ name: "Sam's Plumbing", industry: "Plumbing" });
  prismaMock.filteredEmail.deleteMany.mockResolvedValue({ count: 0 });
  // This sync wins the lead: it is the one that must acknowledge.
  prismaMock.lead.findUnique.mockResolvedValue(null);
  prismaMock.lead.create.mockResolvedValue(newLead);
  // Neither sync has seen the conversation yet when they both look.
  prismaMock.conversation.findUnique.mockResolvedValue(null);
  prismaMock.conversation.create.mockResolvedValue({ id: "conv-mine", leadId: "lead1" });
  prismaMock.message.upsert.mockResolvedValue({});
});

describe("the sync that created the lead", () => {
  it("still acknowledges it when the other sync created the conversation first", async () => {
    prismaMock.conversation.create.mockRejectedValueOnce(uniqueViolation());
    prismaMock.conversation.findUnique
      .mockResolvedValueOnce(null) // the known-thread check, before classifying
      .mockResolvedValueOnce(null) // the read before creating
      .mockResolvedValueOnce({ id: "conv-theirs", leadId: "lead1" }); // the winner's row, after P2002

    const lead = await importGmailThread("biz1", "thread-1");

    expect(lead?.id).toBe("lead1");
    // Its messages go into the one conversation that exists, not a second.
    expect(prismaMock.message.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ conversationId: "conv-theirs" }) }));
    expect(acknowledgeNewLead).toHaveBeenCalledTimes(1);
    expect(acknowledgeNewLead).toHaveBeenCalledWith("lead1", expect.objectContaining({ channel: "email", emailThreadId: "thread-1" }));
  });

  it("still acknowledges it when the other sync wrote the message first", async () => {
    prismaMock.message.upsert.mockRejectedValueOnce(uniqueViolation());

    const lead = await importGmailThread("biz1", "thread-1");

    expect(lead?.id).toBe("lead1");
    expect(acknowledgeNewLead).toHaveBeenCalledTimes(1);
  });
});

describe("what is still a real failure", () => {
  it("a database error on the conversation create still fails the thread", async () => {
    // Only the lost race is absorbed; anything else must surface as before.
    prismaMock.conversation.create.mockRejectedValueOnce(new Error("Connection reset"));

    expect(await importGmailThread("biz1", "thread-1")).toBeNull();
    expect(acknowledgeNewLead).not.toHaveBeenCalled();
  });

  it("a P2002 whose winning row can't be read back still fails the thread", async () => {
    prismaMock.conversation.create.mockRejectedValueOnce(uniqueViolation());

    expect(await importGmailThread("biz1", "thread-1")).toBeNull();
    expect(prismaMock.message.upsert).not.toHaveBeenCalled();
    expect(acknowledgeNewLead).not.toHaveBeenCalled();
  });

  it("a database error on a message write still fails the thread", async () => {
    prismaMock.message.upsert.mockRejectedValueOnce(new Error("Connection reset"));

    expect(await importGmailThread("biz1", "thread-1")).toBeNull();
    expect(acknowledgeNewLead).not.toHaveBeenCalled();
  });
});
