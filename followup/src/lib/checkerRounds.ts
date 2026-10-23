import { prisma } from "@/lib/db";
import { MODEL } from "@/lib/integrations/openaiClient";
import { REPLY_CASES, runReplyTries, tradeLessons } from "@/lib/replyEval";
import { hasLessonTest, problemWords } from "@/lib/lessonTestResult";
import {
  advisoryChecks,
  agreement,
  agrees,
  CHECK_WORDS,
  checkTrust,
  isMarkCheck,
  type Agreement,
  type CheckTrust,
  type MarkCheck,
  type MarkedReply,
} from "@/lib/checkerTrust";

/**
 * Plan step 4 (A-321): the rounds of "Mark replies" on Admin → Train. FollowUp writes MARK_TRIES replies to each of a
 * kind's fixed test messages with the lessons in use, checks them the way the lesson test does, and keeps both; the
 * founder marks them one at a time. What the checker found is never sent to the page until the founder has marked
 * every reply in the round (src/lib/checkerTrust.ts compares the two). The messages are invented.
 */

/** Each test message is answered this many times: 20 messages, 60 replies. */
export const MARK_TRIES = 3;
/** A round still "writing" after this long stopped somewhere; the founder can start another. */
export const ROUND_STALE_MS = 6 * 60_000;
/** More replies than this that couldn't be written and the round isn't kept: too few left to mark. */
const MAX_LOST = 6;

export type StartRoundResult = { ok: true; id: string; replies: number } | { ok: false; reason: "no_test" | "running" | "failed"; message?: string };

export async function startRound(trade: string, byUserId: string | null): Promise<StartRoundResult> {
  if (!hasLessonTest(trade)) return { ok: false, reason: "no_test" };
  const busy = await prisma.checkerRound.findFirst({
    where: { trade, status: "writing", createdAt: { gt: new Date(Date.now() - ROUND_STALE_MS) } },
    select: { id: true },
  });
  if (busy) return { ok: false, reason: "running" };

  const round = await prisma.checkerRound.create({ data: { trade, model: MODEL, byUserId }, select: { id: true } });
  try {
    const written = await runReplyTries(await tradeLessons(trade), { tries: MARK_TRIES, concurrency: 5, cases: REPLY_CASES });
    // Every message once, then every message again: the same customer twice in a row reads like a repeat.
    const rows = [];
    for (let t = 0; t < MARK_TRIES; t++) {
      for (const c of written) {
        const tried = c.tries[t];
        if (!tried || tried.error || !tried.reply) continue;
        rows.push({ roundId: round.id, position: rows.length, caseName: c.name, said: c.said, reply: tried.reply, checker: tried.problems, hard: tried.hard });
      }
    }
    const lost = written.length * MARK_TRIES - rows.length;
    if (lost > MAX_LOST) {
      const message = `FollowUp couldn't write ${lost} of the ${written.length * MARK_TRIES} replies. Try again.`;
      await prisma.checkerRound.update({ where: { id: round.id }, data: { status: "failed", error: message, finishedAt: new Date() } });
      return { ok: false, reason: "failed", message };
    }
    await prisma.checkerReply.createMany({ data: rows });
    await prisma.checkerRound.update({ where: { id: round.id }, data: { status: "ready", finishedAt: new Date() } });
    return { ok: true, id: round.id, replies: rows.length };
  } catch (err) {
    console.error(`Mark-replies round ${round.id} for ${trade} failed:`, err instanceof Error ? err.message : err);
    const message = "FollowUp stopped before the replies were written. Try again.";
    await prisma.checkerRound.update({ where: { id: round.id }, data: { status: "failed", error: message, finishedAt: new Date() } }).catch(() => {});
    return { ok: false, reason: "failed", message };
  }
}

export type MarkVerdict = "send" | "fix" | "skip";

/**
 * Keeps what the founder said about one reply. What's wrong is kept only on "fix", and only the checks the page offers.
 * False when there's no such reply in a round that's ready.
 */
export async function markReply(id: string, verdict: MarkVerdict, marked: readonly string[]): Promise<boolean> {
  const picked = verdict === "fix" ? [...new Set(marked.filter((m) => isMarkCheck(m) || m === "other"))] : [];
  const updated = await prisma.checkerReply.updateMany({
    where: { id, round: { status: "ready" } },
    data: { verdict, marked: picked, markedAt: new Date() },
  });
  return updated.count > 0;
}

/** The founder's marks on this kind, for the model in use: a check is trusted for the model it was marked on. */
async function markedReplies(trade: string) {
  return prisma.checkerReply.findMany({
    where: { verdict: { not: null }, round: { trade, model: MODEL, status: "ready" } },
    orderBy: [{ markedAt: "asc" }],
    select: { id: true, said: true, reply: true, verdict: true, marked: true, checker: true, markedAt: true },
  });
}

/** The checks that are advice only for this kind right now (src/lib/lessonTest.ts sets them aside). */
export async function advisoryFor(trade: string): Promise<MarkCheck[]> {
  return advisoryChecks(await markedReplies(trade));
}

export type Disagreement = { id: string; said: string; reply: string; you: string; checker: string };

export type MarkView =
  | { state: "start"; error: string | null }
  | { state: "writing" }
  | { state: "marking"; reply: { id: string; said: string; reply: string }; number: number; total: number }
  | {
      state: "results";
      marked: number;
      lastMarkedAt: string | null;
      agreement: Agreement;
      checks: CheckTrust[];
      disagreements: Disagreement[];
    };

function you(r: MarkedReply): string {
  if (r.verdict === "send") return "You'd send it as it is.";
  const words = r.marked.map((m) => CHECK_WORDS[m as MarkCheck | "other"]).filter(Boolean);
  return words.length ? `You wouldn't send it: ${words.join(", ").toLowerCase()}.` : "You wouldn't send it.";
}

function checkerSaid(r: MarkedReply): string {
  if (r.checker.length === 0) return "The checker found nothing wrong.";
  return `The checker said it ${problemWords([{ reply: "", problems: [...r.checker] }])}.`;
}

/** What the Mark replies tab shows for a kind of business. Only a marked reply's checker reading leaves the server. */
export async function markView(trade: string, now: Date = new Date()): Promise<MarkView> {
  const latest = await prisma.checkerRound.findFirst({
    where: { trade },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, error: true, createdAt: true },
  });
  if (latest?.status === "writing" && now.getTime() - latest.createdAt.getTime() < ROUND_STALE_MS) return { state: "writing" };

  const open = await prisma.checkerRound.findFirst({
    where: { trade, status: "ready", replies: { some: { verdict: null } } },
    orderBy: { createdAt: "desc" },
    select: { id: true, _count: { select: { replies: true } } },
  });
  if (open) {
    const [next, done] = await Promise.all([
      prisma.checkerReply.findFirst({ where: { roundId: open.id, verdict: null }, orderBy: { position: "asc" }, select: { id: true, said: true, reply: true } }),
      prisma.checkerReply.count({ where: { roundId: open.id, verdict: { not: null } } }),
    ]);
    if (next) return { state: "marking", reply: next, number: done + 1, total: open._count.replies };
  }

  const replies = await markedReplies(trade);
  if (replies.length === 0) {
    return { state: "start", error: latest?.status === "failed" ? latest.error ?? "The last round stopped before it finished. Try again." : null };
  }
  const disagreements = replies
    .filter((r) => (r.verdict === "send" || r.verdict === "fix") && !agrees(r))
    .map((r) => ({ id: r.id, said: r.said, reply: r.reply, you: you(r), checker: checkerSaid(r) }));
  return {
    state: "results",
    marked: replies.length,
    lastMarkedAt: replies[replies.length - 1]?.markedAt?.toISOString() ?? null,
    agreement: agreement(replies),
    checks: checkTrust(replies),
    disagreements,
  };
}
