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
 * Since 2026-09-25 the live path asks too: a message from, or to, someone
 * who is not a lead yet goes through this same judge before it becomes
 * one, and a chat set aside is judged again whenever it says more
 * (judgeUnknownContact in whatsappCloud.ts).
 *
 * The two errors are not equal and this file is deliberately lopsided
 * about them. Missing a real customer is the failure the whole product
 * exists to prevent. A private chat appearing in the pipeline is untidy
 * and nothing sends from it unreviewed. So every uncertain path — a
 * classifier that throws, a missing business description, an empty
 * thread — imports. Failing open is the safe direction here, exactly as
 * gmail.ts already does when classification errors.
 */

/**
 * The one fact stage 2 needs that no amount of reading can supply.
 *
 * "Did the owner send this person a price or a time?" used to live here
 * too, computed by a regex list. It was dropped on 2026-09-20, the day it
 * was written: the list matched "$120" and "Tuesday at 3" and nothing in
 * Hindi, Punjabi or Spanish — weakest for exactly the customers this
 * product's language work exists for. And it was never needed. Stage 2
 * already reads the owner's own messages in the transcript, so the model
 * can see a quote in any language far better than a regex can. It is now
 * simply TOLD to look, and the list is gone rather than translated.
 */
export interface DeepSignals {
  /**
   * This person is already a lead on another channel (email, Instagram,
   * a web form). If they are a customer over there they are a customer
   * here, and nothing the classifier reads should overturn that.
   *
   * A database fact, not a judgement — which is why it stays a flag while
   * the other signal became an instruction.
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
  signals: DeepSignals,
  // A chat that was already set aside, being looked at again because it
  // said more. Stage 1 reads the opening, which has not changed and
  // already said no — so it is skipped, and only the full look runs
  // (security pass 2026-09-25 F2: half the cost of every re-judge).
  options?: { alreadySetAside?: boolean }
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
    if (!options?.alreadySetAside) {
      const stageOne = await classifyAsProspect(messages, counterpart, business);
      if (stageOne.isProspect) return { import: true };
    }

    // --- Stage 2: the same judge, more evidence ------------------------
    //
    // The whole thread rather than its opening, plus the business signal
    // stage 1 structurally could not see. Re-using classifyAsProspect
    // rather than writing a second prompt is the point: one definition of
    // "customer" across every channel, and stage 2 differs only in what
    // it is shown.
    // Stage 2 is told what to look for rather than handed a precomputed
    // boolean. The transcript below already contains the owner's own
    // messages, so the model can see a quoted price or an offered time in
    // whatever language and script the two of them actually use — which a
    // keyword list could only ever do for English.
    //
    // Goes on the business context because that is the field the prompt
    // already treats as "what you need to know to judge this the way
    // someone in this trade would".
    const deepContext: ClassifierBusinessContext | undefined = business
      ? {
          ...business,
          industry:
            `${business.industry ?? "small"} business. Read the business's OWN messages in this thread as well ` +
            `as the customer's: if the business quoted a price, offered a time, arranged to come out, or sent an ` +
            `invoice — in ANY language or script, including a language written in English letters — then work was ` +
            `discussed, whatever the conversation opened like, and this is customer business unless the thread ` +
            `plainly shows otherwise`,
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
