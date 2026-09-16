/**
 * The actual auto-send job. Two gates both have to be open for a lead to
 * be CONSIDERED for an automated message:
 *   1. The business-level Automation row is enabled (Settings' "Auto
 *      follow-up on silence" toggle) — the master switch.
 *   2. That specific Lead's automationTier is not OFF. Since 2026-09-06
 *      (CEO decision, see schema.prisma's AutomationTier comment) a new
 *      lead starts on ASSISTED, not OFF — the per-lead selector on its
 *      detail page is how an owner dials a lead *down* to OFF or *up* to
 *      AUTONOMOUS, not an opt-in gate a lead starts behind.
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
import { composeFollowUpEmail, latestInboundText } from "@/lib/sender";
import { sendFollowUpToLead, detectAutomatedReplyChannel } from "@/lib/sending";
import { requireActiveBilling, checkAiEligibility } from "@/lib/billing";
import { mapWithConcurrency } from "@/lib/concurrency";
import { getVoiceSamples } from "@/lib/voice";
import { recordAudit } from "@/lib/audit";
import { isWithinSendWindow } from "@/lib/sendWindow";
import { isTransientError } from "@/lib/transientError";
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

// Meta's 24-hour window and the 20-hour ceiling it forces on the unanswered
// rule live in @/lib/metaWindow — a leaf module with no imports, because
// Settings ("use client") has to show the owner the true number and this
// file pulls in Prisma. Re-exported here so nothing that already imports
// them from automation.ts has to move. The full reasoning is on the
// constants themselves.
import { META_DM_CHANNELS, META_DM_WINDOW_HOURS, UNANSWERED_META_DM_MAX_HOURS } from "@/lib/metaWindow";
export { META_DM_WINDOW_HOURS, UNANSWERED_META_DM_MAX_HOURS };

/**
 * How long this particular lead waits before the unanswered rule fires, in
 * hours. The one place that decision is made.
 *
 * A shared function rather than a shared constant because the rule now has
 * three inputs, and automationStatus.ts has to reach the same answer: it
 * renders the "Following up in Nh" badge, and its own header exists because
 * that badge silently disagreeing with the engine was already shipped once.
 * A ceiling applied in only one of the two would recreate exactly that bug —
 * the badge promising three more hours on a lead the cron is about to send.
 */
export function effectiveUnansweredHours(
  configuredHours: number,
  hasSubstantiveOutbound: boolean,
  channel: string | null | undefined
): number {
  // No substantive reply yet → the short first-reply safety net, which at 3
  // hours is already far inside any window and is never lengthened by the
  // ceiling below.
  const base = hasSubstantiveOutbound ? configuredHours : UNANSWERED_FIRST_REPLY_HOURS;
  if (channel && META_DM_CHANNELS.has(channel)) return Math.min(base, UNANSWERED_META_DM_MAX_HOURS);
  return base;
}

export const DEAD_LEAD_ACTION = "dead_lead_reactivation";
export const DEAD_LEAD_NAME = "Reactivate cold leads";
// research/product/2026-09-09-followup-cadence-best-practices.md, §3: a
// lead a business has genuinely stopped chasing — not just a few days
// quiet, actually cold — needs a distinct campaign, not a longer version
// of the same silence trigger. 45 days is the low end of the 45-60-day
// range that research settled on; configurable 30-180 like triggerDays is
// for the main rule.
export const DEAD_LEAD_DEFAULT_DAYS = 45;

/**
 * The narrow allowlist of failures worth retrying — moved to
 * src/lib/transientError.ts (a leaf module with no imports) now that the
 * outbound send queue needs the same judgement, and re-exported here so this
 * stays the name everything already imports. One classifier, one definition:
 * a second one would drift, and the whole reason this is an allowlist rather
 * than a denylist is that being generous costs real money (see that file).
 */
export { isTransientError };

interface AutomationResult {
  checked: number;
  unanswered: number; // of `checked`, how many were picked up because the LEAD wrote last and nobody answered
  reactivated: number; // of `checked`, how many were picked up because the lead has gone genuinely cold (DEAD_LEAD_ACTION)
  sent: number;
  held: number; // risk-gated: drafted and saved for manual approval instead of auto-sent
  // Outside the business's local send window (see sendWindow.ts) — not
  // sent this tick, not held for approval either, just retried on the
  // next in-window hourly tick. Distinct from `skipped`, which is a real
  // failure.
  deferred: number;
  // Not sent and not held for approval, for a reason that isn't "outside
  // the send window" (that's `deferred`) — a real failure (send errors,
  // exceptions) or a business rule that says this lead gets no AI
  // processing at all right now (Free tier's lead cap or channel
  // restriction, @/lib/billing).
  skipped: string[];
  heldReasons: string[]; // "{lead name}: {why it was held}", one per held lead
}

const EMPTY_RESULT: AutomationResult = {
  checked: 0,
  unanswered: 0,
  reactivated: 0,
  sent: 0,
  held: 0,
  deferred: 0,
  skipped: [],
  heldReasons: [],
};

/**
 * The messaging angle that makes a dead-lead reactivation actually work,
 * per the research's real-estate-vendor data (§3): name the actual
 * elapsed time in one sentence at most, then move on to something
 * concrete — never repeat "just checking in" or "circling back," the
 * single most-cited reason a reactivation-style message gets ignored.
 * Passed as generateFollowUpMessage()'s messageHint, the same steering
 * mechanism sequences.ts already uses per-step — this is deliberately
 * NOT a second system prompt, just a stronger steer on the existing one.
 */
export function deadLeadMessageHint(daysSinceContact: number): string {
  return (
    `This lead has gone genuinely cold — nobody, on either side, has said anything in about ${daysSinceContact} ` +
    "days. This is a reactivation message, not a routine follow-up: name that actual elapsed time plainly " +
    "(e.g. \"it's been about a month since we last talked about...\"), in one sentence at most, then move on. " +
    "Never fall back to a vague \"just checking in\" or \"circling back\" — research on real reactivation " +
    "campaigns found that's the single most-cited reason this kind of message gets ignored, since it signals " +
    "nothing new to offer. Lead with something concrete and useful instead: reference a specific detail from " +
    "what they were originally interested in, not a generic status question. " +
    // The two facts that make this message land as a belated reply rather
    // than an unsolicited approach — founder's call, 2026-09-15, and the
    // reasoning is worth keeping: THEY made contact first, and nobody here
    // answered. A recipient who is reminded of both recognises the message
    // instantly and reads it as overdue courtesy. One who isn't is being
    // emailed by a stranger about nothing in particular, months later,
    // which is the definition of the thing people report as spam.
    //
    // This is also what makes the absence of an unsubscribe line defensible
    // rather than merely convenient: the message is a continuation of a
    // conversation the recipient started. If these two instructions are
    // ever dropped, that stops being true, and the decision to omit the
    // unsubscribe should be revisited at the same time.
    "Two things must be unmistakable. First, that THEY got in touch originally — say so plainly, in their " +
    "own terms (\"you got in touch about...\", \"you asked us about...\"), so there is no moment where they " +
    "wonder who this is or why they are hearing from you. Second, acknowledge honestly that they never got a " +
    "proper reply — one short, unfussy line, no grovelling and no excuses (\"sorry we never came back to you " +
    "on this\"). Then ask one clear question about whether they still need it. The whole message should read " +
    "like a person who just found this in their inbox and felt bad about it, because that is exactly what " +
    "happened."
  );
}

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
  // Captured once so every lead in the batch is judged against the same
  // instant rather than a clock that moves as the filter runs.
  const nowMs = Date.now();
  const cutoff = new Date(nowMs - hours * 60 * 60 * 1000);
  const firstReplyCutoff = new Date(nowMs - UNANSWERED_FIRST_REPLY_HOURS * 60 * 60 * 1000);
  // The DB-level filter has to be broad enough to catch both cases the
  // per-lead check below distinguishes — an established conversation
  // silent past the full `hours` window, and a lead's still-unanswered
  // FIRST message silent past the much shorter UNANSWERED_FIRST_REPLY_HOURS
  // window — so it uses whichever cutoff is more recent (further hours
  // means a smaller/older Date, so the later Date is the broader filter,
  // catching more candidates than either threshold alone would).
  // The Meta ceiling (effectiveUnansweredHours) needs no widening here: it
  // only ever SHORTENS a wait, and this filter is already at least as broad
  // as the 3-hour first-reply cutoff, which catches everything a 20-hour
  // threshold could.
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
    },
  });
  // The query finds "has an old-enough inbound"; only "the LAST message is
  // that inbound, AND it's old enough by the threshold THIS lead actually
  // gets" counts — if anyone has replied since, it's not neglected.
  return candidates.filter((lead) => {
    const all = lead.conversations.flatMap((c) => c.messages);
    // The instant acknowledgement is boilerplate everyone gets, not a
    // reply. For "did anyone answer this lead" it is transparent: the
    // judgment runs over everything else. Before Message.trigger existed
    // the ack was an ordinary outbound row, so a lead who wrote once and
    // got the ack read as "answered" here and was never selected — the
    // 3-hour first-reply rule and the 20-hour Meta ceiling only ever fired
    // if the lead wrote a SECOND time (audit 2026-09-16, F2). The old
    // FollowUp-row exclusion sat below the direction check that had
    // already thrown the lead out, so it never got the chance to help.
    const isAck = (m: { direction: string; trigger: string | null }) => m.direction === "outbound" && m.trigger === "instant_ack";
    const judged = all.filter((m) => !isAck(m));
    if (judged.length === 0) return false;
    const last = judged.reduce((latest, m) => (m.sentAt > latest.sentAt ? m : latest));
    if (last.direction !== "inbound") return false;
    // A lead with no substantive outbound reply yet gets the shorter
    // first-reply threshold; everyone already in a real back-and-forth
    // keeps the business's normal unanswered-reply window. "Substantive"
    // is any outbound that is not the ack. That deliberately includes an
    // owner's reply synced from Gmail/Outlook — which has no FollowUp row,
    // no `source` and no trigger — and a Meta echo (`source` set). "Has a
    // FollowUp row" was never a safe test for that reason: a lead the owner
    // answered from their mail app would have looked untouched.
    const hasSubstantiveOutbound = all.some((m) => m.direction === "outbound" && !isAck(m));
    // Channel is read off the conversation `last` belongs to rather than via
    // detectAutomatedReplyChannel(), which would be a query per candidate
    // lead. That function's first and strongest rule is the channel the last
    // inbound arrived on, which is exactly this value. Where the two could
    // diverge it resolves to email, which has no window — so the worst case
    // is a send four hours early on a channel that did not need it.
    const lastChannel = lead.conversations.find((c) => c.messages.some((m) => m.id === last.id))?.channel;
    const thresholdHours = effectiveUnansweredHours(hours, hasSubstantiveOutbound, lastChannel);
    return last.sentAt <= new Date(nowMs - thresholdHours * 60 * 60 * 1000);
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
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { timezone: true, tier: true } });
  const timezone = business?.timezone ?? "America/New_York";
  const tier = (business?.tier ?? "plus") as "free" | "plus" | "pro";

  const deadLeadRule = await prisma.automation.findFirst({ where: { businessId, action: DEAD_LEAD_ACTION } });
  const deadLeadEnabled = deadLeadRule?.enabled ?? true; // on by default, like everything else here
  const deadLeadDays = deadLeadRule?.triggerDays ?? DEAD_LEAD_DEFAULT_DAYS;
  const deadCutoff = new Date(Date.now() - deadLeadDays * 24 * 60 * 60 * 1000);

  const [silent, deadLeads, voiceSamples, unanswered] = await Promise.all([
    prisma.lead.findMany({
      where: {
        businessId,
        automationTier: { not: "OFF" },
        stage: { notIn: ["WON", "LOST"] },
        lastContacted: { lte: cutoff },
        // A lead past the dead-lead threshold exits the normal silence
        // cadence entirely — it belongs to the `deadLeads` query below
        // instead, with its own messaging. Only excluded when that rule
        // is actually enabled; disabled just means "no dead-lead rule,"
        // not "these leads vanish from the normal cadence too."
        ...(deadLeadEnabled ? { NOT: { lastContacted: { lte: deadCutoff } } } : {}),
        OR: [{ lastAutomationCheckedAt: null }, { lastAutomationCheckedAt: { lt: recheckCutoff } }],
      },
      include: { conversations: { include: { messages: { orderBy: { sentAt: "asc" } } } } },
    }),
    deadLeadEnabled
      ? prisma.lead.findMany({
          where: {
            businessId,
            automationTier: { not: "OFF" },
            stage: { notIn: ["WON", "LOST"] },
            lastContacted: { lte: deadCutoff },
            OR: [{ lastAutomationCheckedAt: null }, { lastAutomationCheckedAt: { lt: recheckCutoff } }],
          },
          include: { conversations: { include: { messages: { orderBy: { sentAt: "asc" } } } } },
        })
      : Promise.resolve([]),
    // Same voice sample set for every lead in this business — fetched once
    // up front rather than inside the per-lead loop below.
    getVoiceSamples(businessId),
    unansweredEnabled ? findUnansweredLeads(businessId, unansweredHours, recheckCutoff) : Promise.resolve([]),
  ]);

  // Merge in priority order — unanswered (the lead wrote and got ignored)
  // is the most urgent, dead-lead reactivation is a deliberate exit from
  // the normal cadence, silent is everything else. One row per lead: a
  // dead lead that's ALSO unanswered gets the unanswered framing, not a
  // double-send — the human-neglect case is the more urgent one to name.
  const unansweredIds = new Set(unanswered.map((l) => l.id));
  const deadIds = new Set(deadLeads.filter((l) => !unansweredIds.has(l.id)).map((l) => l.id));
  const eligible = [
    ...unanswered,
    ...deadLeads.filter((l) => deadIds.has(l.id)),
    ...silent.filter((l) => !unansweredIds.has(l.id) && !deadIds.has(l.id)),
  ];

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

      // Free tier's AI processing pause (@/lib/billing) applies here too,
      // not just at initial capture (scoring.ts) — otherwise a lead that
      // never got scored because it was over cap or on a disallowed
      // channel would still get a fresh draft (and possibly an autonomous
      // send) the moment it went silent, defeating the whole point of the
      // pause. Kept claimed (not released like the send-window case above)
      // so it's naturally rechecked in ~20h via recheckCutoff rather than
      // every single hourly tick — this isn't transient the way "outside
      // business hours" is.
      // Named distinctly from the outer `eligible` (the batch array this
      // closure iterates, declared above) — same name, different thing,
      // and shadowing it here was a latent footgun for a future edit
      // inside this closure.
      //
      // Now runs on every tier, not just Free: Plus's 1,500/mo and Pro's
      // 10,000/mo ceilings were published and unenforced, so a paid account
      // had no upper bound on AI processing at all.
      const aiEligible = await checkAiEligibility(businessId, lead, tier);
      if (!aiEligible.ok) {
        return { kind: "skipped", note: `${lead.name}: ${aiEligible.reason}` };
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

      const isDeadLead = deadIds.has(lead.id);

      // Is this lead ACTUALLY past the dead-lead threshold — asked directly,
      // rather than inferred from which framing won the merge above?
      //
      // The two are not the same question, and treating them as one was a
      // real hole. `deadIds` deliberately subtracts the unanswered set
      // (see its construction above) so that a lead who is both cold AND
      // unanswered gets the better, more urgent framing and only one
      // message. That's right for framing. But `isDeadLead` was also what
      // the mandatory human hold below keyed on — so the very act of
      // choosing the kinder wording switched the approval requirement off.
      //
      // The lead it let through is the worst one to get wrong: someone who
      // wrote in, was never answered, and has been waiting 45+ days. On a
      // business's first sync the imported back catalogue is full of
      // exactly that shape, so it fired within the first hourly tick after
      // signup. src/lib/reactivation.ts classifies that same population as
      // COLD_UNANSWERED and refuses to bulk-message them at all — they are
      // owed an answer, not a "still interested?" — so the two subsystems
      // were reaching opposite conclusions about the same person.
      //
      // Deliberately NOT scoped to `deadLeadEnabled`, unlike the
      // `deadLeads` query it otherwise mirrors.
      //
      // "Reactivate cold leads" is a MESSAGING-CAMPAIGN toggle: it decides
      // whether FollowUp goes looking for the back catalogue at all. This
      // is a SAFETY hold: it decides whether a human sees a message before
      // it goes to someone who has been silent for months. Tying the second
      // to the first meant switching the campaign OFF also switched the
      // protection off — cold leads fell through to the `silent` bucket
      // (line ~294 only excludes them while the rule is enabled) and
      // auto-sent unreviewed on a low-risk verdict. A safety property that
      // a settings toggle can quietly disable is not a safety property.
      //
      // `lastContacted ?? createdAt` rather than a null check: a lead with
      // no recorded contact is not evidence of recency. Falling back to the
      // null branch would have made an ancient lead with a missing
      // timestamp the one kind that could still auto-send.
      const coldReference = lead.lastContacted ?? lead.createdAt;
      const isCold = coldReference <= deadCutoff;

      // task #63 (live-test finding): a cached suggestedMessage can predate
      // the lead's actual most recent inbound message — scoring.ts drafts
      // once per inbound webhook, but a lead that fires off several
      // messages in a burst (or in different languages) can leave a stale
      // draft sitting there for hours before the unanswered trigger picks
      // it up. Reusing it verbatim shipped a real English reply to a lead
      // whose latest message was romanized Gujarati. Unlike silence (where
      // nothing new happened since the cache was written, so it's still
      // the right answer), "unanswered" specifically means new inbound
      // content exists that the cached draft was never written against —
      // so it gets the same "never trust the cache" treatment as a dead
      // lead, for the same underlying reason.
      const isUnanswered = unansweredIds.has(lead.id);

      // Whether the cached draft was written against this conversation as
      // it stands now. This is the test the two cases above actually need:
      // the reason a dead-lead or unanswered draft "can't be trusted" is
      // that new inbound content may have arrived since it was written —
      // so compare the draft's stamp to the newest message rather than
      // rebuilding unconditionally.
      //
      // Without this the product had a cost that grew with time instead of
      // with leads. A lead held for approval sends nothing, so
      // lastContacted never moves, so it re-enters this window every 20
      // hours forever — and each pass paid for a fresh draft, a fresh
      // localization and a fresh risk check on a byte-identical
      // conversation ($0.026/lead/month, unbounded;
      // research/product/2026-09-15-ai-cost-per-lead.md §5). Cold leads are
      // held by design, so there is always a standing population of them.
      //
      // A null stamp means the draft predates the column, so it counts as
      // stale: the first pass after deploy rebuilds and stamps it, and
      // every pass after that is free. The task #63 guarantee is preserved
      // exactly — a lead who wrote again in another language has a newer
      // message than the stamp, so the draft is stale and IS rebuilt.
      const newestMessageAt = conversation.length
        ? new Date(conversation[conversation.length - 1].date)
        : null;
      const draftIsCurrent =
        lead.suggestedDraftedFor != null &&
        newestMessageAt != null &&
        newestMessageAt <= lead.suggestedDraftedFor;

      // Reuse an existing draft (subject + body) when this lead already has
      // one from a normal scoring pass — only draft fresh here if it
      // somehow doesn't (e.g. scoring never ran, most commonly no
      // OPENAI_API_KEY configured), or if it's a dead lead or unanswered
      // reply whose draft is no longer current (see above).
      let subject = lead.suggestedSubject ?? undefined;
      let message = lead.suggestedMessage;
      let regenerated = false;
      if (!message || ((isDeadLead || isUnanswered) && !draftIsCurrent)) {
        regenerated = true;
        const messageHint = isDeadLead
          ? deadLeadMessageHint(Math.floor((Date.now() - new Date(lead.lastContacted ?? lead.createdAt).getTime()) / 86_400_000))
          : undefined;
        const draft = await generateFollowUpMessage({ name: lead.name, conversation }, voiceSamples, messageHint);
        subject = draft.subject;
        message = await composeFollowUpEmail(lead.name.split(" ")[0], lead.businessId, draft.body, {
          languageSample: latestInboundText(conversation),
        });
      }

      // AUTONOMOUS skips the risk check entirely — that's the whole point
      // of the tier. Every other opted-in lead (ASSISTED) still gets
      // checked before anything goes out unreviewed. `tier === "free"`
      // forces the check even for a lead whose automationTier is still
      // AUTONOMOUS from before a downgrade — autonomous send is a Plus/Pro
      // capability (leads/[id]/automation/route.ts refuses to set it on
      // Free going forward), but a downgrade doesn't retroactively touch
      // leads already set that way, so this is the belt to that route's
      // suspenders.
      if (lead.automationTier !== "AUTONOMOUS" || tier === "free") {
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

        // A cold-lead reactivation ALWAYS waits for a human, whatever the
        // risk classifier thinks.
        //
        // This is the one automation that reaches backwards. Everything else
        // here answers a conversation the lead started or continued; this one
        // messages someone who went quiet 45+ days ago, and on a business's
        // first sync that means the back catalogue — up to six months of
        // imported threads, all eligible at once, all sent in the owner's
        // name. "Low risk" is a judgement about the wording of one message;
        // it says nothing about whether the owner wanted the whole of last
        // spring contacted on their behalf.
        //
        // So these become a batch the owner is offered rather than a batch
        // that happens to them: FollowUp finds the cold leads, writes each
        // draft, and puts them in the approval queue with the reason
        // attached. Same work, same drafts — the owner just gets to say yes.
        // Founder's call, 2026-09-15, after a trust audit found a new
        // business could message six months of contacts within an hour of
        // signing up without ever being told it would.
        //
        // A lead the owner has deliberately set to AUTONOMOUS never reaches
        // this branch, so an explicit per-lead opt-in still wins.
        //
        // Keyed on `isCold` (the threshold itself), NOT on `isDeadLead`
        // (which framing won the merge) — see isCold's definition above for
        // the hole that distinction was hiding. `isDeadLead` implies
        // `isCold`, so this only ever holds MORE than before, never less.
        if (risk.riskLevel !== "low" || isCold) {
          // Persist whatever was just written, so the stale draft doesn't
          // linger as what the owner sees waiting for approval — and stamp
          // it with the message it was written against, which is what lets
          // the next pass reuse it instead of paying to rebuild it.
          //
          // Keyed on `regenerated` rather than re-deriving the condition:
          // the two had to agree, and writing the same test twice is how
          // they stop agreeing. A draft that was NOT regenerated is by
          // definition already current and already stored, so there is
          // nothing to write.
          if (regenerated) {
            await prisma.lead.update({
              where: { id: lead.id },
              data: {
                suggestedMessage: message,
                suggestedSubject: subject,
                suggestedDraftedFor: newestMessageAt,
              },
            });
          }
          // A cold-lead hold isn't a risk finding, so it needs its own
          // sentence — risk.reason is empty when the classifier said "low"
          // and we held anyway, and "Held because ." is what the owner
          // would otherwise read on the approval card. Reaching the hold
          // with a "low" verdict is only possible via isCold, so these two
          // branches cover that case completely.
          //
          // The unanswered variant says something different on purpose. A
          // lead who merely went quiet is a judgement call about whether to
          // reach back out; a lead who WROTE and never got an answer is a
          // different fact about the business, and the approval card should
          // not describe it as if the lead simply drifted away.
          const daysQuiet = Math.floor(
            (Date.now() - new Date(lead.lastContacted ?? lead.createdAt).getTime()) / 86_400_000
          );
          const firstName = lead.name.split(" ")[0];
          const holdReason =
            risk.riskLevel !== "low"
              ? risk.reason
              : isUnanswered
                ? `${firstName} wrote ${daysQuiet} days ago and never got an answer — this reply is yours to send`
                : `${firstName} went quiet ${daysQuiet} days ago — reaching back out is your call`;

          if (unansweredIds.has(lead.id)) await notifyNeglect(lead, conversation, "held");
          // Held-not-sent is as much a real AI decision as a send — the
          // risk gate is exactly the guarantee Rule 3 (trust ships like a
          // feature) is about, so it belongs in the same audit trail an
          // actual send gets (see the "ai.send" call in sendFollowUpToLead,
          // src/lib/sending.ts), not just a string in this run's summary.
          void recordAudit({ businessId: lead.businessId, userId: null }, "ai.hold", {
            targetType: "lead",
            targetId: lead.id,
            meta: {
              riskLevel: risk.riskLevel,
              reason: holdReason,
              trigger: unansweredIds.has(lead.id) ? "unanswered" : isDeadLead ? DEAD_LEAD_ACTION : "silence",
            },
          });
          return { kind: "held", note: `${lead.name}: ${holdReason}` };
        }
      }

      // Explicit channel, not sendFollowUpToLead()'s own email-if-present
      // default — a lead that only ever texted or DM'd, but happens to
      // also have an email on file, would otherwise get an automated
      // reply sent to an inbox they never check (see
      // detectAutomatedReplyChannel's doc comment).
      const result = await sendFollowUpToLead(lead.id, message, {
        automated: true,
        trigger: unansweredIds.has(lead.id) ? "unanswered" : isDeadLead ? DEAD_LEAD_ACTION : "silence",
        subject,
        channel: (await detectAutomatedReplyChannel(lead)) ?? undefined,
      });
      if (result.success && unansweredIds.has(lead.id)) await notifyNeglect(lead, conversation, "sent");
      return result.success
        ? { kind: "sent" }
        : { kind: "skipped", note: `${lead.name}: ${result.message ?? "unknown error"}` };
    } catch (err) {
      // The claim taken above is what stops two ticks racing the same lead.
      // It was never released on this path, so a lead that threw stayed
      // claimed until `recheckCutoff` — twenty hours — while the automation
      // badge went on saying "Following up soon". One OpenAI 429, or a cron
      // invocation that times out mid-lead, and that lead is silently out of
      // the running for the rest of the day. On a product whose whole promise
      // is that nothing gets missed, a swallowed twenty-hour gap is the
      // failure, not the 429.
      //
      // The claim is released only for errors that are actually worth
      // retrying soon. Releasing on EVERY error would be worse than the bug:
      // a permanently-failing lead (malformed address, unsupported channel)
      // would be re-drafted every single hour forever, burning OpenAI spend
      // on a message that can never send. So the default is unchanged —
      // stay claimed, retry after the normal recheck — and only the known
      // transient classes get an early retry.
      if (isTransientError(err)) {
        await prisma.lead
          .updateMany({ where: { id: lead.id }, data: { lastAutomationCheckedAt: null } })
          .catch((e) => console.error(`Failed to release automation claim for lead ${lead.id}:`, e));
      }
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
    reactivated: deadIds.size,
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
  lead: { id: string; name: string; businessId: string; assignedToId: string | null },
  conversation: Message[],
  outcome: "held" | "sent"
): Promise<void> {
  const lastInbound = [...conversation].reverse().find((m) => m.direction === "inbound");
  const waited = lastInbound ? `${hoursAgo(new Date(lastInbound.date))}h` : "a while";
  const message =
    outcome === "sent"
      ? `${lead.name} wrote ${waited} ago and hadn't heard back — FollowUp replied for you. Check the thread.`
      : `${lead.name} wrote ${waited} ago and hasn't heard back — a reply is drafted and waiting for your approval.`;
  try {
    // An unassigned lead (the shared pool / "up for grabs") has nobody to
    // hand this off to individually — this used to just return early,
    // which meant a held draft on a pond lead notified nobody at all
    // (research/product/2026-09-10-ux-simplification.md §0.6). Falling
    // back to every admin on the business is the right default for the
    // common case (one solo owner, who is the sole admin) and still
    // reaches someone on a small team rather than silently dropping it.
    const userIds = lead.assignedToId
      ? [lead.assignedToId]
      : (await prisma.user.findMany({ where: { businessId: lead.businessId, role: "ADMIN" }, select: { id: true } })).map((u) => u.id);
    for (const userId of userIds) {
      await prisma.notification.create({ data: { userId, leadId: lead.id, message } });
    }
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
    totals.reactivated += result.reactivated;
    totals.sent += result.sent;
    totals.held += result.held;
    totals.deferred += result.deferred;
    totals.skipped.push(...result.skipped);
    totals.heldReasons.push(...result.heldReasons);
  }
  return totals;
}
