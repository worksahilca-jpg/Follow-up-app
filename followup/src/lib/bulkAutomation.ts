/**
 * Setting the automation mode on many leads at once.
 *
 * Source rules (@/lib/sourceRouting) decide what a NEW lead starts on —
 * "anything from Gmail starts on Assisted". They deliberately never touch
 * a lead that already exists: `applySourceRouting` runs once, at
 * creation, "never on a resync/update of an existing one".
 *
 * Which leaves the case the founder named on 2026-09-23: a business with
 * 600 leads already in FollowUp. A rule fixes tomorrow and does nothing
 * for the 600, and nobody is opening 600 lead pages. This is the
 * catch-up.
 *
 * ## Every guard the single-lead route has, this one has too
 *
 * `POST /api/leads/[id]/automation` refuses three things, and a bulk
 * path that skipped them would be a way around them rather than a
 * convenience:
 *
 *   1. **A lead enrolled in a workflow may not be raised above OFF.**
 *      `enrollLead` forces OFF precisely so the silence-based automation
 *      and the workflow cannot both message the same person on the same
 *      day. In bulk this must not fail the whole batch — one enrolled
 *      lead among 600 would block the other 599 — so those are SKIPPED
 *      and counted, and the caller is told how many.
 *   2. **AUTONOMOUS needs Plus or Pro.** Free is Assisted-only.
 *   3. **Business scoping.** Every query is filtered by businessId; a
 *      bulk update is exactly where a missing scope stops being a
 *      per-row bug and becomes someone else's whole lead list.
 *
 * Lowering to OFF is always allowed, for every lead, including enrolled
 * ones — stopping must never be harder than starting.
 */
import { prisma } from "@/lib/db";
import type { AutomationTier } from "@prisma/client";

export type BulkAutomationResult = {
  /** How many leads actually changed. */
  updated: number;
  /**
   * Enrolled in a workflow, so left alone rather than raised. Not an
   * error — the caller shows it as a sentence, because silently doing
   * less than asked is how a bulk action loses trust.
   */
  skippedInWorkflow: number;
};

export type BulkAutomationInput = {
  businessId: string;
  tier: AutomationTier;
  /**
   * Restrict to one lead source ("Gmail", "WhatsApp", …). Omitted means
   * every lead in the business. Matches how a business already thinks
   * about this, because source rules use the same vocabulary.
   */
  source?: string | null;
};

export async function setAutomationTierInBulk({
  businessId,
  tier,
  source,
}: BulkAutomationInput): Promise<BulkAutomationResult> {
  const scope = {
    businessId,
    ...(source ? { source } : {}),
    // Nothing to do for leads already on this mode, and excluding them
    // keeps `updated` an honest count of what changed rather than of
    // what was matched.
    automationTier: { not: tier },
  };

  // Lowering to OFF applies to everything, enrolled or not. Raising
  // skips enrolled leads, for the double-send reason above.
  if (tier === "OFF") {
    const { count } = await prisma.lead.updateMany({ where: scope, data: { automationTier: tier } });
    return { updated: count, skippedInWorkflow: 0 };
  }

  const skippedInWorkflow = await prisma.lead.count({
    where: { ...scope, sequenceId: { not: null } },
  });

  const { count } = await prisma.lead.updateMany({
    where: { ...scope, sequenceId: null },
    data: { automationTier: tier },
  });

  return { updated: count, skippedInWorkflow };
}
