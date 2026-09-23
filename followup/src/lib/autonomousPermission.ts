/**
 * "May this account use Auto?" — asked in one place, by every path that
 * can reach it.
 *
 * Founder, 2026-09-23: "Auto should be permitted by the user that is
 * using followup."
 *
 * Auto is the one mode that skips the risk check. A lead on it sends
 * price talk, delivery promises and tense conversations without anyone
 * reading them. That is a real thing an owner might want, and it is not
 * something that should ever happen because nobody said no.
 *
 * ## What was there before, and why none of it was a permission
 *
 * Three things, and each looked like a guard from one angle:
 *
 *   1. **A confirmation dialog** on the lead page. Client code. It asks
 *      nicely and the API never hears about it.
 *   2. **A billing-tier check** — Free is Assisted-only. That is a
 *      pricing rule, not consent: paying for Pro is not the same as
 *      saying "send things nobody has read".
 *   3. **Nothing on the API at all.** `POST /api/leads/[id]/automation`
 *      had no admin check, so any signed-in teammate could set any lead
 *      to Auto, dialog or no dialog.
 *
 * And a fourth path had no gate of any kind: a SourceRule's
 * `automationTierDefault` is applied by `applySourceRouting` when a lead
 * is CREATED. One rule could put every new lead from a channel straight
 * onto Auto, silently, with no human in the loop at any point.
 *
 * ## The rule
 *
 * Off by default, for existing accounts as well as new ones. Nobody has
 * ever been asked this question, so nobody has answered it, and an
 * unanswered question is not a yes.
 *
 * It gates BOTH ends, which is what makes it a permission rather than a
 * speed bump: a lead cannot be PUT on Auto without it, and a lead already
 * on Auto does not SEND unreviewed without it. Gating only the first
 * would leave every account that already has Auto leads exactly as it
 * was, and the setting would be decoration for the people it most needs
 * to protect.
 */
import { prisma } from "@/lib/db";

/** The owner-facing sentence, in one place so every refusal reads alike. */
export const AUTONOMOUS_NOT_ALLOWED_MESSAGE =
  "Sending without review is switched off for this account. An admin can turn it on in Settings.";

export async function isAutonomousAllowed(businessId: string): Promise<boolean> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { autonomousAllowed: true },
  });
  // A business row that cannot be read is not an account that has granted
  // anything. Same direction as every other default here: the safe answer
  // is the one that promises less.
  return business?.autonomousAllowed ?? false;
}
