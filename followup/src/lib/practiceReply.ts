import { prisma } from "@/lib/db";
import { buildAckLine } from "@/lib/acknowledge";
import { assessSendRisk, extractQualificationFacts, generateFollowUpMessage, localizeFixedText } from "@/lib/integrations/openai";
import { composeFollowUpEmail, getSenderFirstName, latestInboundText } from "@/lib/sender";
import { draftingContext } from "@/lib/businessFacts";
import { getVoiceSamples } from "@/lib/voice";
import { detectLeadLanguage } from "@/lib/leadLanguage";
import { saidYesToMeeting } from "@/lib/bookingOffer";
import { askFor, customerTexts, markOffered, mergeQualification, nextToAsk, readQualification, templateFor, type Criterion, type Qualification } from "@/lib/qualification";
import { appUrl } from "@/lib/stripe";
import { draftDm } from "@/lib/dmDrafting";
import { DM_CONTACT_ASK, findEmail } from "@/lib/dmContact";
import { UNGROUNDED_DRAFT_REASONS } from "@/lib/holdReasons";
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
 * The owner picks where the customer writes from (A-289): Email gets the framed email above; Instagram and Messenger
 * get the DM branch instead: the short "Hi! …" instant reply, then draftDm with its tap buttons and its shape check,
 * the one-time ask for their email and mobile, and no links (a DM never carries one).
 *
 * Keep this in step with scoreAndDraftForLead (src/lib/scoring.ts), both branches. It is a copy of the order of
 * calls, not of their insides, so the rules themselves can only ever be the real ones.
 */

export type PracticeChannel = "email" | "instagram" | "messenger";
export type PracticeTurn = { from: "customer" | "followup"; text: string };
export type PracticeVerdict = { sends: boolean; reason: string | null };
export type PracticeReply = {
  reply: string;
  verdict: PracticeVerdict;
  qualification: Qualification | null;
  /** A DM's tap buttons, as the customer would see them. Always empty for email. */
  buttons: string[];
  /** Whether a DM reply has asked for their email and mobile yet (it asks once). */
  contactAsked: boolean;
};

/** Stands in for the customer's booking page, which a practice customer doesn't have. */
const PRACTICE_BOOKING_PATH = "/book/practice";
export const BOOKING_LINK_SHOWN = "[your booking page link]";

export function practiceConversation(turns: readonly PracticeTurn[], now: Date = new Date(), channel: PracticeChannel = "email"): Message[] {
  // A minute apart, oldest first: the reply writer reads order and gaps, not exact times.
  const start = now.getTime() - turns.length * 60_000;
  return turns.map((t, i) => ({
    id: `practice-${i}`,
    direction: t.from === "customer" ? "inbound" : "outbound",
    channel,
    body: t.text,
    date: new Date(start + i * 60_000).toISOString(),
    ...(t.from === "followup" && i === 1 ? { trigger: "instant_ack" } : {}),
  }));
}

export async function practiceReply(
  businessId: string,
  customerName: string,
  turns: readonly PracticeTurn[],
  previous: unknown,
  channel: PracticeChannel = "email",
  contactAskedBefore = false,
  // The Train scorecard (A-292) replays a realtor's moment: it answers as a real estate business, and that example
  // must not be in its own prompt.
  opts: { excludeTrainingId?: string; industry?: string } = {}
): Promise<PracticeReply> {
  const conversation = practiceConversation(turns, new Date(), channel);
  const dm = channel !== "email";
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
      channel,
    });
    // As acknowledgeNewLead sends it: framed on email, "Hi! " and the line on a DM.
    const reply = dm
      ? await localizeFixedText(`Hi! ${ack.line}`, latest)
      : await composeFollowUpEmail(first, businessId, ack.line, { languageSample: latest });
    // The instant reply is built to be safe to send unread: a risky one falls back to a plain thank-you.
    return { reply, verdict: { sends: true, reason: null }, qualification: readQualification(previous), buttons: [], contactAsked: contactAskedBefore };
  }

  // A DM customer, answered once, is asked once for their email and mobile (dmContact.ts shouldAskForContact): not
  // if they already gave an email. That ask takes this reply's question; the qualifying question waits.
  const askContact = dm && !contactAskedBefore && !conversation.some((m) => m.direction === "inbound" && findEmail(m.body));

  // Every later message: the reply FollowUp writes for a real customer (scoreAndDraftForLead, email branch).
  const industry = opts.industry ?? business?.industry;
  const template = templateFor(industry);
  const detecting = detectLeadLanguage(latest);
  const [voiceSamples, detected, extracted, context] = await Promise.all([
    detecting.then((d) => getVoiceSamples(businessId, d ?? undefined)),
    detecting,
    template ? extractQualificationFacts(conversation, template.criteria).catch(() => null) : Promise.resolve(null),
    draftingContext(businessId, { excludeTrainingId: opts.excludeTrainingId, trade: opts.industry }),
  ]);

  let qualification: Qualification | null = null;
  let qualify: Pick<Criterion, "ask"> | null = null;
  if (template) {
    qualification = mergeQualification(template, readQualification(previous), extracted, customerTexts(conversation), null);
    const next = askContact ? [] : nextToAsk(template, qualification);
    qualify = askFor(next);
    if (next.length) qualification = markOffered(qualification, ...next.map((c) => c.key));
  }

  const contactAsked = contactAskedBefore || askContact;

  if (dm) {
    const written = await draftDm(customerName, conversation, voiceSamples, undefined, undefined, detected, context.facts, askContact ? DM_CONTACT_ASK : qualify, context.trade, context.examples);
    let verdict: PracticeVerdict;
    if (written.shapeFailed) {
      // The send pass holds a DM that failed its shape check, in the same words (automation.ts).
      verdict = { sends: false, reason: UNGROUNDED_DRAFT_REASONS[written.shapeFailed] ?? "FollowUp couldn't write a short enough message, so you'd check it first" };
    } else {
      verdict = await sendCheck(conversation, context.facts, written.body);
    }
    const buttons = written.shapeFailed ? [] : written.quickReplies.buttons.map((b) => b.title);
    return { reply: written.body, verdict, qualification, buttons, contactAsked };
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

  const verdict: PracticeVerdict = message.includes(PRACTICE_BOOKING_PATH)
    ? { sends: false, reason: `it carries your booking link, so you see it go` }
    : await sendCheck(conversation, context.facts, message);

  const reply = message.split(`${appUrl()}${PRACTICE_BOOKING_PATH}`).join(BOOKING_LINK_SHOWN);
  return { reply, verdict, qualification, buttons: [], contactAsked: false };
}

/** The send pass's own check (assessSendRisk): low risk goes out by itself, anything else waits, and so does a check that can't run. */
async function sendCheck(conversation: Message[], facts: Parameters<typeof assessSendRisk>[0]["facts"], message: string): Promise<PracticeVerdict> {
  try {
    const risk = await assessSendRisk({ conversation, facts }, message);
    return risk.riskLevel === "low" ? { sends: true, reason: null } : { sends: false, reason: risk.reason };
  } catch {
    return { sends: false, reason: "FollowUp couldn't check this one, so it would wait" };
  }
}
