/**
 * A newsletter is never a lead (tester inbox, 2026-10-07).
 *
 * A creator's newsletter landed in Primary, the classifier let one thread
 * in, and every later thread from the same address skipped the classifier
 * as a "known customer": one lead, 25 threads, all marketing. Bulk mail
 * says so in its headers, so it is now set aside before any of that, with
 * a reason the owner can read and overrule. A real enquiry, a Google Group
 * relaying one, a form notice and a conversation the owner joined are not.
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
    message: { upsert: vi.fn(), findFirst: vi.fn(async () => null) },
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
import { isBulkMail, isNewsletterThread, NEWSLETTER_REASON } from "@/lib/bulkMail";

const creator = {
  id: "lead1",
  name: "The Course Creator",
  email: "hello@creator.e.podia.com",
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

function message(id: string, from: string, extra: { name: string; value: string }[] = []) {
  return {
    id,
    payload: {
      mimeType: "text/plain",
      headers: [
        { name: "From", value: from },
        { name: "Date", value: new Date().toUTCString() },
        { name: "Subject", value: "Page seven, and a secret link" },
        { name: "Message-ID", value: `<${id}@example.com>` },
        ...extra,
      ],
      body: { data: Buffer.from("Open this link to see what is on page seven.").toString("base64") },
    },
  };
}

const unsubscribe = { name: "List-Unsubscribe", value: "<https://creator.podia.com/unsubscribe?u=1>" };

function thread(messages: ReturnType<typeof message>[]) {
  threadsGet.mockResolvedValue({ data: { id: "thread-1", messages } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("GOOGLE_CLIENT_ID", "client");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
  vi.stubEnv("GOOGLE_REDIRECT_URI", "https://followupbase.io/api/integrations/gmail/callback");
  vi.stubEnv("OPENAI_API_KEY", "sk-test");

  threadsList.mockResolvedValue({ data: { threads: [{ id: "thread-1" }] } });
  prismaMock.integration.findFirst.mockResolvedValue({
    id: "int1",
    refreshToken: "refresh",
    accountEmail: "owner@gmail.com",
    watchExpiration: null,
    user: { email: "owner@gmail.com" },
  });
  prismaMock.business.findUnique.mockResolvedValue({ name: "Owner", industry: "Other" });
  prismaMock.filteredEmail.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.filteredEmail.findUnique.mockResolvedValue(null);
  prismaMock.conversation.findUnique.mockResolvedValue(null);
  prismaMock.conversation.create.mockResolvedValue({ id: "conv-1", leadId: "lead1" });
  prismaMock.message.upsert.mockResolvedValue({});
  prismaMock.lead.findUnique.mockResolvedValue(null);
  prismaMock.lead.update.mockResolvedValue(creator);
  prismaMock.lead.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.lead.create.mockResolvedValue(creator);
  prismaMock.lead.findUniqueOrThrow.mockResolvedValue(creator);
  classifyWithSecondLook.mockResolvedValue({ isProspect: true, reason: "asked about something" });
});

describe("a newsletter in the inbox", () => {
  it("is set aside with a reason the owner can read, without asking the AI", async () => {
    thread([message("m1", "The Course Creator <hello@creator.e.podia.com>", [unsubscribe])]);
    const leads = await fetchSalesConversations("biz1");
    expect(leads).toEqual([]);
    expect(classifyWithSecondLook).not.toHaveBeenCalled();
    expect(prismaMock.lead.create).not.toHaveBeenCalled();
    expect(prismaMock.filteredEmail.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ senderEmail: "hello@creator.e.podia.com", reason: NEWSLETTER_REASON }),
      })
    );
  });

  it("stays out even when that sender was wrongly let in before: one mistake no longer pulls in the rest", async () => {
    prismaMock.lead.findUnique.mockResolvedValue(creator);
    thread([message("m1", "The Course Creator <hello@creator.e.podia.com>", [unsubscribe])]);
    const leads = await fetchSalesConversations("biz1");
    expect(leads).toEqual([]);
    expect(prismaMock.conversation.create).not.toHaveBeenCalled();
  });

  it("a person writing in, with no unsubscribe link, is still judged as before", async () => {
    thread([message("m1", "Jane Doe <jane@example.com>")]);
    await fetchSalesConversations("biz1");
    expect(classifyWithSecondLook).toHaveBeenCalledTimes(1);
    expect(prismaMock.filteredEmail.upsert).not.toHaveBeenCalled();
  });

  it("a customer's enquiry relayed through the business's own Google Group is not a newsletter", async () => {
    thread([
      message("m1", "Jane Doe <jane@example.com>", [
        { name: "List-Unsubscribe", value: "<mailto:googlegroups-manage+1+unsubscribe@googlegroups.com>" },
        { name: "X-Google-Group-Id", value: "12345" },
        { name: "Mailing-list", value: "list info@mybusiness.ca; contact info+owners@mybusiness.ca" },
      ]),
    ]);
    await fetchSalesConversations("biz1");
    expect(classifyWithSecondLook).toHaveBeenCalledTimes(1);
    expect(prismaMock.filteredEmail.upsert).not.toHaveBeenCalled();
  });

  it("a thread the owner replied in is a conversation, not a broadcast, and goes to the AI", async () => {
    thread([
      message("m1", "The Course Creator <hello@creator.e.podia.com>", [unsubscribe]),
      message("m2", "Owner <owner@gmail.com>"),
    ]);
    await fetchSalesConversations("biz1");
    expect(classifyWithSecondLook).toHaveBeenCalledTimes(1);
  });
});

describe("telling bulk mail from a person", () => {
  it("reads the bulk headers, whatever their case", () => {
    expect(isBulkMail([{ name: "list-unsubscribe", value: "<https://x>" }])).toBe(true);
    expect(isBulkMail([{ name: "Precedence", value: " Bulk " }])).toBe(true);
    expect(isBulkMail([{ name: "Precedence", value: "list" }])).toBe(false);
    expect(isBulkMail([{ name: "From", value: "jane@example.com" }])).toBe(false);
    expect(isBulkMail(undefined)).toBe(false);
  });

  it("never judges a form or lead-site notice by its headers", () => {
    const notice = [{ from: { email: "no-reply@thumbtack.com" }, direction: "inbound" as const, bulk: true }];
    expect(isNewsletterThread(notice, { email: "no-reply@thumbtack.com", shared: true })).toBe(false);
  });

  it("needs every message from that sender to be bulk", () => {
    const mixed = [
      { from: { email: "News@Shop.com" }, direction: "inbound" as const, bulk: true },
      { from: { email: "news@shop.com" }, direction: "inbound" as const, bulk: false },
    ];
    expect(isNewsletterThread(mixed, { email: "news@shop.com", shared: false })).toBe(false);
    expect(isNewsletterThread([mixed[0]], { email: "news@shop.com", shared: false })).toBe(true);
  });
});
