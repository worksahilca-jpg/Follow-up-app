import { prisma } from "@/lib/db";
import { LIVE_STATUS, WAITING_STATUS, learningEventWrite } from "@/lib/learning";
import { deleteConversation, rollBackExample } from "@/lib/training";
import { dropTrainingRule } from "@/lib/trainingRules";
import { changeViews, coversExactly, hasLessonTest, type CaseOutcome, type ChangeView } from "@/lib/lessonTestResult";
import { RULES_IN_PROMPT } from "@/lib/trainingRuleLines";
import { REPLY_CASES } from "@/lib/replyEval";

/**
 * A-319 (2026-10-23): "Waiting for your OK" on Admin → Train → Talk to it. Every rule and example the founder teaches
 * waits here (status TESTING) until they put it to work. For a kind of business with test messages (realtors today),
 * that needs a test that covered exactly what is waiting now (src/lib/lessonTest.ts), and one where something got
 * worse needs "Put them to work anyway". For any other kind the founder's OK is the whole step, and the page says so.
 * Putting them to work, or dropping them, is one LearningEvent each (src/lib/learning.ts). Founder-only callers.
 */

export type WaitingItem = {
  /** Names the lesson as tested: a change of wording, or of a conversation's examples, makes it a different key. */
  key: string;
  kind: "rule" | "example" | "conversation";
  id: string;
  trade: string;
  /** "Rule", "New wording", "Taught reply", "Good answer", "Conversation added". */
  label: string;
  /** The rule, or the business's reply. For a conversation, its place and how many examples it gives. */
  text: string;
  /** What the customer said, for an example. */
  said: string | null;
  /** The words in use that new wording replaces. */
  replaces: string | null;
  at: Date;
};

const CHANNEL: Record<string, string> = { email: "Email", instagram: "Instagram", messenger: "Messenger", whatsapp: "WhatsApp", text: "Text" };

/** What waits for the founder's OK, oldest first (the order it was taught). One kind, or every kind. */
export async function listWaiting(trade?: string): Promise<WaitingItem[]> {
  const where = { status: WAITING_STATUS, ...(trade ? { trade } : {}) };
  const [rules, examples] = await Promise.all([
    prisma.trainingRule.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: 200,
      select: { id: true, trade: true, text: true, version: true, replacesId: true, createdAt: true },
    }),
    prisma.trainingExample.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: 500,
      select: {
        id: true,
        trade: true,
        channel: true,
        conversationId: true,
        customerSaid: true,
        reply: true,
        verdict: true,
        createdAt: true,
        conversation: { select: { source: true } },
      },
    }),
  ]);
  const replacedIds = rules.map((r) => r.replacesId).filter((x): x is string => !!x);
  const replaced = replacedIds.length
    ? new Map(
        (await prisma.trainingRule.findMany({ where: { id: { in: replacedIds } }, select: { id: true, text: true } })).map((r) => [r.id, r.text])
      )
    : new Map<string, string>();

  const items: WaitingItem[] = rules.map((r) => ({
    key: `rule:${r.id}:${r.version}`,
    kind: "rule",
    id: r.id,
    trade: r.trade,
    label: r.replacesId ? "New wording" : "Rule",
    text: r.text,
    said: null,
    replaces: r.replacesId ? (replaced.get(r.replacesId) ?? null) : null,
    at: r.createdAt,
  }));

  // A pasted conversation is one change, however many examples it gives; Drop takes it out for good.
  const pasted = new Map<string, typeof examples>();
  for (const e of examples) {
    if (e.conversation?.source === "pasted") pasted.set(e.conversationId, [...(pasted.get(e.conversationId) ?? []), e]);
    else
      items.push({
        key: `example:${e.id}`,
        kind: "example",
        id: e.id,
        trade: e.trade,
        label: e.verdict === "agent" ? "Taught reply" : "Good answer",
        text: e.reply,
        said: e.customerSaid,
        replaces: null,
        at: e.createdAt,
      });
  }
  for (const [conversationId, rows] of pasted) {
    items.push({
      key: `conversation:${conversationId}:${rows.length}`,
      kind: "conversation",
      id: conversationId,
      trade: rows[0].trade,
      label: "Conversation added",
      text: `${CHANNEL[rows[0].channel] ?? rows[0].channel} · ${rows.length} ${rows.length === 1 ? "example" : "examples"}`,
      said: null,
      replaces: null,
      at: rows[0].createdAt,
    });
  }
  return items.sort((a, b) => a.at.getTime() - b.at.getTime());
}

export type LessonTestRow = {
  id: string;
  trade: string;
  lessons: string[];
  status: string;
  cases: number;
  tries: number;
  passedWithout: number | null;
  passedWith: number | null;
  better: number | null;
  worse: number | null;
  results: unknown;
  error: string | null;
  createdAt: Date;
  finishedAt: Date | null;
};

/** The newest test for each kind, finished or not. */
export async function latestTests(): Promise<Map<string, LessonTestRow>> {
  const rows = await prisma.lessonTest.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  const out = new Map<string, LessonTestRow>();
  for (const r of rows) if (!out.has(r.trade)) out.set(r.trade, r);
  return out;
}

/** A test still "running" after this long died with its request (a deploy, a timeout): it counts as failed. */
export const TEST_STALE_MS = 6 * 60_000;

export type TestView = {
  id: string;
  at: string;
  status: "running" | "done" | "failed";
  cases: number;
  tries: number;
  passedWithout: number;
  passedWith: number;
  better: number;
  worse: number;
  /** It covered exactly what waits now; otherwise the founder has to test again. */
  current: boolean;
  error: string | null;
  changes: ChangeView[];
};

export function testView(row: LessonTestRow, waitingKeys: readonly string[], now = Date.now()): TestView {
  const stale = row.status === "running" && now - row.createdAt.getTime() > TEST_STALE_MS;
  const status = stale ? "failed" : row.status === "done" ? "done" : row.status === "running" ? "running" : "failed";
  const cases = Array.isArray(row.results) ? (row.results as CaseOutcome[]) : [];
  return {
    id: row.id,
    at: row.createdAt.toISOString(),
    status,
    cases: row.cases,
    tries: row.tries,
    passedWithout: row.passedWithout ?? 0,
    passedWith: row.passedWith ?? 0,
    better: row.better ?? 0,
    worse: row.worse ?? 0,
    current: status === "done" && coversExactly(row.lessons, waitingKeys),
    error: stale ? "The test stopped before it finished. Test again." : row.error,
    changes: status === "done" ? changeViews(cases) : [],
  };
}

export type PutToWorkResult = { ok: true; count: number } | { ok: false; reason: "nothing" | "untested" | "worse" };

/**
 * "Put them to work": every waiting lesson of this kind becomes ACTIVE at once, in one transaction with its history.
 * New wording takes over from the rule it replaces, which is rolled back (kept, so it can be put back).
 */
export async function putToWork(trade: string, byUserId: string | null, opts: { anyway?: boolean } = {}): Promise<PutToWorkResult> {
  const waiting = await listWaiting(trade);
  if (waiting.length === 0) return { ok: false, reason: "nothing" };
  let note = "Put to work by the founder; there is no reply test for this kind yet (A-319).";
  let tested: string | null = null;
  if (hasLessonTest(trade)) {
    const test = await prisma.lessonTest.findFirst({ where: { trade, status: "done" }, orderBy: { createdAt: "desc" } });
    if (!test || !coversExactly(test.lessons, waiting.map((w) => w.key))) return { ok: false, reason: "untested" };
    if ((test.worse ?? 0) > 0 && !opts.anyway) return { ok: false, reason: "worse" };
    tested = `${test.passedWith ?? 0} of ${test.cases}`;
    note =
      `Put to work by the founder after test ${test.id}: ${test.passedWithout ?? 0} of ${test.cases} without, ${tested} with` +
      ((test.worse ?? 0) > 0 ? `; worse on ${test.worse}, put to work anyway (A-319).` : " (A-319).");
  }
  const now = new Date();
  const after = { tested };
  await prisma.$transaction(async (tx) => {
    for (const w of waiting) {
      if (w.kind === "rule") {
        const rule = await tx.trainingRule.findFirst({ where: { id: w.id, status: WAITING_STATUS }, select: { version: true, replacesId: true } });
        if (!rule) continue;
        await tx.trainingRule.updateMany({ where: { id: w.id, status: WAITING_STATUS }, data: { status: LIVE_STATUS, approvedById: byUserId, approvedAt: now } });
        await learningEventWrite(tx, { trade, kind: "training_rule", targetId: w.id, action: "approved", fromStatus: WAITING_STATUS, toStatus: LIVE_STATUS, version: rule.version, after, byUserId, note });
        if (rule.replacesId) {
          const { count } = await tx.trainingRule.updateMany({ where: { id: rule.replacesId, status: LIVE_STATUS }, data: { status: "ROLLED_BACK", endedAt: now } });
          if (count > 0) {
            await learningEventWrite(tx, {
              trade,
              kind: "training_rule",
              targetId: rule.replacesId,
              action: "rolled_back",
              fromStatus: LIVE_STATUS,
              toStatus: "ROLLED_BACK",
              byUserId,
              note: `Replaced by its new wording, rule ${w.id} (A-319).`,
            });
          }
        }
      } else {
        const ids =
          w.kind === "example"
            ? [w.id]
            : (await tx.trainingExample.findMany({ where: { conversationId: w.id, status: WAITING_STATUS }, select: { id: true } })).map((e) => e.id);
        for (const id of ids) {
          const { count } = await tx.trainingExample.updateMany({ where: { id, status: WAITING_STATUS }, data: { status: LIVE_STATUS, approvedById: byUserId, approvedAt: now } });
          if (count > 0) {
            await learningEventWrite(tx, { trade, kind: "training_example", targetId: id, action: "approved", fromStatus: WAITING_STATUS, toStatus: LIVE_STATUS, after, byUserId, note });
          }
        }
      }
    }
  });
  return { ok: true, count: waiting.length };
}

/** "Drop": one waiting lesson never goes in use. A pasted conversation is taken out for good, with its examples. */
export async function dropWaiting(key: string, byUserId: string | null): Promise<boolean> {
  const [kind, id] = key.split(":");
  if (!id) return false;
  if (kind === "rule") return dropTrainingRule(id, byUserId);
  if (kind === "example") return rollBackExample(id, byUserId);
  if (kind === "conversation") {
    const waiting = await prisma.trainingExample.count({ where: { conversationId: id, status: WAITING_STATUS } });
    return waiting > 0 ? deleteConversation(id, byUserId) : false;
  }
  return false;
}

/** "Drop them": everything waiting for this kind. */
export async function dropAllWaiting(trade: string, byUserId: string | null): Promise<number> {
  let dropped = 0;
  for (const w of await listWaiting(trade)) if (await dropWaiting(w.key, byUserId)) dropped += 1;
  return dropped;
}

/** For each kind with lessons waiting: how many, and its newest test in a few numbers (Admin → Decide). */
export async function waitingSummary(): Promise<
  { trade: string; waiting: number; hasTest: boolean; test: Pick<TestView, "status" | "current" | "passedWithout" | "passedWith" | "cases" | "worse"> | null }[]
> {
  const [items, tests] = await Promise.all([listWaiting(), latestTests()]);
  const byTrade = new Map<string, WaitingItem[]>();
  for (const w of items) byTrade.set(w.trade, [...(byTrade.get(w.trade) ?? []), w]);
  return [...byTrade.entries()].map(([trade, list]) => {
    const row = tests.get(trade);
    const view = row ? testView(row, list.map((w) => w.key)) : null;
    return {
      trade,
      waiting: list.length,
      hasTest: hasLessonTest(trade),
      test: view ? { status: view.status, current: view.current, passedWithout: view.passedWithout, passedWith: view.passedWith, cases: view.cases, worse: view.worse } : null,
    };
  });
}

/** One kind's waiting lessons as the Train page shows them. */
export type WaitingView = {
  items: (Omit<WaitingItem, "at"> & { at: string })[];
  test: TestView | null;
  hasTest: boolean;
  /** How many test messages this kind's test answers (0 with no test). */
  testSize: number;
  /** Rules in use that stop being read when these are put to work: a draft reads only the newest RULES_IN_PROMPT. */
  dropsOut: string[];
};

/** Every kind with something waiting, keyed by kind (Admin → Train → Talk to it). */
export async function trainWaitingViews(): Promise<Record<string, WaitingView>> {
  const [items, tests] = await Promise.all([listWaiting(), latestTests()]);
  const byTrade = new Map<string, WaitingItem[]>();
  for (const w of items) byTrade.set(w.trade, [...(byTrade.get(w.trade) ?? []), w]);
  const out: Record<string, WaitingView> = {};
  for (const [trade, list] of byTrade) {
    const row = tests.get(trade);
    const added = list.filter((w) => w.kind === "rule" && !w.replaces).length;
    let dropsOut: string[] = [];
    if (added > 0) {
      const inUse = await prisma.trainingRule.findMany({
        where: { trade, status: LIVE_STATUS },
        orderBy: { createdAt: "desc" },
        select: { text: true },
      });
      const over = inUse.length + added - RULES_IN_PROMPT;
      if (over > 0) dropsOut = inUse.slice(-over).map((r) => r.text).reverse();
    }
    out[trade] = {
      items: list.map((w) => ({ ...w, at: w.at.toISOString() })),
      test: row ? testView(row, list.map((w) => w.key)) : null,
      hasTest: hasLessonTest(trade),
      testSize: hasLessonTest(trade) ? REPLY_CASES.length : 0,
      dropsOut,
    };
  }
  return out;
}

/** For rules in use: what their test said when they were put to work ("13 of 20"), when there was one. */
export async function testedWhenPutToWork(ruleIds: string[]): Promise<Map<string, string>> {
  if (ruleIds.length === 0) return new Map();
  const events = await prisma.learningEvent.findMany({
    where: { kind: "training_rule", action: "approved", targetId: { in: ruleIds }, businessId: null },
    orderBy: { createdAt: "asc" },
    select: { targetId: true, after: true },
  });
  const out = new Map<string, string>();
  for (const e of events) {
    const tested = e.after && typeof e.after === "object" && "tested" in e.after ? (e.after as { tested?: unknown }).tested : null;
    if (typeof tested === "string" && tested) out.set(e.targetId, tested);
  }
  return out;
}
