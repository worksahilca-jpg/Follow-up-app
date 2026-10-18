import { prisma } from "@/lib/db";
import { buildAckLine } from "@/lib/acknowledge";
import { assessSendRisk, extractQualificationFacts, generateFollowUpMessage } from "@/lib/integrations/openai";
import { composeFollowUpEmail, getSenderFirstName, latestInboundText } from "@/lib/sender";
import { draftingContext } from "@/lib/businessFacts";
import { getVoiceSamples } from "@/lib/voice";
import { detectLeadLanguage } from "@/lib/leadLanguage";
import { saidYesToMeeting } from "@/lib/bookingOffer";
import { askFor, customerTexts, markOffered, mergeQualification, nextToAsk, readQualification, templateFor, type Criterion, type Qualification } from "@/lib/qualification";
import { appUrl } from "@/lib/stripe";
import type { Message } from "@/lib/types";

/**
 * "How FollowUp talks to your customers" (A-288, founder 2026-10-18: "it should use all the rules and strategies … that we use for
 * our actual app"). The owner writes as a customer and FollowUp answers on screen. Nothing is stored and nothing is
 * sent: no Lead, no Message, no audit row.
 *
 * The same parts as a real email customer, in the same order:
 * - the first message gets the instant reply (acknowledge.ts buildAckLine, with its shape and risk gates);
 * - every later message gets the reply scoring.ts writes: the owner's facts and voice, the customer's language, the
 *   qualifying checklist (one round at a time, never asking twice), and the booking page once they say yes to meeting;
 * - the verdict under it is the send pass's own check (assessSendRisk), plus the booking-link rule: a reply with
 *   their booking link always waits for the owner.
 *
 * Keep this in step with scoreAndDraftForLead's email branch (src/lib/scoring.ts). It is a copy of the order of
 * calls, not of their insides, so the rules themselves can only ever be the real ones.
 */

export type PracticeTurn = { from: "customer" | "followup"; text: string };
export type PracticeVerdict = { sends: boolean; reason: string | null };
export type PracticeReply = { reply: string; verdict: PracticeVerdict; qualification: Qualification | null };

/** Stands in for the customer's booking page, which a practice customer doesn't have. */
const PRACTICE_BOOKING_PATH = "/book/practice";
export const BOOKING_LINK_SHOWN = "[your booking page link]";

export function practiceConversation(turns: readonly PracticeTurn[], now: Date = new Date()): Message[] {
  // A minute apart, oldest first: the reply writer reads order and gaps, not exact times.
  const start = now.getTime() - turns.length * 60_000;
  return turns.map((t, i) => ({
    id: `practice-${i}`,
    direction: t.from === "customer" ? "inbound" : "outbound",
    channel: "email",
    body: t.text,
    date: new Date(start + i * 60_000).toISOString(),
    ...(t.from === "followup" && i === 1 ? { trigger: "instant_ack" } : {}),
  }));
}

export async function practiceReply(
  businessId: string,
  customerName: string,
  turns: readonly PracticeTurn[],
  previous: unknown
): Promise<PracticeReply> {
  const conversation = practiceConversation(turns);
  const first = customerName.trim().split(/\s+/)[0] || "there";
  const latest = latestInboundText(conversation) ?? "";
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { name: true, industry: true } });

  // Their first message: the instant reply every new customer gets.
  if (!conversation.some((m) => m.direction === "outbound")) {
    const ack = await buildAckLine({
      leadFirstName: first,
      ownerFirstName: await getSenderFirstName(businessId),
      businessName: business?.name ?? "us",
      automationTier: "ASSISTED",
      inboundText: latest,
      channel: "email",
    });
    const reply = await composeFollowUpEmail(first, businessId, ack.line, { languageSample: latest });
    // The instant reply is built to be safe to send unread: a risky one falls back to a plain thank-you.
    return { reply, verdict: { sends: true, reason: null }, qualification: readQualification(previous) };
  }

  // Every later message: the reply FollowUp writes for a real customer (scoreAndDraftForLead, email branch).
  const template = templateFor(business?.industry);
  const detecting = detectLeadLanguage(latest);
  const [voiceSamples, detected, extracted, context] = await Promise.all([
    detecting.then((d) => getVoiceSamples(businessId, d ?? undefined)),
    detecting,
    template ? extractQualificationFacts(conversation, template.criteria).catch(() => null) : Promise.resolve(null),
    draftingContext(businessId),
  ]);

  let qualification: Qualification | null = null;
  let qualify: Pick<Criterion, "ask"> | null = null;
  if (template) {
    qualification = mergeQualification(template, readQualification(previous), extracted, customerTexts(conversation), null);
    const next = nextToAsk(template, qualification);
    qualify = askFor(next);
    if (next.length) qualification = markOffered(qualification, ...next.map((c) => c.key));
  }

  const bookingLink = saidYesToMeeting(conversation) ? `${appUrl()}${PRACTICE_BOOKING_PATH}` : null;
  const draft = await generateFollowUpMessage(
    { name: customerName, conversation, ...context, qualify, bookingLink },
    voiceSamples,
    undefined,
    undefined,
    detected
  );
  const message = await composeFollowUpEmail(first, businessId, draft.body, { languageSample: latest, leadLanguage: detected });

  let verdict: PracticeVerdict;
  if (message.includes(PRACTICE_BOOKING_PATH)) {
    verdict = { sends: false, reason: `it carries your booking link, so you see it go` };
  } else {
    try {
      const risk = await assessSendRisk({ conversation, facts: context.facts }, message);
      verdict = risk.riskLevel === "low" ? { sends: true, reason: null } : { sends: false, reason: risk.reason };
    } catch {
      verdict = { sends: false, reason: "FollowUp couldn't check this one, so it would wait" };
    }
  }

  const reply = message.split(`${appUrl()}${PRACTICE_BOOKING_PATH}`).join(BOOKING_LINK_SHOWN);
  return { reply, verdict, qualification };
}
