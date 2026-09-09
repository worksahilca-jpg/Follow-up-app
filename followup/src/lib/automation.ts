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
import { sendFollowUpToLead, detectAutomatedReplyChannel } from "@/lib/sending";
import { requireActiveBilling } from "@/lib/billing";
import { mapWithConcurrency } from "@/lib/concurrency";
import { getVoiceSamples } from "@/lib/voice";
import { recordAudit } from "@/lib/audit";
import { isWithinSendWindow } from "@/lib/sendWindow";
import type { Message } from "@/lib/types";

export const UNANSWERED_ACTION = "unanswered_reply";
export const UNANSWERED_NAME = "Reply for me when I haven't";
export const UNANSWERED_DEFAULT_HOURS = 24;

// research/product/2026-09-09-followup-cadence-best-practices.md, §1:
// qualification odds fall off steepest in the first hours after a lead's
// FIRST real message — hour 3 of total silence on a brand-new lead is not
// equivalent to hour 24 of an established conversation going quiet, but
// findUnansweredLeads() used to treat them identically. Applies only when
// nothing substantive has gone out yet (the instant-ack template doesn't
// count — see the trigger check below); not user-configurable the way
// UNANSWERED_DEFAULT_HOURS is, at least for now, since it's meant to be a
// fixed safety net rather than another setting to tune.
export const UNANSWERED_FIRST_REPLY_HOURS = 3;

interface AutomationResult {
  checked: number;
  unanswered: number; // of `checked`, how many were picked up because the LEAD wrote last and nobody answered
  sent: number;
  held: number; // risk-gated: drafted and saved for manual approval instead of auto-sent
  // Outside the business's local send window (see sendWindow.ts) — not
  // sent this tick, not held for approval either, just retried on the
  // next in-window hourly tick. Distinct from `skipped`, which is a real
  // failure.
  deferred: number;
  skipped: string[]; // real failures (send errors, exceptions)
  heldReasons: string[]; // "{lead name}: {why it was held}", one per held lead
}

const EMPTY_RESULT: AutomationResult = {
  checked: 0,
  unanswered: 0,
  sent: 0,
  held: 0,
  deferred: 0,
  skipped: [],
  heldReasons: [],
};

/**
 * The human-neglect trigger — PRODUCT_DIRECTION.md main goal, point 2. The
 * silence window above catches a lead that went quiet on US; this catches
 * the opposite and worse case: the lead wrote, and the owner never came
 * back. "Neglected" = the newest message on the lead is INBOUND and older
 * than the business's unanswered-reply window. Such a lead is fed through
 * the same draft → risk gate → send/hold path as a silent one, and the
 * owner is told either way (a held draft is a reply waiting for one click).
 */
async function findUnansweredLeads(businessId: string, hours: number, recheckCutoff: Date) {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  const firstReplyCutoff = new Date(Date.now() - UNANSWERED_FIRST_REPLY_HOURS * 60 * 60 * 1000);
  // The DB-level filter has to be broad enough to catch both cases the
  // per-lead check below distinguishes — an established conversation
  // silent past the full `hours` window, and a lead's still-unanswered
  // FIRST message silent past the much shorter UNANSWERED_FIRST_REPLY_HOURS
  // window — so it uses whichever cutoff is more recent (further hours
  // means a smaller/older Date, so the later Date is the broader filter,
  // catching more candidates than either threshold alone would).
  const queryCutoff = firstReplyCutoff > cutoff ? firstReplyCutoff : cutoff;
  const candidates = await prisma.lead.findMany({
    where: {
      businessId,
      automationTier: { not: "OFF" },
      stage: { notIn: ["WON", "LOST"] },
      OR: [{ lastAutomationCheckedAt: null }, { lastAutomationCheckedAt: { lt: recheckCutoff } }],
      conversations: { some: { messages: { some: { direction: "inbound", sentAt: { lte: queryCutoff } } } } },
    },
    include: {
      conversations: { include: { messages: { orderBy: { sentAt: "asc" } } } },
      // Message itself carries no "was this the instant-ack" marker —
      // that only lives on the separate FollowUp row sendFollowUpToLead()
      // creates alongside every real send (see below).
      followUps: { select: { trigger: true } },
    },
  });
  // The query finds "has an old-enough inbound"; only "the LAST message is
  // that inbound, AND it's old enough by the threshold THIS lead actually
  // gets" counts — if anyone has replied since, it's not neglected.
  return candidates.filter((lead) => {
    const all = lead.conversations.flatMap((c) => c.messages);
    if (all.length === 0) return false;
    const last = all.reduce((latest, m) => (m.sentAt > latest.sentAt ? m : latest));
    if (last.direction !== "inbound") return false;
    // A lead with no substantive outbound reply yet — not counting the
    // instant-ack template, fixed boilerplate rather than a real reply —
    // gets the shorter first-reply threshold; everyone already in a real
    // back-and-forth keeps the business's normal unanswered-reply window.
    // Two ways a "real reply" shows up: a FollowUp row (created by
    // sendFollowUpToLead for every automated/manual send this app itself
    // made) whose trigger isn't "instant_ack", or a directly-captured
    // Instagram/Messenger echo (Message.source set — see captureDirectReply
    // in instagram.ts, which never creates a FollowUp row at all, so it
    // has to be checked on the Message itself).
    const hasDirectEchoReply = all.some((m) => m.direction === "outbound" && m.source);
    const hasSubstantiveFollowUp = lead.followUps.some((f) => f.trigger !== "instant_ack");
    const hasSubstantiveOutbound = hasDirectEchoReply || hasSubstantiveFollowUp;
    const effectiveCutoff = hasSubstantiveOutbound ? cutoff : firstReplyCutoff;
    return last.sentAt <= effectiveCutoff;
  });
}

function hoursAgo(date: Date): number {
  return Math.max(1, Math.round((Date.now() - date.getTime()) / 3_600_000));
}

type LeadOutcome =
  | { kind: "sent" }
  | { kind: "held"; note: string }
  | { kind: "skipped"; note: string }
  // Another concurrent run (the hourly cron, a manual "run now" click, or an
  // overlapping cron tick — see the claim below) already handled this lead
  // for this eligibility window. Not a failure, just nothing left to do.
  | { kind: "claimed" }
  // Outside the business's local send window (sendWindow.ts) — see that
  // module's own doc comment for why this gates the send, not eligibility.
  | { kind: "deferred" };

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
  // Runs hourly (vercel.json). A lead this pass sends to gets a new
  // lastContacted and drops out of the window on its own; a lead it holds
  // for approval does not, so it's excluded from re-assessment for most of
  // a day via lastAutomationCheckedAt (see schema.prisma).
  const recheckCutoff = new Date(Date.now() - 20 * 60 * 60 * 1000);

  const unansweredRule = await prisma.automation.findFirst({ where: { businessId, action: UNANSWERED_ACTION } });
  const unansweredEnabled = unansweredRule?.enabled ?? true; // on by default, like everything else here
  const unansweredHours = unansweredRule?.triggerHours ?? UNANSWERED_DEFAULT_HOURS;

  // Fetched once for the whole run, not per lead — every lead in this
  // batch belongs to the same business, so the send-window check below
  // always resolves against the same timezone.
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { timezone: true } });
  const timezone = business?.timezone ?? "America/New_York";

  const [silent, voiceSamples, unanswered] = await Promise.all([
    prisma.lead.findMany({
      where: {
        businessId,
        automationTier: { not: "OFF" },
        stage: { notIn: ["WON", "LOST"] },
        lastContacted: { lte: cutoff },
        OR: [{ lastAutomationCheckedAt: null }, { lastAutomationCheckedAt: { lt: recheckCutoff } }],
      },
      include: { conversations: { include: { messages: { orderBy: { sentAt: "asc" } } } } },
    }),
    // Same voice sample set for every lead in this business — fetched once
    // up front rather than inside the per-lead loop below.
    getVoiceSamples(businessId),
    unansweredEnabled ? findUnansweredLeads(businessId, unansweredHours, recheckCutoff) : Promise.resolve([]),
  ]);

  // Merge, unanswered first (it's the more urgent reason), one row per lead.
  const unansweredIds = new Set(unanswered.map((l) => l.id));
  const eligible = [...unanswered, ...silent.filter((l) => !unansweredIds.has(l.id))];

  // Kept modest (vs. the 5 used for sync/cleanup) — this loop calls Gmail's
  // send API per lead, which has its own tighter per-account send quota,
  // not just a "how fast can we finish" budget.
  const outcomes = await mapWithConcurrency(eligible, 3, async (lead): Promise<LeadOutcome> => {
    try {
      // Atomic check-and-claim, same shape as claimLead()/acknowledgeNewLead()/
      // checkRapidEngagement() elsewhere in this codebase — a plain update
      // here always succeeds regardless of who else is touching this row,
      // which let the hourly cron and a manual "Run automation check now"
      // click (or two overlapping cron ticks) both see the same lead as
      // eligible and both draft-and-send it, unreviewed, for an AUTONOMOUS
      // lead. Re-using the same OR clause the eligibility query above used
      // means only the first caller to land here wins; everyone else's
      // WHERE matches zero rows once this commits.
      const claim = await prisma.lead.updateMany({
        where: {
          id: lead.id,
          OR: [{ lastAutomationCheckedAt: null }, { lastAutomationCheckedAt: { lt: recheckCutoff } }],
        },
        data: { lastAutomationCheckedAt: new Date() },
      });
      if (claim.count === 0) return { kind: "claimed" };

      // Outside the business's local send window (e.g. 3am) — release the
      // claim instead of drafting/sending, so the very next hourly cron
      // tick (not a 20-hour recheckCutoff wait) re-considers this lead
      // once it's actually daytime. Checked here rather than in the
      // eligibility query above so it's evaluated at send time, not at
      // whatever moment the batch was fetched.
      if (!isWithinSendWindow(new Date(), timezone)) {
        await prisma.lead.updateMany({ where: { id: lead.id }, data: { lastAutomationCheckedAt: null } });
        return { kind: "deferred" };
      }

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

      // Reuse an existing draft (subject + body) when this lead already has
      // one from a normal scoring pass — only draft fresh here if it
      // somehow doesn't (e.g. scoring never ran, most commonly no
      // OPENAI_API_KEY configured).
      let subject = lead.suggestedSubject ?? undefined;
      let message = lead.suggestedMessage;
      if (!message) {
        const draft = await generateFollowUpMessage({ name: lead.name, conversation }, voiceSamples);
        subject = draft.subject;
        message = await composeFollowUpEmail(lead.name.split(" ")[0], lead.businessId, draft.body);
      }

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
            await prisma.lead.update({ where: { id: lead.id }, data: { suggestedMessage: message, suggestedSubject: subject } });
          }
          if (unansweredIds.has(lead.id)) await notifyNeglect(lead, conversation, "held");
          // Held-not-sent is as much a real AI decision as a send — the
          // risk gate is exactly the guarantee Rule 3 (trust ships like a
          // feature) is about, so it belongs in the same audit trail an
          // actual send gets (see the "ai.send" call in sendFollowUpToLead,
          // src/lib/sending.ts), not just a string in this run's summary.
          void recordAudit({ businessId: lead.businessId, userId: null }, "ai.hold", {
            targetType: "lead",
            targetId: lead.id,
            meta: { riskLevel: risk.riskLevel, reason: risk.reason, trigger: unansweredIds.has(lead.id) ? "unanswered" : "silence" },
          });
          return { kind: "held", note: `${lead.name}: ${risk.reason}` };
        }
      }

      // Explicit channel, not sendFollowUpToLead()'s own email-if-present
      // default — a lead that only ever texted or DM'd, but happens to
      // also have an email on file, would otherwise get an automated
      // reply sent to an inbox they never check (see
      // detectAutomatedReplyChannel's doc comment).
      const result = await sendFollowUpToLead(lead.id, message, {
        automated: true,
        trigger: unansweredIds.has(lead.id) ? "unanswered" : "silence",
        subject,
        channel: (await detectAutomatedReplyChannel(lead)) ?? undefined,
      });
      if (result.success && unansweredIds.has(lead.id)) await notifyNeglect(lead, conversation, "sent");
      return result.success
        ? { kind: "sent" }
        : { kind: "skipped", note: `${lead.name}: ${result.message ?? "unknown error"}` };
    } catch (err) {
      return { kind: "skipped", note: `${lead.name}: ${err instanceof Error ? err.message : "unknown error"}` };
    }
  });

  const sent = outcomes.filter((o) => o.kind === "sent").length;
  const heldOutcomes = outcomes.filter((o): o is { kind: "held"; note: string } => o.kind === "held");
  const deferred = outcomes.filter((o) => o.kind === "deferred").length;
  const skipped = outcomes
    .filter((o): o is { kind: "skipped"; note: string } => o.kind === "skipped")
    .map((o) => o.note);

  return {
    checked: eligible.length,
    unanswered: unanswered.length,
    sent,
    held: heldOutcomes.length,
    deferred,
    skipped,
    heldReasons: heldOutcomes.map((o) => o.note),
  };
}

/** What a real scheduler calls: every business with automation on, in one pass. */
/**
 * Tells the assigned person what just happened on a neglected lead. A held
 * draft is "one click from answered"; a sent one is "handled, here's what
 * went out." Once per consideration — lastAutomationCheckedAt keeps this
 * from repeating every hour.
 */
async function notifyNeglect(
  lead: { id: string; name: string; assignedToId: string | null },
  conversation: Message[],
  outcome: "held" | "sent"
): Promise<void> {
  if (!lead.assignedToId) return;
  const lastInbound = [...conversation].reverse().find((m) => m.direction === "inbound");
  const waited = lastInbound ? `${hoursAgo(new Date(lastInbound.date))}h` : "a while";
  const message =
    outcome === "sent"
      ? `${lead.name} wrote ${waited} ago and hadn't heard back — FollowUp replied for you. Check the thread.`
      : `${lead.name} wrote ${waited} ago and hasn't heard back — a reply is drafted and waiting for your approval.`;
  try {
    await prisma.notification.create({ data: { userId: lead.assignedToId, leadId: lead.id, message } });
  } catch (err) {
    console.error(`Neglect notification failed for lead ${lead.id}:`, err);
  }
}

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
    totals.unanswered += result.unanswered;
    totals.sent += result.sent;
    totals.held += result.held;
    totals.deferred += result.deferred;
    totals.skipped.push(...result.skipped);
    totals.heldReasons.push(...result.heldReasons);
  }
  return totals;
}
