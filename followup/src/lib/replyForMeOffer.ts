import { prisma } from "@/lib/db";
import { hasActiveAccess } from "@/lib/billing";

/**
 * "Let FollowUp reply for you?" (A-217, A-218): owners who set up before
 * the question was part of setup are asked once, on Today.
 *
 * Asked only with the owner's own proof: of the last replies they sent
 * through FollowUp, most went out just as FollowUp wrote them. Never on
 * an account that already lets FollowUp send, never on one whose plan
 * can't turn it on (the switch needs an active plan, so a "yes" would
 * only meet an error), never while sending is paused, and never twice:
 * once the owner answers either way, the business carries this id in
 * `dismissedSetupSteps` (the same per-business "already answered" list
 * setup uses).
 */
export const REPLY_FOR_ME_OFFER = "reply-for-me-offer";

/** How many recent sends the proof looks at, the fewest it needs, and the share sent as written. */
export const OFFER_LOOKBACK = 20;
export const OFFER_MIN_SENDS = 5;
export const OFFER_MIN_SHARE = 0.6;

export type ReplyForMeProof = { asWritten: number; total: number };

/** The decision on its own, for tests: `edited` is each recent send's draftEdited, newest first. */
export function offerFromSends(edited: boolean[]): ReplyForMeProof | null {
  const recent = edited.slice(0, OFFER_LOOKBACK);
  const total = recent.length;
  const asWritten = recent.filter((e) => !e).length;
  if (total < OFFER_MIN_SENDS || asWritten / total < OFFER_MIN_SHARE) return null;
  return { asWritten, total };
}

/** The proof for this business, or null when the question shouldn't be asked. */
export async function replyForMeOffer(businessId: string): Promise<ReplyForMeProof | null> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { holdAllForApproval: true, dismissedSetupSteps: true, subscriptionStatus: true, tier: true, sendingPausedAt: true },
  });
  if (!business?.holdAllForApproval || business.dismissedSetupSteps.includes(REPLY_FOR_ME_OFFER)) return null;
  if (!hasActiveAccess(business.subscriptionStatus, business.tier)) return null;
  // Paused on purpose: a yes would also lift the pause, which the owner didn't ask about here.
  if (business.sendingPausedAt) return null;
  const rows = await prisma.followUp.findMany({
    where: { lead: { businessId }, status: "sent", draftEdited: { not: null } },
    orderBy: { sentAt: "desc" },
    take: OFFER_LOOKBACK,
    select: { draftEdited: true },
  });
  return offerFromSends(rows.map((r) => r.draftEdited === true));
}
