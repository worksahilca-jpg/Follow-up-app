/**
 * The Outlook half of "a newsletter is never a lead" (tester inbox,
 * 2026-10-07; Gmail's side is newsletterIsNotALead.test.ts). Graph returns
 * a message's own headers when asked; a broadcast says so in them, and is
 * set aside with a reason the owner can read, without asking the model.
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
    message: { upsert: vi.fn(), findMany: vi.fn(async () => []) },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/integrations/openai", () => ({ classifyWithSecondLook }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn(async () => null) }));
vi.mock("@/lib/outboundWebhook", () => ({ notifyLeadEvent: vi.fn(async () => undefined) }));
vi.mock("@/lib/engagement", () => ({ checkRapidEngagement: vi.fn(async () => undefined) }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn(async () => undefined) }));
vi.mock("@/lib/acknowledge", () => ({ acknowledgeNewLead: vi.fn(async () => undefined) }));

vi.mock("@/lib/senderVerdicts", () => ({
  OWNER_SAID_NOT_CUSTOMER: "x",
  ownerSaidNotCustomer: vi.fn(async () => false),
  recentCorrections: vi.fn(async () => []),
}));
vi.mock("@/lib/businessFacts", () => ({ getBusinessAbout: vi.fn(async () => null) }));

import { conversationMessagesPath, fetchOutlookConversations } from "@/lib/integrations/outlook";
import { NEWSLETTER_REASON } from "@/lib/bulkMail";

const lead = {
  id: "lead1", name: "Course Creator", email: "hello@creator.example", company: null, source: "Outlook",
  dealValue: 0, score: 0, scoreReason: null, lastContacted: new Date(), nextFollowUp: null, notes: null, automationTier: "HOLD",
};

let headers: { name: string; value: string }[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("OPENAI_API_KEY", "sk-test");
  headers = [];
  prismaMock.integration.findFirst.mockResolvedValue({
    id: "int1", accessToken: "access", refreshToken: "refresh", tokenExpiresAt: new Date(Date.now() + 3_600_000),
    accountEmail: "owner@outlook.example", deltaLink: null, user: { email: "owner@outlook.example" },
  });
  prismaMock.integration.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.business.findUnique.mockResolvedValue({ name: "Owner", industry: "Other", users: [] });
  prismaMock.filteredEmail.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.filteredEmail.findUnique.mockResolvedValue(null);
  prismaMock.conversation.findUnique.mockResolvedValue(null);
  prismaMock.conversation.create.mockResolvedValue({ id: "conv-1", leadId: "lead1" });
  prismaMock.message.upsert.mockResolvedValue({});
  prismaMock.lead.findUnique.mockResolvedValue(null);
  prismaMock.lead.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.lead.create.mockResolvedValue(lead);
  prismaMock.lead.findUniqueOrThrow.mockResolvedValue(lead);
  classifyWithSecondLook.mockResolvedValue({ isProspect: true, reason: "asked" });

  vi.spyOn(global, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/delta")) {
      return new Response(JSON.stringify({ value: [{ id: "m1", conversationId: "conv-1" }], "@odata.deltaLink": "https://graph.microsoft.com/v1.0/delta-next" }), { status: 200 });
    }
    return new Response(
      JSON.stringify({
        value: [
          {
            id: "m1",
            conversationId: "conv-1",
            subject: "Page seven",
            body: { contentType: "text", content: "Open this link to see page seven." },
            from: { emailAddress: { name: "Course Creator", address: "hello@creator.example" } },
            receivedDateTime: new Date().toISOString(),
            internetMessageHeaders: headers,
          },
        ],
      }),
      { status: 200 }
    );
  });
});

afterEach(() => vi.restoreAllMocks());

describe("a newsletter in an Outlook inbox", () => {
  it("asks Graph for each message's headers", () => {
    expect(new URLSearchParams(conversationMessagesPath("c1").split("?")[1]).get("$select")?.split(",")).toContain("internetMessageHeaders");
  });

  it("is set aside with a reason, without asking the model", async () => {
    headers = [{ name: "List-Unsubscribe", value: "<https://creator.example/unsubscribe>" }];
    const leads = await fetchOutlookConversations("biz1");
    expect(leads).toEqual([]);
    expect(classifyWithSecondLook).not.toHaveBeenCalled();
    expect(prismaMock.filteredEmail.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ provider: "outlook", reason: NEWSLETTER_REASON }) })
    );
  });

  it("stays out even when that sender was let in by mistake before", async () => {
    headers = [{ name: "List-Unsubscribe", value: "<https://creator.example/unsubscribe>" }];
    prismaMock.lead.findUnique.mockResolvedValue(lead);
    expect(await fetchOutlookConversations("biz1")).toEqual([]);
    expect(prismaMock.conversation.create).not.toHaveBeenCalled();
  });

  it("a person writing in, with no bulk headers, is judged as before", async () => {
    await fetchOutlookConversations("biz1");
    expect(classifyWithSecondLook).toHaveBeenCalledTimes(1);
    expect(prismaMock.filteredEmail.upsert).not.toHaveBeenCalled();
  });
});
