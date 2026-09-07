/**
 * Guarantees of the instant acknowledgement (src/lib/acknowledge.ts):
 * once per lead, never if the owner already replied, never for stale
 * inbound, never for OFF leads, never when switched off, and the text is
 * the fixed template — nothing invented.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    lead: { findUnique: vi.fn(), updateMany: vi.fn() },
    message: { findFirst: vi.fn() },
    automation: { findFirst: vi.fn() },
    business: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/integrations/openai", () => ({ localizeFixedText: vi.fn(async (t: string) => t) }));
vi.mock("@/lib/sender", () => ({
  getSenderFirstName: vi.fn(async () => "Manoj"),
  composeFollowUpEmail: vi.fn(async (first: string, _b: string, body: string) => `Hi ${first},\n\n${body}\n\nBest,\nManoj`),
}));
vi.mock("@/lib/sending", () => ({ sendFollowUpToLead: vi.fn(async () => ({ success: true })) }));

import { prisma } from "@/lib/db";
import { sendFollowUpToLead } from "@/lib/sending";
import { acknowledgeNewLead } from "@/lib/acknowledge";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const send = sendFollowUpToLead as unknown as ReturnType<typeof vi.fn>;

const baseLead = {
  id: "lead1",
  businessId: "biz1",
  name: "Young Son",
  email: "young@example.com",
  phone: "+15551234567",
  automationTier: "ASSISTED",
  acknowledgedAt: null,
};

beforeEach(() => {
  p.lead.findUnique.mockResolvedValue({ ...baseLead });
  p.lead.updateMany.mockResolvedValue({ count: 1 });
  p.message.findFirst.mockResolvedValue(null);
  p.automation.findFirst.mockResolvedValue(null); // absent row = on by default
  p.business.findUnique.mockResolvedValue({ name: "MJ Homes" });
  send.mockResolvedValue({ success: true });
});

describe("instant acknowledgement", () => {
  it("sends the fixed template once, on the channel the lead used", async () => {
    const r = await acknowledgeNewLead("lead1", { channel: "text", inboundText: "Is the roof original?", inboundAt: new Date() });
    expect(r.sent).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    const [, body, opts] = send.mock.calls[0];
    expect(body).toBe("Hi! Thanks for reaching out to MJ Homes. We got your message and Manoj will get back to you shortly.");
    expect(opts).toMatchObject({ automated: true, channel: "text" });
    // The claim is atomic: only rows still unacknowledged are updated.
    expect(p.lead.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "lead1", acknowledgedAt: null } }));
  });

  it("never sends twice: an already-acknowledged lead is skipped before any work", async () => {
    p.lead.findUnique.mockResolvedValue({ ...baseLead, acknowledgedAt: new Date() });
    const r = await acknowledgeNewLead("lead1", { channel: "text", inboundAt: new Date() });
    expect(r).toEqual({ sent: false, reason: "already acknowledged" });
    expect(send).not.toHaveBeenCalled();
  });

  it("loses the race gracefully: a zero-row claim means someone else sent it", async () => {
    p.lead.updateMany.mockResolvedValue({ count: 0 });
    const r = await acknowledgeNewLead("lead1", { channel: "text", inboundAt: new Date() });
    expect(r.sent).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("never speaks over the owner: any prior outbound message blocks it", async () => {
    p.message.findFirst.mockResolvedValue({ id: "m1" });
    const r = await acknowledgeNewLead("lead1", { channel: "text", inboundAt: new Date() });
    expect(r).toEqual({ sent: false, reason: "owner already replied" });
    expect(send).not.toHaveBeenCalled();
  });

  it("never acknowledges old mail found by a deep sync", async () => {
    const r = await acknowledgeNewLead("lead1", { channel: "email", inboundAt: new Date(Date.now() - 2 * 60 * 60_000) });
    expect(r).toEqual({ sent: false, reason: "inbound too old" });
    expect(send).not.toHaveBeenCalled();
  });

  it("respects a lead the owner set to OFF", async () => {
    p.lead.findUnique.mockResolvedValue({ ...baseLead, automationTier: "OFF" });
    const r = await acknowledgeNewLead("lead1", { channel: "text", inboundAt: new Date() });
    expect(r).toEqual({ sent: false, reason: "lead is OFF" });
    expect(send).not.toHaveBeenCalled();
  });

  it("respects the business-level switch", async () => {
    p.automation.findFirst.mockResolvedValue({ enabled: false });
    const r = await acknowledgeNewLead("lead1", { channel: "text", inboundAt: new Date() });
    expect(r).toEqual({ sent: false, reason: "switched off" });
    expect(send).not.toHaveBeenCalled();
  });

  it("replies in the email thread with a Re: subject", async () => {
    await acknowledgeNewLead("lead1", {
      channel: "email",
      inboundAt: new Date(),
      emailThreadId: "t1",
      emailMessageId: "<abc@mail>",
      emailSubject: "Fwd: Roof question",
    });
    const [, body, opts] = send.mock.calls[0];
    expect(body).toContain("Hi Young,");
    expect(body).toContain("Thanks for reaching out to MJ Homes.");
    expect(opts).toMatchObject({ channel: "email", subject: "Re: Roof question", emailThreadId: "t1", emailInReplyTo: "<abc@mail>" });
  });

  it("releases the claim when the send fails so a later channel can still acknowledge", async () => {
    send.mockResolvedValue({ success: false, message: "Twilio not configured" });
    const r = await acknowledgeNewLead("lead1", { channel: "text", inboundAt: new Date() });
    expect(r.sent).toBe(false);
    expect(p.lead.updateMany).toHaveBeenLastCalledWith({ where: { id: "lead1" }, data: { acknowledgedAt: null } });
  });
});
