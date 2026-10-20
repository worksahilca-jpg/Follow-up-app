import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hasActiveAccess } from "@/lib/billing";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { CRM_PROVIDERS } from "@/lib/crm";
import type { CrmNote } from "@/lib/crm/types";
import { moveLeadForTier, tierMoveWhy } from "@/lib/crm/stages";
import { extractQualificationFacts } from "@/lib/integrations/openai";
import { customerTexts, mergeQualification, readQualification, templateFor } from "@/lib/qualification";
import { byTranscriptOrder } from "@/lib/transcript";
import type { Message } from "@/lib/types";

/**
 * "Read my notes" (A-303, founder 2026-10-20: "Yes" to the drawing). The first realtor makes his calls through
 * GoHighLevel, which keeps a note of each, and asked that a call that changes a customer's plans moves them too. So
 * FollowUp reads the owner's own notes on each customer in GoHighLevel, as evidence for where they stand (Ready, Warm,
 * Later), and their stage follows (src/lib/crm/stages.ts).
 *
 *  - Only the owner's notes: FollowUp's own ("FollowUp sent: …", "FollowUp: … looks ready to talk.") are never read.
 *  - Only new ones: each customer remembers up to which note's time it has read (Lead.crmNotesSeenAt). On the first
 *    look, the last 30 days.
 *  - A little at a time: after each GoHighLevel poll, up to LEADS_PER_RUN customers whose notes weren't looked at in
 *    the last NOTES_EVERY_MS. Looking costs one GoHighLevel request; reading new notes costs one model call, counted
 *    like any other against the daily ceilings.
 *  - No message is drafted or sent from a note, and nobody is buzzed: the owner wrote it, so the owner knows.
 */

export const NOTES_EVERY_MS = 2 * 60 * 60 * 1000;
export const LEADS_PER_RUN = 10;
const ACTIVE_DAYS = 90;
const FIRST_LOOK_DAYS = 30;
const MAX_NOTES = 5;
const MAX_NOTE_CHARS = 1200;
const DAY_MS = 24 * 60 * 60 * 1000;

/** FollowUp's own notes, which it never reads back (src/lib/sending.ts, src/lib/crm/notes.ts). */
export function isFollowUpNote(body: string): boolean {
  return /^\s*FollowUp( sent)?:/.test(body);
}

/** The owner's notes newer than what was read before (on the first look, the last 30 days), oldest first, the latest few. */
export function newOwnerNotes(notes: readonly CrmNote[], seenAt: Date | null, now: Date): CrmNote[] {
  const from = seenAt ?? new Date(now.getTime() - FIRST_LOOK_DAYS * DAY_MS);
  return notes
    .filter((n) => n.at && n.at > from && n.at <= now && n.body.trim() && !isFollowUpNote(n.body))
    .sort((a, b) => a.at!.getTime() - b.at!.getTime())
    .slice(-MAX_NOTES)
    .map((n) => ({ ...n, body: n.body.slice(0, MAX_NOTE_CHARS) }));
}

type NotesLead = Prisma.LeadGetPayload<{
  include: { conversations: { include: { messages: true } }; business: { select: { industry: true; askPlan: true } } };
}>;

/** One customer: look at their notes, read any new ones, and move them if where they stand changed. */
export async function readNotesForLead(lead: NotesLead, apiKey: string, now: Date = new Date()): Promise<"none" | "read" | "held"> {
  const client = CRM_PROVIDERS.gohighlevel.client;
  const template = templateFor(lead.business.industry, lead.business.askPlan);
  if (!template || !lead.crmId || !client.listNotes) return "none";
  const fresh = newOwnerNotes(await client.listNotes(apiKey, lead.crmId), lead.crmNotesSeenAt, now);
  if (fresh.length === 0) {
    await prisma.lead.update({ where: { id: lead.id }, data: { crmNotesCheckedAt: now } });
    return "none";
  }
  // A model call, counted like a reply's: when the day's ceiling is reached the notes wait, unread, for the next look.
  const { AI_RUNS_PER_LEAD_PER_DAY, AI_RUNS_PER_BUSINESS_PER_DAY } = await import("@/lib/scoring");
  if (
    (await tooManyRecentActions(lead.businessId, `ai.run:${lead.id}`, AI_RUNS_PER_LEAD_PER_DAY)) ||
    (await tooManyRecentActions(lead.businessId, "ai.run", AI_RUNS_PER_BUSINESS_PER_DAY))
  ) {
    await prisma.lead.update({ where: { id: lead.id }, data: { crmNotesCheckedAt: now } });
    return "held";
  }
  const conversation: Message[] = lead.conversations
    .flatMap((c) => c.messages.map((m) => ({ id: m.id, direction: m.direction as Message["direction"], channel: c.channel as Message["channel"], body: m.body, date: m.sentAt.toISOString() })))
    .sort(byTranscriptOrder);
  const extracted = await extractQualificationFacts(conversation, template.criteria, now, fresh).catch((err) => {
    console.error(`Reading notes for lead ${lead.id} failed:`, err instanceof Error ? err.message : err);
    return null;
  });
  // Not read: looked at again next time, from the same place.
  if (!extracted) {
    await prisma.lead.update({ where: { id: lead.id }, data: { crmNotesCheckedAt: now } });
    return "held";
  }
  const qualification = mergeQualification(template, readQualification(lead.qualification), extracted, customerTexts(conversation), null, fresh.map((n) => n.body));
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      qualification: qualification as unknown as Prisma.InputJsonValue,
      crmNotesCheckedAt: now,
      crmNotesSeenAt: fresh[fresh.length - 1].at,
    },
  });
  await moveLeadForTier(lead, qualification.tier, tierMoveWhy(qualification, qualification.tier));
  return "read";
}

/** After each GoHighLevel poll: a few customers' notes, for every business that reads them. Never throws per business. */
export async function readGhlNotesForAllBusinesses(now: Date = new Date()): Promise<{ looked: number; read: number; failed: number }> {
  const connections = await prisma.crmConnection.findMany({
    where: { provider: "gohighlevel", apiKey: { not: null }, readNotes: true },
    select: { businessId: true, apiKey: true, business: { select: { subscriptionStatus: true, industry: true } } },
  });
  let looked = 0;
  let read = 0;
  let failed = 0;
  const active = new Date(now.getTime() - ACTIVE_DAYS * DAY_MS);
  const due = new Date(now.getTime() - NOTES_EVERY_MS);
  for (const conn of connections) {
    if (!conn.apiKey || !hasActiveAccess(conn.business.subscriptionStatus) || !templateFor(conn.business.industry)) continue;
    try {
      const leads = await prisma.lead.findMany({
        where: {
          businessId: conn.businessId,
          crmProvider: "gohighlevel",
          crmId: { not: null },
          OR: [{ crmNotesCheckedAt: null }, { crmNotesCheckedAt: { lt: due } }],
          AND: [{ OR: [{ lastContacted: { gte: active } }, { createdAt: { gte: active } }] }],
        },
        orderBy: { crmNotesCheckedAt: { sort: "asc", nulls: "first" } },
        take: LEADS_PER_RUN,
        include: { conversations: { include: { messages: true } }, business: { select: { industry: true, askPlan: true } } },
      });
      for (const lead of leads) {
        looked++;
        if ((await readNotesForLead(lead, conn.apiKey, now)) === "read") read++;
      }
    } catch (err) {
      failed++;
      console.error(`Reading GoHighLevel notes failed for business ${conn.businessId}:`, err instanceof Error ? err.message : err);
    }
  }
  return { looked, read, failed };
}
