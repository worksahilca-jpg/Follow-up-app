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

  let sent = 0;
  const skipped: string[] = [];

  for (const lead of eligible) {
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
      if (result.success) {
        sent++;
      } else {
        skipped.push(`${lead.name}: ${result.message ?? "unknown error"}`);
      }
    } catch (err) {
      skipped.push(`${lead.name}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  return { checked: eligible.length, sent, skipped };
}

/** What a real scheduler calls: every business with automation on, in one pass. */
export async function runAutomationForAllBusinesses(): Promise<AutomationResult> {
  const enabled = await prisma.automation.findMany({
    where: { action: "auto_send", enabled: true },
    select: { businessId: true },
  });

  const totals: AutomationResult = { checked: 0, sent: 0, skipped: [] };
  for (const { businessId } of enabled) {
    const result = await runAutomationForBusiness(businessId);
    totals.checked += result.checked;
    totals.sent += result.sent;
    totals.skipped.push(...result.skipped);
  }
  return totals;
}
