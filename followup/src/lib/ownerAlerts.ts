import { NOT_AN_ANSWER_TRIGGERS } from "@/lib/notAnAnswer";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getPendingApprovals } from "@/lib/pendingApprovals";
import { groupByRecipient, HOLD_BURST_THRESHOLD } from "@/lib/holdNotices";
import { greetingFirstName } from "@/lib/leadName";
import { inboundBaseUrl } from "@/lib/siteUrl";
import { isAlertEmailConfigured, sendAlertEmail } from "@/lib/alertEmail";
import { renderNoticeEmailHtml, noticeDate } from "@/lib/noticeEmailHtml";
import { isPushConfigured, sendPushToUser, type PushPayload } from "@/lib/webPush";
import { isUniqueViolation } from "@/lib/uniqueViolation";
import { readQualification, readyWhy, templateById, templateFor, viewingOf, type Qualification } from "@/lib/qualification";

/**
 * Telling the owner, outside the app, that a customer is waiting.
 *
 * ## Why
 *
 * On the default account every reply is held for the owner's OK
 * (Business.holdAllForApproval). Until this existed the only thing that
 * said so was the bell inside FollowUp — which reaches exactly the people
 * who are already looking at FollowUp. An owner up a ladder found out a
 * customer had been waiting when they next happened to open the app. The
 * founder's bar, 2026-09-25: told within minutes, on their phone, so they
 * can approve within five.
 *
 * ## What counts as "a customer is waiting"
 *
 * Derived from state on every tick, not raised by the code that holds a
 * draft. The holds that mean "a customer wrote" are raised in two places —
 * the held first reply in acknowledge.ts and the unanswered rule in
 * automation.ts — and flushHoldNotices carries neither of them (it carries
 * the silence nudge, workflow steps, DM handoffs and the stale reminder,
 * none of which is a customer who just wrote). Reading the approval queue
 * instead means one definition, the same one the owner sees on the
 * dashboard, and no change to either of those files.
 *
 * A lead alerts when ALL of these hold:
 *  - it is in the approval queue (getPendingApprovals — the latest thing
 *    that happened to it is a hold, and nothing has been sent since);
 *  - the customer spoke last: their newest message is newer than anything
 *    anyone sent them, the instant acknowledgement aside (it is
 *    boilerplate, not an answer — the same exemption the unanswered rule
 *    makes);
 *  - the draft waiting is a reply to THAT message (suggestedDraftedFor);
 *  - the message arrived while FollowUp was watching — not history pulled
 *    in by a fresh inbox connect (BACKFILL_SLACK_MS);
 *  - it became waiting recently (ALERT_RECENT_MS), so a backlog the owner
 *    already knows about is not re-announced.
 *
 * Set-aside private chats never get here: they become a FilteredEmail row,
 * not a lead, so they have no draft and no hold.
 *
 * ## Once per wait
 *
 * A wait starts with the customer's first message after the owner last
 * acted — sent something, or dismissed the draft — and it is keyed by that
 * message's time. The customer writing three times in a row is one wait
 * and one alert. The owner answering and the customer writing back is a
 * new wait, and alerts again. So is a customer writing again a day or more
 * after their last message, answered or not (NEW_WAIT_GAP_MS): someone who
 * comes back after two weeks is news, not the same old wait. The OwnerAlert row's unique index is the
 * claim, so two overlapping ticks cannot both alert it.
 *
 * ## Many at once
 *
 * Same rule as the bell (src/lib/holdNotices.ts): per person, per tick,
 * up to HOLD_BURST_THRESHOLD customers are named one by one, and more than
 * that becomes one line with the count. Ten emails in a minute is a
 * product nagging; one "10 customers are waiting" is information.
 */

/** A wait older than this when first seen is not announced — see the header. */
export const ALERT_RECENT_MS = 6 * 60 * 60_000;

/**
 * Quiet hours, in the business's own time (founder, 2026-10-07, research
 * round 2: "no alerts at night"). Between 10 pm and 7 am nothing is sent:
 * an owner woken at 2 am cannot usefully answer, and getting notifications
 * in batches made people calmer and more productive than getting them as
 * they came (Fitz et al. 2019). Nothing is lost: a customer who wrote in
 * the night is still news at 7, and several at once arrive as one summary
 * (the burst rule below). The morning still beats the speed-to-lead cliff
 * at 24 hours.
 */
export const QUIET_START_HOUR = 22;
export const QUIET_END_HOUR = 7;
const QUIET_LENGTH_MS = ((24 - QUIET_START_HOUR + QUIET_END_HOUR) % 24) * 60 * 60_000;

/** Minutes after local midnight where the business is. Null for an unknown timezone. */
function localMinutes(now: Date, timeZone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).formatToParts(now);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    return (get("hour") % 24) * 60 + get("minute");
  } catch {
    return null;
  }
}

/** Is it night where the business is? An unknown timezone is never quiet: missing a customer is worse. */
export function inQuietHours(now: Date, timeZone: string): boolean {
  const m = localMinutes(now, timeZone);
  if (m === null) return false;
  return m >= QUIET_START_HOUR * 60 || m < QUIET_END_HOUR * 60;
}

/**
 * How far back a wait still counts as news. Normally ALERT_RECENT_MS; on the
 * morning after quiet hours, far enough to reach back to when the night
 * began, so a customer who wrote at 11 pm is announced at 7.
 */
export function newsSince(now: Date, timeZone: string): Date {
  const usual = now.getTime() - ALERT_RECENT_MS;
  const m = localMinutes(now, timeZone);
  if (m === null) return new Date(usual);
  const sinceQuietEnded = (m - QUIET_END_HOUR * 60) * 60_000;
  if (sinceQuietEnded < 0 || sinceQuietEnded >= ALERT_RECENT_MS) return new Date(usual);
  return new Date(Math.min(usual, now.getTime() - sinceQuietEnded - QUIET_LENGTH_MS));
}

/**
 * How far a customer's message may predate the lead row and still count as
 * arriving while FollowUp was watching.
 *
 * A message synced a few minutes after it was sent (Gmail's ten-minute
 * poll, Instagram's three-minute one) predates its own lead row by that
 * much, and is live. A thread pulled in by a first inbox connect predates
 * it by days. One hour is the line acknowledge.ts already draws for the
 * same question (STALE_AFTER_MS): older than that, it is history.
 */
export const BACKFILL_SLACK_MS = 60 * 60_000;

/** Emails per person per day, before one "more are waiting" note and then silence until tomorrow. */
export const DAILY_EMAIL_CAP = 20;

/** The founder's limit on how much of a customer's message leaves the app in an alert. */
export const ALERT_QUOTE_LIMIT = 140;
/** Shorter on a lock screen, which cuts a long line off anyway. */
const PUSH_QUOTE_LIMIT = 100;

export type WaitingCustomer = {
  leadId: string;
  businessId: string;
  assignedToId: string | null;
  leadName: string;
  /** The customer's own newest message, whole — trimmed only when it is quoted. */
  lastMessage: string;
  channel: string | null;
  /** The customer's first message since the owner last acted. The wait's identity. */
  waitStartedAt: Date;
};

/**
 * A customer who writes again this long after their previous message has started a new wait, even if nobody
 * answered the last one (founder, 2026-10-11, after a test email 16 days on brought no buzz: "Fix it so a customer
 * who writes again a day or more later buzzes your phone again?" → "Yes, fix it"). Messages closer together than
 * this are one wait and one alert, as before.
 */
export const NEW_WAIT_GAP_MS = 24 * 60 * 60_000;
/** How many of a customer's unanswered messages are read to find where their wait began. */
const WAIT_SCAN_LIMIT = 100;

/**
 * Where the customer's current wait began, given their unanswered messages newest first: the first message of the
 * latest run, where a run ends at any gap of NEW_WAIT_GAP_MS or more. Null when there are none.
 */
export function waitStart(inboundNewestFirst: Date[], gapMs: number = NEW_WAIT_GAP_MS): Date | null {
  if (inboundNewestFirst.length === 0) return null;
  let start = inboundNewestFirst[0];
  for (const earlier of inboundNewestFirst.slice(1)) {
    if (start.getTime() - earlier.getTime() >= gapMs) break;
    start = earlier;
  }
  return start;
}

export type WaitVerdict = { waiting: true } | { waiting: false; reason: string };

/**
 * The pure half of "is this customer waiting, and is it news?" — every rule
 * in the header that does not need the database. Exported so the tests
 * drive the real rules rather than a copy of them.
 */
export function judgeWait(
  w: {
    heldAt: Date;
    latestInboundAt: Date | null;
    lastReplyAt: Date | null;
    leadCreatedAt: Date;
    draftedFor: Date | null;
  },
  now: Date,
  since: Date = new Date(now.getTime() - ALERT_RECENT_MS)
): WaitVerdict {
  if (!w.latestInboundAt) return { waiting: false, reason: "the customer never wrote" };
  if (w.lastReplyAt && w.lastReplyAt >= w.latestInboundAt) return { waiting: false, reason: "someone answered after they wrote" };
  if (w.latestInboundAt.getTime() < w.leadCreatedAt.getTime() - BACKFILL_SLACK_MS) {
    return { waiting: false, reason: "history from before FollowUp was watching" };
  }
  if (!w.draftedFor || w.draftedFor < w.latestInboundAt) return { waiting: false, reason: "the draft is not a reply to their newest message" };
  const becameWaiting = Math.max(w.heldAt.getTime(), w.latestInboundAt.getTime());
  if (becameWaiting < since.getTime()) return { waiting: false, reason: "not new" };
  return { waiting: true };
}

/** Anything sent to the lead that is a real answer. The acknowledgement is not. */
const REPLY_WHERE: Prisma.MessageWhereInput = {
  direction: "outbound",
  // `not` alone would drop rows whose trigger is null — an owner's reply
  // synced from Gmail, the commonest answer of all — because SQL's
  // `trigger <> 'instant_ack'` is NULL for them, not true.
  OR: [{ trigger: null }, { trigger: { notIn: [...NOT_AN_ANSWER_TRIGGERS] } }],
};

async function waitingCustomersFor(businessId: string, now: Date): Promise<WaitingCustomer[]> {
  // Quiet hours: claim nothing tonight, so the morning tick finds them all.
  let timeZone = "America/New_York";
  try {
    const biz = await prisma.business.findUnique({ where: { id: businessId }, select: { timezone: true } });
    if (biz?.timezone) timeZone = biz.timezone;
  } catch {
    // The usual timezone, rather than no alert at all.
  }
  if (inQuietHours(now, timeZone)) return [];
  const newsFrom = newsSince(now, timeZone);
  const since = newsFrom.getTime();
  // Cheap first cut on what the queue already knows, so a backlog of fifty
  // old holds costs no per-lead queries on every tick.
  // A card set aside with "Later" (A-046) has been seen; it isn't news.
  const fresh = (await getPendingApprovals(businessId)).filter(
    (a) => !a.laterUntil && a.leadLastMessageAt && Math.max(a.heldAt.getTime(), new Date(a.leadLastMessageAt).getTime()) >= since
  );
  if (fresh.length === 0) return [];
  const ids = fresh.map((a) => a.leadId);

  const [leads, dismissals] = await Promise.all([
    prisma.lead.findMany({
      where: { id: { in: ids }, businessId },
      select: { id: true, assignedToId: true, createdAt: true, suggestedDraftedFor: true },
    }),
    prisma.auditEvent.findMany({
      where: { businessId, action: "ai.hold_dismissed", targetType: "lead", targetId: { in: ids } },
      orderBy: { createdAt: "desc" },
      select: { targetId: true, createdAt: true },
    }),
  ]);
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const lastDismissed = new Map<string, Date>();
  for (const d of dismissals) if (d.targetId && !lastDismissed.has(d.targetId)) lastDismissed.set(d.targetId, d.createdAt);

  const out: WaitingCustomer[] = [];
  for (const approval of fresh) {
    const lead = leadById.get(approval.leadId);
    if (!lead) continue;
    const lastReply = await prisma.message.findFirst({
      where: { conversation: { leadId: lead.id }, ...REPLY_WHERE },
      orderBy: { sentAt: "desc" },
      select: { sentAt: true },
    });
    const verdict = judgeWait(
      {
        heldAt: approval.heldAt,
        latestInboundAt: approval.leadLastMessageAt ? new Date(approval.leadLastMessageAt) : null,
        lastReplyAt: lastReply?.sentAt ?? null,
        leadCreatedAt: lead.createdAt,
        draftedFor: lead.suggestedDraftedFor,
      },
      now,
      newsFrom
    );
    if (!verdict.waiting) continue;

    // Owner "acted" = answered, or looked at the draft and said no. Either
    // one ends a wait; the customer's next message starts a new one.
    const dismissedAt = lastDismissed.get(lead.id) ?? null;
    const actedAt = [lastReply?.sentAt ?? null, dismissedAt].reduce<Date | null>(
      (max, d) => (d && (!max || d > max) ? d : max),
      null
    );
    // Their messages since the owner last acted, newest first. The wait starts at the first of the latest run:
    // a customer who writes again a day or more after their last message has started a new one (see waitStart).
    const inbound = await prisma.message.findMany({
      where: { conversation: { leadId: lead.id }, direction: "inbound", ...(actedAt ? { sentAt: { gt: actedAt } } : {}) },
      orderBy: { sentAt: "desc" },
      take: WAIT_SCAN_LIMIT,
      select: { sentAt: true },
    });
    const startedAt = waitStart(inbound.map((m) => m.sentAt));
    if (!startedAt) continue;

    out.push({
      leadId: lead.id,
      businessId,
      assignedToId: lead.assignedToId,
      leadName: approval.leadName,
      lastMessage: approval.leadLastMessage ?? "",
      channel: approval.leadLastMessageChannel,
      waitStartedAt: startedAt,
    });
  }
  return out;
}

/** Every waiting customer that is news, across every business with anything recent. */
export async function findWaitingCustomers(now: Date = new Date()): Promise<WaitingCustomer[]> {
  // Wide enough for the morning after quiet hours; each business narrows it.
  const since = new Date(now.getTime() - ALERT_RECENT_MS - QUIET_LENGTH_MS);
  // Only businesses where something could have changed: a draft was held,
  // or a lead with a draft heard from someone. Everyone else is skipped
  // without touching their queue, which is what makes a one-minute tick
  // affordable.
  const [held, touched] = await Promise.all([
    prisma.auditEvent.findMany({
      where: { action: "ai.hold", createdAt: { gte: since } },
      select: { businessId: true },
      distinct: ["businessId"],
    }),
    prisma.lead.findMany({
      where: { lastContacted: { gte: since }, suggestedMessage: { not: null } },
      select: { businessId: true },
      distinct: ["businessId"],
    }),
  ]);
  const businessIds = [...new Set([...held, ...touched].map((r) => r.businessId))];

  const all: WaitingCustomer[] = [];
  for (const businessId of businessIds) {
    try {
      all.push(...(await waitingCustomersFor(businessId, now)));
    } catch (err) {
      // One business's bad row must not silence every other business.
      console.error(`Owner alerts: could not read the queue for business ${businessId}:`, err);
    }
  }
  return all;
}

/* ------------------------------------------------------------------ *
 * What the owner reads.
 *
 * Plain and calm (brand-principles.md #2): who, what they said, that a
 * reply is ready, one link. Never the draft itself, never why it was held
 * — the owner reads both in full in FollowUp, and an alert that contains
 * the reply invites sending it without looking. No exclamation marks.
 * ------------------------------------------------------------------ */

export function quote(text: string, limit: number = ALERT_QUOTE_LIMIT): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > limit ? `${flat.slice(0, limit - 1).trimEnd()}…` : flat;
}

/** "Jane", or "A customer" when all FollowUp has is a placeholder like "Instagram DM". */
function whoIs(leadName: string): { first: string; full: string } {
  const first = greetingFirstName(leadName);
  if (!first) return { first: "A customer", full: "A customer" };
  return { first, full: leadName.trim().replace(/^@/, "") };
}

const CHANNEL_PHRASE: Record<string, string> = {
  email: "by email",
  text: "by text",
  whatsapp: "on WhatsApp",
  instagram: "on Instagram",
  messenger: "on Messenger",
  web: "on your website form",
  lead_form: "on your Facebook form",
};

type EmailContent = { subject: string; text: string; html: string };

const FOOTNOTE = "You're getting this because email alerts are on for you in FollowUp. To stop them,";

function footer(base: string): { text: string; link: { text: string; href: string } } {
  const settings = `${base}/settings#alerts`;
  return {
    text: `You're getting this because email alerts are on for you in FollowUp. To stop them, turn them off in Settings: ${settings}`,
    link: { text: "turn them off in Settings", href: settings },
  };
}

/** The two capitals a person row shows for a name ("Jane Cooper" → "JC"; a number or a placeholder → "·"). */
function initialsOf(name: string, first: string): string {
  if (first === "A customer" || /^\+?\d/.test(name.trim())) return "·";
  const parts = name.trim().replace(/^@/, "").split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

type EmailOptions = { timeZone?: string };

export function customerEmail(c: WaitingCustomer, base: string, opts: EmailOptions = {}): EmailContent {
  const { first, full } = whoIs(c.leadName);
  const where = c.channel ? CHANNEL_PHRASE[c.channel] : undefined;
  const said = quote(c.lastMessage);
  const url = `${base}/leads/${c.leadId}`;
  const foot = footer(base);
  // A photo or a voice note has no text to quote; say they wrote, and stop.
  const wrote = `${full} wrote${where ? ` ${where}` : ""}${said ? ":" : "."}`;
  const open = first === "A customer" ? "Open the conversation" : `Open ${first}'s conversation`;
  return {
    subject: `${first} is waiting for your reply`,
    text: [wrote, ...(said ? ["", `"${said}"`] : []), "", "FollowUp's reply is ready — open it to send.", url, "", foot.text].join("\n"),
    html: renderNoticeEmailHtml({
      base,
      label: "Waiting for your reply",
      title: `${first} is waiting for your reply`,
      date: noticeDate(new Date(), opts.timeZone ?? "America/New_York"),
      before: [],
      sub: { kind: "person", initials: initialsOf(full, first), name: full, channel: where ? `wrote ${where}` : "wrote", when: null, quote: said || null },
      after: ["FollowUp's reply is ready. Open it to send."],
      button: { text: open, href: url },
      why: "Nothing goes out until you send it.",
      footnote: FOOTNOTE,
      footnoteLink: foot.link,
    }),
  };
}

export function summaryEmail(count: number, base: string, opts: EmailOptions = {}): EmailContent {
  const url = `${base}/dashboard`;
  const foot = footer(base);
  const line = `${count} customers wrote, and FollowUp's replies to them are ready. Open FollowUp to read them and send.`;
  return {
    subject: `${count} customers are waiting for your OK`,
    text: [line, url, "", foot.text].join("\n"),
    html: renderNoticeEmailHtml({
      base,
      label: "Waiting for your OK",
      title: `${count} customers are waiting for your OK`,
      date: noticeDate(new Date(), opts.timeZone ?? "America/New_York"),
      before: [line],
      button: { text: "Open FollowUp", href: url },
      why: "Nothing goes out until you send it.",
      footnote: FOOTNOTE,
      footnoteLink: foot.link,
    }),
  };
}

export function moreWaitingEmail(base: string, opts: EmailOptions = {}): EmailContent {
  const url = `${base}/dashboard`;
  const foot = footer(base);
  const line =
    `FollowUp has emailed you about ${DAILY_EMAIL_CAP} customers today, so it will stop emailing about each one until tomorrow. ` +
    "Everyone who is waiting is in FollowUp, with a reply ready.";
  return {
    subject: "More customers are waiting for your reply",
    text: [line, url, "", foot.text].join("\n"),
    html: renderNoticeEmailHtml({
      base,
      label: "Waiting for your reply",
      title: "More customers are waiting for your reply",
      date: noticeDate(new Date(), opts.timeZone ?? "America/New_York"),
      before: [line],
      button: { text: "Open FollowUp", href: url },
      footnote: FOOTNOTE,
      footnoteLink: foot.link,
    }),
  };
}

export function customerPush(c: WaitingCustomer): PushPayload {
  const { first } = whoIs(c.leadName);
  const said = quote(c.lastMessage, PUSH_QUOTE_LIMIT);
  return {
    title: `${first} is waiting`,
    body: said || "FollowUp's reply is ready for your OK.",
    url: `/leads/${c.leadId}`,
    tag: `lead-${c.leadId}`,
  };
}

export function summaryPush(count: number): PushPayload {
  return { title: `${count} customers are waiting`, body: "Their replies are ready for your OK.", url: "/dashboard", tag: "waiting-summary" };
}

/* ------------------------------------------------------------------ *
 * "Nadia is ready."
 *
 * The other thing worth reaching an owner outside the app for (founder,
 * 2026-10-09: "the owner gets only 'X is ready'"): everything on the
 * customer's checklist is known (src/lib/qualification.ts), so it is time
 * for a person to call. Once per customer — Lead.qualifiedAt is stamped
 * once and is the claim's key — under the same quiet hours and the same
 * "only if it's news" window as a waiting customer.
 *
 * It says why in a line, never the customer's own words: the proof is one
 * tap away in FollowUp, and the alert is not where anyone should read it.
 * ------------------------------------------------------------------ */

export type ReadyCustomer = {
  leadId: string;
  businessId: string;
  assignedToId: string | null;
  leadName: string;
  qualification: Qualification;
  /** When the checklist completed. The alert's identity. */
  qualifiedAt: Date;
};

/** Every customer who became ready recently enough to be news, where it isn't night. */
export async function findReadyCustomers(now: Date = new Date()): Promise<ReadyCustomer[]> {
  const rows = await prisma.lead.findMany({
    where: { qualifiedAt: { gte: new Date(now.getTime() - ALERT_RECENT_MS - QUIET_LENGTH_MS) } },
    select: {
      id: true,
      businessId: true,
      assignedToId: true,
      name: true,
      stage: true,
      qualification: true,
      qualifiedAt: true,
      business: { select: { industry: true, timezone: true } },
    },
  });
  const out: ReadyCustomer[] = [];
  for (const r of rows) {
    // A deal already won or lost needs nobody to pick up the phone.
    if (!r.qualifiedAt || r.stage === "WON" || r.stage === "LOST") continue;
    if (!templateFor(r.business.industry)) continue;
    const qualification = readQualification(r.qualification);
    if (!qualification) continue;
    const timeZone = r.business.timezone || "America/New_York";
    if (inQuietHours(now, timeZone)) continue;
    if (r.qualifiedAt < newsSince(now, timeZone)) continue;
    out.push({
      leadId: r.id,
      businessId: r.businessId,
      assignedToId: r.assignedToId,
      leadName: r.name,
      qualification,
      qualifiedAt: r.qualifiedAt,
    });
  }
  return out;
}

export function readyPush(c: ReadyCustomer): PushPayload {
  const { first } = whoIs(c.leadName);
  const viewing = viewingOf(c.qualification);
  const why = readyWhy(c.qualification);
  return {
    title: `${first} is ready`,
    body: [viewing, why].filter(Boolean).join(" · ") || "Everything FollowUp needed to know is in.",
    url: `/leads/${c.leadId}`,
    tag: `ready-${c.leadId}`,
  };
}

export function readyEmail(c: ReadyCustomer, base: string, opts: EmailOptions = {}): EmailContent {
  const { first } = whoIs(c.leadName);
  const template = templateById(c.qualification.template);
  const labels = new Map(template?.criteria.map((k) => [k.key, k.label]) ?? []);
  const rows: [string, string][] = c.qualification.items.map((i) => [labels.get(i.key) ?? i.key, i.value]);
  const url = `${base}/leads/${c.leadId}`;
  const foot = footer(base);
  const open = first === "A customer" ? "Open the conversation" : `Open ${first}'s conversation`;
  const line = "Everything FollowUp needed to know is in. It's a good moment for you to call.";
  return {
    subject: `${first} is ready`,
    text: [line, "", ...rows.map(([k, v]) => `${k}: ${v}`), "", url, "", foot.text].join("\n"),
    html: renderNoticeEmailHtml({
      base,
      label: "Ready",
      title: `${first} is ready`,
      date: noticeDate(new Date(), opts.timeZone ?? "America/New_York"),
      before: [line],
      sub: { kind: "rows", rows },
      button: { text: open, href: url },
      why: "Each line is from what they wrote. Open the conversation to see their words.",
      footnote: FOOTNOTE,
      footnoteLink: foot.link,
    }),
  };
}

/* ------------------------------------------------------------------ *
 * Delivery.
 * ------------------------------------------------------------------ */

/**
 * Midnight today where the business is. The cap is "per day" and the note
 * that ends it promises "until tomorrow", so the day has to be the owner's,
 * not UTC's — an owner in Toronto would otherwise see the count reset at
 * 8pm. Off by an hour on the two days a year the clocks change, which is
 * an acceptable cost for not carrying a timezone library.
 */
export function startOfLocalDay(now: Date, timeZone: string): Date {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(now);
  } catch {
    return new Date(now.getTime() - 24 * 60 * 60_000);
  }
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const elapsed = ((get("hour") % 24) * 60 + get("minute")) * 60 + get("second");
  return new Date(now.getTime() - elapsed * 1000 - now.getMilliseconds());
}

export type AlertRunResult = {
  /** Waiting customers found this tick that were news to at least one person. */
  customers: number;
  emails: number;
  pushes: number;
  summaries: number;
  /** Customers who became ready and someone was told. */
  ready: number;
  /** Set when neither channel has keys: the run did nothing, on purpose. */
  skipped?: string;
};

type Recipient = {
  id: string;
  email: string;
  businessId: string | null;
  alertEmailEnabled: boolean;
  business: { timezone: string } | null;
};

async function alertOne(
  user: Recipient,
  customers: WaitingCustomer[],
  now: Date,
  channels: { email: boolean; push: boolean },
  result: AlertRunResult
): Promise<void> {
  // Never tell someone about another business's customer, whatever the
  // assignee column says.
  const mine = customers.filter((c) => c.businessId === user.businessId);
  if (mine.length === 0) return;

  const already = await prisma.ownerAlert.findMany({
    where: { userId: user.id, leadId: { in: mine.map((c) => c.leadId) } },
    select: { leadId: true, waitStartedAt: true, kind: true, emailedAt: true, pushedAt: true },
  });
  const told = new Set(already.map((a) => `${a.leadId}|${a.waitStartedAt?.getTime()}`));
  // "Nadia is ready" already reached this person since Nadia started
  // waiting: that alert said her reply is ready too, so a second one about
  // the same moment is the noise the founder asked to avoid ("one
  // notification"). Claimed silently, so later ticks see it as told.
  const readyAt = new Map<string, number>();
  for (const a of already) {
    if (a.kind === "ready" && a.leadId && a.waitStartedAt && (a.emailedAt || a.pushedAt)) {
      readyAt.set(a.leadId, Math.max(readyAt.get(a.leadId) ?? 0, a.waitStartedAt.getTime()));
    }
  }

  // Claim before sending: the unique index decides, so a second tick that
  // races this one finds the row and skips rather than alerting twice.
  const claimed: { customer: WaitingCustomer; rowId: string }[] = [];
  for (const c of mine) {
    if (told.has(`${c.leadId}|${c.waitStartedAt.getTime()}`)) continue;
    const coveredByReady = (readyAt.get(c.leadId) ?? 0) >= c.waitStartedAt.getTime();
    try {
      const row = await prisma.ownerAlert.create({
        data: { userId: user.id, businessId: c.businessId, leadId: c.leadId, waitStartedAt: c.waitStartedAt, kind: "customer" },
        select: { id: true },
      });
      if (!coveredByReady) claimed.push({ customer: c, rowId: row.id });
    } catch (err) {
      if (!isUniqueViolation(err)) console.error(`Owner alert claim failed for lead ${c.leadId}:`, err);
    }
  }
  if (claimed.length === 0) return;
  result.customers += claimed.length;

  const base = inboundBaseUrl();
  const emailOn = channels.email && user.alertEmailEnabled && Boolean(user.email);
  const dayStart = startOfLocalDay(now, user.business?.timezone ?? "America/New_York");
  let emailedToday = emailOn
    ? await prisma.ownerAlert.count({ where: { userId: user.id, emailedAt: { gte: dayStart } } })
    : 0;

  /**
   * A send that was really attempted and did not land — the email service
   * refused it, or a still-subscribed phone did not take it. Distinct from a
   * deliberate skip (email switched off, today's allowance used, no phone
   * registered), which is a finished decision, not a failure.
   */
  let attemptFailed = false;

  /** One email, if the person wants them and today's allowance has room. Returns whether it went. */
  const email = async (content: EmailContent, idempotencyKey: string): Promise<boolean> => {
    if (!emailOn) return false;
    if (emailedToday >= DAILY_EMAIL_CAP) {
      // Over the cap: one note saying so, once, and then nothing until the
      // owner's tomorrow. The note counts against the day like any email.
      const noted = await prisma.ownerAlert.count({ where: { userId: user.id, kind: "more_waiting", createdAt: { gte: dayStart } } });
      if (noted > 0) return false;
      const note = await prisma.ownerAlert.create({
        data: { userId: user.id, businessId: user.businessId as string, kind: "more_waiting" },
        select: { id: true },
      });
      const sent = await sendAlertEmail({ to: user.email, ...moreWaitingEmail(base, { timeZone: user.business?.timezone }), idempotencyKey: note.id });
      if (sent.sent) {
        await prisma.ownerAlert.update({ where: { id: note.id }, data: { emailedAt: new Date() } });
        emailedToday += 1;
        result.emails += 1;
      }
      return false;
    }
    const sent = await sendAlertEmail({ to: user.email, ...content, idempotencyKey });
    if (sent.sent) {
      emailedToday += 1;
      result.emails += 1;
    } else {
      attemptFailed = true;
    }
    return sent.sent;
  };

  const push = async (payload: PushPayload): Promise<boolean> => {
    if (!channels.push) return false;
    const r = await sendPushToUser(user.id, payload);
    result.pushes += r.delivered;
    if (r.delivered === 0 && r.failed > 0) attemptFailed = true;
    return r.delivered > 0;
  };

  if (claimed.length > HOLD_BURST_THRESHOLD) {
    // The burst. Every claimed customer is now "told" by this one line, so
    // none of them is named later on its own.
    const summary = await prisma.ownerAlert.create({
      data: { userId: user.id, businessId: user.businessId as string, kind: "summary" },
      select: { id: true },
    });
    attemptFailed = false;
    const emailed = await email(summaryEmail(claimed.length, base, { timeZone: user.business?.timezone }), summary.id);
    const pushed = await push(summaryPush(claimed.length));
    if (emailed || pushed) {
      await prisma.ownerAlert.update({
        where: { id: summary.id },
        data: { ...(emailed ? { emailedAt: new Date() } : {}), ...(pushed ? { pushedAt: new Date() } : {}) },
      });
    } else if (attemptFailed) {
      // Same rule as one customer, below: a summary that reached nobody
      // leaves every customer it covered un-told. Release them all.
      await prisma.ownerAlert.deleteMany({ where: { id: { in: [summary.id, ...claimed.map((c) => c.rowId)] } } });
      result.customers -= claimed.length;
      return;
    }
    result.summaries += 1;
    return;
  }

  for (const { customer, rowId } of claimed) {
    attemptFailed = false;
    const emailed = await email(customerEmail(customer, base, { timeZone: user.business?.timezone }), rowId);
    const pushed = await push(customerPush(customer));
    if (emailed || pushed) {
      await prisma.ownerAlert.update({
        where: { id: rowId },
        data: { ...(emailed ? { emailedAt: new Date() } : {}), ...(pushed ? { pushedAt: new Date() } : {}) },
      });
    } else if (attemptFailed) {
      // Nothing reached them and something really tried. The claim row is
      // what marks this customer "told", so keep it and they are never
      // announced (daily-path sweep 2026-09-25 #2). Released, the next
      // minute's run claims and tries again — until the wait stops being
      // new (ALERT_RECENT_MS), and the daily setup check reports a key that
      // keeps failing.
      await prisma.ownerAlert.deleteMany({ where: { id: rowId, emailedAt: null, pushedAt: null } });
      result.customers -= 1;
    }
  }
}

/** Tells one person about the customers of theirs who just became ready. */
async function alertReady(
  user: Recipient,
  customers: ReadyCustomer[],
  now: Date,
  channels: { email: boolean; push: boolean },
  result: AlertRunResult
): Promise<void> {
  const mine = customers.filter((c) => c.businessId === user.businessId);
  if (mine.length === 0) return;
  const base = inboundBaseUrl();
  const emailOn = channels.email && user.alertEmailEnabled && Boolean(user.email);
  const dayStart = startOfLocalDay(now, user.business?.timezone ?? "America/New_York");
  let emailedToday = emailOn ? await prisma.ownerAlert.count({ where: { userId: user.id, emailedAt: { gte: dayStart } } }) : 0;

  for (const c of mine) {
    let rowId: string;
    try {
      // The claim, as for a waiting customer: the unique index decides.
      const row = await prisma.ownerAlert.create({
        data: { userId: user.id, businessId: c.businessId, leadId: c.leadId, waitStartedAt: c.qualifiedAt, kind: "ready" },
        select: { id: true },
      });
      rowId = row.id;
    } catch (err) {
      if (!isUniqueViolation(err)) console.error(`Ready alert claim failed for lead ${c.leadId}:`, err);
      continue;
    }

    let emailed = false;
    let failed = false;
    if (emailOn && emailedToday < DAILY_EMAIL_CAP) {
      const sent = await sendAlertEmail({ to: user.email, ...readyEmail(c, base, { timeZone: user.business?.timezone }), idempotencyKey: rowId });
      emailed = sent.sent;
      if (sent.sent) {
        emailedToday += 1;
        result.emails += 1;
      } else failed = true;
    }
    let pushed = false;
    if (channels.push) {
      const r = await sendPushToUser(user.id, readyPush(c));
      result.pushes += r.delivered;
      pushed = r.delivered > 0;
      if (r.delivered === 0 && r.failed > 0) failed = true;
    }

    if (emailed || pushed) {
      await prisma.ownerAlert.update({
        where: { id: rowId },
        data: { ...(emailed ? { emailedAt: new Date() } : {}), ...(pushed ? { pushedAt: new Date() } : {}) },
      });
      result.ready += 1;
    } else if (failed) {
      // Released so the next tick tries again, as for a waiting customer.
      await prisma.ownerAlert.deleteMany({ where: { id: rowId, emailedAt: null, pushedAt: null } });
    }
  }
}

/**
 * One tick: find who is waiting, and tell each person who should know.
 * Run every minute by /api/cron/owner-alerts.
 *
 * With neither Resend nor VAPID keys set, returns at once without reading
 * or writing anything — no claims are recorded for alerts nobody could
 * receive, so the first tick after the founder adds keys starts clean
 * (and anything recent arrives as one summary, not a flood).
 */
export async function runOwnerAlerts(now: Date = new Date()): Promise<AlertRunResult> {
  const result: AlertRunResult = { customers: 0, emails: 0, pushes: 0, summaries: 0, ready: 0 };
  const channels = { email: isAlertEmailConfigured(), push: isPushConfigured() };
  if (!channels.email && !channels.push) return { ...result, skipped: "no alert channel is configured" };

  // Ready first: a customer who is both newly ready and waiting gets the
  // one "ready" alert, and the waiting one below sees it and stays quiet.
  let ready: ReadyCustomer[] = [];
  try {
    ready = await findReadyCustomers(now);
  } catch (err) {
    console.error("Owner alerts: could not read who is ready:", err);
  }
  const readyByUser = ready.length > 0 ? await groupByRecipient(ready) : new Map<string, ReadyCustomer[]>();

  const waiting = await findWaitingCustomers(now);
  if (waiting.length === 0 && ready.length === 0) return result;

  const byUser = await groupByRecipient(waiting);
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set([...readyByUser.keys(), ...byUser.keys()])] } },
    // Only what an alert needs. The business relation is narrowed to its
    // timezone so this never pulls (and decrypts) the channel tokens on
    // the Business row.
    select: { id: true, email: true, businessId: true, alertEmailEnabled: true, business: { select: { timezone: true } } },
  });

  for (const user of users) {
    try {
      await alertReady(user, readyByUser.get(user.id) ?? [], now, channels, result);
    } catch (err) {
      console.error(`Ready alerts failed for user ${user.id}:`, err);
    }
    try {
      await alertOne(user, byUser.get(user.id) ?? [], now, channels, result);
    } catch (err) {
      console.error(`Owner alerts failed for user ${user.id}:`, err);
    }
  }
  return result;
}
