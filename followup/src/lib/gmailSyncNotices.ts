import { prisma } from "@/lib/db";
import { gmailSelfAddress } from "@/lib/integrations/gmail";

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
async function adminIdsOf(businessId: string): Promise<string[]> {
  const admins = await prisma.user.findMany({ where: { businessId, role: "ADMIN" }, select: { id: true } });
  return admins.map((a) => a.id);
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
  try {
    await notifyEach(await adminIdsOf(businessId), message);
  } catch (err) {
    console.error(`Could not tell business ${businessId} that Gmail needs reconnecting:`, err);
  }
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
