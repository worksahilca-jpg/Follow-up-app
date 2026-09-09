/**
 * Guarantees of the instant acknowledgement (src/lib/acknowledge.ts):
 * once per lead, never if the owner already replied, never for stale
 * inbound, never for OFF leads, never when switched off, and — since
 * this became a generated reply rather than a fixed template — that the
 * risk gate/fallback machinery around generateInstantReply behaves
 * correctly: AUTONOMOUS skips the risk check, everything else falls
 * back to the always-safe generic line on anything but "low" risk or a
 * generation failure, and nothing is ever held for approval (delaying
 * the very first touch defeats the point of "instant").
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
vi.mock("@/lib/integrations/openai", () => ({
  localizeFixedText: vi.fn(async (t: string) => t),
  generateInstantReply: vi.fn(async () => "Got it — I'll get you the exact price and Manoj will follow up shortly."),
  assessSendRisk: vi.fn(async () => ({ riskLevel: "low", reason: "" })),
}));
vi.mock("@/lib/sender", () => ({
  getSenderFirstName: vi.fn(async () => "Manoj"),
  composeFollowUpEmail: vi.fn(async (first: string, _b: string, body: string) => `Hi ${first},\n\n${body}\n\nBest,\nManoj`),
}));
vi.mock("@/lib/sending", () => ({ sendFollowUpToLead: vi.fn(async () => ({ success: true })) }));

import { prisma } from "@/lib/db";
import { sendFollowUpToLead } from "@/lib/sending";
import { acknowledgeNewLead } from "@/lib/acknowledge";
import { localizeFixedText, generateInstantReply, assessSendRisk } from "@/lib/integrations/openai";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const send = sendFollowUpToLead as unknown as ReturnType<typeof vi.fn>;
const localize = localizeFixedText as unknown as ReturnType<typeof vi.fn>;
const generateReply = generateInstantReply as unknown as ReturnType<typeof vi.fn>;
const assessRisk = assessSendRisk as unknown as ReturnType<typeof vi.fn>;

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
  localize.mockImplementation(async (t: string) => t);
  generateReply.mockResolvedValue("Got it — I'll get you the exact price and Manoj will follow up shortly.");
  assessRisk.mockResolvedValue({ riskLevel: "low", reason: "" });
});

describe("instant acknowledgement", () => {
  it("sends the AI-generated reply once, on the channel the lead used, after a low-risk assessment", async () => {
    const r = await acknowledgeNewLead("lead1", { channel: "text", inboundText: "Is the roof original?", inboundAt: new Date() });
    expect(r.sent).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    const [, body, opts] = send.mock.calls[0];
    expect(body).toBe("Hi! Got it — I'll get you the exact price and Manoj will follow up shortly.");
    expect(opts).toMatchObject({ automated: true, channel: "text" });
    expect(generateReply).toHaveBeenCalledWith(expect.objectContaining({ inboundText: "Is the roof original?" }));
    expect(assessRisk).toHaveBeenCalledTimes(1);
    // The claim is atomic: only rows still unacknowledged are updated.
    expect(p.lead.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "lead1", acknowledgedAt: null } }));
  });

  it("skips the risk check entirely for an AUTONOMOUS lead", async () => {
    p.lead.findUnique.mockResolvedValue({ ...baseLead, automationTier: "AUTONOMOUS" });
    const r = await acknowledgeNewLead("lead1", { channel: "text", inboundText: "Is the roof original?", inboundAt: new Date() });
    expect(r.sent).toBe(true);
    expect(assessRisk).not.toHaveBeenCalled();
    const [, body] = send.mock.calls[0];
    expect(body).toContain("Got it");
  });

  it("falls back to the generic, always-safe line when the risk check comes back anything but low", async () => {
    assessRisk.mockResolvedValue({ riskLevel: "medium", reason: "unverifiable specific" });
    const r = await acknowledgeNewLead("lead1", { channel: "text", inboundText: "Is the roof original?", inboundAt: new Date() });
    expect(r.sent).toBe(true);
    const [, body] = send.mock.calls[0];
    expect(body).toBe("Hi! Thanks for reaching out to MJ Homes — I'll take a look and Manoj will follow up shortly.");
  });

  it("falls back to the generic line if generation itself throws, without failing the send", async () => {
    generateReply.mockRejectedValue(new Error("rate limited"));
    const r = await acknowledgeNewLead("lead1", { channel: "text", inboundText: "Is the roof original?", inboundAt: new Date() });
    expect(r.sent).toBe(true);
    const [, body] = send.mock.calls[0];
    expect(body).toContain("Thanks for reaching out to MJ Homes");
    expect(assessRisk).not.toHaveBeenCalled(); // never reached — generation failed first
  });

  it("uses the generic line with no generation attempt when there's no inbound text to respond to", async () => {
    const r = await acknowledgeNewLead("lead1", { channel: "text", inboundAt: new Date() });
    expect(r.sent).toBe(true);
    expect(generateReply).not.toHaveBeenCalled();
    const [, body] = send.mock.calls[0];
    expect(body).toContain("Thanks for reaching out to MJ Homes");
  });

  // Task #63: verifies the actual code path a non-English lead goes
  // through for the fallback line specifically (the generated-reply path
  // itself is covered by prompts.test.ts's own language/tone assertions
  // on generateInstantReply's prompt). This is deliberately NOT a
  // substitute for a real end-to-end test with an actual non-English
  // lead and native-speaker review of the output — it can't be, without
  // a live model call and a real speaker to judge it — but it does prove
  // the fallback line is handed the lead's real inbound text for
  // translation, and whatever comes back is sent unmodified.
  it("hands the lead's real inbound text to the fallback localizer when falling back, and sends back whatever it returns", async () => {
    generateReply.mockRejectedValue(new Error("rate limited"));
    localize.mockImplementationOnce(async (_template: string, sample: string) => {
      expect(sample).toBe("Hola, ¿todavía tienen la casa disponible?");
      return "¡Hola! Gracias por contactar a MJ Homes — lo revisaré y Manoj te responderá pronto.";
    });
    const r = await acknowledgeNewLead("lead1", {
      channel: "text",
      inboundText: "Hola, ¿todavía tienen la casa disponible?",
      inboundAt: new Date(),
    });
    expect(r.sent).toBe(true);
    expect(localize).toHaveBeenCalledWith(expect.any(String), "Hola, ¿todavía tienen la casa disponible?");
    const [, body] = send.mock.calls[0];
    expect(body).toBe("Hi! ¡Hola! Gracias por contactar a MJ Homes — lo revisaré y Manoj te responderá pronto.");
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
    expect(body).toContain("Thanks for reaching out to MJ Homes");
    expect(opts).toMatchObject({ channel: "email", subject: "Re: Roof question", emailThreadId: "t1", emailInReplyTo: "<abc@mail>" });
  });

  it("releases the claim when the send fails so a later channel can still acknowledge", async () => {
    send.mockResolvedValue({ success: false, message: "Twilio not configured" });
    const r = await acknowledgeNewLead("lead1", { channel: "text", inboundAt: new Date() });
    expect(r.sent).toBe(false);
    expect(p.lead.updateMany).toHaveBeenLastCalledWith({ where: { id: "lead1" }, data: { acknowledgedAt: null } });
  });
});
