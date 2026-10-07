import { siteReplyFrom, type SiteReply } from "@/lib/siteReply";
import { HOLDING_TRIGGER, NOT_AN_ANSWER_TRIGGERS, isNotAnAnswer } from "@/lib/notAnAnswer";
import { prisma } from "@/lib/db";
import { getHabits, habitOn, thanksIsNewest, weekendWaitUntil } from "@/lib/habits";
import { recordAudit } from "@/lib/audit";
import { isHeldOnlyByApprovalSetting } from "@/lib/holdReasons";
import { NO_ANSWER_TEXT } from "@/lib/callPlan";

/**
 * The approval queue — research/product/2026-09-10-ux-simplification.md
 * section 0.6's "single biggest structural gap": the risk gate holds a
 * draft (src/lib/automation.ts, the "ai.hold" AuditEvent) but nothing
 * before this showed the owner "what needs my OK right now" as a single
 * list of one-click decisions. A held draft on an unassigned/pond lead
 * used to notify nobody at all (see notifyNeglect's early return, now
 * fixed) and otherwise only surfaced buried inside that one lead's own
 * page — indistinguishable there from the "AI-suggested follow-up" box
 * every lead shows regardless of whether anything was actually held.
 *
 * A pending approval is derived, not stored separately: it's simply a
 * lead whose most recent AuditEvent is still "ai.hold". A later
 * "ai.send" (approved and sent, or a normal automated send since),
 * "lead.send" (sent manually — edited or not), or "ai.hold_dismissed"
 * (explicitly declined, see dismissHold below) all mean it's been
 * resolved and the lead drops out of the queue on its own, with no
 * separate "resolved" flag to keep in sync.
 */
const SCAN_LIMIT = 2000;

/**
 * The lead events that decide a held draft: the hold itself, and whatever
 * resolves it. An allowlist, not a denylist (daily-path sweep 2026-09-25
 * #6). The denylist this replaces named two events that say nothing about
 * the draft — "This was a lead" and the acknowledgement — and every event
 * added since had the same effect unnoticed: a DM button tap, an opt-in, a
 * quiet-lead verdict, each became "the most recent event" and the held
 * draft left the queue and the owner alerts with nobody having decided
 * anything.
 *
 * An opt-out and a DM "not now" are here because they do decide it: that
 * customer asked not to hear more. The send-failure rows are kept as they
 * were — they record the outcome of a release, not a new event.
 */
export const DECISION_EVENTS = [
  "ai.hold",
  "ai.hold_dismissed",
  "ai.send",
  "ai.send_queued",
  "ai.send_failed",
  "ai.send_abandoned",
  "lead.send",
  "lead.opt_out",
  "lead.dm_exit",
];

// "We talked" and its Undo (lead.talked, lead.talked_undone) are not in the
// list either: the talk is read from Lead.talkedAt below, so Undo brings the
// held draft straight back.

/**
 * The acknowledgement is recorded as an ordinary "ai.send" whose meta
 * says `trigger: "instant_ack"` (acknowledge.ts merges it there). It can go
 * out after a hold, and "we got your message" is not an answer to the
 * customer, so it never counts as the decision. The old denylist named an
 * "ai.instant_ack" action no code writes, so it never matched.
 */
function isAcknowledgement(e: { action: string; meta: unknown }): boolean {
  // The holding message ("let me check and I'll send you the price soon",
  // src/lib/holdingMessage.ts) is the same kind of placeholder, and it is
  // sent precisely BECAUSE this lead is held: counting it as the decision
  // would take the held price out of the queue the moment it went.
  const trigger = (e.meta as Record<string, unknown> | null)?.trigger;
  return e.action === "ai.send" && isNotAnAnswer(typeof trigger === "string" ? trigger : null);
}

// How much of the lead's own message to carry into the queue — this is a
// compact list view, not the full lead page; a reviewer needs enough to
// judge the draft against, not the whole email. Truncated, never the raw
// length, so one long inbound email can't blow out the dashboard.
const LEAD_MESSAGE_PREVIEW_LENGTH = 400;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export type PendingApproval = {
  leadId: string;
  leadName: string;
  /**
   * Where this lead came from — "Gmail", "WhatsApp", "Instagram"…
   * Nullable because Lead.source is: a lead typed in by hand or imported
   * from an old CSV may genuinely have none. Left null here rather than
   * given a placeholder, so the grouping decides what to call it and the
   * data layer never invents a source that was not recorded.
   */
  source: string | null;
  /** 0-100 intent score. What "who do I deal with first" is sorted on. */
  score: number;
  /**
   * The risk classifier's verdict on the draft that is actually sitting
   * here (Lead.suggestedRiskLevel), NOT the `riskLevel` below.
   *
   * They are different things and the difference matters. `riskLevel` is
   * read out of the hold's audit meta — written at hold time, and on a
   * holding account that was a hardcoded "low" for years, because the
   * classifier was skipped whenever nothing could send. So it says
   * nothing about whether this draft is safe.
   *
   * This one is the real verdict, stored with the draft it judged. Null
   * means UNJUDGED — a draft written before verdicts were recorded, or
   * one the classifier could not reach. Null is never "safe": see
   * isSafeToSendInBulk in @/lib/approvalGroups, which is the only place
   * allowed to turn this into a yes.
   */
  draftRiskLevel: string | null;
  /** What kind of check the risk judge asked for (Lead.suggestedRiskTopic): how the reason is said (plainHoldReason). */
  riskTopic?: string | null;
  riskLevel: string;
  reason: string;
  trigger: string;
  heldAt: Date;
  draftSubject: string | null;
  draftMessage: string;
  // What the lead actually said, most recent inbound message across every
  // channel they've used — null only when there's genuinely no inbound
  // message on record (a manually-created lead with a draft but no real
  // conversation yet). Without this, approving a draft meant judging it
  // with no visible context for what it's actually replying to.
  leadLastMessage: string | null;
  leadLastMessageChannel: string | null;
  /**
   * When that message arrived (ISO). Sent back with Approve & send as
   * `seenInboundAt`, so the server can refuse a draft the lead has since
   * answered (daily-path audit 2026-09-25 F7).
   */
  leadLastMessageAt: string | null;
  /** Their newest message said no (Lead.saidNoAt): Today says FollowUp won't remind them again. */
  saidNo?: boolean;
  /** Their newest message asked if they're talking to a real person (Lead.askedIfPersonAt). */
  askedIfPerson?: boolean;
  /**
   * Set aside with "Later" (A-046) until this time, or null when it isn't.
   * Already null once the time has passed or the customer has written
   * since, so callers only ever see a deferral that is still in force.
   * Today and the "still waiting" reminders hide these; every count keeps
   * them.
   */
  laterUntil: Date | null;
  /**
   * When FollowUp told the customer the owner is on it (the 30-minute
   * holding message, src/lib/holdingMessage.ts), as ISO — only when that
   * message answered their newest question. Null otherwise. Today says it
   * on the card (A-060, TodayHoldingPhone), so the owner knows the customer
   * is not waiting in silence.
   */
  customerToldAt: string | null;
  /**
   * Set when this customer came through a lead site that keeps their
   * contact private, so the reply goes on that site, not by email (b018,
   * A-075). Null for everyone else.
   */
  site?: SiteReply | null;
  /**
   * The number this reply goes to as a text, when it is the one "No answer"
   * wrote (A-103): the card says "Text to …" and Send asks for a text, not
   * the email-first default. Null for every other reply.
   */
  textTo?: string | null;
};

/**
 * Exported so its tests drive the real thing. A copy of this logic in a
 * test file is a test of the copy: it keeps passing while the shipped
 * order drifts away from it.
 */
export function compareApprovals(a: { reason: string; heldAt: Date }, b: { reason: string; heldAt: Date }): number {
  const aNeedsYou = !isHeldOnlyByApprovalSetting(a.reason);
  const bNeedsYou = !isHeldOnlyByApprovalSetting(b.reason);
  if (aNeedsYou !== bNeedsYou) return aNeedsYou ? -1 : 1;
  return b.heldAt.getTime() - a.heldAt.getTime();
}

/**
 * What's on Today right now: everything waiting except what the owner set
 * aside with "Later" (A-046) and isn't due back yet. Today and the sidebar's
 * Today number both use this, so they can't disagree (founder, 2026-10-01).
 */
export function onTodayNow<T extends { laterUntil: Date | null }>(approvals: T[]): T[] {
  return approvals.filter((a) => !a.laterUntil);
}

export async function getPendingApprovals(businessId: string, now: Date = new Date()): Promise<PendingApproval[]> {
  // One row per lead — the most recent AuditEvent naming that lead —
  // scoped to a bounded recent window so a business with years of audit
  // history doesn't force a full-table distinct scan on every dashboard
  // load. A held draft is meant to be resolved within days; anything
  // older than this scan window has functionally gone stale anyway, and
  // a stale hold that never got resolved is a real bug worth surfacing
  // some other way (a metrics pass), not by scanning the whole table on
  // every page load.
  // Newest first, then the first qualifying event per lead is its latest
  // decision. Reduced here rather than with `distinct`, because the
  // acknowledgement has to be skipped by its meta, which `distinct` would
  // already have picked before it could be looked at.
  const decisionEvents = await prisma.auditEvent.findMany({
    where: { businessId, targetType: "lead", targetId: { not: null }, action: { in: DECISION_EVENTS } },
    orderBy: { createdAt: "desc" },
    take: SCAN_LIMIT,
  });
  const seen = new Set<string>();
  const recentEvents = decisionEvents.filter((e) => {
    if (isAcknowledgement(e) || seen.has(e.targetId as string)) return false;
    seen.add(e.targetId as string);
    return true;
  });

  const held = recentEvents.filter((e) => e.action === "ai.hold" && e.targetId);
  if (held.length === 0) return [];

  const leads = await prisma.lead.findMany({
    where: { id: { in: held.map((e) => e.targetId as string) }, businessId },
    select: {
      id: true,
      name: true,
      email: true,
      viaSite: true,
      viaSiteUrl: true,
      source: true,
      talkedAt: true,
      laterUntil: true,
      laterSetAt: true,
      score: true,
      suggestedSubject: true,
      suggestedMessage: true,
      suggestedRiskLevel: true,
      suggestedRiskTopic: true,
      suggestedDraftKind: true,
      phone: true,
      saidNoAt: true,
      askedIfPersonAt: true,
      thanksOnlyAt: true,
      // One inbound message per conversation (the most recent), not the
      // whole thread — a lead can have several conversations across
      // channels (an old email thread plus a newer text, say), so the
      // actual "what did they last say" is the max sentAt across all of
      // these, reduced below, not just the first conversation's.
      conversations: {
        select: {
          channel: true,
          messages: { where: { direction: "inbound" }, orderBy: { sentAt: "desc" }, take: 1, select: { body: true, sentAt: true } },
        },
      },
    },
  });
  const leadById = new Map(leads.map((l) => [l.id, l]));

  /**
   * Anything sent to the lead AFTER the hold resolves it, however it went.
   *
   * Until 2026-09-25 the only way out of this queue was a later audit
   * event naming the lead. "Send all routine" writes none — it records one
   * business-level `approvals.send_safe` row — so every lead it sent stayed
   * here, and the next press sent the same drafts to the same people again.
   * Its own copy ("press again for the next batch") invited exactly that.
   * An owner who answered from the Gmail app was in the same position: the
   * reply synced in as an outbound message, the hold stayed, and the pile
   * could send them an AI reply on top of their own.
   *
   * The message table is the ground truth for "has this person been
   * answered", so the queue asks it directly rather than trusting every
   * send path to remember to write the right audit row. One query for all
   * held leads, bounded below by the oldest hold.
   */
  const heldIds = held.map((e) => e.targetId as string);
  const oldestHold = held.reduce((min, e) => (e.createdAt < min ? e.createdAt : min), held[0].createdAt);
  const laterSends = await prisma.message.findMany({
    where: {
      direction: "outbound",
      // The acknowledgement is not an answer (isAcknowledgement above). A
      // bare `not` would also drop null triggers — an owner's reply synced
      // from their inbox — so both are spelled out, as in ownerAlerts.ts.
      OR: [{ trigger: null }, { trigger: { notIn: [...NOT_AN_ANSWER_TRIGGERS] } }],
      sentAt: { gt: oldestHold },
      conversation: { leadId: { in: heldIds }, lead: { businessId } },
    },
    select: { sentAt: true, conversation: { select: { leadId: true } } },
  });
  // The holding messages among the same leads: "let me check" is not an
  // answer, so it is filtered out above, but the owner should see it went.
  const holdingSends = await prisma.message.findMany({
    where: {
      direction: "outbound",
      trigger: HOLDING_TRIGGER,
      sentAt: { gt: oldestHold },
      conversation: { leadId: { in: heldIds }, lead: { businessId } },
    },
    select: { sentAt: true, conversation: { select: { leadId: true } } },
  });
  const lastHoldingByLead = new Map<string, Date>();
  for (const m of holdingSends) {
    const id = m.conversation.leadId;
    const prev = lastHoldingByLead.get(id);
    if (!prev || m.sentAt > prev) lastHoldingByLead.set(id, m.sentAt);
  }

  const lastSentByLead = new Map<string, Date>();
  for (const m of laterSends) {
    const id = m.conversation.leadId;
    const prev = lastSentByLead.get(id);
    if (!prev || m.sentAt > prev) lastSentByLead.set(id, m.sentAt);
  }

  // What the owner said yes to on Today (src/lib/habits.ts, A-099).
  const [habits, businessRow] = await Promise.all([
    getHabits(businessId),
    // A failed read keeps the default zone rather than losing the queue.
    Promise.resolve(prisma.business.findUnique({ where: { id: businessId }, select: { timezone: true } })).catch(() => null),
  ]);
  const skipThanks = habitOn(habits, "skip_thanks");
  const weekendWait = habitOn(habits, "weekend_wait");
  const timezone = businessRow?.timezone ?? "America/New_York";

  const approvals: PendingApproval[] = [];
  for (const event of held) {
    const lead = leadById.get(event.targetId as string);
    // No draft text to show (the hold predates suggestedMessage being
    // set, or the lead was deleted) — nothing for the owner to approve.
    if (!lead?.suggestedMessage) continue;
    // Already answered since this draft was held — by the bulk button, a
    // send from another screen, or the owner replying from their own inbox.
    const sentAfter = lastSentByLead.get(lead.id);
    if (sentAfter && sentAfter > event.createdAt) continue;
    // Or answered where FollowUp cannot see it: "We talked"
    // (src/lib/talked.ts). Undo clears the stamp, and the draft is back.
    if (lead.talkedAt && lead.talkedAt > event.createdAt) continue;
    const meta = (event.meta ?? {}) as Record<string, unknown>;

    let lastInbound: { body: string; channel: string; sentAt: Date } | null = null;
    for (const c of lead.conversations ?? []) {
      const m = c.messages[0];
      if (m && (!lastInbound || m.sentAt > lastInbound.sentAt)) lastInbound = { body: m.body, channel: c.channel, sentAt: m.sentAt };
    }

    // Told since their newest message, so it answers the question in front of the owner.
    const told = lastHoldingByLead.get(lead.id);
    const customerToldAt = told && lastInbound && told > lastInbound.sentAt ? told.toISOString() : null;

    // skip_thanks: a customer whose newest message only says thanks has
    // nothing to answer, by the owner's own rule.
    if (skipThanks && thanksIsNewest(lead.thanksOnlyAt, lastInbound?.sentAt)) continue;

    const ownLater =
      lead.laterUntil && lead.laterUntil > now && !(lastInbound && lead.laterSetAt && lastInbound.sentAt > lead.laterSetAt)
        ? lead.laterUntil
        : null;
    // weekend_wait: a weekend message waits until Monday 9 am, like a Later
    // the owner would have pressed. An explicit Later still wins.
    const later = ownLater ?? (weekendWait && lastInbound ? weekendWaitUntil(lastInbound.sentAt, now, timezone) : null);

    approvals.push({
      laterUntil: later,
      leadId: lead.id,
      leadName: lead.name,
      source: lead.source,
      score: lead.score,
      draftRiskLevel: lead.suggestedRiskLevel,
      riskTopic: lead.suggestedRiskTopic,
      riskLevel: typeof meta.riskLevel === "string" ? meta.riskLevel : "medium",
      reason: typeof meta.reason === "string" ? meta.reason : "",
      trigger: typeof meta.trigger === "string" ? meta.trigger : "silence",
      heldAt: event.createdAt,
      draftSubject: lead.suggestedSubject,
      draftMessage: lead.suggestedMessage,
      leadLastMessage: lastInbound ? truncate(lastInbound.body, LEAD_MESSAGE_PREVIEW_LENGTH) : null,
      leadLastMessageChannel: lastInbound?.channel ?? null,
      leadLastMessageAt: lastInbound ? lastInbound.sentAt.toISOString() : null,
      saidNo: lead.saidNoAt != null,
      askedIfPerson: lead.askedIfPersonAt != null,
      customerToldAt,
      site: siteReplyFrom(lead, lastInbound?.body),
      ...(lead.suggestedDraftKind === NO_ANSWER_TEXT ? { textTo: lead.phone } : {}),
    });
  }
  /*
   * Drafts that need a judgement come first; everything else follows,
   * newest first within each group.
   *
   * This used to be recency alone, and on a holding account that buries
   * the only cards worth reading. Nine say the same generic sentence —
   * "your account holds every automated message for you to approve" —
   * and mixed in among them, in whatever order they happened to be held,
   * is one saying "the draft quotes a price nobody in this conversation
   * mentioned". That one is about to send a made-up number to a customer
   * in the owner's name; the other nine only need a glance.
   *
   * An owner scanning twelve near-identical cards has no way to tell
   * which is which, which is the product's own thesis — "which one am I
   * about to lose?" — failing on the product's own screen.
   *
   * Recency stays as the tiebreak inside each group: among drafts that
   * are alike, the newest is still the most useful first.
   */
  return approvals.sort(compareApprovals);
}

/**
 * Is this lead already waiting in the queue on a hold written at or after
 * `since`? The same "latest decision is a hold" reading getPendingApprovals
 * makes, for one lead. automation.ts asks it before holding a draft again
 * on its ~20-hour re-examination, so an unchanged draft keeps its one hold
 * (and its one notification) instead of gaining a new one every day.
 */
export async function heldSince(businessId: string, leadId: string, since: Date): Promise<boolean> {
  const events = await prisma.auditEvent.findMany({
    where: { businessId, targetType: "lead", targetId: leadId, action: { in: DECISION_EVENTS } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { action: true, meta: true, createdAt: true },
  });
  const latest = events.find((e) => !isAcknowledgement(e));
  return latest?.action === "ai.hold" && latest.createdAt >= since;
}

/**
 * "Don't send" — explicitly declines a held draft. Never deletes the
 * original "ai.hold" event (the audit trail is append-only) and never
 * touches the lead's cached suggestedMessage; writing this newer event
 * for the same lead is what drops it out of getPendingApprovals above,
 * the same mechanism a real send already used.
 */
export async function dismissHold(
  leadId: string,
  businessId: string,
  userId: string | null
): Promise<{ success: boolean; message?: string }> {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, businessId }, select: { id: true, thanksOnlyAt: true } });
  if (!lead) return { success: false, message: "Lead not found." };
  const newestInbound = lead.thanksOnlyAt
    ? await prisma.message.findFirst({
        where: { direction: "inbound", conversation: { leadId, lead: { businessId } } },
        orderBy: { sentAt: "desc" },
        select: { sentAt: true },
      })
    : null;
  const thanksOnly = thanksIsNewest(lead.thanksOnlyAt, newestInbound?.sentAt);
  // Remembered on the lead so the automatic paths leave this customer alone
  // until the conversation moves (settledByDecline, founder 2026-09-30).
  await prisma.lead.update({ where: { id: leadId }, data: { holdDismissedAt: new Date() } });
  // A "Don't send" on a reply to a thank-you is what the skip_thanks habit
  // learns from (src/lib/habits.ts).
  await recordAudit({ businessId, userId }, "ai.hold_dismissed", {
    targetType: "lead",
    targetId: leadId,
    ...(thanksOnly ? { meta: { thanksOnly: true } } : {}),
  });
  return { success: true };
}
