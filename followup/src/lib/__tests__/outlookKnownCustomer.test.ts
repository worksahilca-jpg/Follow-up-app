/**
 * The Outlook half of the known-customer rule (b005, 2026-09-29).
 *
 * A sender who is already this business's lead is a customer, and their new
 * thread is never put to the model: whatever it says about deposit paperwork
 * or a rescheduled visit, it cannot set a known client aside. Gmail's side
 * is gmailKnownCustomer.test.ts; this one had no test.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { prismaMock, classifyWithSecondLook } = vi.hoisted(() => ({
  classifyWithSecondLook: vi.fn(),
  prismaMock: {
    integration: { findFirst: vi.fn(), updateMany: vi.fn() },
    business: { findUnique: vi.fn() },
    filteredEmail: { deleteMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
    lead: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    conversation: { findUnique: vi.fn(), create: vi.fn() },
    message: { upsert: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/integrations/openai", () => ({ classifyWithSecondLook }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn(async () => null) }));
vi.mock("@/lib/outboundWebhook", () => ({ notifyLeadEvent: vi.fn(async () => undefined) }));
vi.mock("@/lib/engagement", () => ({ checkRapidEngagement: vi.fn(async () => undefined) }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn(async () => undefined) }));
vi.mock("@/lib/acknowledge", () => ({ acknowledgeNewLead: vi.fn(async () => undefined) }));

import { fetchOutlookConversations } from "@/lib/integrations/outlook";

const mark = {
  id: "lead1",
  name: "Mark Chen",
  email: "mark@example.com",
  company: null,
  source: "Outlook",
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
  vi.stubEnv("OPENAI_API_KEY", "sk-test");

  prismaMock.integration.findFirst.mockResolvedValue({
    id: "int1",
    accessToken: "access",
    refreshToken: "refresh",
    tokenExpiresAt: new Date(Date.now() + 3_600_000),
    accountEmail: "info@maplekey.example",
    deltaLink: null,
    user: { email: "owner@maplekey.example" },
  });
  prismaMock.integration.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.business.findUnique.mockResolvedValue({ name: "Maple Key Realty", industry: "Real estate", users: [] });
  prismaMock.filteredEmail.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.filteredEmail.findUnique.mockResolvedValue(null);
  prismaMock.conversation.findUnique.mockResolvedValue(null); // a new thread
  prismaMock.conversation.create.mockResolvedValue({ id: "conv-B", leadId: "lead1" });
  prismaMock.message.upsert.mockResolvedValue({});
  prismaMock.lead.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.lead.create.mockResolvedValue(mark);
  prismaMock.lead.findUniqueOrThrow.mockResolvedValue(mark);

  vi.spyOn(global, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/delta")) {
      return new Response(
        JSON.stringify({ value: [{ id: "m1", conversationId: "conv-B" }], "@odata.deltaLink": "https://graph.microsoft.com/v1.0/delta-next" }),
        { status: 200 }
      );
    }
    return new Response(
      JSON.stringify({
        value: [
          {
            id: "m1",
            conversationId: "conv-B",
            subject: "Deposit for Elm St",
            body: {
              contentType: "text",
              content: "Attached is the deposit receipt and my ID for the offer on Elm St. Let me know what else you need to sign.",
            },
            from: { emailAddress: { name: "Mark Chen", address: "Mark@Example.com" } },
            receivedDateTime: new Date().toISOString(),
          },
        ],
      }),
      { status: 200 }
    );
  });
});

afterEach(() => vi.restoreAllMocks());

describe("an Outlook thread from someone who is already a lead", () => {
  it("is kept without asking the model, and lands on their lead", async () => {
    prismaMock.lead.findUnique.mockResolvedValue(mark);
    const leads = await fetchOutlookConversations("biz1");
    expect(classifyWithSecondLook).not.toHaveBeenCalled();
    expect(prismaMock.filteredEmail.upsert).not.toHaveBeenCalled();
    expect(prismaMock.lead.create).not.toHaveBeenCalled();
    expect(leads.map((l) => l.id)).toEqual(["lead1"]);
    // Looked up inside this business only, by the lowercased address.
    expect(prismaMock.lead.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessId_email: { businessId: "biz1", email: "mark@example.com" } } })
    );
  });

  it("a stranger's thread is still judged, and can still be set aside", async () => {
    prismaMock.lead.findUnique.mockResolvedValue(null);
    classifyWithSecondLook.mockResolvedValue({ isProspect: false, reason: "a newsletter" });
    const leads = await fetchOutlookConversations("biz1");
    expect(classifyWithSecondLook).toHaveBeenCalledTimes(1);
    expect(prismaMock.filteredEmail.upsert).toHaveBeenCalledTimes(1);
    expect(leads).toEqual([]);
  });
});
