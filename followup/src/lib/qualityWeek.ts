import { prisma } from "@/lib/db";
import { founderEmails } from "@/lib/helpAlert";
import { sendAlertEmail } from "@/lib/alertEmail";

/**
 * How FollowUp did with real customers this week, in one place (night plan A6 + C2 + E3, 2026-10-31,
 * research/product/2026-10-31-make-followup-easy-to-train-and-fix.md).
 *
 * The accuracy tests say how FollowUp does on invented chats; this says how its drafts fared with real owners: sent as
 * written, changed first, or not sent, by the situation that produced them. Beside it, what FollowUp learned this
 * week (facts and lessons), what the AI cost for customers and for tests, which model versions answered (a new one is
 * flagged, because OpenAI can change a model under FollowUp), and the tests run.
 *
 * Counts only, across every business, never a message's words (founder, 2026-10-05, security review H1: Google's
 * Workspace data policy doesn't allow a person to read Gmail-derived messages to improve a product). Shown on
 * Admin → Usage, and emailed to the founder on Monday mornings with the weekly digest.
 */

const DAY = 86_400_000;
const WEEK = 7 * DAY;
/** How far back a model version counts as already seen, before it is called new. */
const MODEL_MEMORY_WEEKS = 6;

/** The situation that produced a send (FollowUp.trigger), in words. */
export const SITUATIONS: { trigger: string | null; label: string }[] = [
  { trigger: "instant_ack", label: "First reply to a new customer" },
  { trigger: "unanswered", label: "Reply to a message waiting for an answer" },
  { trigger: "silence", label: "Follow-up after they went quiet" },
  { trigger: "sequence", label: "Planned follow-up" },
  { trigger: "manual", label: "Sent by the owner" },
  { trigger: null, label: "Other" },
];

export type SendRow = { label: string; sent: number; asWritten: number; edited: number; typed: number; notSent: number; avgEdit: number | null };

export type QualityWeek = {
  from: string;
  to: string;
  sends: SendRow[];
  total: SendRow;
  learned: { factsLearned: number; factsTold: number; factsApproved: number; lessons: { what: string; count: number }[] };
  ai: { realCalls: number; realCostMicros: number; testCalls: number; testCostMicros: number; failedCalls: number; models: { model: string; calls: number }[]; newModels: string[] };
  tests: { runs: number; costMicros: number };
};

type FollowUpRow = { trigger: string | null; status: string; draftEdited: boolean | null; editSize: number | null };

/** Pure: the sends by situation. "Typed" is a send with no draft to compare (draftEdited null). */
export function sendRows(rows: readonly FollowUpRow[]): { sends: SendRow[]; total: SendRow } {
  const blank = (label: string): SendRow => ({ label, sent: 0, asWritten: 0, edited: 0, typed: 0, notSent: 0, avgEdit: null });
  const byLabel = new Map(SITUATIONS.map((s) => [s.label, { row: blank(s.label), editSum: 0, editN: 0 }]));
  const total = { row: blank("All"), editSum: 0, editN: 0 };
  const labelOf = (t: string | null) => SITUATIONS.find((s) => s.trigger === t)?.label ?? "Other";
  for (const r of rows) {
    const slots = [byLabel.get(labelOf(r.trigger))!, total];
    for (const slot of slots) {
      if (r.status === "dismissed") {
        slot.row.notSent += 1;
        continue;
      }
      if (r.status !== "sent") continue;
      slot.row.sent += 1;
      if (r.draftEdited === true) slot.row.edited += 1;
      else if (r.draftEdited === false) slot.row.asWritten += 1;
      else slot.row.typed += 1;
      if (r.draftEdited !== null && r.editSize != null) {
        slot.editSum += r.editSize;
        slot.editN += 1;
      }
    }
  }
  const finish = (s: { row: SendRow; editSum: number; editN: number }): SendRow => ({ ...s.row, avgEdit: s.editN ? s.editSum / s.editN : null });
  return {
    sends: [...byLabel.values()].map(finish).filter((r) => r.sent + r.notSent > 0),
    total: finish(total),
  };
}

/** Pure: model versions that answered this week and hadn't in the weeks before. */
export function newModelVersions(thisWeek: readonly string[], before: readonly string[]): string[] {
  const seen = new Set(before);
  return [...new Set(thisWeek)].filter((m) => !seen.has(m)).sort();
}

const LESSON_WORDS: Record<string, [one: string, many: string]> = {
  training_rule: ["rule", "rules"],
  training_example: ["example", "examples"],
  training_conversation: ["practice conversation", "practice conversations"],
  owner_example: ["owner's example", "owner's examples"],
};
const ACTION_WORDS: Record<string, string> = {
  created: "added",
  edited: "changed",
  approved: "approved",
  rolled_back: "rolled back",
  restored: "put back",
  removed: "removed",
};

/** Pure: "4 owner's examples added", "1 rule rolled back". */
export function lessonWords(kind: string, action: string, count: number): string {
  const [one, many] = LESSON_WORDS[kind] ?? [kind.replace(/_/g, " "), kind.replace(/_/g, " ")];
  return `${count} ${count === 1 ? one : many} ${ACTION_WORDS[action] ?? action.replace(/_/g, " ")}`;
}

export async function gatherQualityWeek(now = new Date()): Promise<QualityWeek> {
  const to = now;
  const from = new Date(now.getTime() - WEEK);
  const memoryFrom = new Date(from.getTime() - MODEL_MEMORY_WEEKS * WEEK);
  const week = { gte: from, lt: to };
  // A test's calls carry "test:" (src/lib/testRuns.ts); the founder's practice and examples carry their own tags.
  const tagged = { purpose: { contains: ":" } };
  const [followUps, factsLearned, factsTold, factsApproved, events, realAi, testAi, failedCalls, modelsNow, modelsBefore, tests] = await Promise.all([
    prisma.followUp.findMany({
      where: { OR: [{ status: "sent", sentAt: { gte: from, lt: to } }, { status: "dismissed", createdAt: { gte: from, lt: to } }] },
      select: { trigger: true, status: true, draftEdited: true, editSize: true },
      take: 20_000,
    }),
    prisma.businessFact.count({ where: { source: "reply", createdAt: { gte: from, lt: to } } }),
    prisma.businessFact.count({ where: { source: { not: "reply" }, createdAt: { gte: from, lt: to } } }),
    prisma.businessFact.count({ where: { source: "reply", approvedAt: { gte: from, lt: to } } }),
    prisma.learningEvent.groupBy({ by: ["kind", "action"], where: { createdAt: { gte: from, lt: to } }, _count: { _all: true } }),
    prisma.aiDecision.aggregate({ where: { createdAt: week, NOT: tagged }, _count: { _all: true }, _sum: { costMicros: true } }),
    prisma.aiDecision.aggregate({ where: { createdAt: week, ...tagged }, _count: { _all: true }, _sum: { costMicros: true } }),
    prisma.aiDecision.count({ where: { createdAt: week, ok: false } }),
    prisma.aiDecision.groupBy({ by: ["modelUsed"], where: { createdAt: { gte: from, lt: to }, modelUsed: { not: null } }, _count: { _all: true } }),
    prisma.aiDecision.groupBy({ by: ["modelUsed"], where: { createdAt: { gte: memoryFrom, lt: from }, modelUsed: { not: null } } }),
    prisma.testRun.aggregate({ where: { createdAt: { gte: from, lt: to } }, _count: { _all: true }, _sum: { costMicros: true } }),
  ]);

  const { sends, total } = sendRows(followUps);
  const ai = {
    realCalls: realAi._count._all,
    realCostMicros: realAi._sum.costMicros ?? 0,
    testCalls: testAi._count._all,
    testCostMicros: testAi._sum.costMicros ?? 0,
    failedCalls,
  };
  const models = modelsNow
    .map((m) => ({ model: m.modelUsed as string, calls: m._count._all }))
    .sort((a, b) => b.calls - a.calls);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    sends,
    total,
    learned: {
      factsLearned,
      factsTold,
      factsApproved,
      lessons: events
        .map((e) => ({ what: lessonWords(e.kind, e.action, e._count._all), count: e._count._all }))
        .sort((a, b) => b.count - a.count),
    },
    ai: {
      ...ai,
      models,
      newModels: newModelVersions(
        models.map((m) => m.model),
        modelsBefore.map((m) => m.modelUsed as string)
      ),
    },
    tests: { runs: tests._count._all, costMicros: tests._sum.costMicros ?? 0 },
  };
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const dollars = (micros: number) => `$${(micros / 1_000_000).toFixed(2)}`;
const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "–");

/** The week as short plain lines, for the founder's email. Numbers only. */
export function qualityWeekText(w: QualityWeek): string {
  const t = w.total;
  const lines = [
    `Drafts with real customers this week: ${t.sent} sent, ${t.asWritten} as written (${pct(t.asWritten, t.asWritten + t.edited)} of those with a draft), ${t.edited} changed first, ${t.notSent} not sent.`,
    ...w.sends.map((s) => `- ${s.label}: ${s.sent} sent, ${s.asWritten} as written, ${s.edited} changed, ${s.notSent} not sent.`),
    "",
    `Learned: ${w.learned.factsLearned} facts from replies (${w.learned.factsApproved} OK'd by owners), ${w.learned.factsTold} told by owners.` +
      (w.learned.lessons.length ? ` Train: ${w.learned.lessons.map((l) => l.what).join(", ")}.` : ""),
    "",
    `AI for customers: ${w.ai.realCalls} calls, ${dollars(w.ai.realCostMicros)}. Tests and practice: ${w.ai.testCalls} calls, ${dollars(w.ai.testCostMicros)}. ${w.ai.failedCalls} calls failed.`,
    `Tests run: ${w.tests.runs}, ${dollars(w.tests.costMicros)}.`,
  ];
  if (w.ai.newModels.length) {
    lines.push("", `New AI model version answering this week: ${w.ai.newModels.join(", ")}. OpenAI changed it; run the accuracy tests to check nothing got worse.`);
  }
  return lines.join("\n");
}

/**
 * The founder's Monday email: the week in numbers, and a link to Admin → Usage. Once a week per address (Resend's
 * idempotency key names the week). Quiet when no founder address is set.
 */
export async function sendFounderQualityWeek(now = new Date()): Promise<{ sent: number }> {
  const emails = founderEmails();
  if (!emails.length) return { sent: 0 };
  const week = await gatherQualityWeek(now);
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://www.followupbase.io").replace(/\/$/, "");
  const text = `${qualityWeekText(week)}\n\nThe whole week: ${base}/admin/usage#quality`;
  const weekKey = week.from.slice(0, 10);
  let sent = 0;
  for (const to of emails) {
    const out = await sendAlertEmail({
      to,
      subject: week.ai.newModels.length ? "FollowUp's week, and a new AI model version" : "FollowUp's week with real customers",
      text,
      html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;white-space:pre-wrap">${escapeHtml(text)}</div>`,
      idempotencyKey: `quality-week:${weekKey}:${to}`,
    });
    if (out.sent) sent += 1;
  }
  return { sent };
}
