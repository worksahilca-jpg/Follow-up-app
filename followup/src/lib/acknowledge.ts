import { prisma } from "@/lib/db";
import { generateInstantReply, assessAckRisk, localizeFixedText } from "@/lib/integrations/openai";
import { composeFollowUpEmail, getSenderFirstName } from "@/lib/sender";
import { sendFollowUpToLead } from "@/lib/sending";

/**
 * Instant acknowledgement — the first half of "no lead is lost to LATE
 * follow-up" (PRODUCT_DIRECTION.md, main goal, point 1).
 *
 * A brand-new lead's first message gets a real, specific reply within a
 * minute — answering what it honestly can from what the lead themselves
 * wrote, or saying so warmly by name ("I'll get you the exact price and
 * follow up shortly") when it can't — on the channel they
 * used, in the language and tone they wrote in. The substantive reply
 * still goes through the Assisted flow (drafted, approved by the owner)
 * once there's real business context to draw from; this only closes the
 * gap between "they wrote" and "someone/something noticed," which the
 * research puts at 29–47 hours on average and where the close rate
 * falls by more than half.
 *
 * This used to be a fixed template specifically because a generated
 * reply risked inventing a fact with zero human review — now it's a
 * generated reply (generateInstantReply), kept safe by a two-layer gate
 * purpose-built for this first touch (buildAckLine, below) instead of by
 * being static: a deterministic checkAckShape() catches any digit,
 * currency, link, or the owner's name in third person, in any language,
 * and then (for anything but an AUTONOMOUS lead) a first-touch-specific
 * model judge, assessAckRisk(), catches an asserted fact the shape check
 * can't see. This deliberately replaced reusing assessSendRisk — the
 * gate written for a mid-conversation follow-up behind a human-approval
 * queue — after a live test showed it rejecting essentially every reply
 * to a lead who asked about price or availability, exactly the leads
 * that matter most; see research/product/2026-09-10-instant-ack-safety-
 * gate.md for the root-cause analysis. If generation fails, the shape
 * check or the risk check rejects the reply, or there's no
 * OPENAI_API_KEY, this falls back to a fixed, always-safe line rather
 * than holding the very first touch for approval — delaying it defeats
 * the point of "instant," and the fallback line states no fact about
 * the business.
 *
 * Language (task #63 live-test finding): the outgoing message is
 * localized as a whole, greeting/sign-off included — not just the
 * middle line. The first real Spanish test lead got "Hi Lucía, <English
 * fallback> Best, Sahil": the fallback was localized on its own while
 * composeFollowUpEmail wrapped it in a fixed English frame, and the
 * SMS/DM path glued an English "Hi! " onto whatever came back. Now the
 * email frame follows the lead's language (see src/lib/sender.ts) and
 * the non-email "Hi! <line>" is localized as one string, so a fallback
 * and a generated reply both go out entirely in the lead's language.
 *
 * Guarantees, each enforced below and each a reason this returns without
 * sending:
 *  - once per lead, ever (atomic claim on Lead.acknowledgedAt);
 *  - never if the owner has already replied (any outbound message, or
 *    the email thread already contains their reply);
 *  - never for a message older than STALE_AFTER_MS — a deep inbox pass
 *    finds months-old threads and must not "acknowledge" them;
 *  - never for a lead the owner set to OFF;
 *  - never when the business switch (Settings → Automation) is off;
 *  - only on a channel the lead wrote to us on (a web form is
 *    acknowledged by email only — we don't text a number nobody texted from).
 */
export const INSTANT_ACK_ACTION = "instant_ack";
export const INSTANT_ACK_NAME = "Instant reply to new leads";

const STALE_AFTER_MS = 60 * 60_000;

export type AckChannel = "email" | "text" | "whatsapp" | "instagram" | "messenger";

/**
 * Deterministic, language-neutral shape check for a generated instant
 * reply — runs before (and instead of, for AUTONOMOUS leads) the model
 * risk check. See research/product/2026-09-10-instant-ack-safety-gate.md
 * section 4.2: the single highest-value rule is `digits` — no price,
 * count, time, date, or phone number the lead didn't write themselves,
 * checked via Unicode digit runs so it also catches Devanagari/Gujarati/
 * Arabic-Indic numerals, not just ASCII ones. Pure and model-free on
 * purpose: it costs nothing to run on every tier, including AUTONOMOUS,
 * which previously had no check on the ack at all.
 *
 * Deliberately excludes word-level deny-lists ("available", "booked") —
 * those are language-specific, trivially evaded by paraphrase, and would
 * recreate the exact bug this file is fixing (rejecting a reply for
 * mentioning a topic rather than for asserting something about it).
 * Assertions are assessAckRisk's job, not this one's.
 */
export function checkAckShape(
  reply: string,
  inboundText: string,
  ownerFirstName: string
): { ok: true } | { ok: false; rule: string } {
  const fail = (rule: string) => ({ ok: false as const, rule });
  const trimmed = reply.trim();

  if (!trimmed) return fail("empty");
  if (trimmed.length > 320) return fail("length");

  const sentenceEnders = trimmed.match(/[.!?।](?=\s|$)/g) ?? [];
  if (sentenceEnders.length > 3) return fail("sentences");

  // A "number" is a run of digits, optionally continuing through internal
  // thousands-separator commas or a decimal point ("$2,000", "19.99") —
  // extracted identically from both sides and compared as whole values,
  // never as a plain substring. A plain `inboundText.includes(run)` check
  // (the previous version of this rule) lets a fabricated number slip
  // through whenever it happens to appear inside a larger, unrelated
  // number the lead already used: a hallucinated "2 days" is an
  // `.includes("2")` hit against a lead-quoted "$2,000" budget, since
  // "2,000" contains "2" as plain text — even bounding "2" against
  // adjacent digits doesn't help, because the comma already splits
  // "2,000" into separate digit-runs. Comparing whole number tokens (so
  // "$2,000" is one token, "2,000", not two) is what actually fixes it.
  const NUMBER_RE = /\p{Nd}(?:[\p{Nd},.]*\p{Nd})?/gu;
  const replyNumbers = trimmed.match(NUMBER_RE) ?? [];
  const inboundNumbers = new Set(inboundText.match(NUMBER_RE) ?? []);
  if (replyNumbers.some((n) => !inboundNumbers.has(n))) return fail("digits");

  const currencyTokens = trimmed.match(/[$€£₹¥]|%|\b(USD|EUR|GBP|INR|CAD|MXN|AUD|Rs\.?)\b/gi) ?? [];
  if (currencyTokens.some((token) => !inboundText.toLowerCase().includes(token.toLowerCase()))) return fail("currency");

  if (/https?:\/\//i.test(trimmed) || /www\./i.test(trimmed) || /\S+@\S+\.\S+/.test(trimmed) || /\+\d/.test(trimmed)) {
    return fail("contact");
  }

  const timeTokens = trimmed.match(/\b\d{1,2}[:.]\d{2}\b|\b\d{1,2}\s?(am|pm|hs?)\b/gi) ?? [];
  if (timeTokens.some((token) => !inboundText.toLowerCase().includes(token.toLowerCase()))) return fail("time");

  if (/^\s*(hi|hello|hey|dear|hola|buenos|buenas|namaste|namaskar|bonjour|olá|ola|ciao|hallo|salut)\b/i.test(trimmed)) {
    return fail("greeting");
  }

  const lastLine = trimmed.split("\n").pop() ?? trimmed;
  if (/^(best|regards|saludos|atentamente|gracias,|thanks,|cheers|dhanyavaad)\b/i.test(lastLine.trim())) {
    return fail("signoff");
  }

  if (ownerFirstName.trim() && new RegExp(`\\b${escapeRegExp(ownerFirstName.trim())}\\b`, "i").test(trimmed)) {
    return fail("third_person_owner");
  }

  if (/[<>]|lead_conversation|\bsystem\b|\[inbound\]/i.test(trimmed)) return fail("leak");

  const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  if (normalize(trimmed) === normalize(inboundText)) return fail("echo");

  return { ok: true };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// A boolean about the inbound, computed once at ack time and recorded to
// the audit trail (never the message text itself — see recordAudit's own
// "identifiers and counts, never message bodies" contract) so the
// fallback rate can be split by exactly the lead segment that motivated
// this file's redesign: research/product/2026-09-10-instant-ack-safety-
// gate.md section 4.6 found this was the single most important split,
// since it was precisely the segment the old gate rejected almost 100%
// of the time. Best-effort multilingual regex, not exhaustive.
const PRICE_OR_AVAILABILITY_RE =
  /precio|price|pricing|cost|cuánto|cuanto|quanto|combien|kimmat|kimat|keemat|rate|disponib|availab|available|book|appointment|cita|turno|slot|schedule/i;

function asksPriceOrAvailability(inboundText: string): boolean {
  return PRICE_OR_AVAILABILITY_RE.test(inboundText);
}

// The always-safe fallback: states no fact about the business, so it's
// fine to send with zero review the same way the old fixed template
// was. Kept as a plain function (not a module-level constant) since it
// depends on businessName/owner, which vary per business.
function genericAckLine(businessName: string): string {
  // First person throughout: the email is signed by the owner
  // (composeFollowUpEmail's sign-off), so "I" is them. The previous
  // wording — "I'll take a look and <owner> will follow up shortly. Best,
  // <owner>" — mixed first and third person for the same signer and read
  // as filler; task #63's first two live leads both received it.
  return `Thank you for contacting ${businessName}. I've received your message and will get back to you shortly.`;
}

/**
 * What buildAckLine decided and why — `source` says whether the line is
 * the model's specific reply or the always-safe generic one, `reason` is
 * a short, prefix-parseable why: "no inbound text", "generation failed",
 * "shape: <rule>" (checkAckShape rejected it), "autonomous, shape ok",
 * "risk check failed" (assessAckRisk itself errored), "ack ok", or
 * "ack not_ok: <reason>". Recorded to the AI audit trail on every send so
 * a fallback that looks wrong on a real lead — task #63's live test
 * shipped two generic English acknowledgements to Spanish leads with no
 * record of which step had bailed — can be diagnosed from the lead page
 * instead of from production logs nobody can reach, and so the fallback
 * rate can be measured by reason (research/product/2026-09-10-instant-
 * ack-safety-gate.md section 4.6).
 */
type AckLine = { line: string; source: "generated" | "fallback"; reason: string };

/**
 * Builds the one line of substantive content the caller wraps into an
 * email (composeFollowUpEmail adds the greeting/sign-off) or sends
 * with a short "Hi! " prefix for every other channel — either way
 * localized to the lead's language by the caller, not here.
 *
 * Two layers, in order, per research/product/2026-09-10-instant-ack-
 * safety-gate.md section 4.1 — deliberately NOT assessSendRisk (see that
 * function's own doc comment for why reusing the follow-up gate here was
 * the root cause of a live test failure):
 *  1. checkAckShape — deterministic, free, language-neutral, runs for
 *     EVERY tier including AUTONOMOUS (previously unchecked).
 *  2. assessAckRisk — a first-touch-specific model judge, skipped only
 *     for AUTONOMOUS leads, same as every other automated send path.
 */
async function buildAckLine(input: {
  leadFirstName: string;
  ownerFirstName: string;
  businessName: string;
  automationTier: string;
  inboundText: string;
  channel: AckChannel;
}): Promise<AckLine> {
  const fallback = genericAckLine(input.businessName);
  if (!input.inboundText.trim()) return { line: fallback, source: "fallback", reason: "no inbound text" }; // nothing specific to respond to

  let reply: string;
  try {
    reply = await generateInstantReply({
      leadFirstName: input.leadFirstName,
      ownerFirstName: input.ownerFirstName,
      inboundText: input.inboundText,
    });
  } catch (err) {
    console.error("Instant reply generation failed, falling back to the generic acknowledgement:", err);
    return { line: fallback, source: "fallback", reason: "generation failed" };
  }

  const shape = checkAckShape(reply, input.inboundText, input.ownerFirstName);
  if (!shape.ok) return { line: fallback, source: "fallback", reason: `shape: ${shape.rule}` };

  if (input.automationTier === "AUTONOMOUS") return { line: reply, source: "generated", reason: "autonomous, shape ok" }; // same skip every other autonomous send path takes

  try {
    const verdict = await assessAckRisk(input.inboundText, reply);
    if (verdict.verdict === "ok") return { line: reply, source: "generated", reason: "ack ok" };
    return { line: fallback, source: "fallback", reason: `ack not_ok: ${verdict.reason}`.slice(0, 160) };
  } catch (err) {
    console.error("Instant ack risk check failed, falling back to the generic acknowledgement:", err);
    return { line: fallback, source: "fallback", reason: "risk check failed" };
  }
}

export async function isInstantAckEnabled(businessId: string): Promise<boolean> {
  const row = await prisma.automation.findFirst({
    where: { businessId, action: INSTANT_ACK_ACTION },
    select: { enabled: true },
  });
  // On by default: absence of a row means "never turned off."
  return row?.enabled ?? true;
}

export async function acknowledgeNewLead(
  leadId: string,
  input: {
    channel: AckChannel;
    inboundText?: string;
    inboundAt?: Date;
    hasHumanReply?: boolean;
    emailThreadId?: string;
    emailMessageId?: string;
    emailSubject?: string;
  }
): Promise<{ sent: boolean; reason?: string }> {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, businessId: true, name: true, email: true, phone: true, automationTier: true, acknowledgedAt: true },
    });
    if (!lead) return { sent: false, reason: "no lead" };
    if (lead.acknowledgedAt) return { sent: false, reason: "already acknowledged" };
    if (lead.automationTier === "OFF") return { sent: false, reason: "lead is OFF" };
    if (input.channel === "email" && !lead.email) return { sent: false, reason: "no email" };
    if (input.channel !== "email" && !lead.phone) return { sent: false, reason: "no phone" };

    const inboundAt = input.inboundAt ?? new Date();
    if (Date.now() - inboundAt.getTime() > STALE_AFTER_MS) return { sent: false, reason: "inbound too old" };

    if (input.hasHumanReply) return { sent: false, reason: "owner already replied" };
    const priorOutbound = await prisma.message.findFirst({
      where: { conversation: { leadId }, direction: "outbound" },
      select: { id: true },
    });
    if (priorOutbound) return { sent: false, reason: "owner already replied" };

    if (!(await isInstantAckEnabled(lead.businessId))) return { sent: false, reason: "switched off" };

    // Claim first, send second — two webhooks for the same new lead
    // (a double-tap text, an email + a form) can't both win.
    const claim = await prisma.lead.updateMany({
      where: { id: leadId, acknowledgedAt: null },
      data: { acknowledgedAt: new Date() },
    });
    if (claim.count === 0) return { sent: false, reason: "already acknowledged" };

    const business = await prisma.business.findUnique({ where: { id: lead.businessId }, select: { name: true } });
    const businessName = business?.name ?? "us";
    const owner = await getSenderFirstName(lead.businessId);
    const leadFirstName = lead.name.split(" ")[0];

    const decision = await buildAckLine({
      leadFirstName,
      ownerFirstName: owner,
      businessName,
      automationTier: lead.automationTier,
      inboundText: input.inboundText ?? "",
      channel: input.channel,
    });

    // The lead's own message decides the language of everything that
    // goes out: a generated reply is already in their language, but the
    // generic fallback line is English and has to be translated (email
    // path: here, since composeFollowUpEmail localizes only its frame;
    // other channels: below, as one string with the "Hi! " prefix). The
    // email greeting/sign-off frame and the default subject follow too.
    // localizeFixedText returns its input untouched for an English lead
    // (or with nothing to sample), so the common case reads as before.
    const languageSample = input.inboundText ?? "";
    let body: string;
    let subject: string | undefined;
    if (input.channel === "email") {
      const line = decision.source === "fallback" ? await localizeFixedText(decision.line, languageSample) : decision.line;
      body = await composeFollowUpEmail(leadFirstName, lead.businessId, line, { languageSample });
      const cleanSubject = input.emailSubject?.replace(/^(re|fwd?):\s*/i, "").trim();
      subject = cleanSubject ? `Re: ${cleanSubject}` : await localizeFixedText(`Thank you for contacting ${businessName}`, languageSample);
    } else {
      body = await localizeFixedText(`Hi! ${decision.line}`, languageSample);
    }

    const result = await sendFollowUpToLead(leadId, body, {
      automated: true,
      trigger: "instant_ack",
      channel: input.channel,
      subject,
      emailThreadId: input.emailThreadId,
      emailInReplyTo: input.emailMessageId,
      // Merged into sendFollowUpToLead's own "ai.send" audit event rather
      // than logged separately — task #63's live test showed two rows
      // for one send: the generic "ai.send" the UI knows how to render,
      // and a second, undetailed "ai.instant_ack" line the UI didn't
      // recognize (see LeadTrustPanel.tsx's ACTION_COPY). One event now
      // carries both the generic detail and the ack-specific decision.
      extraAuditMeta: {
        source: decision.source,
        reason: decision.reason,
        localized: languageSample.trim().length > 0,
        asksPriceOrAvailability: asksPriceOrAvailability(input.inboundText ?? ""),
      },
    });
    if (!result.success) {
      // Release the claim so a later inbound on a working channel can
      // still be acknowledged — e.g. Twilio not configured yet.
      await prisma.lead.updateMany({ where: { id: leadId }, data: { acknowledgedAt: null } });
      console.error(`Instant acknowledgement failed for lead ${leadId}: ${result.message}`);
      return { sent: false, reason: result.message };
    }
    return { sent: true };
  } catch (err) {
    // Never let the acknowledgement break the webhook that captured the lead.
    console.error(`Instant acknowledgement errored for lead ${leadId}:`, err);
    return { sent: false, reason: "error" };
  }
}
