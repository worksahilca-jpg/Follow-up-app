/**
 * The office's trust guarantees, pinned.
 *
 * An agent that can spend money while nobody is watching is only as
 * trustworthy as the gates in front of it, so these are the gates: a desk
 * with no runner never runs, a desk at its ceiling never runs, two shifts
 * never open at one desk, a shift with nothing to do costs nothing, and
 * nothing identifying a customer is ever put in a prompt.
 *
 * The founder-only gate on /admin/office itself is not re-tested here —
 * platformAdmin.test.ts already owns it.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// $transaction runs the callback against the same mocked client plus a
// no-op $executeRaw — good enough to exercise the claim logic without a
// real Postgres advisory lock, since these tests care about the gating
// decisions, not actual cross-request concurrency.
vi.mock("@/lib/db", () => {
  const prisma: Record<string, unknown> = {
    agentRole: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
    agentRun: { findFirst: vi.fn(), aggregate: vi.fn(), create: vi.fn(), update: vi.fn() },
    agentTask: { findUnique: vi.fn() },
    productFeedback: { findMany: vi.fn() },
    $executeRaw: vi.fn().mockResolvedValue(undefined),
  };
  prisma.$transaction = vi.fn((fn: (tx: unknown) => unknown) => fn(prisma));
  return { prisma };
});

const createCompletion = vi.fn();
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: (...args: unknown[]) => createCompletion(...args) } };
  },
}));

import { prisma } from "@/lib/db";
import { runShift } from "@/lib/office/runner";
import { buildContextPack } from "@/lib/office/context";
import { ROLES } from "@/lib/office/roles";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;

function desk(over: Record<string, unknown> = {}) {
  return {
    id: "role1",
    key: "product-ux-agent",
    title: "Product & UX",
    brief: "Reads what people said.",
    gate: "Writes a note.",
    live: true,
    enabled: true,
    dailyCostCeilingUsd: 0.5,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENAI_API_KEY = "test-key";
  p.agentRole.findUnique.mockResolvedValue(desk());
  p.agentRun.aggregate.mockResolvedValue({ _sum: { costUsd: 0 } });
  p.agentRun.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "run1", ...data }));
  p.agentRun.update.mockResolvedValue({});
  p.productFeedback.findMany.mockResolvedValue([]);
  // No shift already open, and no previous success (so packs aren't
  // incremental) — individual tests override where they need to.
  p.agentRun.findFirst.mockImplementation(async () => null);
});

describe("the roster matches the agents that actually exist", () => {
  it("every desk key names a lane in .claude/agents/", () => {
    // If a lane is renamed there and not here, the floor shows a desk for
    // an agent nobody can dispatch. Cheap check, real failure mode.
    expect(ROLES.map((r) => r.key).sort()).toEqual([
      "backend-ai-agent",
      "frontend-3d-agent",
      "manager-agent",
      "product-ux-agent",
      "qa-security-agent",
    ]);
  });
});

describe("the gates in front of a shift", () => {
  it("a desk on the roster with no runner never runs", async () => {
    p.agentRole.findUnique.mockResolvedValue(desk({ live: false }));

    const result = await runShift({ roleKey: "backend-ai-agent", trigger: "cron" });

    expect(result.status).toBe("BLOCKED");
    expect(result.summary).toMatch(/no runner/i);
    expect(createCompletion).not.toHaveBeenCalled();
  });

  it("a desk switched off never runs", async () => {
    p.agentRole.findUnique.mockResolvedValue(desk({ enabled: false }));

    const result = await runShift({ roleKey: "product-ux-agent", trigger: "cron" });

    expect(result.status).toBe("BLOCKED");
    expect(createCompletion).not.toHaveBeenCalled();
  });

  it("a desk at its daily ceiling stops itself, and says what it spent", async () => {
    p.agentRun.aggregate.mockResolvedValue({ _sum: { costUsd: 0.5 } });

    const result = await runShift({ roleKey: "product-ux-agent", trigger: "cron" });

    expect(result.status).toBe("BLOCKED");
    expect(result.summary).toMatch(/\$0\.500 of \$0\.50/);
    expect(createCompletion).not.toHaveBeenCalled();
  });

  it("a cron tick landing on top of an open shift does not double the bill", async () => {
    p.agentRun.findFirst.mockImplementation(async ({ where }: { where: { status: string } }) =>
      where.status === "RUNNING" ? { id: "already-running" } : null,
    );

    const result = await runShift({ roleKey: "product-ux-agent", trigger: "cron" });

    expect(result.status).toBe("BLOCKED");
    expect(result.summary).toMatch(/already open/i);
    expect(createCompletion).not.toHaveBeenCalled();
  });

  it("blocked shifts are recorded, not dropped — the floor has to show the office stopping itself", async () => {
    p.agentRole.findUnique.mockResolvedValue(desk({ live: false }));

    await runShift({ roleKey: "backend-ai-agent", trigger: "cron" });

    expect(p.agentRun.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "BLOCKED" }) }),
    );
  });
});

describe("a shift with nothing to do", () => {
  it("succeeds, costs nothing, and calls no model", async () => {
    p.productFeedback.findMany.mockResolvedValue([]);

    const result = await runShift({ roleKey: "product-ux-agent", trigger: "cron" });

    expect(result.status).toBe("SUCCEEDED");
    expect(result.costUsd).toBe(0);
    expect(result.summary).toMatch(/no product feedback/i);
    expect(createCompletion).not.toHaveBeenCalled();
  });
});

describe("a shift that works", () => {
  beforeEach(() => {
    p.productFeedback.findMany.mockResolvedValue([
      {
        message: "I never know if it actually sent anything",
        createdAt: new Date("2026-09-10"),
        business: { industry: "roofing", teamSize: 3 },
      },
    ]);
    createCompletion.mockResolvedValue({
      choices: [
        { message: { content: JSON.stringify({ summary: "Three people can't tell what was sent.", note: "## Theme" }) } },
      ],
      usage: { prompt_tokens: 1000, completion_tokens: 500 },
    });
  });

  it("prices the run from its own token usage and writes it to the run", async () => {
    const result = await runShift({ roleKey: "product-ux-agent", trigger: "cron" });

    expect(result.status).toBe("SUCCEEDED");
    // gpt-4o-mini: (1000 × $0.15 + 500 × $0.60) per million tokens.
    expect(result.costUsd).toBeCloseTo(0.00045, 6);
    expect(p.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SUCCEEDED", inputTokens: 1000, outputTokens: 500 }),
      }),
    );
  });

  it("records a failure instead of throwing, so one bad desk doesn't take the cron down", async () => {
    createCompletion.mockRejectedValue(new Error("upstream is down"));

    const result = await runShift({ roleKey: "product-ux-agent", trigger: "cron" });

    expect(result.status).toBe("FAILED");
    expect(p.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED", error: "upstream is down" }) }),
    );
  });
});

describe("what a prompt is allowed to carry", () => {
  it("carries what a customer wrote, never who wrote it", async () => {
    p.productFeedback.findMany.mockResolvedValue([
      {
        message: "The Instagram sync missed two days",
        createdAt: new Date("2026-09-11"),
        business: { industry: "dental", teamSize: 4 },
        // Present on the row but never selected — if that ever changes,
        // this test is what catches it.
        userName: "Priya Raman",
      },
    ]);

    const pack = await buildContextPack("product-ux-agent", "role1");

    expect(pack.kind).toBe("work");
    if (pack.kind !== "work") return;
    expect(pack.context).toContain("The Instagram sync missed two days");
    expect(pack.context).toContain("dental");
    expect(pack.context).not.toContain("Priya");
  });
});
