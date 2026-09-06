/**
 * The actual auto-send job. Two gates both have to be open for a lead to
 * be CONSIDERED for an automated message:
 *   1. The business-level Automation row is enabled (Settings' "Auto
 *      follow-up on silence" toggle) — the master switch.
 *   2. That specific Lead's automationTier is not OFF (opted in
 *      individually, via the selector on its detail page) — OFF by
 *      default.
 *
 * Which tier decides what happens next:
 *   - ASSISTED: the draft still passes assessSendRisk() (see openai.ts)
 *     first. "Opted in" means "send the safe stuff for me," not "send
 *     anything" — a draft that touches pricing/terms/commitments, or
 *     follows a conversation that's turned negative, is saved as the
 *     lead's suggestedMessage and left for manual approval instead, the
 *     same as any non-automated draft already is.
 *   - AUTONOMOUS: the risk check is skipped entirely and the draft is
 *     sent regardless of what it says. This is the one place in the app
 *     that sends without any review — real trust decision, opt-in per
 *     lead, never a default.
 *
 * Multi-tenant: runAutomationForBusiness() takes an explicit businessId —
 * the "Run automation check now" button in Settings only ever runs it for
 * the signed-in user's own business (see the API route). Nothing runs this
 * on a schedule by itself; runAutomationForAllBusinesses() is what a real
 * scheduler (e.g. Vercel Cron) would call once deployed, looping over
 * every business that has automation enabled.
 */

import { prisma } from "@/lib/db";
import { generateFollowUpMessage, assessSendRisk } from "@/lib/integrations/openai";
import { composeFollowUpEmail } from "@/lib/sender";
import { sendFollowUpToLead } from "@/lib/sending";
import { requireActiveBilling } from "@/lib/billing";
import { mapWithConcurrency } from "@/lib/concurrency";
import { getVoiceSamples } from "@/lib/voice";
import type { Message } from "@/lib/types";

interface AutomationResult {
  checked: number;
  sent: number;
  held: number; // risk-gated: drafted and saved for manual approval instead of auto-sent
  skipped: string[]; // real failures (send errors, exceptions)
  heldReasons: string[]; // "{lead name}: {why it was held}", one per held lead
}

const EMPTY_RESULT: AutomationResult = { checked: 0, sent: 0, held: 0, skipped: [], heldReasons: [] };

type LeadOutcome =
  | { kind: "sent" }
  | { kind: "held"; note: string }
  | { kind: "skipped"; note: string };

export async function runAutomationForBusiness(businessId: string): Promise<AutomationResult> {
  const automation = await prisma.automation.findFirst({
    where: { businessId, action: "auto_send" },
  });
  if (!automation || !automation.enabled) {
    return EMPTY_RESULT;
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
    return EMPTY_RESULT;
  }

  const cutoff = new Date(Date.now() - automation.triggerDays * 24 * 60 * 60 * 1000);

  const [eligible, voiceSamples] = await Promise.all([
    prisma.lead.findMany({
      where: {
        businessId,
        automationTier: { not: "OFF" },
        stage: { notIn: ["WON", "LOST"] },
        lastContacted: { lte: cutoff },
      },
      include: { conversations: { include: { messages: { orderBy: { sentAt: "asc" } } } } },
    }),
    // Same voice sample set for every lead in this business — fetched once
    // up front rather than inside the per-lead loop below.
    getVoiceSamples(businessId),
  ]);

  // Kept modest (vs. the 5 used for sync/cleanup) — this loop calls Gmail's
  // send API per lead, which has its own tighter per-account send quota,
  // not just a "how fast can we finish" budget.
  const outcomes = await mapWithConcurrency(eligible, 3, async (lead): Promise<LeadOutcome> => {
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
          await generateFollowUpMessage({ name: lead.name, conversation }, voiceSamples)
        ));

      // AUTONOMOUS skips the risk check entirely — that's the whole point
      // of the tier. Every other opted-in lead (ASSISTED) still gets
      // checked before anything goes out unreviewed.
      if (lead.automationTier !== "AUTONOMOUS") {
        let risk: { riskLevel: "low" | "medium" | "high"; reason: string };
        if (process.env.OPENAI_API_KEY) {
          try {
            risk = await assessSendRisk({ conversation }, message);
          } catch (err) {
            // Can't tell if this one's safe — hold it rather than guess.
            // Sending something autonomously that shouldn't have gone out
            // is a worse failure mode than an unnecessary manual review.
            console.error(`Risk assessment failed for lead ${lead.id}:`, err);
            risk = { riskLevel: "medium", reason: "Couldn't assess risk automatically — held to be safe." };
          }
        } else {
          // No classifier available — fall back to the older, unguarded
          // behavior rather than holding every automated lead forever in
          // an unconfigured/demo environment.
          risk = { riskLevel: "low", reason: "" };
        }

        if (risk.riskLevel !== "low") {
          if (!lead.suggestedMessage) {
            // suggestedMessageHoldReason rides along with suggestedMessage on
            // purpose, same guard and all — so the reason shown next to a
            // draft always matches *why that specific draft* was held, not
            // whatever the most recent automation pass happened to say.
            await prisma.lead.update({
              where: { id: lead.id },
              data: { suggestedMessage: message, suggestedMessageHoldReason: risk.reason || null },
            });
          }
          return { kind: "held", note: `${lead.name}: ${risk.reason}` };
        }
      }

      const result = await sendFollowUpToLead(lead.id, message, { automated: true });
      return result.success
        ? { kind: "sent" }
        : { kind: "skipped", note: `${lead.name}: ${result.message ?? "unknown error"}` };
    } catch (err) {
      return { kind: "skipped", note: `${lead.name}: ${err instanceof Error ? err.message : "unknown error"}` };
    }
  });

  const sent = outcomes.filter((o) => o.kind === "sent").length;
  const heldOutcomes = outcomes.filter((o): o is { kind: "held"; note: string } => o.kind === "held");
  const skipped = outcomes
    .filter((o): o is { kind: "skipped"; note: string } => o.kind === "skipped")
    .map((o) => o.note);

  return {
    checked: eligible.length,
    sent,
    held: heldOutcomes.length,
    skipped,
    heldReasons: heldOutcomes.map((o) => o.note),
  };
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
        ...EMPTY_RESULT,
        skipped: [`Business ${businessId}: ${err instanceof Error ? err.message : "unknown error"}`],
      } satisfies AutomationResult;
    }
  });

  const totals: AutomationResult = { ...EMPTY_RESULT, skipped: [], heldReasons: [] };
  for (const result of results) {
    totals.checked += result.checked;
    totals.sent += result.sent;
    totals.held += result.held;
    totals.skipped.push(...result.skipped);
    totals.heldReasons.push(...result.heldReasons);
  }
  return totals;
}
