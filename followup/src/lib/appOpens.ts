import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

/**
 * "Did they open FollowUp today?" (founder, 2026-10-04: build the last
 * opened tracking). Until this, nothing recorded a person looking at the
 * app: a tester could stop opening it for a week and the only sign was
 * replies piling up. One "app.open" event per person per local day, in the
 * existing audit log, so no schema change: who, which business, when.
 * Nothing about what they looked at.
 *
 * The client pings once per browser day (SeenPing); this is the server's
 * own once-per-day guard, so a second device or a cleared browser never
 * writes a second row for the same day.
 */
export const APP_OPEN = "app.open";

/** The calendar day of `at` in `timeZone`, as YYYY-MM-DD. */
export function localDay(at: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

/** Records today's open for this person unless one is already on file. Returns whether it wrote. */
export async function recordAppOpen(ctx: { businessId: string; userId: string }, now: Date = new Date()): Promise<boolean> {
  const [business, last] = await Promise.all([
    prisma.business.findUnique({ where: { id: ctx.businessId }, select: { timezone: true } }),
    prisma.auditEvent.findFirst({
      where: { userId: ctx.userId, action: APP_OPEN, createdAt: { gte: new Date(now.getTime() - 36 * 60 * 60_000) } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);
  const tz = business?.timezone ?? "America/Toronto";
  if (last && localDay(last.createdAt, tz) === localDay(now, tz)) return false;
  return recordAudit(ctx, APP_OPEN);
}

/** `timeZone` is the business's, so "today" means their calendar day. */
export type Opened = { last: Date | null; daysOf7: number; timeZone?: string };

/**
 * From a person's open times: the newest, and on how many of the last
 * seven days (today included) they opened it. Days are counted in the
 * business's time zone, the same one the record was deduplicated in.
 */
export function summariseOpens(times: Date[], now: Date, timeZone: string): Opened {
  if (times.length === 0) return { last: null, daysOf7: 0, timeZone };
  const last = times.reduce((a, b) => (b > a ? b : a));
  const week = new Set<string>();
  for (let i = 0; i < 7; i++) week.add(localDay(new Date(now.getTime() - i * 24 * 60 * 60_000), timeZone));
  const days = new Set(times.map((t) => localDay(t, timeZone)).filter((d) => week.has(d)));
  return { last, daysOf7: days.size, timeZone };
}
