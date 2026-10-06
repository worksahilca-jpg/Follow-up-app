/**
 * "FollowUp learns what you do" (founder, 2026-10-06: "it should come to a
 * point where it acts like a clone of the user"; the drawing was approved
 * with "yes build it", A-099).
 *
 * A habit is something the owner keeps doing by hand that FollowUp could do
 * for them. FollowUp never starts doing it on its own: once the owner has done
 * the same thing SUGGEST_AFTER times in WINDOW_DAYS, Today asks once ("Stop
 * writing replies to messages like that?"). Only a yes changes anything; a no
 * is remembered and never asked again; Settings → Your business → "How you
 * work" lists every yes with Undo.
 *
 * Two habits, both learned from what the owner does on Today:
 *  - skip_thanks: "Don't send" on replies to messages that only say thanks
 *    (Lead.thanksOnlyAt, read with the score). On a yes, those customers are
 *    not drafted for or shown on Today while that is their newest message.
 *  - weekend_wait: "Later" on a weekend message, on the weekend. On a yes,
 *    weekend messages wait off Today until Monday 9 am, like a Later.
 *
 * The evidence is the audit trail itself (ai.hold_dismissed with
 * meta.thanksOnly, lead.later with meta.weekend), so nothing new is stored
 * until the owner answers.
 */

import { prisma } from "@/lib/db";
import { isLocalWeekend, mondayMorning } from "@/lib/later";

export const HABIT_KINDS = ["skip_thanks", "weekend_wait"] as const;
export type HabitKind = (typeof HABIT_KINDS)[number];
export type HabitDecision = "on" | "declined" | "off";

/** Times the owner has to do the same thing before Today asks. */
export const SUGGEST_AFTER = 4;
/** How far back those times are counted. */
export const WINDOW_DAYS = 30;

const EVIDENCE: Record<HabitKind, { action: string; flag: string }> = {
  skip_thanks: { action: "ai.hold_dismissed", flag: "thanksOnly" },
  weekend_wait: { action: "lead.later", flag: "weekend" },
};

export type HabitRow = { kind: HabitKind; status: HabitDecision; evidence: number; decidedAt: Date };
export type HabitSuggestion = { kind: HabitKind; count: number; example: string | null };

export function isHabitKind(value: unknown): value is HabitKind {
  return typeof value === "string" && (HABIT_KINDS as readonly string[]).includes(value);
}

/** This business's answered habits. Never throws: a failed read is "no habits", which changes nothing. */
export async function getHabits(businessId: string): Promise<HabitRow[]> {
  try {
    const rows = await prisma.ownerHabit.findMany({ where: { businessId }, select: { kind: true, status: true, evidence: true, decidedAt: true } });
    return (rows ?? []).filter((r): r is HabitRow => isHabitKind(r.kind));
  } catch (err) {
    console.error(`Could not read habits for business ${businessId}:`, err);
    return [];
  }
}

export function habitOn(habits: readonly HabitRow[], kind: HabitKind): boolean {
  return habits.some((h) => h.kind === kind && h.status === "on");
}

/** How many times in the window the owner did the thing behind `kind`. */
async function evidenceCount(businessId: string, kind: HabitKind, now: Date): Promise<number> {
  const { action, flag } = EVIDENCE[kind];
  return prisma.auditEvent.count({
    where: {
      businessId,
      action,
      createdAt: { gte: new Date(now.getTime() - WINDOW_DAYS * 86_400_000) },
      meta: { path: [flag], equals: true },
    },
  });
}

/** A short quote of the newest thanks-only message the owner skipped, for "like "Thanks, got it!"". */
async function thanksExample(businessId: string): Promise<string | null> {
  const event = await prisma.auditEvent.findFirst({
    where: { businessId, action: "ai.hold_dismissed", meta: { path: ["thanksOnly"], equals: true } },
    orderBy: { createdAt: "desc" },
    select: { targetId: true },
  });
  if (!event?.targetId) return null;
  const message = await prisma.message.findFirst({
    where: { direction: "inbound", conversation: { leadId: event.targetId, lead: { businessId } } },
    orderBy: { sentAt: "desc" },
    select: { body: true },
  });
  const text = message?.body?.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > 40 ? `${text.slice(0, 39)}…` : text;
}

/**
 * The one question Today asks, or null. At most one at a time, and never for
 * a habit the owner already answered, either way.
 */
export async function findHabitSuggestion(businessId: string, now: Date = new Date()): Promise<HabitSuggestion | null> {
  try {
    const answered = new Set((await getHabits(businessId)).map((h) => h.kind));
    for (const kind of HABIT_KINDS) {
      if (answered.has(kind)) continue;
      const count = await evidenceCount(businessId, kind, now);
      if (count < SUGGEST_AFTER) continue;
      return { kind, count, example: kind === "skip_thanks" ? await thanksExample(businessId) : null };
    }
    return null;
  } catch (err) {
    console.error(`Could not look for a habit to suggest for business ${businessId}:`, err);
    return null;
  }
}

/** Records the owner's answer. "on" and "declined" come from Today; "off" is Undo in Settings. */
export async function decideHabit(businessId: string, userId: string | null, kind: HabitKind, status: HabitDecision, now: Date = new Date()) {
  const evidence = status === "off" ? undefined : await evidenceCount(businessId, kind, now);
  return prisma.ownerHabit.upsert({
    where: { businessId_kind: { businessId, kind } },
    create: { businessId, kind, status, evidence: evidence ?? 0, decidedById: userId, decidedAt: now },
    update: { status, decidedById: userId, decidedAt: now, ...(evidence !== undefined ? { evidence } : {}) },
  });
}

/**
 * weekend_wait: until when a message that arrived at `messageAt` waits off
 * Today, or null when it doesn't. Only weekend messages, and only while it
 * is still that weekend: from Monday 9 am they are back like any other.
 */
export function weekendWaitUntil(messageAt: Date, now: Date, timeZone: string): Date | null {
  if (!isLocalWeekend(messageAt, timeZone)) return null;
  const until = mondayMorning(messageAt, timeZone);
  return now < until ? until : null;
}
