/**
 * Problems go on Today (A-270): an inbox FollowUp lost or can't check is the owner's to fix now, so it sits at the
 * top of Today until it's fixed or they press "Got it". Activity keeps the record (src/lib/activity.ts).
 *
 * Only account-wide notices (no customer on them): a problem with one customer already shows on Today as that
 * customer's row. "A reply is waiting" summaries are left out for the same reason (R-116).
 */
import { prisma } from "@/lib/db";
import { HOLD_SUMMARY_MARKER } from "@/lib/holdNotices";

/** A problem older than this has either been fixed or been seen; it stays in Activity. */
export const PROBLEM_DAYS = 3;
export const MAX_PROBLEMS = 3;

export type OpenProblem = { id: string; line: string; action: { label: string; href: string } | null };
type Notice = { id: string; message: string; createdAt: Date };
/** What the inboxes look like right now, to drop a notice the owner already fixed. */
export type InboxState = {
  gmail: { connected: boolean; needsReconnect: boolean; lastSyncedAt: Date | null };
  outlook: { connected: boolean };
  /** Today already shows "Replies and check-ins can't go out" with Reconnect Gmail. */
  cantSendShown: boolean;
};

/** The notice's first sentence: what happened. The rest (why, what else) is in Activity. */
export function firstSentence(message: string): string {
  const m = /^(.+?[.!?])(\s|$)/.exec(message.trim());
  return (m ? m[1] : message).trim();
}

/** The one thing to do, when the notice names it. */
export function problemAction(message: string): OpenProblem["action"] {
  if (/\breconnect gmail\b/i.test(message)) return { label: "Reconnect Gmail", href: "/settings#connections" };
  if (/\breconnect outlook\b/i.test(message)) return { label: "Reconnect Outlook", href: "/settings#connections" };
  if (/\breconnect\b/i.test(message)) return { label: "Open Connected apps", href: "/settings#connections" };
  return null;
}

/**
 * Still worth showing: not fixed since. A Gmail notice is fixed once Gmail is connected again and has checked the
 * inbox after it was written; an Outlook one once Outlook is connected. While Today's own can't-send box already
 * says Gmail is lost, the Gmail notice would only say it twice.
 */
export function stillOpen(n: Notice, s: InboxState): boolean {
  const aboutGmail = /\bgmail\b/i.test(n.message);
  const aboutOutlook = /\boutlook\b/i.test(n.message);
  if (aboutGmail) {
    if (s.cantSendShown) return false;
    const checkedSince = s.gmail.lastSyncedAt !== null && s.gmail.lastSyncedAt.getTime() > n.createdAt.getTime();
    if (s.gmail.connected && !s.gmail.needsReconnect && checkedSince) return false;
  }
  if (aboutOutlook && s.outlook.connected) return false;
  return true;
}

export async function openProblems(businessId: string, userId: string, state: InboxState, now = new Date()): Promise<OpenProblem[]> {
  const notices = await prisma.notification.findMany({
    where: {
      userId,
      user: { businessId },
      read: false,
      leadId: null,
      createdAt: { gte: new Date(now.getTime() - PROBLEM_DAYS * 24 * 60 * 60 * 1000) },
      NOT: { message: { contains: HOLD_SUMMARY_MARKER } },
    },
    select: { id: true, message: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: MAX_PROBLEMS * 3,
  });
  const seen = new Set<string>();
  const out: OpenProblem[] = [];
  for (const n of notices) {
    if (!stillOpen(n, state)) continue;
    const line = firstSentence(n.message);
    // The same problem told twice (a nightly re-check) is one line.
    if (seen.has(line)) continue;
    seen.add(line);
    out.push({ id: n.id, line, action: problemAction(n.message) });
    if (out.length >= MAX_PROBLEMS) break;
  }
  return out;
}
