import { prisma } from "@/lib/db";
import { sendAlertEmail } from "@/lib/alertEmail";
import { recordAudit } from "@/lib/audit";
import { GMAIL_PUBLISHED_AT } from "@/lib/gmailSyncNotices";
import { noticeDate, renderNoticeEmailHtml } from "@/lib/noticeEmailHtml";
import { appUrl } from "@/lib/stripe";

/**
 * Reminders when an inbox stays disconnected (founder, 2026-10-22: "fix all the weak points … do whatever you think is
 * best").
 *
 * The one notice at the break (gmailSyncNotices.ts for Gmail, outlook.ts for Outlook) was not enough: two testers'
 * Gmail sat disconnected for weeks (since Sep 13 and Oct 6) and neither reconnected. The owner who stopped opening
 * FollowUp is exactly the one who never sees the line inside it. So, once a day (the setup-health cron): a connection
 * that still needs reconnecting gets one email per admin 2 days after it last worked, and one more at 7 days. Then
 * nothing more, until it is reconnected and breaks again.
 *
 * This amends "say it once" (brand principle 2) for this one case only: twice more, each with the one-press fix.
 */
export const REMINDER_DAYS = [2, 7] as const;

/** The audit row that records a reminder went: the durable "already sent" (an email's idempotency key lasts a day). */
export const REMINDER_ACTION = "integration.reconnect_reminder";

const DAY = 86_400_000;

type Provider = "gmail" | "outlook";
const NAME: Record<Provider, string> = { gmail: "Gmail", outlook: "Outlook" };

/**
 * Which reminder is due, counting from 1: the latest one whose day has passed, unless it or a later one already went.
 * An inbox found long after it broke gets one reminder, the last, never two in a row.
 */
export function reminderDue(brokeAt: Date, now: Date, sent: readonly number[]): number | null {
  const days = (now.getTime() - brokeAt.getTime()) / DAY;
  let due: number | null = null;
  REMINDER_DAYS.forEach((d, i) => {
    if (days >= d) due = i + 1;
  });
  if (due === null) return null;
  const n: number = due;
  return sent.some((s) => s >= n) ? null : n;
}

/** The last moment the inbox was known to work: its last good sync, or the connect if that is later. */
export function brokeAtOf(c: { lastSyncedAt: Date | null; connectedAt: Date | null }): Date | null {
  const known = [c.lastSyncedAt, c.connectedAt].filter((d): d is Date => d instanceof Date);
  return known.length === 0 ? null : new Date(Math.max(...known.map((d) => d.getTime())));
}

export function reconnectReminderEmail(p: {
  provider: Provider;
  inbox: string;
  brokeAt: Date;
  connectedAt: Date | null;
  last: boolean;
  base: string;
  timeZone?: string;
}): { subject: string; text: string; html: string } {
  const name = NAME[p.provider];
  const tz = p.timeZone ?? "America/New_York";
  const since = noticeDate(p.brokeAt, tz);
  const url = `${p.base}/api/integrations/${p.provider}/connect`;
  const title = `${name} is still disconnected`;
  const what = `FollowUp hasn't been able to read ${p.inbox} since ${since}, so new customer emails there aren't being picked up.`;
  const how = "Reconnecting takes a few seconds: press the button and choose the same account.";
  const why =
    p.provider === "gmail" && p.connectedAt && p.connectedAt.getTime() < GMAIL_PUBLISHED_AT.getTime()
      ? "Connections made before October 3 ended after 7 days while Google reviewed FollowUp. Reconnect once and it stays connected."
      : `It can mean access was removed in your ${p.provider === "gmail" ? "Google" : "Microsoft"} account or the password changed.`;
  const footnote = p.last
    ? "This is the last reminder. FollowUp won't email about this again."
    : "FollowUp will remind you once more in a few days, then stop.";
  return {
    subject: title,
    text: [title, "", what, "", how, `Reconnect ${name}: ${url}`, "", why, "", footnote].join("\n"),
    html: renderNoticeEmailHtml({
      base: p.base,
      label: name,
      title,
      date: noticeDate(new Date(), tz),
      before: [what, how],
      button: { text: `Reconnect ${name}`, href: url },
      why,
      footnote,
    }),
  };
}

/**
 * Once a day: email the admins of every business whose Gmail or Outlook still needs reconnecting, on the reminder
 * that is due. Never throws for one business: each is tried on its own, and a failure is logged by business id only.
 */
export async function sendReconnectReminders(now: Date = new Date()): Promise<{ checked: number; emailed: number }> {
  const broken = await prisma.integration.findMany({
    where: { provider: { in: ["gmail", "outlook"] }, status: "needs_reconnect" },
    // Column by column, never the whole row: src/lib/db.ts decrypts token columns on read.
    select: {
      id: true,
      provider: true,
      connectedAt: true,
      lastSyncedAt: true,
      accountEmail: true,
      user: { select: { email: true, businessId: true } },
    },
    take: 500,
  });
  if (broken.length === 0) return { checked: 0, emailed: 0 };

  const past = await prisma.auditEvent.findMany({
    where: { action: REMINDER_ACTION, targetId: { in: broken.map((b) => b.id) } },
    select: { targetId: true, meta: true },
  });

  let emailed = 0;
  for (const c of broken) {
    const businessId = c.user.businessId;
    const provider = c.provider as Provider;
    const brokeAt = brokeAtOf(c);
    if (!businessId || !brokeAt || !(provider in NAME)) continue;
    // A reconnect makes a new connect time: reminders for an earlier break never count against a new one.
    const since = c.connectedAt?.toISOString() ?? "unknown";
    const sent = past
      .filter((p) => p.targetId === c.id)
      .map((p) => (p.meta && typeof p.meta === "object" ? (p.meta as Record<string, unknown>) : {}))
      .filter((m) => m.since === since && typeof m.n === "number")
      .map((m) => m.n as number);
    const due = reminderDue(brokeAt, now, sent);
    if (due === null) continue;

    try {
      // Already working again through another connection of the same kind: nothing to remind about.
      const working = await prisma.integration.count({ where: { provider, status: "connected", user: { businessId } } });
      if (working > 0) continue;
      const admins = await prisma.user.findMany({
        where: { businessId, role: "ADMIN" },
        select: { id: true, email: true, business: { select: { timezone: true } } },
      });
      const content = reconnectReminderEmail({
        provider,
        inbox: c.accountEmail ?? c.user.email ?? `your ${NAME[provider]} inbox`,
        brokeAt,
        connectedAt: c.connectedAt,
        last: due === REMINDER_DAYS.length,
        base: appUrl(),
        timeZone: admins[0]?.business?.timezone,
      });
      let went = false;
      for (const admin of admins) {
        if (!admin.email) continue;
        const result = await sendAlertEmail({
          to: admin.email,
          ...content,
          idempotencyKey: `reconnect-reminder-${c.id}-${since}-${due}-${admin.id}`,
        });
        if (result.sent) {
          went = true;
          emailed++;
        }
      }
      if (went) {
        await recordAudit({ businessId }, REMINDER_ACTION, { targetType: "integration", targetId: c.id, meta: { n: due, since } });
      }
    } catch (err) {
      console.error(`Could not send a reconnect reminder for business ${businessId}:`, err);
    }
  }
  return { checked: broken.length, emailed };
}
