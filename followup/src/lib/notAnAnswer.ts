/**
 * The automatic messages that are NOT an answer to the customer.
 *
 * Two of FollowUp's messages exist only so a customer isn't left in
 * silence, and say nothing of substance:
 *
 *  - "instant_ack": the "got your message" reply to a brand-new customer
 *    (src/lib/acknowledge.ts).
 *  - "holding": the "let me check and I'll send you the price soon" to a
 *    customer whose price or date question has waited 30 minutes for the
 *    owner (src/lib/holdingMessage.ts, founder 2026-09-26).
 *
 * Everything that asks "has this customer been answered?" has to skip
 * both, or the placeholder reads as the answer: a held price question
 * would drop out of the owner's queue the moment the holding line went,
 * Today would say the customer is waiting on THEM, and the first-value and
 * rescued reports would count "let me check" as a reply.
 *
 * The instant ack was special-cased by name in each of those places. The
 * holding message is the same kind of thing, so they share one list now.
 */
/** The trigger on the holding message. Lives here so the queue can find it without importing the sender. */
export const HOLDING_TRIGGER = "holding";

export const NOT_AN_ANSWER_TRIGGERS: readonly string[] = ["instant_ack", HOLDING_TRIGGER];

/** True for an outbound message whose trigger is one of NOT_AN_ANSWER_TRIGGERS. */
export function isNotAnAnswer(trigger: string | null | undefined): boolean {
  return typeof trigger === "string" && NOT_AN_ANSWER_TRIGGERS.includes(trigger);
}

/**
 * The Prisma filter for "a real answer" on FollowUp / Message rows that
 * carry a `trigger`. A null trigger is a real message (an owner's own
 * reply), and `notIn` alone is NULL for those rows, not true — hence the OR.
 */
export const REAL_ANSWER_WHERE = {
  OR: [{ trigger: null }, { trigger: { notIn: [...NOT_AN_ANSWER_TRIGGERS] } }],
};
