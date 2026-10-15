/**
 * "Stay in touch" (A-260): the parts that read and write the database.
 * The rules themselves are in src/lib/stayInTouch.ts.
 */
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { heldSince } from "@/lib/pendingApprovals";
import { isOptOutMessage } from "@/lib/optOutKeywords";
import { isNotAnAnswer } from "@/lib/notAnAnswer";
import { closedTheLoop, followUpState, readFollowUpPlans, type TimelineMessage } from "@/lib/followUpPlans";
import { readQualification } from "@/lib/qualification";
import { classifyStayInTouchAnswer, writeStayInTouchNote, type StayAnswer } from "@/lib/integrations/openai";
import { leadLanguageOf } from "@/lib/leadLanguage";
import {
  MAX_NOTES_PER_NEWS,
  STAY_IN_TOUCH_TRIGGER,
  cleanStayDays,
  mayAskForNews,
  noteDue,
  withStopLine,
} from "@/lib/stayInTouch";
import type { Message } from "@/lib/types";

/** The welcome-back wait the plan reads; only its "welcome back" stop depends on it, which a yes never answers. */
const DEAD_LEAD_DAYS = 45;
/** Meta's window for a business to write on Instagram or Messenger. */
const META_WINDOW_HOURS = 24;

type RowMessage = { id: string; direction: string; body: string; sentAt: Date; trigger: string | null; quickReplyPayload: string | null };
type RowConversation = { channel: string; messages: RowMessage[] };

/** What judgeStayInTouchReply reads off the lead scoring already loaded. */
export type StayLead = {
  id: string;
  businessId: string;
  createdAt: Date;
  lastContacted: Date | null;
  followUpPlan: string | null;
  followUpNotBefore: Date | null;
  qualification: unknown;
  stayInTouchAt: Date | null;
  stayInTouchMessageId: string | null;
  stayInTouchNoteAt: Date | null;
  conversations: RowConversation[];
};

type Flat = RowMessage & { channel: string };

function flatten(conversations: RowConversation[]): Flat[] {
  return conversations
    .flatMap((c) => c.messages.map((m) => ({ ...m, channel: c.channel })))
    .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
}

function asMessage(m: Flat): Message {
  return { id: m.id, direction: m.direction === "inbound" ? "inbound" : "outbound", channel: m.channel as Message["channel"], body: m.body, date: m.sentAt.toISOString() };
}

/**
 * When the customer has just written: did they answer the plan's
 * close-the-loop question with a yes (start staying in touch), or answer a
 * stay-in-touch note by asking to stop (end it)? Anything else changes
 * nothing. Runs from scoring (src/lib/scoring.ts), inside its daily AI
 * ceiling, and only in those two moments, so it costs one small check on a
 * few messages, not one per message.
 *
 * Judged once per reply: the reply's id is kept in stayInTouchMessageId, so
 * scoring the same message again does not ask again.
 */
export async function judgeStayInTouchReply(lead: StayLead, plansJson: unknown, now: Date = new Date()): Promise<StayAnswer | null> {
  const all = flatten(lead.conversations);
  const newest = all[all.length - 1];
  if (!newest || newest.direction !== "inbound") return null;
  if (lead.stayInTouchMessageId === newest.id) return null;

  // The run of their messages since we last wrote: one answer, perhaps in two texts.
  let k = all.length - 1;
  while (k > 0 && all[k - 1].direction === "inbound") k--;
  const before = all.slice(0, k);
  const reply = all.slice(k);
  const asked = [...before].reverse().find((m) => m.direction === "outbound" && !isNotAnAnswer(m.trigger));
  if (!asked) return null;

  // STOP is consent, recorded by the capture path; it ends staying in touch without asking anyone.
  if (lead.stayInTouchAt && reply.some((m) => isOptOutMessage(m.body))) {
    await stopStaying(lead, newest.id, "stop");
    return "no";
  }

  let moment: "close" | "note" | null = null;
  if (lead.stayInTouchAt) {
    if (lead.stayInTouchNoteAt && asked.sentAt >= lead.stayInTouchNoteAt) moment = "note";
  } else {
    const plans = readFollowUpPlans(plansJson);
    const timeline: TimelineMessage[] = before.map((m) => ({ direction: m.direction, at: m.sentAt.getTime(), trigger: m.trigger, quickReplyPayload: m.quickReplyPayload }));
    const state = followUpState(
      timeline,
      (lead.lastContacted ?? lead.createdAt).getTime(),
      plans,
      {
        override: lead.followUpPlan,
        tier: readQualification(lead.qualification)?.tier ?? null,
        notBeforeMs: lead.followUpNotBefore ? lead.followUpNotBefore.getTime() : null,
        createdAtMs: lead.createdAt.getTime(),
      },
      reply[0].sentAt.getTime(),
      DEAD_LEAD_DAYS
    );
    if (closedTheLoop(state, plans)) moment = "close";
  }
  if (!moment) return null;

  const answer = await classifyStayInTouchAnswer({ asked: asked.body, reply: reply.map(asMessage) });
  if (moment === "close" && answer === "yes") {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { stayInTouchAt: now, stayInTouchMessageId: newest.id, stayInTouchNoteAt: null },
    });
    void recordAudit({ businessId: lead.businessId, userId: null }, "lead.stay_in_touch", {
      targetType: "lead",
      targetId: lead.id,
      meta: { decision: "yes" },
    });
  } else if (answer === "no" && lead.stayInTouchAt) {
    await stopStaying(lead, newest.id, "no");
  } else {
    // Judged, nothing to change: remember the message so it isn't asked about again.
    await prisma.lead.updateMany({ where: { id: lead.id, stayInTouchAt: lead.stayInTouchAt }, data: { stayInTouchMessageId: lead.stayInTouchAt ? lead.stayInTouchMessageId : newest.id } });
  }
  return answer;
}

async function stopStaying(lead: { id: string; businessId: string }, messageId: string, why: "stop" | "no") {
  await prisma.lead.update({ where: { id: lead.id }, data: { stayInTouchAt: null, stayInTouchMessageId: messageId } });
  void recordAudit({ businessId: lead.businessId, userId: null }, "lead.stay_in_touch", {
    targetType: "lead",
    targetId: lead.id,
    meta: { decision: why },
  });
}

/** The owner's "Stop staying in touch" on the customer's page. */
export async function ownerStopsStaying(businessId: string, leadId: string, userId: string | null): Promise<boolean> {
  const res = await prisma.lead.updateMany({ where: { id: leadId, businessId, stayInTouchAt: { not: null } }, data: { stayInTouchAt: null } });
  if (res.count > 0) {
    void recordAudit({ businessId, userId }, "lead.stay_in_touch", { targetType: "lead", targetId: leadId, meta: { decision: "owner_stopped" } });
  }
  return res.count > 0;
}

/** Who is staying in touch and could get a note now, for Today's question. */
export async function stayingSummary(businessId: string, now: Date = new Date()): Promise<{ total: number; due: { id: string; first: string }[]; days: number; askedAt: Date | null }> {
  const [business, leads] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { stayInTouchDays: true, stayInTouchAskedAt: true } }),
    prisma.lead.findMany({
      where: { businessId, stayInTouchAt: { not: null }, optedOutAt: null, stage: { notIn: ["WON", "LOST"] } },
      select: { id: true, name: true, stayInTouchNoteAt: true },
      orderBy: { stayInTouchAt: "asc" },
      take: 200,
    }),
  ]);
  const days = cleanStayDays(business?.stayInTouchDays);
  const due = leads.filter((l) => noteDue(l.stayInTouchNoteAt, days, now)).map((l) => ({ id: l.id, first: l.name.trim().split(/\s+/)[0] || l.name }));
  return { total: leads.length, due, days, askedAt: business?.stayInTouchAskedAt ?? null };
}

/** Should Today ask for news now? Someone is due a note, and it hasn't asked in half a period. */
export function shouldAskForNews(summary: { due: unknown[]; days: number; askedAt: Date | null }, now: Date = new Date()): boolean {
  return summary.due.length > 0 && mayAskForNews(summary.askedAt, summary.days, now);
}

export type NewsResult = {
  fit: string[];
  notFit: { first: string; why: string }[];
  notDue: number;
  waiting: number;
  unreachable: number;
  /** Notes FollowUp tried to write and couldn't (the AI failed): said plainly, never as "doesn't fit". */
  failed: number;
};

/**
 * The owner's news, as answered on Today: one note per customer staying in
 * touch that it fits, each held on Today for the owner's OK (an "ai.hold"
 * like every other waiting reply). Never sent from here.
 */
export async function writeStayNotes(ctx: { businessId: string; userId: string | null }, text: string, now: Date = new Date()): Promise<NewsResult> {
  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { name: true, industry: true, stayInTouchDays: true },
  });
  const result: NewsResult = { fit: [], notFit: [], notDue: 0, waiting: 0, unreachable: 0, failed: 0 };
  await prisma.business.update({ where: { id: ctx.businessId }, data: { stayInTouchAskedAt: now } });
  if (!business) return result;
  const days = cleanStayDays(business.stayInTouchDays);
  const news = await prisma.stayInTouchNews.create({ data: { businessId: ctx.businessId, text } });

  const leads = await prisma.lead.findMany({
    where: { businessId: ctx.businessId, stayInTouchAt: { not: null }, optedOutAt: null, stage: { notIn: ["WON", "LOST"] }, automationTier: { not: "OFF" } },
    orderBy: { stayInTouchAt: "asc" },
    take: 100,
    include: { conversations: { include: { messages: { orderBy: { sentAt: "asc" } } } } },
  });

  const todo: typeof leads = [];
  for (const l of leads) {
    if (l.saidNoAt && l.stayInTouchAt && l.saidNoAt > l.stayInTouchAt) continue;
    if (!noteDue(l.stayInTouchNoteAt, days, now)) {
      result.notDue++;
      continue;
    }
    if (await heldSince(ctx.businessId, l.id, new Date(0)).catch(() => true)) {
      result.waiting++;
      continue;
    }
    const messages = flatten(l.conversations);
    const lastIn = [...messages].reverse().find((m) => m.direction === "inbound");
    const dmOnly = lastIn && (lastIn.channel === "instagram" || lastIn.channel === "messenger") && !l.email && !l.dmEmail;
    if (dmOnly && (now.getTime() - lastIn.sentAt.getTime()) / 3_600_000 > META_WINDOW_HOURS) {
      result.unreachable++;
      continue;
    }
    todo.push(l);
  }

  // A few at a time: one AI call each, inside the same daily ceilings as every other AI run.
  // Imported here, not at the top: scoring imports this file (as businessFacts.ts does).
  const { AI_RUNS_PER_LEAD_PER_DAY, AI_RUNS_PER_BUSINESS_PER_DAY } = await import("@/lib/scoring");
  const batch = todo.slice(0, MAX_NOTES_PER_NEWS);
  for (let i = 0; i < batch.length; i += 4) {
    await Promise.all(
      batch.slice(i, i + 4).map(async (l) => {
        const first = l.name.trim().split(/\s+/)[0] || l.name;
        const capped =
          (await tooManyRecentActions(ctx.businessId, `ai.run:${l.id}`, AI_RUNS_PER_LEAD_PER_DAY)) ||
          (await tooManyRecentActions(ctx.businessId, "ai.run", AI_RUNS_PER_BUSINESS_PER_DAY));
        if (capped) {
          result.waiting++;
          return;
        }
        const messages = flatten(l.conversations);
        const lastIn = [...messages].reverse().find((m) => m.direction === "inbound");
        const dm = lastIn?.channel === "instagram" || lastIn?.channel === "messenger" || lastIn?.channel === "whatsapp" || lastIn?.channel === "text";
        try {
          const out = await writeStayInTouchNote({
            business: { name: business.name, industry: business.industry },
            firstName: first,
            conversation: messages.map(asMessage),
            news: text,
            dm,
            leadLanguage: leadLanguageOf(l),
          });
          if (!out.fits) {
            result.notFit.push({ first, why: out.why });
            return;
          }
          await prisma.lead.update({
            where: { id: l.id },
            data: {
              suggestedMessage: withStopLine(out.note, l.language),
              suggestedSubject: null,
              suggestedQuickReplies: undefined,
              suggestedDraftKind: STAY_IN_TOUCH_TRIGGER,
              suggestedDraftedFor: now,
              suggestedRiskLevel: null,
              suggestedRiskReason: null,
              suggestedRiskTopic: null,
              stayInTouchNoteAt: now,
            },
          });
          const held = await recordAudit(ctx, "ai.hold", {
            targetType: "lead",
            targetId: l.id,
            meta: { riskLevel: "owner", reason: `Why ${first}: ${out.why}`, trigger: STAY_IN_TOUCH_TRIGGER },
          });
          if (held === false) throw new Error("hold not recorded");
          result.fit.push(first);
        } catch (err) {
          console.error(`Could not write a stay-in-touch note for lead ${l.id}:`, err);
          result.failed++;
        }
      })
    );
  }
  result.waiting += Math.max(0, todo.length - batch.length);
  await prisma.stayInTouchNews.update({ where: { id: news.id }, data: { fits: result.fit.length } }).catch(() => {});
  void recordAudit(ctx, "business.stay_in_touch_news", {
    targetType: "business",
    targetId: ctx.businessId,
    meta: { fit: result.fit.length, notFit: result.notFit.length, notDue: result.notDue, waiting: result.waiting, unreachable: result.unreachable, failed: result.failed },
  });
  return result;
}

/** "Not now" on Today's question: asked, so it waits half a period. */
export async function newsNotNow(businessId: string, now: Date = new Date()): Promise<void> {
  await prisma.business.update({ where: { id: businessId }, data: { stayInTouchAskedAt: now } });
}

/** The owner's recent news, so the words the notes took from it aren't flagged as words nobody wrote. */
export async function recentNewsText(businessId: string, now: Date = new Date()): Promise<string> {
  try {
    const rows = await prisma.stayInTouchNews.findMany({
      where: { businessId, createdAt: { gte: new Date(now.getTime() - 60 * 86_400_000) } },
      select: { text: true },
      take: 20,
    });
    return rows.map((r) => r.text).join("\n");
  } catch {
    return "";
  }
}
