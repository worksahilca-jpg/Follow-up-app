/**
 * "Before your call" (A-268), kept with the booking: written once, and again only when the conversation has moved on.
 * The pure rules are in src/lib/callBrief.ts; this file reads and writes the database and asks the model.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { Message } from "@/lib/types";
import { checkBrief, emptyBrief, isBriefCurrent, isBriefEmpty, readCallBrief, wantsFromFacts, type CallBrief } from "@/lib/callBrief";
import { extractCallBrief } from "@/lib/integrations/openai";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { AI_RUNS_PER_BUSINESS_PER_DAY, AI_RUNS_PER_LEAD_PER_DAY } from "@/lib/scoring";
import { leadAiRefusal } from "@/lib/billing";
import { readQualification } from "@/lib/qualification";

/** What the note needs to know about the call and the customer. */
export type BriefInput = {
  bookingId: string;
  businessId: string;
  leadId: string;
  leadName: string;
  conversation: Message[];
  /** Lead.qualification as stored: what the Ready card already knows, used when the model can't be asked. */
  qualification: unknown;
  /** Booking.brief as stored. */
  stored: unknown;
};

/** What the Ready card knows, as "What they want", when there is no model to ask (or it said nothing there). */
function withFacts(brief: CallBrief, input: BriefInput): CallBrief {
  if (brief.wants.length > 0) return brief;
  const q = readQualification(input.qualification);
  // Buying or selling goes without saying next to the facts themselves; a booked call isn't something they want.
  const line = q ? wantsFromFacts(q.items.filter((i) => i.source !== "booking" && i.key !== "side"), input.conversation) : null;
  return line ? { ...brief, wants: [line] } : brief;
}

/**
 * The note for this call, as current as it can be: the stored one while no message has come since; otherwise written
 * again (within the plan's allowance and the daily AI ceilings, H2) and stored. When the model can't be asked, the
 * stored note stands, or what the Ready card knows. Null when there is nothing true to say.
 */
export async function currentCallBrief(input: BriefInput): Promise<CallBrief | null> {
  const stored = readCallBrief(input.stored);
  const count = input.conversation.length;
  if (stored && isBriefCurrent(stored, count)) return isBriefEmpty(stored) ? null : stored;
  const fallback = (): CallBrief | null => {
    const b = stored ?? withFacts(emptyBrief(count), input);
    return isBriefEmpty(b) ? null : b;
  };
  if (count === 0) return fallback();

  const refused =
    (await leadAiRefusal(input.businessId, input.leadId)) !== null ||
    (await tooManyRecentActions(input.businessId, `ai.run:${input.leadId}`, AI_RUNS_PER_LEAD_PER_DAY)) ||
    (await tooManyRecentActions(input.businessId, "ai.run", AI_RUNS_PER_BUSINESS_PER_DAY));
  if (refused) return fallback();

  let brief: CallBrief;
  try {
    const proposed = await extractCallBrief(input.conversation, input.leadName.trim().split(/\s+/)[0] ?? "");
    if (proposed === null) return fallback();
    brief = withFacts(checkBrief(proposed, input.conversation), input);
  } catch (err) {
    console.error(`Call note for booking ${input.bookingId} could not be written:`, err);
    return fallback();
  }
  // Kept even when empty, so an empty answer isn't asked for again until the conversation moves on.
  await prisma.booking.updateMany({
    where: { id: input.bookingId, businessId: input.businessId },
    data: { brief: brief as unknown as Prisma.InputJsonValue, briefAt: new Date() },
  });
  return isBriefEmpty(brief) ? null : brief;
}
