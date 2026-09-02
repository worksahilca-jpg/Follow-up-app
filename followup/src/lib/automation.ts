/**
 * The actual auto-send job. Two gates both have to be open for a lead to
 * get an automated message:
 *   1. The business-level Automation row is enabled (Settings' "Auto
 *      follow-up on silence" toggle) — the master switch.
 *   2. That specific Lead has automationOn = true (opted in individually,
 *      via the toggle on its detail page) — off by default.
 *
 * Multi-tenant: runAutomationForBusiness() takes an explicit businessId —
 * the "Run automation check now" button in Settings only ever runs it for
 * the signed-in user's own business (see the API route). Nothing runs this
 * on a schedule by itself; runAutomationForAllBusinesses() is what a real
 * scheduler (e.g. Vercel Cron) would call once deployed, looping over
 * every business that has automation enabled.
 */

import { prisma } from "@/lib/db";
import { generateFollowUpMessage } from "@/lib/integrations/openai";
import { composeFollowUpEmail } from "@/lib/sender";
import { sendFollowUpToLead } from "@/lib/sending";
import { requireActiveBilling } from "@/lib/billing";
import { mapWithConcurrency } from "@/lib/concurrency";
import type { Message } from "@/lib/types";

interface AutomationResult {
  checked: number;
  sent: number;
  skipped: string[];
}

export async function runAutomationForBusiness(businessId: string): Promise<AutomationResult> {
  const automation = await prisma.automation.findFirst({
    where: { businessId, action: "auto_send" },
  });
  if (!automation || !automation.enabled) {
    return { checked: 0, sent: 0, skipped: [] };
  }

  // Automated sending is a paid feature like everything else that costs
  // money to run — a business that lapsed or never subscribed shouldn't
  // keep getting free automated sends just because the toggle was left on
  // from before. The manual "Run automation check now" button already
  // goes through requireActiveBilling() at the route level; this check
  // makes the cron-driven path (which calls this function directly, for
  // every business, with no route-level gate of its own) honor the same
  // rule.
  if (!(await requireActiveBilling(businessId))) {
    return { checked: 0, sent: 0, skipped: [] };
  }

  const cutoff = new Date(Date.now() - automation.triggerDays * 24 * 60 * 60 * 1000);

  const eligible = await prisma.lead.findMany({
    where: {
      businessId,
      automationOn: true,
      stage: { notIn: ["WON", "LOST"] },
      lastContacted: { lte: cutoff },
    },
    include: { conversations: { include: { messages: { orderBy: { sentAt: "asc" } } } } },
  });

  // Kept modest (vs. the 5 used for sync/cleanup) — this loop calls Gmail's
  // send API per lead, which has its own tighter per-account send quota,
  // not just a "how fast can we finish" budget.
  const outcomes = await mapWithConcurrency(eligible, 3, async (lead) => {
    try {
      const conversation: Message[] = lead.conversations.flatMap((c) =>
        c.messages.map((m) => ({
          id: m.id,
          direction: m.direction as Message["direction"],
          channel: c.channel as Message["channel"],
          body: m.body,
          date: m.sentAt.toISOString(),
          opened: m.opened,
        }))
      );

      const message =
        lead.suggestedMessage ||
        (await composeFollowUpEmail(
          lead.name.split(" ")[0],
          lead.businessId,
          await generateFollowUpMessage({ name: lead.name, conversation })
        ));
      const result = await sendFollowUpToLead(lead.id, message, { automated: true });
      return result.success
        ? { sent: true as const }
        : { sent: false as const, skipped: `${lead.name}: ${result.message ?? "unknown error"}` };
    } catch (err) {
      return { sent: false as const, skipped: `${lead.name}: ${err instanceof Error ? err.message : "unknown error"}` };
    }
  });

  const sent = outcomes.filter((o) => o.sent).length;
  const skipped = outcomes.flatMap((o) => (o.sent ? [] : [o.skipped]));

  return { checked: eligible.length, sent, skipped };
}

/** What a real scheduler calls: every business with automation on, in one pass. */
export async function runAutomationForAllBusinesses(): Promise<AutomationResult> {
  const enabled = await prisma.automation.findMany({
    where: { action: "auto_send", enabled: true },
    select: { businessId: true },
  });

  // One business's automation blowing up (a bad token, a billing edge
  // case, an unexpected API error) must not take down every other
  // business's daily run — each is isolated and, at real tenant counts,
  // a few running at once instead of strictly one-at-a-time keeps one
  // cron invocation from running for hours.
  const results = await mapWithConcurrency(enabled, 3, async ({ businessId }) => {
    try {
      return await runAutomationForBusiness(businessId);
    } catch (err) {
      console.error(`Automation run failed for business ${businessId}:`, err);
      return {
        checked: 0,
        sent: 0,
        skipped: [`Business ${businessId}: ${err instanceof Error ? err.message : "unknown error"}`],
      } satisfies AutomationResult;
    }
  });

  const totals: AutomationResult = { checked: 0, sent: 0, skipped: [] };
  for (const result of results) {
    totals.checked += result.checked;
    totals.sent += result.sent;
    totals.skipped.push(...result.skipped);
  }
  return totals;
}
