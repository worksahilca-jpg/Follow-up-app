/**
 * Step 2 of research/product/2026-10-23-self-improving-loop.md: a sent reply names the AI answer whose draft it used,
 * and how much a person changed it (a number, never the words); a draft that no AI answer wrote is never traced to one.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", async (importOriginal) => ({
  clearStaleDraftLink: (await importOriginal<typeof import("@/lib/db")>()).clearStaleDraftLink,
  prisma: {
    lead: { findUnique: vi.fn(), update: vi.fn() },
    conversation: { findFirst: vi.fn(), create: vi.fn() },
    sendClaim: { create: vi.fn(), updateMany: vi.fn(async () => ({ count: 0 })), deleteMany: vi.fn() },
    message: { create: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(async () => 0) },
    followUp: { create: vi.fn() },
    business: { findUnique: vi.fn(async () => ({ allowModelTraining: false })) },
    outboundSend: { findFirst: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/integrations/gmail", () => ({ getGmailStatus: vi.fn(async () => ({ connected: false })), sendEmail: vi.fn() }));
vi.mock("@/lib/integrations/outlook", () => ({ getOutlookStatus: vi.fn(async () => ({ connected: false })), sendOutlookEmail: vi.fn() }));
vi.mock("@/lib/twilio", () => ({ sendSms: vi.fn(), sendWhatsApp: vi.fn() }));
vi.mock("@/lib/instagram", () => ({ sendInstagramMessage: vi.fn() }));
vi.mock("@/lib/facebook", () => ({ sendMessengerMessage: vi.fn(async () => ({ success: true })) }));
vi.mock("@/lib/crm", () => ({ CRM_PROVIDERS: {}, isCrmProvider: vi.fn(() => false) }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/sendCaps", () => ({ checkSendCap: vi.fn(async () => ({ allowed: true, used: 0, cap: 50 })) }));
vi.mock("@/lib/suppression", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/suppression")>()),
  isSuppressed: vi.fn(async () => false),
}));

import { prisma, clearStaleDraftLink } from "@/lib/db";
import { sendInstagramMessage } from "@/lib/instagram";
import { sendFollowUpToLead } from "@/lib/sending";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const instagramSend = sendInstagramMessage as unknown as ReturnType<typeof vi.fn>;
const DRAFT = "Yes, the condo on King St is still available. Would Thursday at 5 work for a showing?";
const PERSON = { humanSend: { userId: "u1" } };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  p.lead.findUnique.mockResolvedValue({
    id: "lead1", businessId: "biz1", name: "Sam", email: null, phone: "ig:3141592653589793",
    optedOutAt: null, crmProvider: null, crmId: null, suggestedMessage: DRAFT, suggestedResponseId: "chatcmpl-9",
  });
  p.lead.update.mockResolvedValue({});
  p.conversation.findFirst.mockResolvedValue({ id: "conv1" });
  p.message.create.mockResolvedValue({});
  p.message.updateMany.mockResolvedValue({ count: 1 });
  p.message.findFirst.mockResolvedValue({ sentAt: new Date() });
  p.followUp.create.mockResolvedValue({});
  p.outboundSend.findFirst.mockResolvedValue(null);
  instagramSend.mockResolvedValue({ success: true, messageId: "mid-1" });
});

const recorded = () => p.followUp.create.mock.calls[0][0].data as { responseId: string | null; editSize: number | null };

describe("a sent reply names the draft it used", () => {
  it("as written: the AI answer, nothing changed", async () => {
    await sendFollowUpToLead("lead1", DRAFT, { channel: "instagram", trigger: "manual", ...PERSON });
    expect(recorded()).toMatchObject({ responseId: "chatcmpl-9", editSize: 0 });
  });

  it("edited: the AI answer, and how much changed", async () => {
    await sendFollowUpToLead("lead1", DRAFT.replace("Thursday", "Friday"), { channel: "instagram", trigger: "manual", ...PERSON });
    const row = recorded();
    expect(row.responseId).toBe("chatcmpl-9");
    expect(row.editSize).toBeGreaterThan(0);
    expect(row.editSize).toBeLessThan(0.2);
  });

  it("sent by itself: the AI answer", async () => {
    await sendFollowUpToLead("lead1", DRAFT, { channel: "instagram", automated: true, trigger: "unanswered" });
    expect(recorded()).toMatchObject({ responseId: "chatcmpl-9", editSize: 0 });
  });

  it("never links a different message sent while the draft waits", async () => {
    await sendFollowUpToLead("lead1", "Thanks, we got your message.", { channel: "instagram", trigger: "instant_ack" });
    expect(recorded()).toMatchObject({ responseId: null, editSize: null });
  });

  it("never links a reply typed with no draft", async () => {
    p.lead.findUnique.mockResolvedValue({
      id: "lead1", businessId: "biz1", name: "Sam", email: null, phone: "ig:3141592653589793",
      optedOutAt: null, crmProvider: null, crmId: null, suggestedMessage: null, suggestedResponseId: null,
    });
    await sendFollowUpToLead("lead1", "Showings are weekdays after 4.", { channel: "instagram", trigger: "manual", ...PERSON });
    expect(recorded()).toMatchObject({ responseId: null, editSize: null });
  });
});

describe("clearStaleDraftLink", () => {
  it("clears the link when a draft is written without naming its AI answer", () => {
    const args = { data: { suggestedMessage: "Hi Sam, following up." } };
    clearStaleDraftLink(args);
    expect(args.data).toEqual({ suggestedMessage: "Hi Sam, following up.", suggestedResponseId: null });
    const cleared = { data: { suggestedMessage: null } };
    clearStaleDraftLink(cleared);
    expect(cleared.data).toEqual({ suggestedMessage: null, suggestedResponseId: null });
  });

  it("keeps the link a writer names, and leaves writes that don't touch the draft alone", () => {
    const named = { data: { suggestedMessage: "Hi", suggestedResponseId: "chatcmpl-2" } };
    clearStaleDraftLink(named);
    expect(named.data.suggestedResponseId).toBe("chatcmpl-2");
    const other = { data: { name: "Sam" } };
    clearStaleDraftLink(other);
    expect(other.data).toEqual({ name: "Sam" });
  });

  it("covers upserts and many rows at once", () => {
    const upsert = { create: { suggestedMessage: "a" }, update: { suggestedMessage: "b" } };
    clearStaleDraftLink(upsert);
    expect(upsert).toEqual({ create: { suggestedMessage: "a", suggestedResponseId: null }, update: { suggestedMessage: "b", suggestedResponseId: null } });
    const many = { data: [{ suggestedMessage: "a" }, { name: "x" }] };
    clearStaleDraftLink(many);
    expect(many.data).toEqual([{ suggestedMessage: "a", suggestedResponseId: null }, { name: "x" }]);
  });
});
