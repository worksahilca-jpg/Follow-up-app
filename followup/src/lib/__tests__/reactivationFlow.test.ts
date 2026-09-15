/**
 * The whole reactivation flow, end to end, against ONE shared store.
 *
 * Why this exists
 * ---------------
 * Every defect found in this feature so far came from the same shape of
 * mistake: two modules that each looked correct on their own, disagreeing
 * about the same rule. The classify pass and the batch view disagreed about
 * what "eligible" meant, so a count could never reach zero. The eligibility
 * query and the send query each resolve the quiet window separately, from a
 * lookup with no deterministic ordering. A stale claim and a fresh verdict
 * each wrote to the same column without reference to each other.
 *
 * The per-module tests cannot catch that class of bug. They mock Prisma per
 * file, so each module is asked "do you behave correctly against the world
 * you imagine?" — and the answer is yes, right up until two of them meet.
 *
 * These tests give every module the SAME store and run the real sequence a
 * business goes through: judge the back catalogue, look at the buckets,
 * preview the drafts, send, stop. A disagreement between modules shows up
 * here as the symptom an owner would actually experience — a lead in the
 * cold bucket that the sender won't send to, a count that never settles, a
 * person messaged who shouldn't have been.
 *
 * The fake store is deliberately small and dumb. It is not a Prisma
 * emulator; it supports exactly the query shapes these three modules use.
 * If a module starts using a shape it doesn't support, that is a signal to
 * extend it here rather than to mock around it in a per-module file.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// A tiny in-memory stand-in for the rows these modules touch.
// ---------------------------------------------------------------------------

type LeadRow = {
  id: string;
  businessId: string;
  name: string;
  email: string | null;
  stage: string;
  optedOutAt: Date | null;
  lastContacted: Date | null;
  createdAt: Date;
  quietOutcome: string | null;
  quietOutcomeReason: string | null;
  quietOutcomeAt: Date | null;
  reactivationSentAt: Date | null;
  conversations: { channel: string; messages: { id: string; direction: string; body: string; sentAt: Date; opened: boolean }[] }[];
};

type RunRow = {
  id: string;
  businessId: string;
  status: string;
  totalPlanned: number;
  sent: number;
  failed: number;
  skipped: number;
  startedAt: Date;
  endedAt: Date | null;
  stoppedById: string | null;
};

const store = {
  leads: [] as LeadRow[],
  runs: [] as RunRow[],
  audits: [] as { action: string; targetId: string | null }[],
};

/** Supports only the operators these three modules actually use. */
function matches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  for (const [key, cond] of Object.entries(where)) {
    if (key === "OR") {
      if (!(cond as Record<string, unknown>[]).some((c) => matches(row, c))) return false;
      continue;
    }
    if (key === "conversations") {
      const wanted = cond as { some?: { messages?: { some?: unknown } } };
      if (wanted.some?.messages?.some !== undefined) {
        const convs = row.conversations as LeadRow["conversations"] | undefined;
        if (!convs?.some((c) => c.messages.length > 0)) return false;
      }
      continue;
    }
    const value = row[key];
    if (cond === null) {
      if (value !== null && value !== undefined) return false;
    } else if (cond instanceof Date) {
      if ((value as Date)?.getTime() !== cond.getTime()) return false;
    } else if (typeof cond === "object" && cond !== null) {
      const c = cond as Record<string, unknown>;
      if ("lte" in c && !(value !== null && (value as Date) <= (c.lte as Date))) return false;
      if ("lt" in c && !(value !== null && (value as Date) < (c.lt as Date))) return false;
      if ("gt" in c && !(value !== null && (value as Date) > (c.gt as Date))) return false;
      if ("notIn" in c && (c.notIn as unknown[]).includes(value)) return false;
      if ("in" in c && !(c.in as unknown[]).includes(value)) return false;
      if ("equals" in c && value !== c.equals) return false;
    } else if (value !== cond) {
      return false;
    }
  }
  return true;
}

function sortRows<T extends Record<string, unknown>>(rows: T[], orderBy?: Record<string, "asc" | "desc">): T[] {
  if (!orderBy) return rows;
  const [field, dir] = Object.entries(orderBy)[0];
  return [...rows].sort((a, b) => {
    const av = a[field] as Date | null;
    const bv = b[field] as Date | null;
    const cmp = (av?.getTime() ?? 0) - (bv?.getTime() ?? 0);
    return dir === "desc" ? -cmp : cmp;
  });
}

const prismaFake = {
  lead: {
    findMany: async (args: { where: Record<string, unknown>; orderBy?: Record<string, "asc" | "desc">; take?: number }) => {
      const hits = sortRows(store.leads.filter((l) => matches(l as unknown as Record<string, unknown>, args.where)), args.orderBy);
      return args.take ? hits.slice(0, args.take) : hits;
    },
    findFirst: async (args: { where: Record<string, unknown>; orderBy?: Record<string, "asc" | "desc"> }) =>
      sortRows(store.leads.filter((l) => matches(l as unknown as Record<string, unknown>, args.where)), args.orderBy)[0] ?? null,
    count: async (args: { where: Record<string, unknown> }) =>
      store.leads.filter((l) => matches(l as unknown as Record<string, unknown>, args.where)).length,
    update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = store.leads.find((l) => l.id === args.where.id)!;
      Object.assign(row, args.data);
      return row;
    },
    updateMany: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const hits = store.leads.filter((l) => matches(l as unknown as Record<string, unknown>, args.where));
      hits.forEach((row) => Object.assign(row, args.data));
      return { count: hits.length };
    },
  },
  reactivationRun: {
    findFirst: async (args: { where: Record<string, unknown> }) =>
      store.runs.find((r) => matches(r as unknown as Record<string, unknown>, args.where)) ?? null,
    findUnique: async (args: { where: { id: string } }) => store.runs.find((r) => r.id === args.where.id) ?? null,
    create: async (args: { data: Record<string, unknown> }) => {
      const data = args.data as Partial<RunRow>;
      const row: RunRow = {
        id: `run-${store.runs.length + 1}`,
        businessId: data.businessId ?? "biz-1",
        status: data.status ?? "RUNNING",
        totalPlanned: data.totalPlanned ?? 0,
        sent: data.sent ?? 0,
        failed: data.failed ?? 0,
        skipped: data.skipped ?? 0,
        startedAt: data.startedAt ?? new Date(),
        endedAt: data.endedAt ?? null,
        stoppedById: data.stoppedById ?? null,
      };
      store.runs.push(row);
      return row;
    },
    update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = store.runs.find((r) => r.id === args.where.id)!;
      Object.assign(row, args.data);
      return row;
    },
    updateMany: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const hits = store.runs.filter((r) => matches(r as unknown as Record<string, unknown>, args.where));
      hits.forEach((row) => Object.assign(row, args.data));
      return { count: hits.length };
    },
  },
  business: { findUnique: async () => ({ name: "Riverside Kitchens", industry: "kitchen fitting" }) },
  automation: { findFirst: async () => null },
  auditEvent: {
    create: async (args: { data: { action: string; targetId: string | null } }) => {
      store.audits.push({ action: args.data.action, targetId: args.data.targetId });
      return args.data;
    },
  },
};

// vi.mock is hoisted above every declaration in this file, so the factory
// cannot close over `prismaFake` directly. The proxy defers each lookup to
// call time, by which point the real object exists.
vi.mock("@/lib/db", () => ({
  prisma: new Proxy(
    {},
    { get: (_t, key: string) => (prismaFake as unknown as Record<string, unknown>)[key] }
  ),
}));

const classify = vi.fn();
const draft = vi.fn();
vi.mock("@/lib/integrations/openai", () => ({
  classifyThreadOutcome: (...a: unknown[]) => classify(...a),
  generateFollowUpMessage: (...a: unknown[]) => draft(...a),
}));

const sendFollowUpToLead = vi.fn();
vi.mock("@/lib/sending", () => ({ sendFollowUpToLead: (...a: unknown[]) => sendFollowUpToLead(...a) }));
vi.mock("@/lib/sender", () => ({
  composeFollowUpEmail: async (_n: string, _b: string, body: string) => body,
  latestInboundText: () => "",
}));
vi.mock("@/lib/voice", () => ({ getVoiceSamples: async () => [] }));
// The daily circuit breaker is exercised in reactivationSend.test.ts; here it
// is always open, so these end-to-end flows test the batch itself rather than
// the fuse. The fake store below has no FollowUp table for the real one to
// count.
vi.mock("@/lib/sendCaps", () => ({
  checkSendCap: async () => ({ allowed: true, used: 0, cap: 250 }),
}));

import { classifyQuietLeads, getReactivationBatch } from "@/lib/reactivation";
import {
  startReactivationRun,
  stopReactivationRun,
  runReactivationSend,
  previewReactivationDrafts,
} from "@/lib/reactivationSend";

const DAY = 24 * 60 * 60 * 1000;

function seedLead(over: Partial<LeadRow> & { id: string; lastMessage: { direction: string; daysAgo: number } }): LeadRow {
  const { lastMessage, ...rest } = over;
  const sentAt = new Date(Date.now() - lastMessage.daysAgo * DAY);
  const row: LeadRow = {
    businessId: "biz-1",
    name: `Lead ${over.id}`,
    email: `${over.id}@example.com`,
    stage: "NEW",
    optedOutAt: null,
    lastContacted: sentAt,
    createdAt: new Date(Date.now() - 200 * DAY),
    quietOutcome: null,
    quietOutcomeReason: null,
    quietOutcomeAt: null,
    reactivationSentAt: null,
    conversations: [
      {
        channel: "email",
        messages: [
          { id: `${over.id}-m1`, direction: "inbound", body: "What would a refit cost?", sentAt: new Date(sentAt.getTime() - DAY), opened: false },
          { id: `${over.id}-m2`, direction: lastMessage.direction, body: "About $12k.", sentAt, opened: false },
        ],
      },
    ],
    ...rest,
  } as LeadRow;
  store.leads.push(row);
  return row;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  store.leads = [];
  store.runs = [];
  store.audits = [];
  draft.mockResolvedValue({ subject: "Your kitchen quote", body: "Still thinking it over?" });
  sendFollowUpToLead.mockResolvedValue({ success: true });
});

describe("the whole flow, one store", () => {
  /**
   * The contract the two modules have to agree on. If eligibility drifts
   * apart again — a different quiet window, a different exclusion, a
   * different bucket — this is where it surfaces, as a lead the owner is
   * shown and promised but that never gets sent to.
   */
  it("every lead shown as cold is a lead the sender will actually reach", async () => {
    seedLead({ id: "a", lastMessage: { direction: "outbound", daysAgo: 60 } });
    seedLead({ id: "b", lastMessage: { direction: "outbound", daysAgo: 90 } });
    seedLead({ id: "c", lastMessage: { direction: "outbound", daysAgo: 120 } });
    classify.mockResolvedValue({ outcome: "cold", reason: "Quote never answered." });

    await classifyQuietLeads("biz-1");
    const batch = await getReactivationBatch("biz-1");
    const started = await startReactivationRun("biz-1");

    expect(batch.cold.total).toBe(3);
    // The count the owner approves and the count the sender can reach are
    // the same number, produced by two different queries in two files.
    expect(started).toMatchObject({ totalPlanned: 3 });
  });

  it("judges, buckets, previews, sends — and nobody is reached twice", async () => {
    seedLead({ id: "a", lastMessage: { direction: "outbound", daysAgo: 60 } });
    seedLead({ id: "b", lastMessage: { direction: "outbound", daysAgo: 70 } });
    classify.mockResolvedValue({ outcome: "cold", reason: "Quote never answered." });

    await classifyQuietLeads("biz-1");

    const previews = await previewReactivationDrafts("biz-1", 3);
    expect(previews).toHaveLength(2);
    // A preview must never consume a lead.
    expect(store.leads.every((l) => l.reactivationSentAt === null)).toBe(true);

    const started = await startReactivationRun("biz-1");
    expect(started).toMatchObject({ totalPlanned: 2 });

    const first = await runReactivationSend("biz-1", (started as { runId: string }).runId, { spacingMs: 0 });
    expect(first.sent).toBe(2);
    expect(first.status).toBe("COMPLETED");

    // Run it again: there is nobody left, and nothing sends a second time.
    sendFollowUpToLead.mockClear();
    const second = await startReactivationRun("biz-1");
    expect(second).toEqual({ error: "There are no cold leads to reach out to." });
    expect(sendFollowUpToLead).not.toHaveBeenCalled();
  });

  /**
   * The bucket separation, proven end to end rather than per-module. These
   * four people must never receive a "still interested?" — each for a
   * different reason, and each reason is enforced in a different place.
   */
  it("never sends to anyone outside the cold bucket", async () => {
    seedLead({ id: "cold", lastMessage: { direction: "outbound", daysAgo: 60 } });
    seedLead({ id: "unanswered", lastMessage: { direction: "inbound", daysAgo: 60 } });
    seedLead({ id: "closed", lastMessage: { direction: "outbound", daysAgo: 60 } });
    seedLead({ id: "optedout", lastMessage: { direction: "outbound", daysAgo: 60 }, optedOutAt: new Date() });
    seedLead({ id: "won", lastMessage: { direction: "outbound", daysAgo: 60 }, stage: "WON" });

    classify.mockImplementation(async (_conv: unknown, ctx: { lastMessageFrom?: string }) =>
      ctx?.lastMessageFrom === "lead"
        ? { outcome: "cold", reason: "They asked and got nothing back." }
        : { outcome: "cold", reason: "Quote never answered." }
    );
    await classifyQuietLeads("biz-1");
    // The one we want filed as finished.
    store.leads.find((l) => l.id === "closed")!.quietOutcome = "CLOSED";

    const started = await startReactivationRun("biz-1");
    await runReactivationSend("biz-1", (started as { runId: string }).runId, { spacingMs: 0 });

    const reached = sendFollowUpToLead.mock.calls.map((c) => c[0] as string);
    expect(reached).toEqual(["cold"]);
    // Stated individually so a failure says WHICH promise broke.
    expect(reached).not.toContain("unanswered"); // owed an apology, not a check-in
    expect(reached).not.toContain("closed");
    expect(reached).not.toContain("optedout");
    expect(reached).not.toContain("won");
  });

  it("stops mid-batch and leaves the rest untouched", async () => {
    for (let i = 0; i < 6; i++) seedLead({ id: `l${i}`, lastMessage: { direction: "outbound", daysAgo: 60 + i } });
    classify.mockResolvedValue({ outcome: "cold", reason: "Quote never answered." });
    await classifyQuietLeads("biz-1");

    const started = (await startReactivationRun("biz-1")) as { runId: string };

    // The owner presses Stop from another invocation while the loop runs.
    let sends = 0;
    sendFollowUpToLead.mockImplementation(async () => {
      sends += 1;
      if (sends === 2) await stopReactivationRun("biz-1", started.runId, "user-1");
      return { success: true };
    });

    const result = await runReactivationSend("biz-1", started.runId, { spacingMs: 0 });

    expect(result.status).toBe("STOPPED");
    expect(result.sent).toBe(2);
    // The four who were never reached are still pristine — no claim, no
    // send. "Stopped" has to mean they can still be reached later, on
    // purpose, rather than being quietly burned.
    expect(store.leads.filter((l) => l.reactivationSentAt === null)).toHaveLength(4);
  });

  it("a stopped batch can be resumed, and resumes where it left off", async () => {
    for (let i = 0; i < 4; i++) seedLead({ id: `l${i}`, lastMessage: { direction: "outbound", daysAgo: 60 + i } });
    classify.mockResolvedValue({ outcome: "cold", reason: "Quote never answered." });
    await classifyQuietLeads("biz-1");

    const first = (await startReactivationRun("biz-1")) as { runId: string };
    let sends = 0;
    sendFollowUpToLead.mockImplementation(async () => {
      sends += 1;
      if (sends === 1) await stopReactivationRun("biz-1", first.runId, "user-1");
      return { success: true };
    });
    await runReactivationSend("biz-1", first.runId, { spacingMs: 0 });

    // A second batch sees only the three nobody reached.
    sendFollowUpToLead.mockReset();
    sendFollowUpToLead.mockResolvedValue({ success: true });
    const second = await startReactivationRun("biz-1");
    expect(second).toMatchObject({ totalPlanned: 3 });

    await runReactivationSend("biz-1", (second as { runId: string }).runId, { spacingMs: 0 });
    expect(sendFollowUpToLead).toHaveBeenCalledTimes(3);
    // Four leads, two batches, four messages. Never five.
    expect(store.leads.filter((l) => l.reactivationSentAt !== null)).toHaveLength(4);
  });

  /**
   * The count an owner watches while the back catalogue is judged. It has
   * to be able to reach zero — a number that never settles is a number
   * that teaches people to ignore the screen.
   */
  it("the still-being-judged count settles at zero", async () => {
    for (let i = 0; i < 5; i++) seedLead({ id: `l${i}`, lastMessage: { direction: "outbound", daysAgo: 60 + i } });
    classify.mockResolvedValue({ outcome: "unclear", reason: "Too little to go on." });

    let guard = 0;
    let remaining = Infinity;
    while (remaining > 0 && guard++ < 10) {
      remaining = (await classifyQuietLeads("biz-1", { limit: 2 })).remaining;
    }

    const batch = await getReactivationBatch("biz-1");
    expect(batch.unjudged).toBe(0);
    expect(batch.unclear.total).toBe(5);
    expect(batch.cold.total).toBe(0);
  });

  it("a lead whose thread is not actually quiet is repaired, not judged", async () => {
    // lastContacted says 60 days; the real conversation ended yesterday —
    // the corruption both mailbox syncs used to cause.
    const lead = seedLead({ id: "live", lastMessage: { direction: "outbound", daysAgo: 60 } });
    lead.conversations[0].messages.push({
      id: "live-m3",
      direction: "inbound",
      body: "Sorry for the delay — yes, let's do it.",
      sentAt: new Date(Date.now() - 1 * DAY),
      opened: false,
    });
    classify.mockResolvedValue({ outcome: "cold", reason: "should never be reached" });

    await classifyQuietLeads("biz-1");

    expect(classify).not.toHaveBeenCalled();
    expect(lead.quietOutcome).toBeNull();
    // Repaired, so it drops out of the eligible set instead of being
    // re-fetched and re-skipped forever.
    expect(lead.lastContacted!.getTime()).toBeGreaterThan(Date.now() - 2 * DAY);
    expect((await getReactivationBatch("biz-1")).unjudged).toBe(0);
  });

  it("the consent decision is on the record", async () => {
    seedLead({ id: "a", lastMessage: { direction: "outbound", daysAgo: 60 } });
    classify.mockResolvedValue({ outcome: "cold", reason: "Quote never answered." });
    await classifyQuietLeads("biz-1");

    const started = (await startReactivationRun("biz-1")) as { runId: string };
    await stopReactivationRun("biz-1", started.runId, "user-1");
    await new Promise((r) => setTimeout(r, 0)); // recordAudit is fire-and-forget

    const actions = store.audits.map((a) => a.action);
    expect(actions).toContain("reactivation.batch_approved");
    expect(actions).toContain("reactivation.batch_stopped");
  });
});

describe("one business cannot touch another's batch", () => {
  it("refuses to stop, or send, a run belonging to someone else", async () => {
    seedLead({ id: "a", lastMessage: { direction: "outbound", daysAgo: 60 } });
    classify.mockResolvedValue({ outcome: "cold", reason: "Quote never answered." });
    await classifyQuietLeads("biz-1");
    const started = (await startReactivationRun("biz-1")) as { runId: string };

    expect(await stopReactivationRun("biz-2", started.runId, "attacker")).toEqual({ stopped: false });
    const hijack = await runReactivationSend("biz-2", started.runId, { spacingMs: 0 });
    expect(hijack.status).toBe("FAILED");
    expect(sendFollowUpToLead).not.toHaveBeenCalled();

    // And the real owner's run is untouched by the attempt.
    expect(store.runs[0].status).toBe("RUNNING");
  });
});
