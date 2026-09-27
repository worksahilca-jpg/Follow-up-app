import { NOT_AN_ANSWER_TRIGGERS } from "@/lib/notAnAnswer";
import type { Prisma } from "@prisma/client";
import { startOfLocalDay } from "@/lib/calmToday";

/**
 * FollowUp's first value moment (design brain A-047, the Amplitude study),
 * in one place so /admin and Today can never disagree about it:
 *
 *   First value: a customer got a reply that FollowUp wrote.
 *
 * A reply FollowUp wrote that went out: a rule sent it by itself
 * (automated), or a person sent it from a FollowUp draft (draftEdited is
 * only set when a draft existed to compare against, edited or not).
 * The instant "got your message" is left out on purpose: it is the same
 * boilerplate for everyone, not a reply (see Message.trigger in the schema).
 */
export const FIRST_VALUE_SEND: Prisma.FollowUpWhereInput = {
  status: "sent",
  sentAt: { not: null },
  AND: [
    // `not` alone would also drop rows whose trigger is null (SQL NULL).
    { OR: [{ trigger: null }, { trigger: { notIn: [...NOT_AN_ANSWER_TRIGGERS] } }] },
    { OR: [{ automated: true }, { draftEdited: { not: null } }] },
  ],
};

/** Activated: first value within this long of first signing in. */
export const ACTIVATION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface FirstValueSend {
  sentAt: Date;
  channel: string;
  repliedAt: Date | null;
  leadName: string | null;
}

const CHANNEL_WORDS: Record<string, string> = {
  email: "by email",
  text: "by text",
  sms: "by text",
  whatsapp: "on WhatsApp",
  instagram: "on Instagram",
  messenger: "on Messenger",
  facebook: "on Messenger",
};

function partOfDay(at: Date, timeZone: string): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hourCycle: "h23" }).formatToParts(at).find((p) => p.type === "hour")?.value ?? 12
  );
  if (hour < 12) return "this morning";
  if (hour < 17) return "this afternoon";
  return "this evening";
}

/**
 * Today's one-time line, said on the day it happens and never again
 * (A-047): no stored flag, because "the day it happens" is a fact the
 * send already carries. Null on every other day. Uses the customer's name,
 * never a pronoun: the app can't know anyone's pronouns.
 */
export function firstValueNote(send: FirstValueSend | null, now: Date, timeZone: string): { title: string; body: string } | null {
  if (!send) return null;
  if (send.sentAt < startOfLocalDay(now, timeZone) || send.sentAt > now) return null;
  const full = send.leadName?.trim() || null;
  const first = full ? full.split(/\s+/)[0] : null;
  const how = CHANNEL_WORDS[send.channel] ? ` ${CHANNEL_WORDS[send.channel]}` : "";
  const when = partOfDay(send.sentAt, timeZone);
  const who = full ?? "Your customer";
  const body = send.repliedAt
    ? `${who} got it${how} ${when}, and has already written back.`
    : `${who} got it${how} ${when}. From here FollowUp keeps watching, and tells you when ${first ?? "the customer"} writes back.`;
  return { title: "Your first reply went out through FollowUp.", body };
}
