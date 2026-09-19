/**
 * Orchestration: actually sending a follow-up (manual, approved by the
 * user, or automated) and logging it for real — both as a Message in the
 * lead's conversation history, and as a FollowUp record (so "Sent" on the
 * weekly report can be a real count instead of a placeholder).
 *
 * Real channels now: email (Gmail or Outlook — see detectEmailProvider
 * below), SMS (Twilio) or WhatsApp (Twilio's WhatsApp API) when the lead
 * only has a phone, Instagram DM or Facebook Messenger when the lead's
 * "phone" is actually a platform-scoped sender ID (see
 * src/lib/instagramId.ts) — same approval-first flow either way, just a
 * different wire underneath.
 */

import { prisma } from "@/lib/db";
import { dmSuppressionKey, isSuppressed } from "@/lib/suppression";
import { checkSendCap } from "@/lib/sendCaps";
import { getGmailStatus, sendEmail } from "@/lib/integrations/gmail";
import { getOutlookStatus, sendOutlookEmail } from "@/lib/integrations/outlook";
import { sendSms, sendWhatsApp } from "@/lib/twilio";
import { recordAudit } from "@/lib/audit";
import { findOrCreateConversation } from "@/lib/conversations";
import { sendInstagramMessage } from "@/lib/instagram";
import { instagramRecipientId, isInstagramLeadId, isMessengerLeadId, messengerRecipientId } from "@/lib/instagramId";
import { sendMessengerMessage } from "@/lib/facebook";
import type { QuickReply } from "@/lib/quickReplies";
import { META_DM_WINDOW_HOURS, META_HUMAN_AGENT_MAX_HOURS } from "@/lib/metaWindow";
import { CRM_PROVIDERS, isCrmProvider } from "@/lib/crm";
import { isTransientError } from "@/lib/transientError";
import { requireActiveBilling } from "@/lib/billing";
import {
  claimNextDueSend,
  hasSendInFlight,
  markSendDelivered,
  queueSendForRetry,
  reapStaleSends,
  rescheduleSend,
  retireSend,
} from "@/lib/sendQueue";

/**
 * SMS and WhatsApp both live on Lead.phone (the same phone number
 * identifies the same person on either channel — see
 * findOrCreateLeadByPhone in src/lib/twilio.ts) — so which one to reply
 * on isn't stored on the lead itself, it's inferred from whichever
 * channel they most recently actually messaged through, same as a human
 * replying in whatever thread they were just in.
 */
async function detectPhoneChannel(leadId: string): Promise<"whatsapp" | "text"> {
  const lastInbound = await prisma.message.findFirst({
    where: { conversation: { leadId }, direction: "inbound" },
    orderBy: { sentAt: "desc" },
    select: { conversation: { select: { channel: true } } },
  });
  return lastInbound?.conversation.channel === "whatsapp" ? "whatsapp" : "text";
}

/**
 * Same idea as detectPhoneChannel() above, for email once a business can
 * have both Gmail and Outlook connected: a reply has to go out from
 * whichever mailbox actually holds the lead's thread, not always Gmail.
 *  - A lead with an existing "email" Conversation uses whatever provider
 *    was stamped on it (see Conversation.emailProvider) — null there
 *    means a row from before this field existed, always Gmail.
 *  - A lead with no email history yet (manually entered, or captured on
 *    another channel first) falls back to whichever mailbox is actually
 *    connected, preferring Gmail since that's the long-standing default
 *    when a business has both.
 */
async function detectEmailProvider(businessId: string, leadId: string): Promise<"gmail" | "outlook"> {
  const lastEmailConversation = await prisma.conversation.findFirst({
    where: { leadId, channel: "email" },
    orderBy: { createdAt: "desc" },
    select: { emailProvider: true },
  });
  if (lastEmailConversation?.emailProvider === "outlook") return "outlook";
  if (lastEmailConversation) return "gmail";

  const [gmailStatus, outlookStatus] = await Promise.all([getGmailStatus(businessId), getOutlookStatus(businessId)]);
  if (gmailStatus.connected) return "gmail";
  if (outlookStatus.connected) return "outlook";
  // Neither connected — sendEmail() will fail with a clear "not
  // connected" message, same behavior as before Outlook existed.
  return "gmail";
}

/**
 * Which channel an AUTOMATED send (automation.ts, sequences.ts) should
 * use — always pass this explicitly rather than relying on
 * sendFollowUpToLead()'s own default below, which the manual-send
 * composer UI (MessageComposer.tsx's `isEmail = Boolean(leadEmail)`) is
 * built around and this deliberately leaves untouched.
 *
 * The bug this fixes: that default always picks "email" whenever the
 * lead has one on file, regardless of what channel the lead is actually
 * engaging on — so a lead who only ever texts or DMs, but also has an
 * email address (common: a web form asks for both, or a rep adds one
 * later), got automated replies sent to an inbox they never check. This
 * mirrors detectPhoneChannel()'s own reasoning above ("which one to
 * reply on isn't stored on the lead, it's inferred from whichever channel
 * they most recently actually messaged through") but widens it to
 * arbitrate against email too, instead of only between text/WhatsApp.
 *
 * "web" and "call" aren't send-capable channels themselves (no reply
 * API), and a lead with no inbound history yet has nothing to infer from
 * — both fall through to the same static preference order
 * sendFollowUpToLead()'s own default uses.
 */
export async function detectAutomatedReplyChannel(lead: {
  id: string;
  email: string | null;
  phone: string | null;
}): Promise<"email" | "text" | "whatsapp" | "instagram" | "messenger" | null> {
  const lastInbound = await prisma.message.findFirst({
    where: { conversation: { leadId: lead.id }, direction: "inbound" },
    orderBy: { sentAt: "desc" },
    select: { conversation: { select: { channel: true } } },
  });
  const lastChannel = lastInbound?.conversation.channel;
  if (lastChannel === "email" && lead.email) return "email";
  if (lastChannel === "text" && lead.phone) return "text";
  if (lastChannel === "whatsapp" && lead.phone) return "whatsapp";
  if (lastChannel === "instagram" && isInstagramLeadId(lead.phone)) return "instagram";
  if (lastChannel === "messenger" && isMessengerLeadId(lead.phone)) return "messenger";

  if (lead.email) return "email";
  if (isInstagramLeadId(lead.phone)) return "instagram";
  if (isMessengerLeadId(lead.phone)) return "messenger";
  if (lead.phone) return detectPhoneChannel(lead.id);
  return null;
}

/**
 * research/product/2026-09-09-followup-cadence-best-practices.md §4: the
 * channel a caller escalates to when it has deliberately decided NOT to
 * use email for this particular send — a workflow (sequences.ts) EMAIL
 * step for a lead with no email address at all, or one whose earlier
 * EMAIL steps in the same sequence already went out with no reply.
 *
 * Deliberately a separate function rather than a flag on
 * detectAutomatedReplyChannel() above: that function always prefers
 * email whenever the lead has one (both via its own lastChannel check
 * and its static fallback order), which is exactly the behavior a caller
 * invoking this one is trying to get away from. Mirrors its phone/DM
 * branches exactly — same priority (whichever channel the lead's last
 * inbound message actually came in on, then Instagram/Messenger/phone
 * based on what Lead.phone actually holds) — so the two channel-picking
 * functions never quietly disagree about what "text" or "whatsapp" means
 * for a given lead; this one just never returns "email".
 */
export async function detectNonEmailChannel(lead: {
  id: string;
  phone: string | null;
}): Promise<"text" | "whatsapp" | "instagram" | "messenger" | null> {
  if (!lead.phone) return null;
  const lastInbound = await prisma.message.findFirst({
    where: { conversation: { leadId: lead.id }, direction: "inbound" },
    orderBy: { sentAt: "desc" },
    select: { conversation: { select: { channel: true } } },
  });
  const lastChannel = lastInbound?.conversation.channel;
  if (lastChannel === "text") return "text";
  if (lastChannel === "whatsapp") return "whatsapp";
  if (lastChannel === "instagram" && isInstagramLeadId(lead.phone)) return "instagram";
  if (lastChannel === "messenger" && isMessengerLeadId(lead.phone)) return "messenger";

  if (isInstagramLeadId(lead.phone)) return "instagram";
  if (isMessengerLeadId(lead.phone)) return "messenger";
  return detectPhoneChannel(lead.id);
}

/**
 * Why a send didn't happen — the distinction the retry queue is built on.
 *
 *  - "refused"   a guard said no (opt-out, suppression, the daily fuse, no
 *                channel on file). Nothing went wrong and nothing is owed a
 *                retry; trying again would be the loop that burns money and
 *                looks like abuse.
 *  - "permanent" the provider rejected the message itself — a bad number, a
 *                disconnected mailbox, a closed WhatsApp window. Sending the
 *                same bytes again gets the same answer.
 *  - "transient" the provider had a bad moment: a 429, a 5xx, a socket that
 *                hung up. This is the ONLY kind that is worth trying again,
 *                and the classifier is the existing narrow allowlist in
 *                @/lib/transientError — not a second, more generous one.
 */
export type SendFailureKind = "refused" | "permanent" | "transient";

/**
 * Turns a provider wrapper's `{ success: false }` into a labelled failure.
 *
 * `status` is the load-bearing field: it's the first thing isTransientError
 * looks at, and it is the only way to tell a Twilio 503 from a Twilio 400,
 * both of which arrive as prose otherwise. A wrapper that doesn't supply one
 * falls back to matching on the message, which is how the classifier has
 * always handled errors without a status.
 */
function providerFailure(
  result: { message?: string; status?: number },
  fallback: string
): { ok: false; message: string; failure: SendFailureKind } {
  const message = result.message ?? fallback;
  return {
    ok: false,
    message,
    failure: isTransientError({ status: result.status, message }) ? "transient" : "permanent",
  };
}

export type SendResult = {
  success: boolean;
  message?: string;
  failure?: SendFailureKind;
  /** Set when this failure was parked for a retry rather than dropped. */
  queuedRetryAt?: Date;
  /**
   * Set on a successful Instagram/Messenger send that went out under
   * Meta's human-agent allowance — a person's reply between 24 hours and
   * 7 days after the lead's last message. The manual send route records
   * it in the audit trail beside the acting user.
   */
  messagingTag?: "HUMAN_AGENT";
};

/**
 * Meta's window on Instagram and Messenger, judged before the provider is
 * called — so an automated send past 24 hours is a plain refusal here,
 * never a Graph 400 read back from cron JSON (audit 2026-09-16, P1), and
 * a person's send past 7 days is refused with a sentence they can act on.
 *
 * Measured from the lead's last INBOUND message on that channel — a tap on
 * a reply button is an inbound row and counts (api-facts §A5, grade C,
 * verify live); nothing the business sends restarts either clock.
 */
export async function metaWindowFor(
  leadId: string,
  channel: "instagram" | "messenger"
): Promise<{ hoursSinceLead: number | null }> {
  const lastInbound = await prisma.message.findFirst({
    where: { conversation: { leadId, channel }, direction: "inbound" },
    orderBy: { sentAt: "desc" },
    select: { sentAt: true },
  });
  if (!lastInbound) return { hoursSinceLead: null };
  return { hoursSinceLead: (Date.now() - lastInbound.sentAt.getTime()) / 3_600_000 };
}

export async function sendFollowUpToLead(
  leadId: string,
  body: string,
  options: {
    automated?: boolean;
    // Force a channel instead of the email-first default — the instant
    // acknowledgement (src/lib/acknowledge.ts) replies on the channel the
    // lead actually used.
    channel?: "email" | "text" | "whatsapp" | "instagram" | "messenger";
    subject?: string;
    emailThreadId?: string;
    emailInReplyTo?: string;
    // Attribution for the rescued-leads report (see FollowUp.trigger).
    trigger?: "instant_ack" | "unanswered" | "silence" | "sequence" | "manual" | "dead_lead_reactivation";
    // Extra fields merged into this send's own "ai.send" audit event —
    // e.g. the instant ack's generated-vs-fallback decision (see
    // src/lib/acknowledge.ts). Never message text; same contract as
    // every other audit meta. Kept separate from `trigger` since it's
    // caller-specific detail, not something every automated send has.
    extraAuditMeta?: Record<string, unknown>;
    // Set ONLY by runOutboundRetries() below, when this call is a retry of
    // an already-queued send. It does two things: it stops this attempt
    // queueing a second row for the same message, and it exempts the attempt
    // from the "is a send already in flight for this lead" guard — which
    // would otherwise refuse the retry on the strength of its own queue row.
    queuedSendId?: string;
    // Reply chips under an Instagram/Messenger DM — see src/lib/quickReplies.ts.
    // Ignored on every other channel. Not carried into the retry queue: a
    // send parked after a provider blip goes out later as plain text (the
    // question is still in the words; only the chips are lost).
    quickReplies?: QuickReply[];
    // Set ONLY by POST /api/leads/[id]/send — the one route where a
    // signed-in person has the full message in front of them and tapped
    // Send for this one message. It is what allows an Instagram/Messenger
    // send between 24 hours and 7 days after the lead's last message to
    // go out under Meta's human-agent tag (api-facts §B5: human-sent
    // only, one tap per message, a real user id on the record). Ignored
    // when `automated` is set, so no cron, sequence, retry or auto-send
    // path can ever carry the tag, whatever it passes.
    humanSend?: { userId: string };
  } = {}
): Promise<SendResult> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { success: false, message: "Lead not found.", failure: "refused" };

  const channel =
    options.channel ??
    (lead.email
      ? "email"
      : isInstagramLeadId(lead.phone)
        ? "instagram"
        : isMessengerLeadId(lead.phone)
          ? "messenger"
          : lead.phone
          ? await detectPhoneChannel(lead.id)
          : null);
  if (!channel)
    return { success: false, message: "This lead has no email or phone number on file.", failure: "refused" };

  // TCPA/CTIA opt-out — see Lead.optedOutAt and isOptOutMessage() in
  // src/lib/optOutKeywords.ts. A hard stop, not a risk signal: applies to
  // every caller (manual send, automation.ts, sequences.ts, acknowledge.ts —
  // this is the one funnel all of them send through) and is never
  // overridable from here. Scoped to text/whatsapp only — STOP is the
  // SMS-specific legal mechanism, not a "never contact this lead again."
  if ((channel === "text" || channel === "whatsapp") && lead.optedOutAt) {
    return {
      success: false,
      message: "This lead texted STOP — SMS/WhatsApp sending is blocked until they text START to opt back in.",
      failure: "refused",
    };
  }

  // The same hard stop for Instagram and Messenger DMs, which had none at
  // all until now: a lead could DM "stop" and keep receiving automated
  // follow-ups on the two channels this product is being launched on.
  //
  // The consent record is the Suppression table rather than
  // Lead.optedOutAt, keyed on the platform-scoped user id — see the
  // argument in src/lib/suppression.ts. The short version: that row
  // survives the Lead being deleted and re-created by the next DM, and
  // Lead.optedOutAt is documented (schema.prisma) and queried
  // (reactivation.ts, twilio.ts's missed-call claim) as the SMS/WhatsApp
  // mechanism, so overloading it would change what those queries mean.
  //
  // Checked before the send-cap and the suppression checks below for the
  // same reason the SMS one is: nothing may stand in front of an opt-out,
  // and no caller may reach the provider without passing it. Unlike the
  // email suppression further down, this blocks a MANUAL send too — a
  // person who typed STOP at a business meant it, exactly as they would
  // have over SMS.
  const dmKey = channel === "instagram" || channel === "messenger" ? dmSuppressionKey(lead.phone) : null;
  if (dmKey && (await isSuppressed(lead.businessId, dmKey.address, dmKey.channel))) {
    const platform = dmKey.channel === "instagram" ? "Instagram" : "Messenger";
    return {
      success: false,
      message: `This lead sent STOP on ${platform} — messages there are blocked until they send START to opt back in.`,
      failure: "refused",
    };
  }

  // Meta's window, judged here rather than discovered as a Graph 400.
  //
  // Inside 24 hours of the lead's last message: any send. Between 24
  // hours and 7 days: a PERSON's send only, tagged human_agent, and only
  // when this call carries that person's id (see `humanSend`). Past 7
  // days, or before the lead has ever written on this channel: nothing —
  // Meta refuses it regardless, so the refusal happens here, in words the
  // owner can act on, and never spends an API call or a retry slot.
  // Founder's decision 2026-09-16 (PRODUCT_DIRECTION, "DM-only"): no
  // fallback to another channel, ever.
  let humanAgent = false;
  if (channel === "instagram" || channel === "messenger") {
    const platform = channel === "instagram" ? "Instagram" : "Messenger";
    const firstName = lead.name.split(" ")[0];
    const { hoursSinceLead } = await metaWindowFor(lead.id, channel);
    const humanSend = options.automated ? undefined : options.humanSend;
    if (hoursSinceLead === null) {
      return {
        success: false,
        message: `${firstName} hasn't messaged you on ${platform} yet, so Meta doesn't allow a message to them there. They'll need to write first.`,
        failure: "refused",
      };
    }
    if (hoursSinceLead > META_HUMAN_AGENT_MAX_HOURS) {
      return {
        success: false,
        message: `${firstName} last wrote on ${platform} more than 7 days ago — Meta doesn't allow a business to message them now. They'll need to write first, and then everything restarts.`,
        failure: "refused",
      };
    }
    if (hoursSinceLead > META_DM_WINDOW_HOURS) {
      if (!humanSend) {
        return {
          success: false,
          message: `Meta's 24-hour window on ${platform} has closed for ${firstName} — an automatic reply can't go out now. Only you can send one, from their page, for the next ${Math.max(1, Math.floor((META_HUMAN_AGENT_MAX_HOURS - hoursSinceLead) / 24))} day(s).`,
          failure: "refused",
        };
      }
      humanAgent = true;
    }
  }

  // No unsubscribe line, and no List-Unsubscribe header, on ANY message.
  // Founder's call, 2026-09-15, and the reasoning is sound enough to write
  // down rather than just obey.
  //
  // Every message this product sends is a reply to someone who contacted
  // the business first. Even the coldest one in the reactivation batch goes
  // to a person who filled in a form or sent an email and then never heard
  // back — and deadLeadMessageHint() now requires the draft to say exactly
  // that: you got in touch about X, sorry we never came back to you. A
  // recipient reading that recognises it instantly. It is an overdue reply,
  // not an approach, and an "unsubscribe" line stapled to the bottom would
  // misdescribe it as a mailing — which is both untrue and corrosive to the
  // one thing this product sells, that its messages read as if the owner
  // wrote them.
  //
  // The suppression list itself is deliberately KEPT and still enforced
  // below. What changed is how an address gets onto it: not a link, but a
  // person saying so — which is how the SMS side already works, and how
  // someone would actually do it in an email anyway ("please stop emailing
  // me"). Volume is also bounded (see sendCaps.ts), which is what makes
  // relying on a reply rather than a button reasonable: this is 25 messages
  // a day to people who asked, not a list blast.
  //
  // What would make this wrong: if the drafts stopped naming the original
  // enquiry and the missed reply, or if volume rose to where recipients no
  // longer recognise the sender. Both are worth re-checking together.
  // Daily volume ceiling. Applies to AUTOMATED sends only — a human
  // emailing their own customer is never rate-limited by us — and lives
  // here, in the one funnel every automated path goes through, so a caller
  // added later cannot forget it.
  //
  // This carries more weight now that there is no unsubscribe line: volume
  // discipline IS the protection. A handful of recognisable, overdue
  // replies a day is a different thing from a list blast, and the cap is
  // what keeps it the first one. See src/lib/sendCaps.ts.
  if (options.automated) {
    const capKind = options.trigger === "dead_lead_reactivation" ? "reactivation" : "automated";
    const cap = await checkSendCap(lead.businessId, capKind);
    if (!cap.allowed) return { success: false, message: cap.reason, failure: "refused" };
  }

  const isCampaignSend = options.automated && options.trigger === "dead_lead_reactivation";

  const emailSuppressed = channel === "email" && (await isSuppressed(lead.businessId, lead.email));
  if (emailSuppressed && isCampaignSend) {
    return {
      success: false,
      message: "This person unsubscribed from automated follow-ups. You can still reply to them yourself.",
      failure: "refused",
    };
  }

  // Is an earlier message to this lead still waiting to go out?
  //
  // Deliberately the LAST guard — after opt-out, after the daily fuse, after
  // suppression, so it can never stand in front of any of them — and only on
  // automated sends: a human typing a reply is never blocked by our
  // bookkeeping.
  //
  // It exists because the queue is not the only thing that retries.
  // sequences.ts leaves a lead enrolled on the same step after a failed send
  // and re-drafts it on the next hourly tick (see the `!result.success`
  // branch there), and automation.ts re-considers a lead once its claim
  // ages out. Without this, the queue would deliver the parked copy and the
  // caller would deliver a fresh one — the same follow-up twice, in the
  // owner's name, which is the exact failure the retry was added to avoid.
  if (options.automated && !options.queuedSendId && (await hasSendInFlight(lead.id))) {
    return {
      success: false,
      message:
        "An earlier message to this lead is still waiting to go out after a provider failure — FollowUp is retrying that one rather than sending another.",
      failure: "refused",
    };
  }

  // ---------------------------------------------------------------
  // The provider call, and the one place a failure gets classified.
  //
  // Every wire in here used to fail the same way — a `return { success:
  // false }` that the caller shrugged at — so a Twilio 500 and a wrong phone
  // number were indistinguishable, and the transient one cost a real
  // follow-up. Now each failure leaves here labelled (see SendFailureKind),
  // and exactly one of those labels leads to a retry.
  //
  // The classifier is @/lib/transientError, used unchanged. What it needed
  // was evidence: the fetch-based wrappers (Twilio, Meta, Graph) were
  // throwing away the HTTP status and handing back only a prose message, so
  // "503 Service Unavailable" arrived here as "Twilio rejected this
  // message." and read as permanent. They now pass `status` through, which
  // is the field isTransientError already looks at first.
  //
  // Gmail is the other shape: googleapis THROWS a GaxiosError carrying
  // .status, so the whole dispatch runs inside a try — and note that a throw
  // no longer escapes this function. That matters: automation.ts treats an
  // escaped transient throw by releasing its claim and re-drafting the lead
  // next hour, which would race this queue and send twice.
  // ---------------------------------------------------------------
  const dispatch = async (): Promise<
    { ok: true; externalId?: string; emailProvider?: "gmail" | "outlook" } | { ok: false; message: string; failure: SendFailureKind }
  > => {
    let externalId: string | undefined;
    let emailProvider: "gmail" | "outlook" | undefined;
    if (channel === "email") {
      if (!lead.email) return { ok: false, message: "This lead has no email address on file.", failure: "refused" };

      // Only AUTOMATED mail carries the unsubscribe footer and headers. A
      // human typing a reply to a customer is not a mailing they should be
      // offered a way out of — putting "unsubscribe" under a personal reply
      // would be both odd and, by implying the message was bulk, untrue.
      //
      // Deliberately a SEPARATE value rather than appended to `body`: the
      // footer is transport decoration, like the List-Unsubscribe header
      // beside it. `body` is what gets stored on the Message row, shown in
      // the thread, and measured in the audit trail — and none of those
      // should carry a link that isn't part of what anyone wrote.
      emailProvider = await detectEmailProvider(lead.businessId, lead.id);
      if (emailProvider === "outlook") {
        const result = await sendOutlookEmail(lead.businessId, {
          to: lead.email,
          subject: options.subject ?? `Following up on your inquiry, ${lead.name.split(" ")[0]}`,
          body,
          // Graph's /reply endpoint takes the specific message's own id,
          // not an RFC822 Message-ID header — acknowledgeNewLead's Outlook
          // path passes that Graph id through as emailInReplyTo (same
          // field Gmail's flow uses for its own, differently-shaped id).
          replyToMessageId: options.emailInReplyTo,
        });
        if (!result.success) return providerFailure(result, "Outlook didn't confirm this message sent.");
      } else {
        const result = await sendEmail(lead.businessId, {
          to: lead.email,
          subject: options.subject ?? `Following up on your inquiry, ${lead.name.split(" ")[0]}`,
          body,
          threadId: options.emailThreadId,
          inReplyTo: options.emailInReplyTo,
        });
        if (!result.success) return providerFailure(result, "Gmail didn't confirm this message sent.");
        externalId = result.messageId ?? undefined;
      }
    } else if (channel === "instagram") {
      const result = await sendInstagramMessage(lead.businessId, instagramRecipientId(lead.phone!), body, { quickReplies: options.quickReplies, humanAgent });
      if (!result.success) return providerFailure(result, "Instagram didn't confirm this message sent.");
    } else if (channel === "messenger") {
      const result = await sendMessengerMessage(lead.businessId, messengerRecipientId(lead.phone!), body, { quickReplies: options.quickReplies, humanAgent });
      if (!result.success) return providerFailure(result, "Facebook didn't confirm this message sent.");
    } else if (channel === "whatsapp") {
      const result = await sendWhatsApp(lead.businessId, lead.phone!, body, { leadFirstName: lead.name.split(" ")[0] });
      if (!result.success) return providerFailure(result, "WhatsApp didn't confirm this message sent.");
      externalId = result.sid;
    } else {
      const result = await sendSms(lead.businessId, lead.phone!, body);
      if (!result.success) return providerFailure(result, "Twilio didn't confirm this message sent.");
      externalId = result.sid;
    }
    return { ok: true, externalId, emailProvider };
  };

  let sent: Awaited<ReturnType<typeof dispatch>>;
  try {
    sent = await dispatch();
  } catch (err) {
    // A throw from the wire (Gmail's GaxiosError, a DNS failure, a socket
    // reset mid-request) — classified exactly like a returned failure, and
    // deliberately not re-thrown, so the callers' own ad-hoc retries can't
    // race the queue below.
    sent = {
      ok: false,
      message: err instanceof Error ? err.message : "The message couldn't be sent.",
      failure: isTransientError(err) ? "transient" : "permanent",
    };
  }

  if (!sent.ok) {
    // The whole point of the exercise: a provider outage delays this
    // message, it does not lose it.
    //
    // Only automated sends are parked. A person who pressed Send is looking
    // at the screen, gets told it failed, and can decide for themselves —
    // queueing that behind their back would mean their message goes out
    // twice the moment they press it again.
    if (options.automated && sent.failure === "transient" && !options.queuedSendId) {
      const queued = await queueSendForRetry(
        {
          businessId: lead.businessId,
          leadId: lead.id,
          channel,
          body,
          subject: options.subject,
          emailThreadId: options.emailThreadId,
          emailInReplyTo: options.emailInReplyTo,
          trigger: options.trigger ?? "silence",
          auditMeta: options.extraAuditMeta,
        },
        sent.message
      );
      if (queued) {
        void recordAudit({ businessId: lead.businessId, userId: null }, "ai.send_queued", {
          targetType: "lead",
          targetId: lead.id,
          meta: { channel, trigger: options.trigger ?? "silence", reason: sent.message, nextAttemptAt: queued.nextAttemptAt.toISOString() },
        });
        return {
          success: false,
          message: `${sent.message} FollowUp will try again shortly.`,
          failure: "transient",
          queuedRetryAt: queued.nextAttemptAt,
        };
      }
    }
    return { success: false, message: sent.message, failure: sent.failure };
  }
  const { externalId, emailProvider } = sent;
  const quickRepliesSent = (channel === "instagram" || channel === "messenger") ? options.quickReplies?.length ?? 0 : 0;

  // ---------------------------------------------------------------
  // Past this line the message has LEFT. Gmail/Outlook/Twilio/Meta has
  // accepted it and the lead's phone is already buzzing — nothing below
  // can un-send it, so nothing below may be allowed to make this look
  // like a send that didn't happen.
  //
  // It used to. Every write here ran unguarded, so a Prisma failure
  // after the provider said yes — a pool timeout ("Timed out fetching a
  // new connection from the connection pool", the single most common
  // serverless+Postgres failure), an ECONNRESET, a deploy cycling the
  // DB — threw straight out of this function, and each caller read that
  // as "the send failed" and retried it:
  //   - automation.ts treats ECONNRESET/ETIMEDOUT as transient
  //     (isTransientError), RELEASES its lastAutomationCheckedAt claim,
  //     and re-drafts and re-sends the lead on the next hourly tick —
  //     and because the lastContacted update below never ran either,
  //     the lead is still inside the silence window, so it qualifies
  //     again. Two follow-ups, an hour apart, to the same person.
  //   - sequences.ts catches the throw as "skipped" and leaves the lead
  //     enrolled on the SAME sequenceStepIndex with only the 5-minute
  //     claim lock on sequenceStepDueAt, which expires long before the
  //     next hourly tick — so that step re-sends, unconditionally, with
  //     no transient-error test required at all.
  //
  // So: the bookkeeping is best-effort and the send is reported as what
  // it actually is — successful. The cost of losing a Message row is a
  // gap in the thread view; the cost of retrying is a duplicate message
  // to a customer in the owner's name, which is the failure this whole
  // module exists to prevent.
  //
  // lastContacted goes FIRST, deliberately: it is the one field that
  // takes the lead back out of every re-eligibility window, so it gets
  // the best chance of landing if the database is only intermittently
  // reachable.
  // ---------------------------------------------------------------
  try {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { lastContacted: new Date() },
    });

    const conversation = await findOrCreateConversation(lead.id, channel, emailProvider ? { emailProvider } : {});

    // One value, written to both rows. The Message copy is what lets the
    // neglect judgment (automation.ts, automationStatus.ts) see the instant
    // ack as boilerplate rather than as "someone answered" — see
    // Message.trigger in schema.prisma for the bug that was.
    const trigger = options.trigger ?? (options.automated ? "silence" : "manual");

    // Did the draft go out as FollowUp wrote it? Whitespace-insensitive,
    // because the composer re-wraps text; anything else is an edit. No
    // draft on the lead (a message typed from scratch, an instant ack)
    // means nothing to compare, so null rather than a false "unedited".
    const squash = (s: string) => s.replace(/\s+/g, " ").trim();
    const draftEdited = lead.suggestedMessage ? squash(body) !== squash(lead.suggestedMessage) : null;

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "outbound",
        body,
        externalId,
        trigger,
      },
    });

    await prisma.followUp.create({
      data: {
        leadId: lead.id,
        channel,
        message: body,
        status: "sent",
        automated: options.automated ?? false,
        trigger,
        draftEdited,
        sentAt: new Date(),
      },
    });
  } catch (err) {
    // Loud, because a send that isn't in the thread is genuinely wrong —
    // just less wrong than sending it twice.
    console.error(
      `Send to lead ${lead.id} on ${channel} was accepted by the provider but could not be recorded — NOT retrying (the message already went out):`,
      err
    );
  }

  // Push a note to the CRM this lead came from — best-effort, never lets
  // a CRM hiccup fail a send that already succeeded. See src/lib/crmSync.ts.
  if (lead.crmProvider && lead.crmId && isCrmProvider(lead.crmProvider)) {
    void pushCrmNote(lead.businessId, lead.crmProvider, lead.crmId, body);
  }

  // AI audit trail (task #67): every message this app sent with nobody
  // clicking "Send" — auto-send on silence, the human-neglect rescue, a
  // sequence step, the instant acknowledgement — lands in the same
  // append-only AuditEvent trail admin-side actions already use, instead
  // of only existing as a FollowUp row nobody but the weekly report
  // reads. A manual send is already covered by its own route-level
  // recordAudit("lead.send", ...) call, so this only fires for automated
  // ones to avoid double-logging the same send.
  if (options.automated) {
    void recordAudit({ businessId: lead.businessId, userId: null }, "ai.send", {
      targetType: "lead",
      targetId: lead.id,
      meta: {
        channel,
        trigger: options.trigger ?? "silence",
        length: body.length,
        // How many chips went under a DM — a count, never the titles, per
        // the "identifiers and counts, never message bodies" contract.
        ...(quickRepliesSent ? { quickReplies: quickRepliesSent } : {}),
        ...options.extraAuditMeta,
      },
    });
  }

  return humanAgent ? { success: true, messagingTag: "HUMAN_AGENT" } : { success: true };
}

async function pushCrmNote(businessId: string, provider: string, crmId: string, body: string): Promise<void> {
  try {
    const conn = await prisma.crmConnection.findUnique({ where: { businessId } });
    if (!conn?.apiKey || conn.provider !== provider) return;
    const result = await CRM_PROVIDERS[provider as keyof typeof CRM_PROVIDERS].client.pushNote(
      conn.apiKey,
      crmId,
      `FollowUp sent:\n\n${body}`
    );
    if (!result.ok) console.error(`CRM note push failed for business ${businessId}: ${result.message}`);
  } catch (err) {
    console.error(`CRM note push errored for business ${businessId}:`, err);
  }
}

// ---------------------------------------------------------------------
// The retry worker.
// ---------------------------------------------------------------------

const CHANNEL_LABELS: Record<string, string> = {
  email: "by email",
  text: "by text",
  whatsapp: "on WhatsApp",
  instagram: "on Instagram",
  messenger: "on Facebook Messenger",
};

function isSendableChannel(channel: string): channel is "email" | "text" | "whatsapp" | "instagram" | "messenger" {
  return channel in CHANNEL_LABELS;
}

/**
 * Tells a human that a follow-up did not go out.
 *
 * This is the "someone can see it" half of the terminal state — a row in a
 * table nobody opens is not visibility. Goes to whoever owns the lead, or to
 * every admin when it's in the shared pool, exactly like the neglect
 * notification in automation.ts.
 */
async function notifyUndeliveredSend(leadId: string, message: string): Promise<void> {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { businessId: true, assignedToId: true },
    });
    if (!lead) return;
    const userIds = lead.assignedToId
      ? [lead.assignedToId]
      : (
          await prisma.user.findMany({
            where: { businessId: lead.businessId, role: "ADMIN" },
            select: { id: true },
          })
        ).map((u) => u.id);
    for (const userId of userIds) {
      await prisma.notification.create({ data: { userId, leadId, message } });
    }
  } catch (err) {
    console.error(`Could not notify anyone that the send to lead ${leadId} failed:`, err);
  }
}

export type OutboundRetryResult = {
  /** Rows claimed and attempted this invocation. */
  attempted: number;
  sent: number;
  /** Failed again, still has budget — waiting for a longer backoff. */
  requeued: number;
  /** Terminal: out of attempts, or a permanent rejection. */
  failed: number;
  /** Terminal: a guard refused it at retry time (opt-out, suppression, cap). */
  canceled: number;
  /** Terminal: an earlier invocation was killed mid-attempt; never retried. */
  abandoned: number;
};

/**
 * Works the queue of sends a provider refused for a reason that fixes itself.
 *
 * Called from /api/cron/outbound-retry every five minutes. Safe to call
 * concurrently with itself: nothing is held in local state, every row is
 * taken with an atomic claim, and a row this invocation is working cannot be
 * claimed by another.
 *
 * The budget is WALL-CLOCK first, count second, and deliberately so. The
 * lesson is next door in reactivationSend.ts, whose loop budgets by count
 * (40 sends) against a spacing (6s) that multiplies out to 240s under a 300s
 * ceiling — so the invocation is killed part-way through and the lead it had
 * claimed is lost. A count budget is only a time budget if you already know
 * how long a send takes, and nobody does when the provider is having a bad
 * day, which is exactly when this function runs.
 */
export async function runOutboundRetries(
  options: { maxSends?: number; deadlineMs?: number } = {}
): Promise<OutboundRetryResult> {
  const maxSends = options.maxSends ?? 50;
  // Well inside the route's maxDuration (300s), with room for one slow
  // attempt to finish after the last check rather than being killed in the
  // middle of it.
  const deadlineMs = options.deadlineMs ?? 200_000;
  const startedAt = Date.now();
  const result: OutboundRetryResult = { attempted: 0, sent: 0, requeued: 0, failed: 0, canceled: 0, abandoned: 0 };

  // Rows whose invocation died mid-attempt. Retired, never retried — see
  // reapStaleSends().
  for (const stale of await reapStaleSends()) {
    result.abandoned += 1;
    console.error(`Outbound send ${stale.id} (lead ${stale.leadId}) was interrupted mid-attempt — not retried.`);
    await notifyUndeliveredSend(
      stale.leadId,
      "A follow-up was interrupted while it was being sent. We couldn't tell whether it arrived, so we didn't send it again — worth checking the thread before you message them."
    );
    void recordAudit({ businessId: stale.businessId, userId: null }, "ai.send_abandoned", {
      targetType: "lead",
      targetId: stale.leadId,
      meta: { channel: stale.channel, reason: "interrupted mid-attempt" },
    });
  }

  // One lookup per business per invocation, not per row.
  const billingCache = new Map<string, boolean>();

  while (result.attempted < maxSends && Date.now() - startedAt < deadlineMs) {
    const row = await claimNextDueSend();
    if (!row) break;
    result.attempted += 1;

    try {
      // A business that lapsed between the first attempt and this one gets
      // nothing sent on its behalf, same rule as every other automated path
      // (automation.ts, sequences.ts). Terminal rather than parked: the
      // subscription isn't coming back inside a two-hour backoff.
      let billingOk = billingCache.get(row.businessId);
      if (billingOk === undefined) {
        billingOk = await requireActiveBilling(row.businessId);
        billingCache.set(row.businessId, billingOk);
      }
      if (!billingOk) {
        await retireSend(row.id, "canceled", "The subscription isn't active, so nothing was sent.");
        result.canceled += 1;
        continue;
      }

      if (!isSendableChannel(row.channel)) {
        await retireSend(row.id, "failed", `There's no way to send ${row.channel} messages.`);
        result.failed += 1;
        continue;
      }

      // Back in at the TOP of the funnel, not at the provider call — which
      // is the whole reason the retry lives here rather than in the queue
      // module. Opt-out, the daily fuse and suppression are all re-evaluated
      // now, against the world as it is now. A lead who texted STOP five
      // minutes after the first attempt is not messaged.
      const attempt = await sendFollowUpToLead(row.leadId, row.body, {
        automated: true,
        channel: row.channel,
        subject: row.subject ?? undefined,
        emailThreadId: row.emailThreadId ?? undefined,
        emailInReplyTo: row.emailInReplyTo ?? undefined,
        trigger: (row.trigger ?? "silence") as NonNullable<Parameters<typeof sendFollowUpToLead>[2]>["trigger"],
        extraAuditMeta: {
          ...(row.auditMeta && typeof row.auditMeta === "object" ? (row.auditMeta as Record<string, unknown>) : {}),
          retriedAttempt: row.attempts,
        },
        queuedSendId: row.id,
      });

      if (attempt.success) {
        await markSendDelivered(row.id);
        result.sent += 1;
        continue;
      }

      const reason = attempt.message ?? "The message couldn't be sent.";

      // A guard said no. Nothing went wrong — the product declined, which is
      // it working. No notification: an owner does not need to be told that
      // someone who opted out wasn't messaged.
      if (attempt.failure === "refused") {
        await retireSend(row.id, "canceled", reason);
        result.canceled += 1;
        continue;
      }

      if (attempt.failure === "transient") {
        const nextAttemptAt = await rescheduleSend(row, reason);
        if (nextAttemptAt) {
          result.requeued += 1;
          continue;
        }
      }

      // Terminal: out of attempts, or a rejection that won't change.
      await retireSend(row.id, "failed", reason);
      result.failed += 1;
      await notifyUndeliveredSend(
        row.leadId,
        `A follow-up couldn't be delivered ${CHANNEL_LABELS[row.channel]} after ${row.attempts} tries — ${reason} Nothing was sent, so it's worth reaching out yourself.`
      );
      void recordAudit({ businessId: row.businessId, userId: null }, "ai.send_failed", {
        targetType: "lead",
        targetId: row.leadId,
        meta: { channel: row.channel, trigger: row.trigger, attempts: row.attempts, reason },
      });
    } catch (err) {
      // sendFollowUpToLead no longer throws on a provider failure, so this is
      // the database itself (a pool timeout, a deploy cycling Postgres). The
      // row must not be left claimed: give it back if there is budget, retire
      // it if there isn't. Both writes can fail too, in which case
      // reapStaleSends() picks the row up later.
      console.error(`Retrying outbound send ${row.id} (lead ${row.leadId}) threw:`, err);
      const reason = err instanceof Error ? err.message : "The message couldn't be sent.";
      try {
        if (isTransientError(err) && (await rescheduleSend(row, reason))) {
          result.requeued += 1;
        } else {
          await retireSend(row.id, "failed", reason);
          result.failed += 1;
        }
      } catch (writeErr) {
        console.error(`Could not record the outcome of outbound send ${row.id}:`, writeErr);
      }
    }
  }

  return result;
}
