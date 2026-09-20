import { prisma } from "@/lib/db";
import { classifyAsProspect, type ClassifierBusinessContext } from "@/lib/integrations/openai";
import type { Message } from "@/lib/types";

/**
 * "Is this WhatsApp chat a customer, or the owner's private life?"
 *
 * WhatsApp Coexistence connects the owner's OWN number — the one on their
 * phone, which they also use for their accountant, their supplier and
 * their brother-in-law. The history import created a Lead per thread and
 * asked nothing, so connecting filled the pipeline with the owner's
 * private contacts, each one scored and drafted for.
 *
 * The mailbox syncs have had the answer to this since the beginning: an
 * inbox is at least as mixed, and gmail.ts/outlook.ts gate lead creation
 * on classifyAsProspect. This brings WhatsApp to the same standard —
 * deliberately the SAME classifier, not a second one, so the two channels
 * cannot drift into disagreeing about what a customer is.
 *
 * What is different here is the founder's bar, set 2026-09-20: "make sure
 * no leads slip over". So a single "no" is not enough to set a chat aside.
 *
 *   Stage 1 — the opening messages, the same read the mailbox does.
 *             Says customer: it is a lead, and stage 2 never runs.
 *   Stage 2 — ONLY on a rejection, and now with everything: the whole
 *             thread rather than its opening, plus the two facts a first
 *             glance cannot see (below).
 *
 * A chat has to fail twice, the second time on full evidence, and even
 * then it is recorded where the owner can see it and take it back — it is
 * never deleted and never silently dropped.
 *
 * The two errors are not equal and this file is deliberately lopsided
 * about them. Missing a real customer is the failure the whole product
 * exists to prevent. A private chat appearing in the pipeline is untidy
 * and nothing sends from it unreviewed. So every uncertain path — a
 * classifier that throws, a missing business description, an empty
 * thread — imports. Failing open is the safe direction here, exactly as
 * gmail.ts already does when classification errors.
 */

/** The extra evidence stage 2 gets that stage 1 does not. */
export interface DeepSignals {
  /**
   * The owner sent something only a business sends into this chat — a
   * price, a quote, a time slot, an invoice. Whatever the chat opened
   * like, that is a job.
   */
  ownerSentBusinessContent: boolean;
  /**
   * This person is already a lead on another channel (email, Instagram,
   * a web form). If they are a customer over there they are a customer
   * here, and nothing the classifier reads should overturn that.
   */
  knownOnAnotherChannel: boolean;
}

export type HistoryVerdict =
  | { import: true }
  | { import: false; reason: string };

// Stage 1 reads the opening, exactly as the mailbox does — the
// classifier's own default of 3.
//
// Stage 2 reads the most RECENT messages instead, up to this many. Not
// the opening again: stage 1 already read that and said no, so re-reading
// it is the one thing guaranteed to add nothing. A chat that opened "hey"
// and turned into a job on message twelve is precisely the case this has
// to catch.
const STAGE_TWO_MESSAGES = 20;

/**
 * Words the owner only types when there is a job on. Matched on the
 * OWNER's side of the chat, never the customer's — a customer saying
 * "how much" is an enquiry stage 1 already catches; an owner answering
 * with a figure is a transaction, and that is the signal stage 1 misses
 * when the chat opened with "hey".
 *
 * Deliberately narrow and boring. This does not decide anything on its
 * own: it is one input handed to the classifier, which still makes the
 * call. A false positive here costs an imported chat, which is the
 * direction this file errs in anyway.
 */
const BUSINESS_CONTENT = [
  /\b(?:quote|quoted|estimate|invoice|deposit|receipt)\b/i,
  // A currency amount: "$120", "120 dollars", "£85", "₹2000".
  /[$£€₹]\s?\d/,
  /\b\d+\s?(?:dollars|pounds|euros|rupees)\b/i,
  // An offered time: "Tuesday at 3", "tomorrow 9am", "between 2 and 4".
  /\b(?:mon|tues|wednes|thurs|fri|satur|sun)day\b.{0,20}\b\d/i,
  /\b\d{1,2}\s?(?:am|pm)\b/i,
  /\b(?:book(?:ed|ing)?|schedul(?:e|ed)|appointment|come (?:by|over|round))\b/i,
];

/**
 * Does the owner's side of this chat contain something only a business
 * says? Outbound messages only.
 */
export function ownerSentBusinessContent(messages: Message[]): boolean {
  return messages.some((m) => m.direction === "outbound" && BUSINESS_CONTENT.some((re) => re.test(m.body)));
}

/**
 * Is this number already a lead on some other channel for this business?
 *
 * Matched on the phone number as stored. A WhatsApp history lead is keyed
 * "+<wa_id>", and Twilio SMS leads use the same E.164 shape, so a number
 * the business already texts is found here. Instagram and Messenger leads
 * hold a prefixed platform id in the same column and simply will not
 * match, which is correct — they are a different person as far as the
 * number is concerned.
 */
export async function knownOnAnotherChannel(businessId: string, phone: string): Promise<boolean> {
  const existing = await prisma.lead.findFirst({
    where: { businessId, phone, source: { not: "WhatsApp" } },
    select: { id: true },
  });
  return existing !== null;
}

/**
 * The two stages. Returns whether to import, and on a refusal the
 * classifier's own one-line reason, verbatim — that sentence is what the
 * owner reads in the skipped list, and our paraphrase of it would be
 * worse than the model's.
 */
export async function judgeHistoryThread(
  messages: Message[],
  contact: { name: string; phone: string },
  business: ClassifierBusinessContext | undefined,
  signals: DeepSignals
): Promise<HistoryVerdict> {
  // Nothing to read is not evidence of anything. Import.
  if (messages.length === 0) return { import: true };

  // A person we already deal with elsewhere is a customer, full stop.
  // Asked before either AI call rather than passed into them: this is a
  // fact about the business's own records, not a judgement, and there is
  // nothing for a classifier to weigh against it.
  if (signals.knownOnAnotherChannel) return { import: true };

  const counterpart = { name: contact.name, email: contact.phone };

  try {
    const stageOne = await classifyAsProspect(messages, counterpart, business);
    if (stageOne.isProspect) return { import: true };

    // --- Stage 2: the same judge, more evidence ------------------------
    //
    // The whole thread rather than its opening, plus the business signal
    // stage 1 structurally could not see. Re-using classifyAsProspect
    // rather than writing a second prompt is the point: one definition of
    // "customer" across every channel, and stage 2 differs only in what
    // it is shown.
    // The signal goes on the business context because that is the field
    // the prompt already treats as "what you need to know to judge this
    // the way someone in this trade would".
    const deepContext: ClassifierBusinessContext | undefined = business
      ? {
          ...business,
          industry: signals.ownerSentBusinessContent
            ? `${business.industry ?? "small"} business. Note: this business has already sent this contact a ` +
              `price, a time or an invoice in this same conversation — whatever the chat opened like, work was ` +
              `discussed, so treat it as customer business unless the thread plainly shows otherwise`
            : business.industry,
        }
      : business;

    const recent = messages.slice(-STAGE_TWO_MESSAGES);
    const stageTwo = await classifyAsProspect(recent, counterpart, deepContext, { maxMessages: STAGE_TWO_MESSAGES });
    if (stageTwo.isProspect) return { import: true };

    return { import: false, reason: stageTwo.reason };
  } catch (err) {
    // Fails open, the same as gmail.ts: better an untidy pipeline than a
    // lost customer, and a classifier outage must never quietly cost the
    // owner a lead they would have answered.
    console.error(`WhatsApp history classification failed for ${contact.phone}:`, err);
    return { import: true };
  }
}

/** What a filtered WhatsApp row keeps so Restore can rebuild the thread. */
export interface StoredThread {
  phone: string;
  name: string | null;
  messages: Message[];
}

/**
 * Reads back what the import stored, refusing anything that is not the
 * shape it wrote. The column is Json and therefore `unknown` to
 * TypeScript; a row written by an older build, or hand-edited, must fail
 * here rather than produce a half-built conversation.
 */
export function parseStoredThread(value: unknown): StoredThread | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.phone !== "string" || !v.phone) return null;
  if (!Array.isArray(v.messages)) return null;

  const messages: Message[] = [];
  for (const raw of v.messages) {
    if (!raw || typeof raw !== "object") continue;
    const m = raw as Record<string, unknown>;
    if (typeof m.body !== "string" || typeof m.date !== "string") continue;
    if (m.direction !== "inbound" && m.direction !== "outbound") continue;
    messages.push({
      id: typeof m.id === "string" ? m.id : "",
      direction: m.direction,
      channel: "whatsapp",
      body: m.body,
      date: m.date,
      opened: false,
    });
  }

  return { phone: v.phone, name: typeof v.name === "string" ? v.name : null, messages };
}
