import { prisma } from "@/lib/db";
import { generateInstantReply, assessAckRisk, localizeFixedText } from "@/lib/integrations/openai";
import { composeFollowUpEmail, getSenderFirstName } from "@/lib/sender";
import { sendFollowUpToLead } from "@/lib/sending";
import { checkAiEligibility } from "@/lib/billing";
import { isOptOutMessage } from "@/lib/optOutKeywords";
import { dmSuppressionKey, isSuppressed } from "@/lib/suppression";

/**
 * Instant acknowledgement — the first half of "no lead is lost to LATE
 * follow-up" (PRODUCT_DIRECTION.md, main goal, point 1).
 *
 * A brand-new lead's first message gets a real, specific reply within a
 * minute — two to three on a DM channel, where the owner is given a short
 * head start to answer it themselves (DM_ACK_GRACE_PERIOD_MS) — answering
 * what it honestly can from what the lead themselves
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
 *  - never in reply to a message that is itself an opt-out keyword;
 *  - never for a lead the owner set to OFF;
 *  - never when the business switch (Settings → Automation) is off;
 *  - never to someone who has opted out (Lead.optedOutAt on SMS/WhatsApp,
 *    a Suppression row on Instagram/Messenger) — re-read at SEND time, not
 *    at the time the inbound arrived;
 *  - only on a channel the lead wrote to us on (a web form is
 *    acknowledged by email only — we don't text a number nobody texted from).
 *
 * On DM channels there is a deliberate two-minute pause first — see
 * DM_ACK_GRACE_PERIOD_MS below.
 */
export const INSTANT_ACK_ACTION = "instant_ack";
export const INSTANT_ACK_NAME = "Instant reply to new leads";

const STALE_AFTER_MS = 60 * 60_000;

export type AckChannel = "email" | "text" | "whatsapp" | "instagram" | "messenger";

/**
 * Let a present owner answer first (founder's decision, 2026-09-16).
 *
 * Two minutes, because that is roughly how long an owner who is already
 * holding their phone takes to see a DM notification and type a reply. The
 * failure this fixes is not hypothetical: the acknowledgement fired within
 * a minute of the webhook, the owner answered a few seconds later from the
 * Instagram app, and the lead received two slightly different replies from
 * the same business — the exact "is this a bot?" moment the product is
 * supposed to prevent. Waiting makes FollowUp the safety net rather than
 * the first responder: if the owner replies inside the window it stays
 * silent, and if they don't it sends and then tells them it did.
 *
 * Shorter than two minutes doesn't give a human time to answer; much
 * longer stops being an "instant" reply at all, and the research this
 * feature exists for is about the gap between "they wrote" and "someone
 * noticed" (29–47 hours on average), which two or three minutes does not
 * meaningfully widen.
 *
 * DM channels only. Email is out of scope deliberately: a Gmail sync tick
 * is not a webhook, it already lags the message by minutes, and the
 * "acknowledged within a minute" promise is not what it's racing.
 */
export const DM_ACK_GRACE_PERIOD_MS = 2 * 60_000;

/**
 * How long a worker owns a claimed deferred acknowledgement before another
 * tick may take it back. This is what makes "the cron missed it" survivable:
 * a claim pushes Lead.ackDueAt one lease into the future, so an invocation
 * killed between claiming and sending leaves the lead due again a few
 * minutes later instead of never. Far longer than the work takes (two model
 * calls and a send), and a resumed attempt still cannot send twice —
 * Lead.acknowledgedAt is claimed before the send and is never re-won.
 */
export const ACK_CLAIM_LEASE_MS = 5 * 60_000;

/** DM channels wait; email and SMS are unchanged (see DM_ACK_GRACE_PERIOD_MS). */
export function ackGracePeriodMs(channel: AckChannel): number {
  return channel === "instagram" || channel === "messenger" || channel === "whatsapp" ? DM_ACK_GRACE_PERIOD_MS : 0;
}

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

export type AckResult = {
  sent: boolean;
  reason?: string;
  /** What actually went out, so the worker can quote it to the owner. Never stored anywhere else. */
  body?: string;
  /** Set instead of sending when the DM grace period parked this — see scheduleDeferredAck. */
  queuedFor?: Date;
};

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
    /**
     * Set ONLY by runDueInstantAcks() below, when the grace period has
     * already been served. Every caller that isn't the worker leaves this
     * alone, so the wait belongs to the acknowledgement itself rather than
     * to each webhook remembering to defer — the same reasoning as the
     * opt-out refusal above.
     */
    skipGracePeriod?: boolean;
  }
): Promise<AckResult> {
  try {
    // Never be cheerful at a STOP.
    //
    // A message whose ENTIRE content is an opt-out keyword is the one
    // moment an instant "thanks for reaching out, I'll get back to you
    // shortly!" is actively harmful: it is an automated message sent in
    // direct reply to someone asking for no more automated messages, and
    // it is the first thing they'd screenshot. The SMS path has always
    // skipped the ack for this (src/lib/inbound/twilioMessage.ts) and the
    // DM path now does too; this check lives HERE as well so the guarantee
    // belongs to the acknowledgement itself rather than to each caller
    // remembering — including the email path, where "unsubscribe" as the
    // whole body means exactly what it says.
    //
    // Before the acknowledgedAt claim, deliberately: a person who says
    // STOP and later changes their mind with START should still get a real
    // first reply, not a lead silently marked as already acknowledged.
    if (isOptOutMessage(input.inboundText ?? "")) return { sent: false, reason: "opt-out message" };

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        businessId: true,
        name: true,
        email: true,
        phone: true,
        automationTier: true,
        acknowledgedAt: true,
        // The DM grace period's queue state — see scheduleDeferredAck.
        ackDueAt: true,
        // Consent, re-read here rather than trusted from when the inbound
        // arrived: on a deferred DM ack, minutes have passed since then.
        optedOutAt: true,
        // For the tier gate below — createdAt fixes this lead's rank in its
        // own month, source decides whether Free covers the channel.
        createdAt: true,
        source: true,
      },
    });
    if (!lead) return { sent: false, reason: "no lead" };
    if (lead.acknowledgedAt) return { sent: false, reason: "already acknowledged" };
    if (lead.automationTier === "OFF") return { sent: false, reason: "lead is OFF" };
    if (input.channel === "email" && !lead.email) return { sent: false, reason: "no email" };
    if (input.channel !== "email" && !lead.phone) return { sent: false, reason: "no phone" };

    const inboundAt = input.inboundAt ?? new Date();
    if (Date.now() - inboundAt.getTime() > STALE_AFTER_MS) return { sent: false, reason: "inbound too old" };

    // The two-minute wait on DM channels. Everything below this line —
    // the owner-already-replied check, the opt-out check, the business
    // switch, the tier cap, the claim — is therefore evaluated when the
    // message is about to GO OUT, not when the DM arrived, which is the
    // entire point: the owner gets those two minutes to win.
    const graceMs = input.skipGracePeriod ? 0 : ackGracePeriodMs(input.channel);
    if (graceMs > 0) return scheduleDeferredAck(leadId, input, lead.ackDueAt, graceMs);

    if (input.hasHumanReply) return { sent: false, reason: "owner already replied" };
    const priorOutbound = await prisma.message.findFirst({
      where: { conversation: { leadId }, direction: "outbound" },
      select: { id: true },
    });
    if (priorOutbound) return { sent: false, reason: "owner already replied" };

    // Opted out — checked HERE, at send time, not at the moment the inbound
    // landed. A DM ack waits two minutes (above), and "stop" is a very
    // ordinary second message to send inside those two minutes: the DM
    // webhook records that in the Suppression table and simply doesn't
    // re-queue, which would leave the already-queued acknowledgement as the
    // only thing still able to reply to someone who just said stop.
    // sendFollowUpToLead refuses these too (src/lib/sending.ts) — this
    // check is here so the ack is abandoned before it claims
    // acknowledgedAt, spends two model calls and logs a failed send.
    if ((input.channel === "text" || input.channel === "whatsapp") && lead.optedOutAt) {
      return { sent: false, reason: "opted out" };
    }
    const dmKey = dmSuppressionKey(lead.phone);
    if (dmKey && (await isSuppressed(lead.businessId, dmKey.address, dmKey.channel))) {
      return { sent: false, reason: "opted out" };
    }

    if (!(await isInstantAckEnabled(lead.businessId))) return { sent: false, reason: "switched off" };

    // The tier gate this path never had.
    //
    // Every other AI entry point (scoring.ts, automation.ts, sequences.ts,
    // the regenerate route) checks the plan's monthly AI allowance before
    // spending a call. This one did not, so generateInstantReply +
    // assessAckRisk + localizeFixedText ran for every lead on every tier
    // regardless of the cap — directly contradicting the published "AI
    // processing pauses past lead #20"
    // (research/market/2026-09-11-tier-pricing-recommendation.md §2.2).
    //
    // Skipping, rather than falling back to the fixed line, is what the
    // other four gates do and is the honest behaviour here: the fixed line
    // is only safe because localizeFixedText puts it in the lead's own
    // language, and that is itself an AI call. Sending it un-localized
    // would ship the exact bug task #63 fixed — an English sentence to a
    // lead who wrote in Gujarati — on purpose.
    //
    // Checked BEFORE the claim below, so a lead skipped here keeps
    // acknowledgedAt null and is acknowledged normally next month or on
    // upgrade, rather than being silently marked as handled.
    const ackBusiness = await prisma.business.findUnique({
      where: { id: lead.businessId },
      select: { tier: true },
    });
    const ackEligible = await checkAiEligibility(
      lead.businessId,
      lead,
      (ackBusiness?.tier ?? "free") as "free" | "plus" | "pro"
    );
    if (!ackEligible.ok) return { sent: false, reason: ackEligible.reason };

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
      //
      // Unless the send was PARKED rather than dropped (a provider blip; see
      // the retry queue in src/lib/sending.ts). That message is still going
      // out, a couple of minutes late, so the lead has been acknowledged and
      // releasing the claim here would set up a second one. The in-flight
      // guard in sendFollowUpToLead would refuse that second ack anyway —
      // this just stops it being attempted at all.
      if (!result.queuedRetryAt) {
        await prisma.lead.updateMany({ where: { id: leadId }, data: { acknowledgedAt: null } });
      }
      console.error(`Instant acknowledgement failed for lead ${leadId}: ${result.message}`);
      return { sent: false, reason: result.message };
    }
    return { sent: true, body };
  } catch (err) {
    // Never let the acknowledgement break the webhook that captured the lead.
    console.error(`Instant acknowledgement errored for lead ${leadId}:`, err);
    return { sent: false, reason: "error" };
  }
}

/* ------------------------------------------------------------------ *
 * The DM grace period: park it now, decide in two minutes.
 * ------------------------------------------------------------------ */

/**
 * Parks the acknowledgement on the lead instead of sending it.
 *
 * Why a due-at column worked on by a cron, and not the alternatives:
 *
 *  - A serverless request cannot wait two minutes. Keeping the invocation
 *    alive (a sleep, or Next's after()) bills two minutes of compute per DM,
 *    dies with the instance, and — worse — leaves NO record that an
 *    acknowledgement was owed, so a deploy mid-window loses it silently.
 *    Durability is the whole requirement here; an in-memory timer has none.
 *  - Riding the InboundWebhookEvent rows (src/lib/inboundEvents.ts) is the
 *    near miss. Those rows are durable and already written before
 *    processing, but they record the PAYLOAD, not the lead: a Meta envelope
 *    carries several messages for several leads, its businessId is null
 *    until it is parsed, and re-dispatching one would re-run the whole
 *    processor (capture, scoring, engagement) to reach the ack. The queue
 *    needs to be keyed on the lead, which is the thing being acknowledged
 *    once ever.
 *  - A separate PendingAck table would work and is what OutboundSend does
 *    for sends. It buys nothing here: there is at most ONE pending ack per
 *    lead by definition (Lead.acknowledgedAt already enforces once-ever),
 *    so the row would be 1:1 with the lead, and the claim would still have
 *    to coordinate with acknowledgedAt on the Lead row anyway. Four
 *    nullable columns next to the marker they coordinate with is the
 *    smaller thing.
 *
 * Real latency, stated plainly rather than discovered later: the cron
 * granularity is one minute (vercel.json), so a "2 minute" delay is in
 * practice 2–3 minutes from the inbound, plus whatever lateness the
 * scheduler itself adds — Vercel schedules crons on a best-effort basis and
 * does not promise the exact second. Two to three minutes is the honest
 * number to quote; four is possible on a bad tick.
 *
 * A second DM inside the window refreshes what the reply will answer but
 * deliberately does NOT push the due time back — otherwise a lead typing
 * three short messages in a row would keep resetting the clock and the
 * acknowledgement would drift indefinitely.
 */
async function scheduleDeferredAck(
  leadId: string,
  input: { channel: AckChannel; inboundText?: string; inboundAt?: Date },
  existingDueAt: Date | null,
  graceMs: number
): Promise<AckResult> {
  const dueAt = existingDueAt ?? new Date(Date.now() + graceMs);
  const claim = await prisma.lead.updateMany({
    // Still conditional on acknowledgedAt: a lead that has already had its
    // one acknowledgement never queues another.
    where: { id: leadId, acknowledgedAt: null },
    data: {
      // Only set when there isn't already a pending (or in-flight) one, so
      // this can never shorten a claim a worker is currently holding.
      ...(existingDueAt ? {} : { ackDueAt: dueAt }),
      ackChannel: input.channel,
      ackInboundText: input.inboundText ?? null,
      ackInboundAt: input.inboundAt ?? new Date(),
    },
  });
  if (claim.count === 0) return { sent: false, reason: "already acknowledged" };
  return { sent: false, reason: "waiting out the grace period", queuedFor: dueAt };
}

/** Takes the lead back out of the queue. Always paired with a terminal outcome. */
async function clearDeferredAck(leadId: string): Promise<void> {
  await prisma.lead
    .updateMany({
      where: { id: leadId },
      data: { ackDueAt: null, ackChannel: null, ackInboundText: null, ackInboundAt: null },
    })
    .catch((err) => console.error(`Could not clear the deferred acknowledgement for lead ${leadId}:`, err));
}

const CHANNEL_LABEL: Record<AckChannel, string> = {
  email: "email",
  text: "text",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  messenger: "Messenger",
};

/** Long enough to recognise the reply, short enough to read in a dropdown. */
const NOTIFICATION_QUOTE_LIMIT = 180;

/**
 * Tells the owner that FollowUp answered for them.
 *
 * This is the other half of the founder's decision: the owner stays silent
 * for two minutes and then finds out, from the app, exactly what was said in
 * their name — not from the lead's next message. Same mechanism as
 * notifyNeglect() in src/lib/automation.ts (a Notification row per
 * recipient, the assignee or every admin when the lead is unassigned), so
 * the bell behaves identically wherever the message came from.
 *
 * Best-effort: a notification that fails to write must not undo a message
 * that has already been delivered.
 */
async function notifyAckSent(
  lead: { id: string; name: string; businessId: string; assignedToId: string | null },
  channel: AckChannel,
  body: string
): Promise<void> {
  const quote = body.length > NOTIFICATION_QUOTE_LIMIT ? `${body.slice(0, NOTIFICATION_QUOTE_LIMIT - 1).trimEnd()}…` : body;
  const minutes = Math.round(DM_ACK_GRACE_PERIOD_MS / 60_000);
  const message =
    `${lead.name} messaged on ${CHANNEL_LABEL[channel]} and hadn't heard back after ${minutes} minutes, ` +
    `so FollowUp replied for you: "${quote}" Check the thread.`;
  try {
    const userIds = lead.assignedToId
      ? [lead.assignedToId]
      : (
          await prisma.user.findMany({ where: { businessId: lead.businessId, role: "ADMIN" }, select: { id: true } })
        ).map((u) => u.id);
    for (const userId of userIds) {
      await prisma.notification.create({ data: { userId, leadId: lead.id, message } });
    }
  } catch (err) {
    console.error(`Instant-ack notification failed for lead ${lead.id}:`, err);
  }
}

export type DueAckResult = {
  /** Rows this invocation took ownership of. */
  claimed: number;
  sent: number;
  /** Claimed, then refused at send time — the owner replied, they opted out, the cap, staleness. */
  skipped: number;
  /** Left claimed for another tick: the attempt errored rather than decided. */
  retrying: number;
};

/**
 * Sends the deferred acknowledgements whose grace period has run out.
 *
 * Called once a minute from /api/cron/instant-ack. Safe to run concurrently
 * with itself and with a webhook: every row is taken with the codebase's
 * atomic conditional updateMany (the same posture as claimNextDueSend in
 * src/lib/sendQueue.ts and the acknowledgedAt claim above), so two ticks
 * that see the same due lead cannot both work it — and even if they somehow
 * both got in, acknowledgeNewLead's own acknowledgedAt claim means only one
 * of them can send.
 *
 * Nothing about WHETHER to send is decided here. The lead is handed back to
 * acknowledgeNewLead with the grace period already served, so every
 * guarantee — owner already replied, opted out, OFF, business switch off,
 * tier cap, inbound too old — is re-evaluated now, against the world as it
 * is now, and not against the world two minutes ago.
 *
 * If the ack never runs — the tick is missed, a deploy lands mid-window,
 * an invocation is killed — the lead stays queued and the next tick takes
 * it. That recovery is bounded by STALE_AFTER_MS: an hour after the lead
 * wrote, acknowledgeNewLead refuses as "inbound too old" and the row is
 * cleared, because a cheerful "we got your message" ninety minutes later is
 * worse than none. The lead is not dropped at that point — it is an
 * unanswered lead with an inbound and no reply, which is exactly what the
 * hourly neglect pass in src/lib/automation.ts exists to catch, and it
 * notifies the owner rather than sending silently.
 */
export async function runDueInstantAcks(
  options: { limit?: number; deadlineMs?: number; now?: Date } = {}
): Promise<DueAckResult> {
  const limit = options.limit ?? 50;
  // Wall-clock budget, well inside the route's ceiling. Whatever isn't
  // reached stays due and is taken by the next tick sixty seconds later —
  // the same resumable posture as the other fan-out crons.
  const deadlineMs = options.deadlineMs ?? 45_000;
  const startedAt = Date.now();
  const now = options.now ?? new Date();
  const result: DueAckResult = { claimed: 0, sent: 0, skipped: 0, retrying: 0 };

  const candidates = await prisma.lead.findMany({
    // Deliberately not also filtered on acknowledgedAt: a lead that got its
    // acknowledgement some other way while queued (a form submission
    // acknowledged by email) must still be taken out of the queue rather
    // than left with a due timestamp nothing ever looks at again.
    // acknowledgeNewLead refuses it as "already acknowledged" and the row
    // is cleared below.
    where: { ackDueAt: { lte: now } },
    orderBy: { ackDueAt: "asc" },
    take: limit,
    select: { id: true },
  });

  for (const candidate of candidates) {
    if (Date.now() - startedAt > deadlineMs) break;

    // The claim. Pushing ackDueAt one lease into the future both takes the
    // row and leaves it recoverable: if this invocation dies before
    // finishing, the lease expires and a later tick retries it, instead of
    // the acknowledgement vanishing with the process.
    const claim = await prisma.lead.updateMany({
      where: { id: candidate.id, ackDueAt: { lte: now } },
      data: { ackDueAt: new Date(Date.now() + ACK_CLAIM_LEASE_MS) },
    });
    if (claim.count === 0) continue; // another tick got there first
    result.claimed += 1;

    const lead = await prisma.lead.findUnique({
      where: { id: candidate.id },
      select: {
        id: true,
        name: true,
        businessId: true,
        assignedToId: true,
        ackChannel: true,
        ackInboundText: true,
        ackInboundAt: true,
      },
    });
    if (!lead?.ackChannel) {
      // Queued by an older deploy, or cleared underneath us. Nothing to send.
      await clearDeferredAck(candidate.id);
      result.skipped += 1;
      continue;
    }

    const channel = lead.ackChannel as AckChannel;
    const outcome = await acknowledgeNewLead(lead.id, {
      channel,
      inboundText: lead.ackInboundText ?? undefined,
      inboundAt: lead.ackInboundAt ?? undefined,
      skipGracePeriod: true,
    });

    if (outcome.sent) {
      await clearDeferredAck(lead.id);
      await notifyAckSent(lead, channel, outcome.body ?? "");
      result.sent += 1;
      continue;
    }

    // "error" is the one outcome that isn't a decision — acknowledgeNewLead
    // swallows its exceptions so a webhook can't be broken by them, and a
    // transient OpenAI or database failure should not cost the lead its
    // acknowledgement. Leaving the row claimed means the lease expires and
    // the next tick tries again, bounded by STALE_AFTER_MS. Every other
    // reason is a real refusal (the owner replied, they opted out, the cap,
    // a provider that can't send this channel at all) and is terminal.
    if (outcome.reason === "error") {
      result.retrying += 1;
      continue;
    }

    await clearDeferredAck(lead.id);
    result.skipped += 1;
  }

  return result;
}
