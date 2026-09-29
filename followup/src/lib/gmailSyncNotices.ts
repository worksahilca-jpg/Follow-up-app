import { prisma } from "@/lib/db";
import { gmailSelfAddress } from "@/lib/integrations/gmail";
import { sendAlertEmail } from "@/lib/alertEmail";
import { appUrl } from "@/lib/stripe";

/**
 * Telling the owner when their inbox stops feeding FollowUp.
 *
 * ## Why this exists (daily-path audit 2026-09-25, F6)
 *
 * While the Google app is in Testing mode, Google ends every refresh token
 * after seven days (research/integrations/2026-09-06-gmail-oauth-
 * verification.md). The periodic sync already parks such a connection at
 * `needs_reconnect` (src/lib/gmailSync.ts), and that part is right. What
 * followed was not: on any account with leads, the only place the owner
 * could find out was one line on Today, below everything else. No bell, no
 * email (the dead inbox is the only mailer). Leads kept arriving in Gmail
 * and nothing picked them up, on day 7 of every tester's beta.
 *
 * Failures that are not a dead token were worse: `lastSyncError` was
 * written every tick and read by nothing, so an inbox that 403s on every
 * sync (an owner who unticked "Read" on Google's consent screen) stayed
 * "Connected" forever.
 *
 * ## The rule
 *
 * `brand-principles.md` #2: urgency is stated once, precisely, where it is
 * actionable. So each of these is one row in the bell per admin, and then
 * silence:
 *
 *  - **Token dead:** once per death. The row is written only by the tick
 *    whose update actually moved the connection from `connected` to
 *    `needs_reconnect` (see the caller). That transition happens once, the
 *    cron stops selecting the row after it, and only a reconnect moves it
 *    back — so the next notice needs a reconnect and a second death.
 *  - **Sync keeps failing:** once per streak, and only past
 *    SYNC_FAILING_NOTICE_AFTER_MS. A timeout or a Google blip clears
 *    itself in a tick or two, and telling an owner about it would teach
 *    them to ignore the bell.
 *
 * Best-effort like every other notification path: this runs inside the
 * sync cron's per-business catch, and failing to write a row must never
 * change what the sync itself records.
 */

/**
 * How long an inbox must have gone without a successful sync, failing on
 * consecutive ticks, before the owner is told. Two hours is sixty
 * two-minute ticks (twelve, when the sync ran every ten minutes — the
 * threshold is time, not a tick count, so the move to two minutes on
 * 2026-09-25 did not change it): long past a rate limit or a short Google incident,
 * short enough that a real, persistent break costs an afternoon rather
 * than a week. Not tuned against data; there is none yet, which is a
 * reason to keep it named here rather than inline.
 */
export const SYNC_FAILING_NOTICE_AFTER_MS = 2 * 60 * 60_000;

/**
 * The phrase that marks the "keeps failing" notice, so a later tick in the
 * same streak can see it was already sent. The same load-bearing-text
 * trade as STALE_APPROVAL_MARKER (src/lib/staleApprovals.ts), for the same
 * reason: no new column for a state that can be read off the text the
 * owner is already shown. Rewording it makes every inbox that is failing
 * right now eligible for one more notice.
 */
export const SYNC_FAILING_MARKER = "hasn't been able to check";

/** What the notices need to know about a connection, read before the failure is recorded. Never a token column. */
export type GmailSyncSnapshot = {
  lastSyncError: string | null;
  lastSyncedAt: Date | null;
  connectedAt: Date | null;
  accountEmail: string | null;
  user: { email: string };
};

/**
 * The business's connected Gmail, as it stood before this tick's failure
 * was written. Must be read first: whether the PREVIOUS tick also failed
 * lives in `lastSyncError`, which the caller is about to overwrite.
 */
export async function readGmailSyncSnapshot(businessId: string): Promise<GmailSyncSnapshot | null> {
  try {
    return await prisma.integration.findFirst({
      where: { provider: "gmail", status: "connected", user: { businessId } },
      // Selected column by column, never the whole row: src/lib/db.ts
      // decrypts token columns on read (audit F12).
      select: {
        lastSyncError: true,
        lastSyncedAt: true,
        connectedAt: true,
        accountEmail: true,
        user: { select: { email: true } },
      },
    });
  } catch (err) {
    console.error(`Could not read Gmail sync state for business ${businessId}:`, err);
    return null;
  }
}

/** Every admin on the business — the owner, on a solo account. The same recipients notifyNeglect falls back to. */
async function adminsOf(businessId: string): Promise<{ id: string; email: string }[]> {
  return prisma.user.findMany({ where: { businessId, role: "ADMIN" }, select: { id: true, email: true } });
}

async function adminIdsOf(businessId: string): Promise<string[]> {
  return (await adminsOf(businessId)).map((a) => a.id);
}

async function notifyEach(userIds: string[], message: string): Promise<void> {
  for (const userId of userIds) {
    // leadId is null: this is about the inbox, not one lead. The bell
    // already tolerates it (see the Notification model).
    await prisma.notification.create({ data: { userId, leadId: null, message } });
  }
}

function inboxLabel(snapshot: GmailSyncSnapshot | null): string {
  return snapshot ? gmailSelfAddress(snapshot) : "your Gmail inbox";
}

/**
 * The token is dead and the connection was just parked. The caller calls
 * this only from the tick that actually parked it; see the header.
 *
 * Names the seven-day limit because it is by far the likeliest cause
 * during the beta, and the likeliest to feel like FollowUp broke. It is
 * said as what Google does, not as the cause of this particular death:
 * an owner who removed access themselves gets the same, correct advice.
 */
export async function notifyGmailAccessLost(businessId: string, snapshot: GmailSyncSnapshot | null): Promise<void> {
  const message =
    `FollowUp lost access to ${inboxLabel(snapshot)}, so new emails there aren't being picked up. ` +
    `Reconnect Gmail in Settings to keep catching leads. ` +
    `While FollowUp is in beta, Google asks for this every 7 days.`;
  let admins: { id: string; email: string }[];
  try {
    admins = await adminsOf(businessId);
  } catch (err) {
    console.error(`Could not tell business ${businessId} that Gmail needs reconnecting:`, err);
    return;
  }
  try {
    await notifyEach(
      admins.map((a) => a.id),
      message
    );
  } catch (err) {
    console.error(`Could not tell business ${businessId} that Gmail needs reconnecting:`, err);
  }
  await emailGmailAccessLost(businessId, admins, snapshot);
}

/**
 * The bell alone reaches only an owner who opens FollowUp, and an owner
 * whose inbox stopped feeding it has least reason to (founder, 2026-09-28,
 * after seeing a teammate's Gmail dead since Sep 15 with nobody told). So
 * each admin also gets one email, from FollowUp's own address (the dead
 * inbox can't send it), with a button that starts the reconnect.
 *
 * Once per death, like the bell: the caller runs only on the tick that
 * parked the connection, and the idempotency key (the business and when
 * this connection was made) stops a retried tick from sending it twice.
 * Separate from the bell's try, so a failed notification row never costs
 * the email, and the other way round.
 */
async function emailGmailAccessLost(
  businessId: string,
  admins: { id: string; email: string }[],
  snapshot: GmailSyncSnapshot | null
): Promise<void> {
  const content = gmailReconnectEmail({ inbox: inboxLabel(snapshot), base: appUrl() });
  const connection = snapshot?.connectedAt?.getTime() ?? "unknown";
  for (const admin of admins) {
    if (!admin.email) continue;
    try {
      await sendAlertEmail({ to: admin.email, ...content, idempotencyKey: `gmail-lost-${businessId}-${connection}-${admin.id}` });
    } catch (err) {
      console.error(`Could not email business ${businessId} that Gmail needs reconnecting:`, err);
    }
  }
}

/**
 * How long Google lets a Gmail grant live while the Google app is in
 * Testing mode (research/integrations/2026-09-06-gmail-oauth-
 * verification.md). Set this to null the day Google verifies the app and
 * it is published: grants stop expiring, and the warning below goes quiet.
 */
export const GMAIL_GRANT_LIFETIME_MS: number | null = 7 * 24 * 60 * 60_000;

/** How far ahead of the end the owner is warned: a day, so there is time to see it. */
export const GMAIL_ENDING_WARNING_MS = 24 * 60 * 60_000;

/**
 * Marks the warning in the bell so it is said once per connection. The
 * same load-bearing-text trade as SYNC_FAILING_MARKER: rewording it makes
 * every inbox in its last day eligible for one more warning.
 */
export const GMAIL_ENDING_MARKER = "ends within a day";

/**
 * True in the last day of a Testing-mode grant (founder, 2026-09-28: warn
 * before it stops, not after). The grant's clock starts at the connect —
 * every connect asks Google for fresh consent (src/lib/integrations/
 * gmail.ts), so a reconnect restarts it.
 */
export function gmailAccessEndingSoon(connectedAt: Date | null | undefined, now: Date): boolean {
  if (GMAIL_GRANT_LIFETIME_MS === null || !connectedAt) return false;
  const endsAt = connectedAt.getTime() + GMAIL_GRANT_LIFETIME_MS;
  return now.getTime() >= endsAt - GMAIL_ENDING_WARNING_MS && now.getTime() < endsAt;
}

/**
 * The day-6 warning: one bell row and one email per admin, a day before
 * Google ends the grant, with the same one-press reconnect as the email
 * sent after it ends. Reconnecting now leaves no gap in which a
 * customer's email goes unseen, and restarts the seven days.
 *
 * Once per connection: a warning already in the bell since this connect
 * stops the next tick, and the email's key (business, connect time, admin)
 * stops a retried one. Never throws: it runs inside a sync that already
 * succeeded, and a warning that can't be written must not undo that.
 */
export async function warnGmailAccessEndingSoon(businessId: string, now: Date = new Date()): Promise<void> {
  // Every connected Gmail in the business, not just one: two admins can each
  // connect their own, a week apart, and an unordered read of "the" inbox
  // could pick the one that isn't ending and stay silent about the one that
  // is (audit 2026-09-29).
  let inboxes: GmailSyncSnapshot[];
  try {
    inboxes = await prisma.integration.findMany({
      where: { provider: "gmail", status: "connected", user: { businessId } },
      select: { lastSyncError: true, lastSyncedAt: true, connectedAt: true, accountEmail: true, user: { select: { email: true } } },
    });
  } catch (err) {
    console.error(`Could not read Gmail connections for business ${businessId}:`, err);
    return;
  }
  const ending = inboxes.filter((i) => gmailAccessEndingSoon(i.connectedAt, now));
  if (ending.length === 0) return;

  let admins: { id: string; email: string }[];
  try {
    admins = await adminsOf(businessId);
  } catch (err) {
    console.error(`Could not warn business ${businessId} that Gmail access ends soon:`, err);
    return;
  }
  if (admins.length === 0) return;

  for (const snapshot of ending) {
    const connectedAt = snapshot.connectedAt!;
    const inbox = inboxLabel(snapshot);
    try {
      const already = await prisma.notification.count({
        where: {
          userId: { in: admins.map((a) => a.id) },
          leadId: null,
          message: { contains: `${inbox} ${GMAIL_ENDING_MARKER}` },
          createdAt: { gte: connectedAt },
        },
      });
      if (already > 0) continue;
    } catch (err) {
      console.error(`Could not check whether business ${businessId} was warned that Gmail access ends soon:`, err);
      continue;
    }

    const message =
      `FollowUp's access to ${inbox} ${GMAIL_ENDING_MARKER}. ` +
      `Reconnect Gmail in Settings now so new emails keep being picked up without a gap. ` +
      `While FollowUp is in beta, Google asks for this every 7 days.`;
    try {
      await notifyEach(
        admins.map((a) => a.id),
        message
      );
    } catch (err) {
      console.error(`Could not warn business ${businessId} that Gmail access ends soon:`, err);
    }

    const content = gmailEndingSoonEmail({ inbox, base: appUrl() });
    for (const admin of admins) {
      if (!admin.email) continue;
      try {
        await sendAlertEmail({ to: admin.email, ...content, idempotencyKey: `gmail-ending-${businessId}-${connectedAt.getTime()}-${admin.id}` });
      } catch (err) {
        console.error(`Could not email business ${businessId} that Gmail access ends soon:`, err);
      }
    }
  }
}

/** The day-6 email. The reconnect email's shape, said a day earlier. */
export function gmailEndingSoonEmail(p: { inbox: string; base: string }): { subject: string; text: string; html: string } {
  return reconnectEmail({
    url: `${p.base}/api/integrations/gmail/connect`,
    title: "Reconnect Gmail today to keep catching customers",
    what: `FollowUp's access to ${p.inbox} ends within a day. Reconnect now and new customer emails keep coming in without a gap.`,
    how: "Reconnecting takes a few seconds: press the button and choose the same Google account.",
    why: "While FollowUp is in beta, Google asks for this every 7 days. That's Google's rule for apps still being verified, not something you did.",
    once: "FollowUp sends this once, a day before the connection ends.",
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

/** The reconnect email. Same shape and type as the sign-in alert (src/lib/signIns.ts). */
export function gmailReconnectEmail(p: { inbox: string; base: string }): { subject: string; text: string; html: string } {
  return reconnectEmail({
    url: `${p.base}/api/integrations/gmail/connect`,
    title: "Reconnect Gmail to keep catching customers",
    what: `FollowUp can't read ${p.inbox} right now, so new customer emails there aren't being picked up.`,
    how: "Reconnecting takes a few seconds: press the button and choose the same Google account.",
    why: "While FollowUp is in beta, Google asks for this every 7 days. That's Google's rule for apps still being verified, not something you did.",
    once: "FollowUp sends this once, only when the connection stops.",
  });
}

function reconnectEmail({
  url,
  title,
  what,
  how,
  why,
  once,
}: {
  url: string;
  title: string;
  what: string;
  how: string;
  why: string;
  once: string;
}): { subject: string; text: string; html: string } {
  return {
    subject: title,
    text: [title, "", what, "", how, `Reconnect Gmail: ${url}`, "", why, "", once].join("\n"),
    html:
      `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#0a0a0a;max-width:520px">` +
      `<p style="margin:0 0 8px;font-size:20px;line-height:1.3">${escapeHtml(title)}</p>` +
      `<p style="margin:0 0 16px;color:#57534e">${escapeHtml(what)}</p>` +
      `<p style="margin:0 0 20px">${escapeHtml(how)}</p>` +
      `<p style="margin:0 0 20px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px">Reconnect Gmail</a></p>` +
      `<p style="margin:0 0 24px;color:#736e68;font-size:13.5px">${escapeHtml(why)}</p>` +
      `<p style="margin:0;color:#736e68;font-size:13px">${escapeHtml(once)}</p>` +
      `</div>`,
  };
}

/**
 * When the streak this failure belongs to began, if it is long enough to
 * tell the owner about — otherwise null.
 *
 * - The tick before this one must have failed too. A successful sync
 *   always clears `lastSyncError` (syncGmailForBusiness), so a value here
 *   means at least two failures in a row, never a single blip.
 * - The streak starts at the last moment the inbox was known to work: the
 *   last successful sync, or the connect itself if that is later (a
 *   reconnect keeps the old lastSyncedAt).
 * - With neither on file there is no honest start to measure from, so it
 *   says nothing rather than guess.
 */
export function syncFailingSince(snapshot: GmailSyncSnapshot, now: Date): Date | null {
  if (!snapshot.lastSyncError) return null;
  const known = [snapshot.lastSyncedAt, snapshot.connectedAt].filter((d): d is Date => d instanceof Date);
  if (known.length === 0) return null;
  const lastKnownGood = new Date(Math.max(...known.map((d) => d.getTime())));
  if (now.getTime() - lastKnownGood.getTime() < SYNC_FAILING_NOTICE_AFTER_MS) return null;
  return lastKnownGood;
}

/**
 * A sync that failed for any reason other than a dead token. Tells the
 * admins once, when the streak crosses the threshold, and never again in
 * the same streak: a notice already written since the streak began is
 * found by its marker. A successful sync moves lastSyncedAt forward, so a
 * later streak starts a fresh window and can be told about in its turn.
 */
export async function notifyIfGmailSyncKeepsFailing(
  businessId: string,
  snapshot: GmailSyncSnapshot | null,
  now: Date = new Date()
): Promise<void> {
  if (!snapshot) return;
  const since = syncFailingSince(snapshot, now);
  if (!since) return;
  try {
    const admins = await adminIdsOf(businessId);
    if (admins.length === 0) return;
    const already = await prisma.notification.count({
      where: {
        userId: { in: admins },
        leadId: null,
        message: { contains: SYNC_FAILING_MARKER },
        createdAt: { gte: since },
      },
    });
    if (already > 0) return;

    const hours = Math.round(SYNC_FAILING_NOTICE_AFTER_MS / 3_600_000);
    const message =
      `FollowUp ${SYNC_FAILING_MARKER} ${inboxLabel(snapshot)} for over ${hours} hours, so new emails there may be missed. ` +
      `It keeps trying every 10 minutes. ` +
      `If this doesn't clear up, reconnect Gmail in Settings.`;
    await notifyEach(admins, message);
  } catch (err) {
    console.error(`Could not tell business ${businessId} that Gmail sync keeps failing:`, err);
  }
}
