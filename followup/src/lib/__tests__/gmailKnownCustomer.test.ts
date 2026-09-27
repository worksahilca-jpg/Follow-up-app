/**
 * A known customer's NEW email thread goes to their lead, unjudged
 * (daily-path sweep 2026-09-25 #3).
 *
 * The "already a lead, don't re-classify" check was per thread. Jane is a
 * lead from thread A; when she starts thread B, it was judged from scratch
 * and a "not a prospect" verdict set it aside — her new message never
 * reached her lead, no draft, no alert. WhatsApp already never
 * second-guesses a number it knows.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { threadsGet, threadsList, prismaMock, classifyWithSecondLook } = vi.hoisted(() => ({
  threadsGet: vi.fn(),
  threadsList: vi.fn(),
  classifyWithSecondLook: vi.fn(),
  prismaMock: {
    integration: { findFirst: vi.fn() },
    business: { findUnique: vi.fn() },
    filteredEmail: { deleteMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
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
    gmail: () => ({ users: { threads: { get: threadsGet, list: threadsList } } }),
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/integrations/openai", () => ({ classifyAsProspect: vi.fn(), classifyWithSecondLook }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn(async () => null) }));
vi.mock("@/lib/outboundWebhook", () => ({ notifyLeadEvent: vi.fn(async () => undefined) }));
vi.mock("@/lib/engagement", () => ({ checkRapidEngagement: vi.fn(async () => undefined) }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn(async () => undefined) }));
vi.mock("@/lib/acknowledge", () => ({ acknowledgeNewLead: vi.fn(async () => undefined) }));

import { fetchSalesConversations } from "@/lib/integrations/gmail";

const jane = {
  id: "lead1",
  name: "Jane Doe",
  email: "jane@example.com",
  company: null,
  source: "Gmail",
  dealValue: 0,
  score: 0,
  scoreReason: null,
  lastContacted: new Date(Date.now() - 86_400_000),
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
  vi.stubEnv("OPENAI_API_KEY", "sk-test");

  threadsList.mockResolvedValue({ data: { threads: [{ id: "thread-B" }] } });
  threadsGet.mockResolvedValue({
    data: {
      id: "thread-B",
      messages: [
        {
          id: "msg-B1",
          payload: {
            mimeType: "text/plain",
            headers: [
              { name: "From", value: "Jane Doe <jane@example.com>" },
              { name: "Date", value: new Date().toUTCString() },
              { name: "Subject", value: "One more thing" },
              { name: "Message-ID", value: "<jane-b1@example.com>" },
            ],
            body: { data: Buffer.from("Also — could you look at the downstairs tap?").toString("base64") },
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
  prismaMock.filteredEmail.findUnique.mockResolvedValue(null);
  prismaMock.conversation.findUnique.mockResolvedValue(null); // thread B is new
  prismaMock.conversation.create.mockResolvedValue({ id: "conv-B", leadId: "lead1" });
  prismaMock.message.upsert.mockResolvedValue({});
  prismaMock.lead.update.mockResolvedValue(jane);
  prismaMock.lead.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.lead.create.mockResolvedValue(jane);
  prismaMock.lead.findUniqueOrThrow.mockResolvedValue(jane);
});

describe("a new thread from someone who is already a lead", () => {
  it("is not re-judged, and lands on their lead", async () => {
    prismaMock.lead.findUnique.mockResolvedValue(jane);
    const leads = await fetchSalesConversations("biz1");
    expect(classifyWithSecondLook).not.toHaveBeenCalled();
    expect(prismaMock.filteredEmail.upsert).not.toHaveBeenCalled();
    expect(leads.map((l) => l.id)).toEqual(["lead1"]);
    expect(prismaMock.lead.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessId_email: { businessId: "biz1", email: "jane@example.com" } } })
    );
  });

  it("a stranger's new thread is still judged", async () => {
    prismaMock.lead.findUnique.mockResolvedValue(null);
    classifyWithSecondLook.mockResolvedValue({ isProspect: false, reason: "a newsletter" });
    await fetchSalesConversations("biz1");
    expect(classifyWithSecondLook).toHaveBeenCalledTimes(1);
    expect(prismaMock.filteredEmail.upsert).toHaveBeenCalledTimes(1);
  });
});
