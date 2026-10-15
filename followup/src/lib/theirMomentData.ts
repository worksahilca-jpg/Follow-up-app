/**
 * "Their moment" (A-262), the database side: once an hour (the automation
 * cron), customers whose named time has come get one note written from
 * their own words and held on Today for the owner's OK. Nothing is sent
 * from here. The pure parts are in src/lib/theirMoment.ts.
 */
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { heldSince } from "@/lib/pendingApprovals";
import { writeMomentNote } from "@/lib/integrations/openai";
import { leadLanguageOf } from "@/lib/leadLanguage";
import { withStopLine } from "@/lib/stayInTouch";
import { THEIR_MOMENT_TRIGGER, mayWriteMoment, momentMonth, saidWhen } from "@/lib/theirMoment";
import type { Message } from "@/lib/types";

/** Meta's rule: an Instagram or Messenger customer can't be written to on their own more than a day after their last message. */
const META_WINDOW_HOURS = 24;
/** Moments one tick handles; the rest wait for the next hour. */
const MAX_PER_TICK = 20;

export type MomentResult = {
  /** Notes held on Today. */
  written: number;
  /** Left for the next tick: a draft already waiting, or the daily AI ceiling. */
  waiting: number;
  /** Moments that passed without a note (no consent any more, or unreachable), marked so they aren't tried again. */
  skipped: number;
  /** The AI failed; tried again next tick. */
  failed: number;
};

type Flat = { direction: "inbound" | "outbound"; body: string; sentAt: Date; channel: string; trigger: string | null; quickReplyPayload: string | null; id: string };

function flatten(conversations: { channel: string; messages: { id: string; direction: string; body: string; sentAt: Date; trigger: string | null; quickReplyPayload: string | null }[] }[]): Flat[] {
  return conversations
    .flatMap((c) => c.messages.map((m) => ({ ...m, direction: m.direction === "inbound" ? ("inbound" as const) : ("outbound" as const), channel: c.channel })))
    .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
}

function asMessage(m: Flat): Message {
  return { id: m.id, direction: m.direction, body: m.body, date: m.sentAt.toISOString(), trigger: m.trigger ?? undefined, quickReplyPayload: m.quickReplyPayload ?? undefined } as Message;
}

async function markPassed(leadId: string, businessId: string, now: Date, reason: string): Promise<void> {
  await prisma.lead.update({ where: { id: leadId }, data: { momentNoteAt: now } });
  void recordAudit({ businessId, userId: null }, "lead.moment.passed", { targetType: "lead", targetId: leadId, meta: { reason } });
}

export async function writeMomentNotesForAllBusinesses(now: Date = new Date()): Promise<MomentResult> {
  const result: MomentResult = { written: 0, waiting: 0, skipped: 0, failed: 0 };
  const leads = await prisma.lead.findMany({
    where: { momentAt: { lte: now }, momentNoteAt: null, optedOutAt: null, stage: { notIn: ["WON", "LOST"] }, automationTier: { not: "OFF" } },
    orderBy: { momentAt: "asc" },
    take: MAX_PER_TICK,
    include: {
      business: { select: { id: true, name: true, industry: true, timezone: true } },
      conversations: { include: { messages: { orderBy: { sentAt: "asc" } } } },
    },
  });
  if (leads.length === 0) return result;
  // Imported here, not at the top: scoring imports theirMoment's pure side, and this file imports pendingApprovals.
  const { AI_RUNS_PER_LEAD_PER_DAY, AI_RUNS_PER_BUSINESS_PER_DAY } = await import("@/lib/scoring");

  for (const l of leads) {
    const ctx = { businessId: l.businessId, userId: null as string | null };
    const first = l.name.trim().split(/\s+/)[0] || l.name;
    const timeZone = l.business.timezone ?? "America/New_York";
    try {
      const messages = flatten(l.conversations);
      const lastIn = [...messages].reverse().find((m) => m.direction === "inbound");
      if (!l.momentAt || !l.momentQuote || !mayWriteMoment(l, lastIn?.sentAt ?? null, now)) {
        await markPassed(l.id, l.businessId, now, "no_consent");
        result.skipped++;
        continue;
      }
      const dmOnly = lastIn && (lastIn.channel === "instagram" || lastIn.channel === "messenger") && !l.email && !l.dmEmail;
      if (dmOnly && (now.getTime() - lastIn.sentAt.getTime()) / 3_600_000 > META_WINDOW_HOURS) {
        await markPassed(l.id, l.businessId, now, "unreachable");
        result.skipped++;
        continue;
      }
      // Something already waits for the owner on this customer: the moment keeps until it is answered.
      if (await heldSince(l.businessId, l.id, new Date(0)).catch(() => true)) {
        result.waiting++;
        continue;
      }
      const capped =
        (await tooManyRecentActions(l.businessId, `ai.run:${l.id}`, AI_RUNS_PER_LEAD_PER_DAY)) ||
        (await tooManyRecentActions(l.businessId, "ai.run", AI_RUNS_PER_BUSINESS_PER_DAY));
      if (capped) {
        result.waiting++;
        continue;
      }
      const dm = lastIn?.channel === "instagram" || lastIn?.channel === "messenger" || lastIn?.channel === "whatsapp" || lastIn?.channel === "text";
      const out = await writeMomentNote({
        business: { name: l.business.name, industry: l.business.industry },
        firstName: first,
        conversation: messages.map(asMessage),
        quote: l.momentQuote,
        saidWhen: l.momentSaidAt ? saidWhen(l.momentSaidAt, now, timeZone) : "earlier",
        month: momentMonth(now, timeZone),
        dm,
        leadLanguage: leadLanguageOf(l),
      });
      await prisma.lead.update({
        where: { id: l.id },
        data: {
          suggestedMessage: withStopLine(out.note, l.language),
          suggestedSubject: null,
          suggestedQuickReplies: undefined,
          suggestedDraftKind: THEIR_MOMENT_TRIGGER,
          suggestedDraftedFor: now,
          suggestedRiskLevel: null,
          suggestedRiskReason: null,
          suggestedRiskTopic: null,
          momentNoteAt: now,
        },
      });
      const held = await recordAudit(ctx, "ai.hold", {
        targetType: "lead",
        targetId: l.id,
        meta: {
          riskLevel: "owner",
          reason: `Why now: ${out.why}`,
          trigger: THEIR_MOMENT_TRIGGER,
          quote: l.momentQuote,
          saidOn: l.momentSaidAt ? l.momentSaidAt.toISOString() : null,
        },
      });
      if (held === false) throw new Error("hold not recorded");
      result.written++;
    } catch (err) {
      console.error(`Could not write a moment note for lead ${l.id}:`, err);
      result.failed++;
    }
  }
  return result;
}

/** The owner picks another day for the moment, or none ("Change" on the customer's page). */
export async function ownerSetsMoment(businessId: string, leadId: string, userId: string | null, at: Date | null): Promise<boolean> {
  const res = await prisma.lead.updateMany({
    where: { id: leadId, businessId },
    data: at ? { momentAt: at, momentNoteAt: null } : { momentAt: null, momentQuote: null, momentSaidAt: null, momentNoteAt: null },
  });
  if (res.count > 0) {
    void recordAudit({ businessId, userId }, "lead.moment.changed", { targetType: "lead", targetId: leadId, meta: { at: at ? at.toISOString() : null } });
  }
  return res.count > 0;
}
