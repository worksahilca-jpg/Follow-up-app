/**
 * The runner — the thing that actually wakes a desk.
 *
 * A shift is bounded on purpose: one model call, one context pack, one
 * written note, then the agent stops existing again. There is no loop here
 * and that is not a shortcut. An unbounded loop is how an office turns
 * into an overnight bill, and a long autonomous run drifts — a short shift
 * that writes down what it found is worth more than a long one nobody
 * reads.
 *
 * Three gates stand before every shift, in this order: the desk must be
 * live and enabled, no other shift may be open at that desk, and the desk
 * must be under its daily spend ceiling. A refusal is recorded as a
 * BLOCKED run rather than dropped, so the floor can show that the office
 * tried and stopped itself.
 *
 * Where this goes next: the model call below is a single completion. A
 * role that needs to read the web, run a command, or open a pull request
 * needs a real tool loop — the Claude Agent SDK in a worker process, not a
 * serverless function. The shape here (role in, AgentRun row out) is what
 * that swap has to preserve; nothing else in the office knows how a shift
 * is executed.
 */

import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { buildContextPack } from "@/lib/office/context";

const MODEL = "gpt-4o-mini";

// USD per 1M tokens, at the time of writing. Stored per-run in AgentRun so
// a rate change never rewrites what a past shift cost — but this table
// itself must be checked against current pricing before you trust today's
// number on the floor.
const RATES_PER_MTOK: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
};

// A shift older than this with no end is a crashed function, not a working
// agent — it stops blocking the desk.
const STALE_RUN_MINUTES = 15;

export interface ShiftResult {
  runId: string;
  status: "SUCCEEDED" | "FAILED" | "BLOCKED";
  summary: string;
  costUsd: number;
}

function priceOf(model: string, inputTokens: number, outputTokens: number): number {
  const rate = RATES_PER_MTOK[model];
  if (!rate) return 0;
  return (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000;
}

export function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** What this desk has spent since midnight UTC. */
export async function spentToday(roleId: string, now: Date = new Date()): Promise<number> {
  const agg = await prisma.agentRun.aggregate({
    where: { roleId, startedAt: { gte: startOfUtcDay(now) } },
    _sum: { costUsd: true },
  });
  return agg._sum.costUsd ?? 0;
}

async function blocked(roleId: string, trigger: string, reason: string): Promise<ShiftResult> {
  const run = await prisma.agentRun.create({
    data: {
      roleId,
      trigger,
      status: "BLOCKED",
      endedAt: new Date(),
      summary: reason,
      error: reason,
    },
  });
  return { runId: run.id, status: "BLOCKED", summary: reason, costUsd: 0 };
}

const NOTE_SCHEMA = {
  name: "shift_note",
  strict: true,
  schema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "One line, under 140 characters, that tells the operator whether this is worth opening.",
      },
      note: {
        type: "string",
        description: "The findings themselves, in markdown. Short sections. Quotes over paraphrase. No preamble.",
      },
    },
    required: ["summary", "note"],
    additionalProperties: false,
  },
} as const;

/**
 * Work one shift at one desk. Never throws for an expected refusal — a
 * blocked or failed shift comes back as a result, because "the office
 * stopped itself" is information the floor needs to show.
 */
export async function runShift(opts: {
  roleKey: string;
  trigger: string;
  taskId?: string | null;
}): Promise<ShiftResult> {
  const role = await prisma.agentRole.findUnique({ where: { key: opts.roleKey } });
  if (!role) throw new Error(`No desk named ${opts.roleKey}.`);

  if (!role.enabled) return blocked(role.id, opts.trigger, "This desk is switched off.");
  if (!role.live) return blocked(role.id, opts.trigger, "This desk has no runner yet — it is on the roster, not on shift.");

  // Claim the desk. The "no open shift" and "under ceiling" checks, and the
  // RUNNING row that then blocks every later claim, all happen inside one
  // Postgres-advisory-locked transaction — without this, a cron tick and a
  // manual "Run now" landing at the same instant could both read "clear"
  // before either writes a row, exactly the race already fixed once for the
  // automation scheduler and again for the rate limiters. The lock is
  // xact-scoped (`pg_advisory_xact_lock`), so it always releases when this
  // transaction ends — a crashed function can never leave a desk locked.
  const claim = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${role.id}))`;

    const openRun = await tx.agentRun.findFirst({
      where: {
        roleId: role.id,
        status: "RUNNING",
        startedAt: { gt: new Date(Date.now() - STALE_RUN_MINUTES * 60_000) },
      },
      select: { id: true },
    });
    if (openRun) return { ok: false as const, reason: "A shift is already open at this desk." };

    const agg = await tx.agentRun.aggregate({
      where: { roleId: role.id, startedAt: { gte: startOfUtcDay(new Date()) } },
      _sum: { costUsd: true },
    });
    const spent = agg._sum.costUsd ?? 0;
    if (spent >= role.dailyCostCeilingUsd) {
      return {
        ok: false as const,
        reason: `Daily ceiling reached — $${spent.toFixed(3)} of $${role.dailyCostCeilingUsd.toFixed(2)} spent.`,
      };
    }

    // Claimed. This RUNNING row is what makes the *next* concurrent caller's
    // openRun check above come back non-null — the lock only needs to cover
    // this transaction, not the model call that follows it.
    const run = await tx.agentRun.create({
      data: { roleId: role.id, taskId: opts.taskId ?? null, trigger: opts.trigger, status: "RUNNING", model: MODEL },
    });
    return { ok: true as const, runId: run.id };
  });

  if (!claim.ok) return blocked(role.id, opts.trigger, claim.reason);
  const runId = claim.runId;

  const pack = await buildContextPack(role.key, role.id);
  if (pack.kind === "skip") {
    // Nothing happened since last time. That is a real answer and it is
    // free — the claimed row is updated to SUCCEEDED rather than left
    // RUNNING, so the desk's cadence stays visible with no model call
    // behind it.
    await prisma.agentRun.update({
      where: { id: runId },
      data: { status: "SUCCEEDED", endedAt: new Date(), summary: pack.reason, output: "", model: "" },
    });
    return { runId, status: "SUCCEEDED", summary: pack.reason, costUsd: 0 };
  }

  const task = opts.taskId
    ? await prisma.agentTask.findUnique({ where: { id: opts.taskId }, select: { title: true, detail: true } })
    : null;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    await prisma.agentRun.update({
      where: { id: runId },
      data: { status: "FAILED", endedAt: new Date(), error: "OPENAI_API_KEY is not set.", summary: "Could not start — no API key." },
    });
    return { runId, status: "FAILED", summary: "Could not start — no API key.", costUsd: 0 };
  }

  const system = [
    `You are ${role.title} at FollowUp, a multi-tenant SaaS whose reason for existing is that no lead is lost to no follow-up, late follow-up, or wrong follow-up, in any language.`,
    role.brief,
    `What you may do without a human: ${role.gate}`,
    "You are writing a note your operator will read on a Monday morning. Be specific, be short, and never pad. If the evidence does not support a conclusion, say what is missing instead of reaching for one.",
  ].join("\n\n");

  const user = [
    task ? `Task you were given: ${task.title}\n${task.detail}`.trim() : null,
    pack.instruction,
    "---",
    pack.context,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_schema", json_schema: NOTE_SCHEMA },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("The model returned nothing.");
    const parsed = JSON.parse(raw) as { summary: string; note: string };

    const inputTokens = completion.usage?.prompt_tokens ?? 0;
    const outputTokens = completion.usage?.completion_tokens ?? 0;
    const costUsd = priceOf(MODEL, inputTokens, outputTokens);

    await prisma.agentRun.update({
      where: { id: runId },
      data: {
        status: "SUCCEEDED",
        endedAt: new Date(),
        summary: parsed.summary.slice(0, 240),
        output: parsed.note,
        inputTokens,
        outputTokens,
        costUsd,
      },
    });

    return { runId, status: "SUCCEEDED", summary: parsed.summary, costUsd };
  } catch (err) {
    const message = err instanceof Error ? err.message : "The shift failed.";
    await prisma.agentRun.update({
      where: { id: runId },
      data: { status: "FAILED", endedAt: new Date(), error: message, summary: "The shift failed." },
    });
    return { runId, status: "FAILED", summary: message, costUsd: 0 };
  }
}
