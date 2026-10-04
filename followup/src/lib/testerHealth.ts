/**
 * "Is it working for them?" on /admin (founder, 2026-09-28: grow only once
 * FollowUp "actually helps the users": email and Meta connected, follow-up
 * working, learning side by side). Five checks per beta tester, each read
 * from rows FollowUp already writes, so the Oct 25 checkpoint is a count,
 * not a feeling:
 *
 *  1. Connected: an inbox (Gmail or Outlook) AND Instagram or Facebook.
 *  2. Inbox checked lately: the inbox's last successful sync is recent.
 *     This stands in for "no message missed"; FollowUp can't know what it
 *     never saw, only that it has been looking.
 *  3. Drafts sent as written: of the replies sent from a FollowUp draft in
 *     the window, at least half went out without edits. Too few sends is
 *     said as too few, never as a pass or a fail.
 *  4. Learning: "Write like me" is on for the business.
 *  5. A customer won back: someone replied to a message FollowUp sent on
 *     its own in the window (src/lib/rescued.ts's definition, unchanged).
 *
 * Founder-only and cross-tenant, gated like admin-data.ts. Only counts and
 * dates leave here, never a message.
 */

import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platformAdmin";
import { getRescueReport } from "@/lib/rescued";
import { APP_OPEN, localDay, summariseOpens, type Opened } from "@/lib/appOpens";

export const WINDOW_DAYS = 30;
/** The sync cron runs every two minutes; half an hour without a good sync is a stall, not a blip. */
export const INBOX_FRESH_MS = 30 * 60_000;
export const MIN_DRAFTS = 3;
export const AS_WRITTEN_TARGET = 0.5;

export type CheckState = "ok" | "not_yet" | "no";
export type Check = { state: CheckState; text: string };

export type TesterFacts = {
  id: string;
  name: string;
  email: string;
  business: string | null;
  signedIn: boolean;
  inbox: { provider: string; status: string; lastSyncedAt: Date | null } | null;
  meta: { instagram: boolean; facebook: boolean };
  drafts: { sent: number; asWritten: number };
  writeLikeMe: { on: boolean; kept: number };
  wonBack: number;
  /** When they last opened FollowUp, and on how many of the last 7 days (src/lib/appOpens.ts). */
  opened?: Opened;
};

export type TesterHealth = {
  id: string;
  name: string;
  email: string;
  business: string | null;
  score: number;
  checks: { connected: Check; inbox: Check; drafts: Check; learning: Check; wonBack: Check };
  /** The first check not passed, in the order above: what to help with next. */
  next: string | null;
  /** "Opened today · 5 of 7 days", or "Not opened since tracking began". Not part of the score. */
  opened: string;
};

export type TesterHealthReport = {
  testers: TesterHealth[];
  working: number;
  summary: string;
};

const LABEL: Record<keyof TesterHealth["checks"], string> = {
  connected: "Gmail connected",
  inbox: "Inbox checked lately",
  drafts: "Drafts sent as written",
  learning: "Learning their writing",
  wonBack: "A customer won back",
};

/** Each check, said as the gap it leaves, for the summary sentence. */
const GAP: Record<keyof TesterHealth["checks"], string> = {
  connected: "Gmail not connected",
  inbox: "inbox not checked lately",
  drafts: "too few drafts sent as written",
  learning: "Write like me off",
  wonBack: "no customer won back yet",
};

function ago(from: Date, now: Date): string {
  const min = Math.max(0, Math.round((now.getTime() - from.getTime()) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

/** The habit line: when they last opened it, and how many of the last seven days. */
export function openedLine(o: Opened | undefined, now: Date): string {
  if (!o?.last) return "Not opened since tracking began";
  const tz = o.timeZone ?? "America/Toronto";
  // Calendar days in the business's zone, so 11 pm yesterday is "yesterday".
  const days = Math.round((Date.parse(localDay(now, tz)) - Date.parse(localDay(o.last, tz))) / (24 * 60 * 60_000));
  const when = days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
  return `Opened ${when} · ${o.daysOf7} of 7 days`;
}

function inboxName(provider: string): string {
  return provider === "outlook" ? "Outlook" : "Gmail";
}

export function judgeTester(t: TesterFacts, now: Date): TesterHealth {
  const inboxOn = t.inbox?.status === "connected";
  const metaOn = t.meta.instagram || t.meta.facebook;
  const metaName = [t.meta.instagram && "Instagram", t.meta.facebook && "Facebook"].filter(Boolean).join(" and ");

  // Gmail first (founder, 2026-10-04: "yes change it to gmail connected"):
  // until Meta approves Instagram and Messenger, the inbox alone is what
  // "connected" means. A Meta channel already on is named, never required.
  const connected: Check = !t.signedIn
    ? { state: "no", text: "Hasn't signed in" }
    : inboxOn
      ? { state: "ok", text: metaOn ? `${inboxName(t.inbox!.provider)}, and ${metaName}` : inboxName(t.inbox!.provider) }
      : { state: "no", text: t.inbox ? `${inboxName(t.inbox.provider)} stopped` : "No email connected" };

  const inbox: Check = !inboxOn
    ? { state: "no", text: t.inbox ? `${inboxName(t.inbox.provider)} stopped, not checked` : "No inbox to check" }
    : !t.inbox!.lastSyncedAt
      ? { state: "not_yet", text: "First check pending" }
      : now.getTime() - t.inbox!.lastSyncedAt.getTime() <= INBOX_FRESH_MS
        ? { state: "ok", text: `Checked ${ago(t.inbox!.lastSyncedAt, now)}` }
        : { state: "no", text: `Last checked ${ago(t.inbox!.lastSyncedAt, now)}` };

  const share = t.drafts.sent > 0 ? t.drafts.asWritten / t.drafts.sent : 0;
  const drafts: Check =
    t.drafts.sent < MIN_DRAFTS
      ? { state: "not_yet", text: t.drafts.sent === 0 ? "None sent yet" : `Only ${t.drafts.sent} sent` }
      : { state: share >= AS_WRITTEN_TARGET ? "ok" : "no", text: `${t.drafts.asWritten} of ${t.drafts.sent} as written` };

  const learning: Check = t.writeLikeMe.on
    ? { state: "ok", text: t.writeLikeMe.kept > 0 ? `Write like me · ${t.writeLikeMe.kept} replies` : "Write like me · reading" }
    : { state: "no", text: "Write like me off" };

  const wonBack: Check =
    t.wonBack > 0
      ? { state: "ok", text: t.wonBack === 1 ? "1 customer" : `${t.wonBack} customers` }
      : { state: "not_yet", text: "None yet" };

  const checks = { connected, inbox, drafts, learning, wonBack };
  const score = Object.values(checks).filter((c) => c.state === "ok").length;
  const firstGap = (Object.keys(checks) as (keyof typeof checks)[]).find((k) => checks[k].state !== "ok");
  return {
    id: t.id,
    name: t.name,
    email: t.email,
    business: t.business,
    score,
    checks,
    next: firstGap ? `${LABEL[firstGap]}: ${checks[firstGap].text}` : null,
    opened: openedLine(t.opened, now),
  };
}

/** Least working first, so the tester who needs help is at the top. */
export function buildTesterHealth(facts: TesterFacts[], now: Date): TesterHealthReport {
  const testers = facts.map((t) => judgeTester(t, now)).sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  const working = testers.filter((t) => t.score === 5).length;
  let summary: string;
  if (testers.length === 0) summary = "No testers yet.";
  else {
    const gaps = new Map<string, number>();
    for (const t of testers)
      for (const k of Object.keys(t.checks) as (keyof TesterHealth["checks"])[])
        if (t.checks[k].state !== "ok") gaps.set(k, (gaps.get(k) ?? 0) + 1);
    const [topKey, topCount] = [...gaps.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    summary =
      `${working} of ${testers.length} ${testers.length === 1 ? "tester has" : "testers have"} FollowUp fully working.` +
      (topKey ? ` Most common gap: ${GAP[topKey as keyof TesterHealth["checks"]]} (${topCount} of ${testers.length}).` : "");
  }
  return { testers, working, summary };
}

export async function getTesterHealth(now: Date = new Date()): Promise<TesterHealthReport> {
  await requirePlatformAdmin();
  const since = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60_000);

  const testers = await prisma.accessRequest.findMany({
    where: { status: "approved" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, name: true, email: true, business: true },
  });
  const users = testers.length
    ? await prisma.user.findMany({ where: { email: { in: testers.map((t) => t.email) } }, select: { id: true, email: true, businessId: true } })
    : [];
  const userIdByEmail = new Map(users.map((u) => [u.email, u.id]));
  const bizByEmail = new Map(users.map((u) => [u.email, u.businessId]));
  const bizIds = [...new Set(users.map((u) => u.businessId).filter((id): id is string => !!id))];

  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
  const [inboxes, businesses, draftRows, kept, rescued, opens, lastOpens] = await Promise.all([
    prisma.integration.findMany({
      where: { provider: { in: ["gmail", "outlook"] }, user: { businessId: { in: bizIds } } },
      // Column by column: src/lib/db.ts decrypts token columns on read.
      select: { provider: true, status: true, lastSyncedAt: true, user: { select: { businessId: true } } },
    }),
    prisma.business.findMany({
      where: { id: { in: bizIds } },
      select: { id: true, instagramUserId: true, facebookPageId: true, pastRepliesAllowedAt: true, timezone: true },
    }),
    // Two counts per tester business: groupBy can't reach through the
    // lead relation to the business, and there are at most 100 testers.
    // draftEdited is null when a send had no draft behind it, so only
    // replies FollowUp drafted are counted.
    Promise.all(
      bizIds.map(async (businessId) => {
        const [sent, asWritten] = await Promise.all([
          prisma.followUp.count({ where: { status: "sent", sentAt: { gte: since }, draftEdited: { not: null }, lead: { businessId } } }),
          prisma.followUp.count({ where: { status: "sent", sentAt: { gte: since }, draftEdited: false, lead: { businessId } } }),
        ]);
        return { businessId, sent, asWritten };
      })
    ),
    prisma.pastReply.groupBy({ by: ["businessId"], where: { businessId: { in: bizIds } }, _count: { _all: true } }),
    Promise.all(bizIds.map(async (businessId) => ({ businessId, rescued: (await getRescueReport(businessId, WINDOW_DAYS, now)).rescued }))),
    // This week's opens, for the days count, and each person's newest ever.
    prisma.auditEvent.findMany({
      where: { action: APP_OPEN, userId: { in: users.map((u) => u.id) }, createdAt: { gte: weekAgo } },
      select: { userId: true, createdAt: true },
    }),
    prisma.auditEvent.groupBy({ by: ["userId"], where: { action: APP_OPEN, userId: { in: users.map((u) => u.id) } }, _max: { createdAt: true } }),
  ]);

  const bizById = new Map(businesses.map((b) => [b.id, b]));
  const draftsBy = new Map(draftRows.map((d) => [d.businessId, d]));
  const keptBy = new Map(kept.map((k) => [k.businessId, k._count._all]));
  const rescuedBy = new Map(rescued.map((r) => [r.businessId, r.rescued]));
  const opensBy = new Map<string, Date[]>();
  for (const o of opens) if (o.userId) opensBy.set(o.userId, [...(opensBy.get(o.userId) ?? []), o.createdAt]);
  const lastOpenBy = new Map(lastOpens.map((l) => [l.userId, l._max.createdAt]));

  const facts: TesterFacts[] = testers.map((t) => {
    const businessId = bizByEmail.get(t.email) ?? null;
    const b = businessId ? bizById.get(businessId) : undefined;
    const own = inboxes.filter((i) => i.user.businessId === businessId);
    // A connected inbox wins over a stopped one when a business has both.
    const inbox = own.find((i) => i.status === "connected") ?? own[0] ?? null;
    const d = businessId ? draftsBy.get(businessId) : undefined;
    return {
      id: t.id,
      name: t.name,
      email: t.email,
      business: t.business,
      signedIn: !!businessId,
      inbox: inbox ? { provider: inbox.provider, status: inbox.status, lastSyncedAt: inbox.lastSyncedAt } : null,
      meta: { instagram: !!b?.instagramUserId, facebook: !!b?.facebookPageId },
      drafts: { sent: d?.sent ?? 0, asWritten: d?.asWritten ?? 0 },
      writeLikeMe: { on: !!b?.pastRepliesAllowedAt, kept: (businessId && keptBy.get(businessId)) || 0 },
      wonBack: (businessId && rescuedBy.get(businessId)) || 0,
      opened: (() => {
        const userId = userIdByEmail.get(t.email);
        if (!userId) return undefined;
        const tz = b?.timezone ?? "America/Toronto";
        const week = summariseOpens(opensBy.get(userId) ?? [], now, tz);
        return { last: lastOpenBy.get(userId) ?? week.last, daysOf7: week.daysOf7, timeZone: tz };
      })(),
    };
  });

  return buildTesterHealth(facts, now);
}
