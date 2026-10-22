import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { FIRST_QUESTION_AFTER_MS, WHAT_YOU_DO_LABEL } from "@/lib/dailyQuestion";
import { labelKey, type FactLine } from "@/lib/factLines";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { summarizeTellProfile, wordTellQuestion } from "@/lib/integrations/openai";
import {
  checkedRead,
  checkedWording,
  knowsLine,
  mergeRows,
  parseTellDraft,
  playbackRows,
  showTellCard,
  tellState,
  usageLines,
  type Playback,
  type TellState,
  type TellTopic,
} from "@/lib/tellFollowUp";

/** How long the owner waits for a question worded for their business before the plain one is asked instead. */
const WORDING_WAIT_MS = 4000;

/**
 * The question to ask now, worded for this business when FollowUp can (A-313), the plain one otherwise. The opener,
 * and any question while nothing is known yet, stay plain: there is nothing to fit the words to. Counts toward the
 * daily AI ceiling. Never throws, and never keeps the owner waiting more than a few seconds.
 */
export async function wordedTopic(businessId: string, topic: TellTopic | null, facts: readonly FactLine[]): Promise<TellTopic | null> {
  if (!topic) return null;
  if (labelKey(topic.label) === labelKey(WHAT_YOU_DO_LABEL) || facts.length === 0) return topic;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const { AI_RUNS_PER_BUSINESS_PER_DAY } = await import("@/lib/scoring");
    if (await tooManyRecentActions(businessId, "ai.run", AI_RUNS_PER_BUSINESS_PER_DAY)) return topic;
    const late = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), WORDING_WAIT_MS);
    });
    const proposed = await Promise.race([wordTellQuestion(topic, facts), late]);
    return checkedWording(proposed, topic) ?? topic;
  } catch (err) {
    console.error(`Could not word a "Tell FollowUp" question for business ${businessId}:`, err instanceof Error ? err.message : err);
    return topic;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Where this business's conversation is (src/lib/tellFollowUp.ts), from what FollowUp knows, what this meeting already
 * took (A-314) and what was skipped.
 */
export async function loadTellState(businessId: string, again = false): Promise<TellState | null> {
  const [business, facts] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { industry: true, questionsSkipped: true, tellDraft: true } }),
    prisma.businessFact.findMany({
      where: { businessId, approvedAt: { not: null } },
      orderBy: { createdAt: "asc" },
      select: { label: true, value: true },
    }),
  ]);
  if (!business) return null;
  return tellState(business.industry, facts, business.questionsSkipped ?? [], again, parseTellDraft(business.tellDraft).rows);
}

/** Adds what FollowUp took from an answer to the meeting's draft (A-314). Its read of the business is made again. */
export async function addToDraft(businessId: string, rows: readonly FactLine[]): Promise<void> {
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { tellDraft: true } });
  const draft = parseTellDraft(business?.tellDraft);
  await prisma.business.update({
    where: { id: businessId },
    data: { tellDraft: { rows: mergeRows(draft.rows, rows) } },
  });
}

/** The meeting is over: what it took is in use, or it was let go. */
export async function clearDraft(businessId: string): Promise<void> {
  await prisma.business.update({ where: { id: businessId }, data: { tellDraft: Prisma.DbNull } });
}

/** How long the owner waits for FollowUp's read of the business before the play-back shows without it. */
const READ_WAIT_MS = 8000;

/**
 * The end of the meeting (A-314): the whole business as FollowUp understands it. FollowUp's read is made once per
 * draft and kept with it; when it can't be made, or doesn't only repeat what the owner said, the play-back shows the
 * owner's lines alone. Null when the meeting took nothing yet. Never throws over the read.
 */
export async function tellPlayback(businessId: string, state: TellState): Promise<Playback | null> {
  if (state.draft.length === 0) return null;
  const rows = playbackRows(state.facts, state.draft, state.topics.map((t) => t.label));
  const plain: FactLine[] = rows.map((r) => ({ label: r.label, value: r.value }));
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { tellDraft: true } });
  const draft = parseTellDraft(business?.tellDraft);
  let read = draft.read ? checkedRead(draft.read, plain) : null;
  if (!read) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const { AI_RUNS_PER_BUSINESS_PER_DAY } = await import("@/lib/scoring");
      if (!(await tooManyRecentActions(businessId, "ai.run", AI_RUNS_PER_BUSINESS_PER_DAY))) {
        const late = new Promise<null>((resolve) => {
          timer = setTimeout(() => resolve(null), READ_WAIT_MS);
        });
        read = checkedRead(await Promise.race([summarizeTellProfile(plain), late]), plain);
        if (read) await prisma.business.update({ where: { id: businessId }, data: { tellDraft: { rows: draft.rows, read } } });
      }
    } catch (err) {
      console.error(`Could not read back the business for ${businessId}:`, err instanceof Error ? err.message : err);
      read = null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  return { read, rows, uses: usageLines(rows, state.skipped), skipped: state.skipped };
}

export type TellCardProps = { knows: string };

/**
 * The card on Today (A-311), or null. Offered once, with the quiet rules of the one question a day (A-101): not in
 * the first hour, not while a question is resting. Never throws: Today never fails over a card.
 */
export async function tellCardOffer(businessId: string, now: Date = new Date()): Promise<TellCardProps | null> {
  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { createdAt: true, questionAfter: true, tellCardClosedAt: true },
    });
    if (!business || business.tellCardClosedAt) return null;
    if (now.getTime() - business.createdAt.getTime() < FIRST_QUESTION_AFTER_MS) return null;
    if (business.questionAfter && business.questionAfter > now) return null;
    const state = await loadTellState(businessId);
    if (!state || !showTellCard(state.open.length, business.tellCardClosedAt)) return null;
    return { knows: knowsLine(state.facts.length) };
  } catch (err) {
    console.error(`Could not check the "Tell FollowUp" card for business ${businessId}:`, err);
    return null;
  }
}
