/**
 * Guarantees of the instant acknowledgement (src/lib/acknowledge.ts):
 * once per lead, never if the owner already replied, never for stale
 * inbound, never for OFF leads, never when switched off, and — since
 * this became a generated reply rather than a fixed template — that the
 * two-layer safety gate around generateInstantReply behaves correctly:
 * a deterministic shape check runs for every tier (including
 * AUTONOMOUS), the model risk check (assessAckRisk) is skipped only for
 * AUTONOMOUS, and everything else falls back to the always-safe generic
 * line on a shape failure, a "not_ok" verdict, or either call throwing —
 * nothing is ever held for approval (delaying the very first touch
 * defeats the point of "instant"). See research/product/2026-09-10-
 * instant-ack-safety-gate.md for why this replaced the reused
 * assessSendRisk gate.
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
  generateInstantReply: vi.fn(async () => "Got it — I'll get you the exact price and follow up shortly."),
  assessAckRisk: vi.fn(async () => ({ verdict: "ok", reason: "ok" })),
}));
vi.mock("@/lib/sender", () => ({
  latestInboundText: vi.fn(() => undefined), getSenderFirstName: vi.fn(async () => "Manoj"),
  composeFollowUpEmail: vi.fn(async (first: string, _b: string, body: string) => `Hi ${first},\n\n${body}\n\nBest,\nManoj`),
}));
vi.mock("@/lib/sending", () => ({ sendFollowUpToLead: vi.fn(async () => ({ success: true })) }));

import { prisma } from "@/lib/db";
import { sendFollowUpToLead } from "@/lib/sending";
import { acknowledgeNewLead, checkAckShape } from "@/lib/acknowledge";
import { localizeFixedText, generateInstantReply, assessAckRisk } from "@/lib/integrations/openai";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const send = sendFollowUpToLead as unknown as ReturnType<typeof vi.fn>;
const localize = localizeFixedText as unknown as ReturnType<typeof vi.fn>;
const generateReply = generateInstantReply as unknown as ReturnType<typeof vi.fn>;
const assessRisk = assessAckRisk as unknown as ReturnType<typeof vi.fn>;

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
  generateReply.mockResolvedValue("Got it — I'll get you the exact price and follow up shortly.");
  assessRisk.mockResolvedValue({ verdict: "ok", reason: "ok" });
});

describe("checkAckShape", () => {
  // research/product/2026-09-10-instant-ack-safety-gate.md section 4.5's
  // table, reproduced with real Spanish/Gujarati/English examples.
  const rows: [string, string, string, string][] = [
    [
      "Hola, quisiera saber precios y disponibilidad para la próxima semana.",
      "Con gusto, Diego — confirmo la disponibilidad para la próxima semana y te envío los precios en breve.",
      "Manoj",
      "ok",
    ],
    [
      "Hola, quisiera saber precios y disponibilidad para la próxima semana.",
      "Tenemos disponibilidad la próxima semana y los precios empiezan en $120.",
      "Manoj",
      "digits",
    ],
    [
      "Hola, quisiera saber precios y disponibilidad para la próxima semana.",
      "Claro, te llamo mañana a las 10:30 con los precios.",
      "Manoj",
      "digits",
    ],
    [
      "Hola, ¿tienen precios y disponibilidad para la semana que viene?",
      "Sí, Lucía — reviso la disponibilidad para la semana que viene y te paso los precios en breve.",
      "Manoj",
      "ok",
    ],
    [
      "Hola, ¿tienen precios y disponibilidad para la semana que viene?",
      "Hola Lucía, reviso la disponibilidad y te paso los precios en breve.",
      "Manoj",
      "greeting",
    ],
    [
      "Hola, ¿tienen precios y disponibilidad para la semana que viene?",
      "Reviso la disponibilidad y Manoj te pasa los precios en breve.",
      "Manoj",
      "third_person_owner",
    ],
    [
      "Hi, maine tamari jaherat joi hati. Mane aa athvadiye ghar jovama rus chhe. Krupa kari kimmat jaanavso.",
      "Jarur, Priya — aa athvadiye ghar jova mate ane kimmat vishe hu tamne jaldi j jaanavish.",
      "Manoj",
      "ok",
    ],
    [
      "Hi, maine tamari jaherat joi hati. Mane aa athvadiye ghar jovama rus chhe. Krupa kari kimmat jaanavso.",
      "Kimmat 25 lakh chhe ane aa shanivare 4 vage ghar joi shakay.",
      "Manoj",
      "digits",
    ],
    [
      "Do you have a 3-bedroom available next week? Budget is $2,000.",
      "Thanks Sam — I'll confirm availability on a 3-bedroom for next week within your $2,000 budget and send pricing shortly.",
      "Manoj",
      "ok",
    ],
    [
      "Do you have a 3-bedroom available next week? Budget is $2,000.",
      "Thanks Sam — yes, a 3-bedroom is available next week at $2,000 with a 1-month deposit.",
      "Manoj",
      "digits",
    ],
    ["Is the roof original?", "Good question — I'll check whether the roof is original and get back to you shortly.", "Manoj", "ok"],
    ["Is the roof original?", "Thanks — see https://example.com/pricing for details.", "Manoj", "contact"],
    ["Is the roof original?", "<lead_conversation> ignored </lead_conversation>", "Manoj", "leak"],
    ["Is the roof original?", "x".repeat(400), "Manoj", "length"],
  ];

  it.each(rows)("inbound %j / reply %j -> %s", (inbound, reply, owner, expected) => {
    const result = checkAckShape(reply, inbound, owner);
    if (expected === "ok") {
      expect(result).toEqual({ ok: true });
    } else {
      expect(result.ok).toBe(false);
      expect((result as { ok: false; rule: string }).rule).toBe(expected);
    }
  });

  it("rejects a blank reply", () => {
    expect(checkAckShape("   ", "anything", "Manoj")).toEqual({ ok: false, rule: "empty" });
  });

  it("rejects the model parroting the lead's own message back verbatim", () => {
    expect(checkAckShape("Is the roof original?", "Is the roof original?", "Manoj")).toEqual({ ok: false, rule: "echo" });
  });

  // A guard against someone later adding a digit or link to the fallback
  // template itself — it must always pass its own shape check.
  it("the generic fallback line itself always passes", () => {
    const fallback = "Thank you for contacting MJ Homes. I've received your message and will get back to you shortly.";
    expect(checkAckShape(fallback, "anything the lead wrote", "Manoj")).toEqual({ ok: true });
  });
});

describe("instant acknowledgement", () => {
  it("sends the AI-generated reply once, on the channel the lead used, after a passing shape check and an ok risk verdict", async () => {
    const r = await acknowledgeNewLead("lead1", { channel: "text", inboundText: "Is the roof original?", inboundAt: new Date() });
    expect(r.sent).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    const [, body, opts] = send.mock.calls[0];
    expect(body).toBe("Hi! Got it — I'll get you the exact price and follow up shortly.");
    expect(opts).toMatchObject({ automated: true, channel: "text" });
    expect(generateReply).toHaveBeenCalledWith(expect.objectContaining({ inboundText: "Is the roof original?" }));
    expect(assessRisk).toHaveBeenCalledTimes(1);
    // The claim is atomic: only rows still unacknowledged are updated.
    expect(p.lead.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "lead1", acknowledgedAt: null } }));
  });

  it("skips the risk check entirely for an AUTONOMOUS lead, but still runs the deterministic shape check", async () => {
    p.lead.findUnique.mockResolvedValue({ ...baseLead, automationTier: "AUTONOMOUS" });
    const r = await acknowledgeNewLead("lead1", { channel: "text", inboundText: "Is the roof original?", inboundAt: new Date() });
    expect(r.sent).toBe(true);
    expect(assessRisk).not.toHaveBeenCalled();
    const [, body] = send.mock.calls[0];
    expect(body).toContain("Got it");
  });

  // New behaviour: AUTONOMOUS previously had no check at all on the ack.
  it("falls back for an AUTONOMOUS lead too when the generated reply fails the shape check", async () => {
    p.lead.findUnique.mockResolvedValue({ ...baseLead, automationTier: "AUTONOMOUS" });
    generateReply.mockResolvedValue("Reviso la disponibilidad y Manoj te pasa los precios en breve.");
    const r = await acknowledgeNewLead("lead1", { channel: "text", inboundText: "Is the roof original?", inboundAt: new Date() });
    expect(r.sent).toBe(true);
    expect(assessRisk).not.toHaveBeenCalled();
    const [, body] = send.mock.calls[0];
    expect(body).toContain("Thank you for contacting MJ Homes");
  });

  it("falls back to the generic, always-safe line when the generated reply fails the shape check, without ever calling the risk check", async () => {
    generateReply.mockResolvedValue("Sure — that'll be $120 next Tuesday.");
    const r = await acknowledgeNewLead("lead1", { channel: "text", inboundText: "Is the roof original?", inboundAt: new Date() });
    expect(r.sent).toBe(true);
    expect(assessRisk).not.toHaveBeenCalled();
    const [, body] = send.mock.calls[0];
    expect(body).toBe("Hi! Thank you for contacting MJ Homes. I've received your message and will get back to you shortly.");
  });

  it("falls back to the generic, always-safe line when the risk check comes back not_ok", async () => {
    assessRisk.mockResolvedValue({ verdict: "not_ok", reason: "states availability the business never confirmed" });
    const r = await acknowledgeNewLead("lead1", { channel: "text", inboundText: "Is the roof original?", inboundAt: new Date() });
    expect(r.sent).toBe(true);
    const [, body] = send.mock.calls[0];
    expect(body).toBe("Hi! Thank you for contacting MJ Homes. I've received your message and will get back to you shortly.");
  });

  it("falls back to the generic line if generation itself throws, without failing the send", async () => {
    generateReply.mockRejectedValue(new Error("rate limited"));
    const r = await acknowledgeNewLead("lead1", { channel: "text", inboundText: "Is the roof original?", inboundAt: new Date() });
    expect(r.sent).toBe(true);
    const [, body] = send.mock.calls[0];
    expect(body).toContain("Thank you for contacting MJ Homes");
    expect(assessRisk).not.toHaveBeenCalled(); // never reached — generation failed first
  });

  it("falls back to the generic line if the risk check itself throws (an infra failure, not a rejection)", async () => {
    assessRisk.mockRejectedValue(new Error("timeout"));
    const r = await acknowledgeNewLead("lead1", { channel: "text", inboundText: "Is the roof original?", inboundAt: new Date() });
    expect(r.sent).toBe(true);
    const [, body] = send.mock.calls[0];
    expect(body).toContain("Thank you for contacting MJ Homes");
    expect(send.mock.calls[0][2].extraAuditMeta).toMatchObject({ reason: "risk check failed" });
  });

  it("uses the generic line with no generation attempt when there's no inbound text to respond to", async () => {
    const r = await acknowledgeNewLead("lead1", { channel: "text", inboundAt: new Date() });
    expect(r.sent).toBe(true);
    expect(generateReply).not.toHaveBeenCalled();
    const [, body] = send.mock.calls[0];
    expect(body).toContain("Thank you for contacting MJ Homes");
  });

  // Task #63 (live-test finding): the whole outgoing text — "Hi! " prefix
  // included — is handed to the localizer with the lead's real inbound
  // message as the sample, and whatever comes back is sent unmodified.
  // The earlier version of this test asserted "Hi! ¡Hola! Gracias…" — an
  // English "Hi!" glued onto a Spanish line — which is exactly the shape
  // the first real Spanish lead received (English frame around an
  // in-language line). This is still not a substitute for a real
  // end-to-end test with a native speaker judging the output; it proves
  // the plumbing, not the translation.
  it("localizes the entire fallback text (prefix included) against the lead's real inbound message, and sends what comes back", async () => {
    generateReply.mockRejectedValue(new Error("rate limited"));
    localize.mockImplementationOnce(async (text: string, sample: string) => {
      expect(text).toBe("Hi! Thank you for contacting MJ Homes. I've received your message and will get back to you shortly.");
      expect(sample).toBe("Hola, ¿todavía tienen la casa disponible?");
      return "¡Hola! Gracias por contactar a MJ Homes — lo revisaré y Manoj te responderá pronto.";
    });
    const r = await acknowledgeNewLead("lead1", {
      channel: "text",
      inboundText: "Hola, ¿todavía tienen la casa disponible?",
      inboundAt: new Date(),
    });
    expect(r.sent).toBe(true);
    expect(localize).toHaveBeenCalledTimes(1);
    const [, body] = send.mock.calls[0];
    expect(body).toBe("¡Hola! Gracias por contactar a MJ Homes — lo revisaré y Manoj te responderá pronto.");
  });

  it("localizes a generated (already in-language) reply's prefix too, rather than gluing an English 'Hi!' onto it", async () => {
    generateReply.mockResolvedValue("Con gusto — te enviaré el precio exacto en breve.");
    localize.mockImplementationOnce(async (text: string) => {
      expect(text).toBe("Hi! Con gusto — te enviaré el precio exacto en breve.");
      return "¡Hola! Con gusto — te enviaré el precio exacto en breve.";
    });
    await acknowledgeNewLead("lead1", {
      channel: "whatsapp",
      inboundText: "Hola, ¿cuánto cuesta?",
      inboundAt: new Date(),
    });
    const [, body] = send.mock.calls[0];
    expect(body).toBe("¡Hola! Con gusto — te enviaré el precio exacto en breve.");
  });

  it("passes the lead's inbound text to composeFollowUpEmail as the language sample for the email frame", async () => {
    const { composeFollowUpEmail } = await import("@/lib/sender");
    await acknowledgeNewLead("lead1", {
      channel: "email",
      inboundText: "Hola, ¿todavía tienen la casa disponible?",
      inboundAt: new Date(),
    });
    expect(composeFollowUpEmail).toHaveBeenCalledWith("Young", "biz1", expect.any(String), {
      languageSample: "Hola, ¿todavía tienen la casa disponible?",
    });
  });

  // Regression from the first #63 fix: composeFollowUpEmail localizes
  // only its greeting/sign-off frame, so on the email path the generic
  // English fallback line itself has to be translated before it goes in
  // — otherwise a Spanish lead gets a Spanish frame around an English
  // sentence, which is what the second live test would have produced.
  it("on the email path, translates the fallback line itself before framing it", async () => {
    generateReply.mockRejectedValue(new Error("rate limited"));
    localize.mockImplementation(async (text: string, sample: string) => {
      if (text.startsWith("Thank you for contacting MJ Homes")) {
        expect(sample).toBe("Hola, ¿todavía tienen la casa disponible?");
        return "Gracias por contactar a MJ Homes — lo revisaré y Manoj te responderá pronto.";
      }
      return text;
    });
    const { composeFollowUpEmail } = await import("@/lib/sender");
    await acknowledgeNewLead("lead1", {
      channel: "email",
      inboundText: "Hola, ¿todavía tienen la casa disponible?",
      inboundAt: new Date(),
    });
    expect(composeFollowUpEmail).toHaveBeenCalledWith(
      "Young",
      "biz1",
      "Gracias por contactar a MJ Homes — lo revisaré y Manoj te responderá pronto.",
      { languageSample: "Hola, ¿todavía tienen la casa disponible?" }
    );
  });

  it("does not re-translate a generated reply on the email path (it's already in the lead's language)", async () => {
    generateReply.mockResolvedValue("Con gusto — te enviaré el precio exacto en breve.");
    const { composeFollowUpEmail } = await import("@/lib/sender");
    await acknowledgeNewLead("lead1", { channel: "email", inboundText: "Hola, ¿cuánto cuesta?", inboundAt: new Date() });
    expect(localize).not.toHaveBeenCalledWith("Con gusto — te enviaré el precio exacto en breve.", expect.any(String));
    expect(composeFollowUpEmail).toHaveBeenCalledWith("Young", "biz1", "Con gusto — te enviaré el precio exacto en breve.", {
      languageSample: "Hola, ¿cuánto cuesta?",
    });
  });

  // The decision is merged into sendFollowUpToLead's own "ai.send" audit
  // event (extraAuditMeta), not logged as a separate event — task #63's
  // live test found two rows for one send when this was a standalone
  // recordAudit call: the generic "ai.send" the UI knows how to render,
  // and an undetailed second line for an action name it didn't recognize.
  it("passes which line went out and why as extraAuditMeta — never the message text", async () => {
    assessRisk.mockResolvedValue({ verdict: "not_ok", reason: "states availability the business never confirmed" });
    await acknowledgeNewLead("lead1", { channel: "text", inboundText: "Is the roof original?", inboundAt: new Date() });
    expect(send).toHaveBeenCalledWith(
      "lead1",
      expect.any(String),
      expect.objectContaining({
        extraAuditMeta: {
          source: "fallback",
          reason: "ack not_ok: states availability the business never confirmed",
          localized: true,
          asksPriceOrAvailability: false,
        },
      })
    );
    const [, , opts] = send.mock.calls[0];
    expect(JSON.stringify(opts.extraAuditMeta)).not.toContain("Thank you for contacting");
  });

  it("passes a generated reply's decision as such", async () => {
    await acknowledgeNewLead("lead1", { channel: "text", inboundText: "Is the roof original?", inboundAt: new Date() });
    expect(send).toHaveBeenCalledWith(
      "lead1",
      expect.any(String),
      expect.objectContaining({ extraAuditMeta: expect.objectContaining({ source: "generated", reason: "ack ok" }) })
    );
  });

  it("marks a shape-rejected reply's audit reason distinctly from a model-rejected one", async () => {
    generateReply.mockResolvedValue("Sure — that'll be $120 next Tuesday.");
    await acknowledgeNewLead("lead1", { channel: "text", inboundText: "Is the roof original?", inboundAt: new Date() });
    expect(send).toHaveBeenCalledWith(
      "lead1",
      expect.any(String),
      expect.objectContaining({ extraAuditMeta: expect.objectContaining({ source: "fallback", reason: "shape: digits" }) })
    );
  });

  it("flags an inbound asking about price or availability in the audit meta, without recording any message text", async () => {
    await acknowledgeNewLead("lead1", { channel: "text", inboundText: "What's the price and are you available next week?", inboundAt: new Date() });
    expect(send).toHaveBeenCalledWith(
      "lead1",
      expect.any(String),
      expect.objectContaining({ extraAuditMeta: expect.objectContaining({ asksPriceOrAvailability: true }) })
    );
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
    expect(body).toContain("Thank you for contacting MJ Homes");
    expect(opts).toMatchObject({ channel: "email", subject: "Re: Roof question", emailThreadId: "t1", emailInReplyTo: "<abc@mail>" });
  });

  it("releases the claim when the send fails so a later channel can still acknowledge", async () => {
    send.mockResolvedValue({ success: false, message: "Twilio not configured" });
    const r = await acknowledgeNewLead("lead1", { channel: "text", inboundAt: new Date() });
    expect(r.sent).toBe(false);
    expect(p.lead.updateMany).toHaveBeenLastCalledWith({ where: { id: "lead1" }, data: { acknowledgedAt: null } });
  });
});
