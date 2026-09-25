import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getPendingApprovals } from "@/lib/pendingApprovals";
import { groupByRecipient, HOLD_BURST_THRESHOLD } from "@/lib/holdNotices";
import { greetingFirstName } from "@/lib/leadName";
import { inboundBaseUrl } from "@/lib/siteUrl";
import { isAlertEmailConfigured, sendAlertEmail } from "@/lib/alertEmail";
import { isPushConfigured, sendPushToUser, type PushPayload } from "@/lib/webPush";

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
 * new wait, and alerts again. The OwnerAlert row's unique index is the
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
  now: Date
): WaitVerdict {
  if (!w.latestInboundAt) return { waiting: false, reason: "the customer never wrote" };
  if (w.lastReplyAt && w.lastReplyAt >= w.latestInboundAt) return { waiting: false, reason: "someone answered after they wrote" };
  if (w.latestInboundAt.getTime() < w.leadCreatedAt.getTime() - BACKFILL_SLACK_MS) {
    return { waiting: false, reason: "history from before FollowUp was watching" };
  }
  if (!w.draftedFor || w.draftedFor < w.latestInboundAt) return { waiting: false, reason: "the draft is not a reply to their newest message" };
  const becameWaiting = Math.max(w.heldAt.getTime(), w.latestInboundAt.getTime());
  if (becameWaiting < now.getTime() - ALERT_RECENT_MS) return { waiting: false, reason: "not new" };
  return { waiting: true };
}

/** Anything sent to the lead that is a real answer. The acknowledgement is not. */
const REPLY_WHERE: Prisma.MessageWhereInput = {
  direction: "outbound",
  // `not` alone would drop rows whose trigger is null — an owner's reply
  // synced from Gmail, the commonest answer of all — because SQL's
  // `trigger <> 'instant_ack'` is NULL for them, not true.
  OR: [{ trigger: null }, { trigger: { not: "instant_ack" } }],
};

async function waitingCustomersFor(businessId: string, now: Date): Promise<WaitingCustomer[]> {
  const since = now.getTime() - ALERT_RECENT_MS;
  // Cheap first cut on what the queue already knows, so a backlog of fifty
  // old holds costs no per-lead queries on every tick.
  const fresh = (await getPendingApprovals(businessId)).filter(
    (a) => a.leadLastMessageAt && Math.max(a.heldAt.getTime(), new Date(a.leadLastMessageAt).getTime()) >= since
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
      now
    );
    if (!verdict.waiting) continue;

    // Owner "acted" = answered, or looked at the draft and said no. Either
    // one ends a wait; the customer's next message starts a new one.
    const dismissedAt = lastDismissed.get(lead.id) ?? null;
    const actedAt = [lastReply?.sentAt ?? null, dismissedAt].reduce<Date | null>(
      (max, d) => (d && (!max || d > max) ? d : max),
      null
    );
    const first = await prisma.message.findFirst({
      where: { conversation: { leadId: lead.id }, direction: "inbound", ...(actedAt ? { sentAt: { gt: actedAt } } : {}) },
      orderBy: { sentAt: "asc" },
      select: { sentAt: true },
    });
    if (!first) continue;

    out.push({
      leadId: lead.id,
      businessId,
      assignedToId: lead.assignedToId,
      leadName: approval.leadName,
      lastMessage: approval.leadLastMessage ?? "",
      channel: approval.leadLastMessageChannel,
      waitStartedAt: first.sentAt,
    });
  }
  return out;
}

/** Every waiting customer that is news, across every business with anything recent. */
export async function findWaitingCustomers(now: Date = new Date()): Promise<WaitingCustomer[]> {
  const since = new Date(now.getTime() - ALERT_RECENT_MS);
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
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

type EmailContent = { subject: string; text: string; html: string };

function footer(base: string): { text: string; html: string } {
  const settings = `${base}/settings#alerts`;
  return {
    text: `You're getting this because email alerts are on for you in FollowUp. To stop them, turn them off in Settings: ${settings}`,
    html: `<p style="color:#6b7280;font-size:13px;margin:32px 0 0">You're getting this because email alerts are on for you in FollowUp. To stop them, <a href="${escapeHtml(settings)}" style="color:#6b7280">turn them off in Settings</a>.</p>`,
  };
}

function wrapHtml(inner: string): string {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111312;max-width:520px">${inner}</div>`;
}

export function customerEmail(c: WaitingCustomer, base: string): EmailContent {
  const { first, full } = whoIs(c.leadName);
  const where = c.channel ? CHANNEL_PHRASE[c.channel] : undefined;
  const said = quote(c.lastMessage);
  const url = `${base}/leads/${c.leadId}`;
  const foot = footer(base);
  // A photo or a voice note has no text to quote; say they wrote, and stop.
  const wrote = `${full} wrote${where ? ` ${where}` : ""}${said ? ":" : "."}`;
  return {
    subject: `${first} is waiting for your reply`,
    text: [wrote, ...(said ? ["", `"${said}"`] : []), "", "FollowUp's reply is ready — open it to send.", url, "", foot.text].join("\n"),
    html: wrapHtml(
      `<p style="margin:0 0 ${said ? 8 : 20}px">${escapeHtml(wrote)}</p>` +
        (said
          ? `<p style="margin:0 0 20px;padding-left:12px;border-left:2px solid #d4d4d8;color:#3f3f46">${escapeHtml(said)}</p>`
          : "") +
        `<p style="margin:0 0 20px">FollowUp's reply is ready — open it to send.</p>` +
        `<p style="margin:0"><a href="${escapeHtml(url)}" style="color:#111312;font-weight:600">Open ${escapeHtml(first === "A customer" ? "the conversation" : `${first}'s conversation`)}</a></p>` +
        foot.html
    ),
  };
}

export function summaryEmail(count: number, base: string): EmailContent {
  const url = `${base}/dashboard`;
  const foot = footer(base);
  const line = `${count} customers wrote, and FollowUp's replies to them are ready. Open FollowUp to read them and send.`;
  return {
    subject: `${count} customers are waiting for your OK`,
    text: [line, url, "", foot.text].join("\n"),
    html: wrapHtml(
      `<p style="margin:0 0 20px">${escapeHtml(line)}</p>` +
        `<p style="margin:0"><a href="${escapeHtml(url)}" style="color:#111312;font-weight:600">Open FollowUp</a></p>` +
        foot.html
    ),
  };
}

export function moreWaitingEmail(base: string): EmailContent {
  const url = `${base}/dashboard`;
  const foot = footer(base);
  const line =
    `FollowUp has emailed you about ${DAILY_EMAIL_CAP} customers today, so it will stop emailing about each one until tomorrow. ` +
    "Everyone who is waiting is in FollowUp, with a reply ready.";
  return {
    subject: "More customers are waiting for your reply",
    text: [line, url, "", foot.text].join("\n"),
    html: wrapHtml(
      `<p style="margin:0 0 20px">${escapeHtml(line)}</p>` +
        `<p style="margin:0"><a href="${escapeHtml(url)}" style="color:#111312;font-weight:600">Open FollowUp</a></p>` +
        foot.html
    ),
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

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export type AlertRunResult = {
  /** Waiting customers found this tick that were news to at least one person. */
  customers: number;
  emails: number;
  pushes: number;
  summaries: number;
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
    select: { leadId: true, waitStartedAt: true },
  });
  const told = new Set(already.map((a) => `${a.leadId}|${a.waitStartedAt?.getTime()}`));

  // Claim before sending: the unique index decides, so a second tick that
  // races this one finds the row and skips rather than alerting twice.
  const claimed: { customer: WaitingCustomer; rowId: string }[] = [];
  for (const c of mine) {
    if (told.has(`${c.leadId}|${c.waitStartedAt.getTime()}`)) continue;
    try {
      const row = await prisma.ownerAlert.create({
        data: { userId: user.id, businessId: c.businessId, leadId: c.leadId, waitStartedAt: c.waitStartedAt, kind: "customer" },
        select: { id: true },
      });
      claimed.push({ customer: c, rowId: row.id });
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
      const sent = await sendAlertEmail({ to: user.email, ...moreWaitingEmail(base), idempotencyKey: note.id });
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
    }
    return sent.sent;
  };

  const push = async (payload: PushPayload): Promise<boolean> => {
    if (!channels.push) return false;
    const r = await sendPushToUser(user.id, payload);
    result.pushes += r.delivered;
    return r.delivered > 0;
  };

  if (claimed.length > HOLD_BURST_THRESHOLD) {
    // The burst. Every claimed customer is now "told" by this one line, so
    // none of them is named later on its own.
    const summary = await prisma.ownerAlert.create({
      data: { userId: user.id, businessId: user.businessId as string, kind: "summary" },
      select: { id: true },
    });
    const emailed = await email(summaryEmail(claimed.length, base), summary.id);
    const pushed = await push(summaryPush(claimed.length));
    if (emailed || pushed) {
      await prisma.ownerAlert.update({
        where: { id: summary.id },
        data: { ...(emailed ? { emailedAt: new Date() } : {}), ...(pushed ? { pushedAt: new Date() } : {}) },
      });
    }
    result.summaries += 1;
    return;
  }

  for (const { customer, rowId } of claimed) {
    const emailed = await email(customerEmail(customer, base), rowId);
    const pushed = await push(customerPush(customer));
    if (emailed || pushed) {
      await prisma.ownerAlert.update({
        where: { id: rowId },
        data: { ...(emailed ? { emailedAt: new Date() } : {}), ...(pushed ? { pushedAt: new Date() } : {}) },
      });
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
  const result: AlertRunResult = { customers: 0, emails: 0, pushes: 0, summaries: 0 };
  const channels = { email: isAlertEmailConfigured(), push: isPushConfigured() };
  if (!channels.email && !channels.push) return { ...result, skipped: "no alert channel is configured" };

  const waiting = await findWaitingCustomers(now);
  if (waiting.length === 0) return result;

  const byUser = await groupByRecipient(waiting);
  const users = await prisma.user.findMany({
    where: { id: { in: [...byUser.keys()] } },
    // Only what an alert needs. The business relation is narrowed to its
    // timezone so this never pulls (and decrypts) the channel tokens on
    // the Business row.
    select: { id: true, email: true, businessId: true, alertEmailEnabled: true, business: { select: { timezone: true } } },
  });

  for (const user of users) {
    try {
      await alertOne(user, byUser.get(user.id) ?? [], now, channels, result);
    } catch (err) {
      console.error(`Owner alerts failed for user ${user.id}:`, err);
    }
  }
  return result;
}
