/**
 * One failing path must not take down the hourly tick.
 *
 * `/api/cron/automation` is the most important scheduled job in the
 * product: it is the silence rule, the workflow steps, the stale-approval
 * reminders and the inbound-event pruning, once an hour, for every
 * business.
 *
 * It ran the two send paths under a bare `Promise.all`, which rejects the
 * moment either does. Both `runAutomationForAllBusinesses` and
 * `runSequencesForAllBusinesses` open with an unguarded `findMany` — the
 * per-business work inside each is carefully isolated, but the query that
 * lists which businesses to process is not. So one transient database
 * error in that one query:
 *
 *   - discarded the OTHER path's results, including sends already made,
 *     losing the run's own record of what went out
 *   - skipped the stale-approval reminders entirely
 *   - skipped the pruning entirely
 *   - returned 500 having actually done some of the work
 *
 * An hour of no follow-ups, and a response that could not tell you what
 * had already happened.
 *
 * Tested against the real route handler rather than by reading the source:
 * the whole failure was in how four calls were composed, which is exactly
 * what a source assertion cannot see.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { runAutomation, runSequences, remindStale, prune, cronAuth } = vi.hoisted(() => ({
  runAutomation: vi.fn(),
  runSequences: vi.fn(),
  remindStale: vi.fn(),
  prune: vi.fn(),
  cronAuth: vi.fn(),
}));

vi.mock("@/lib/automation", () => ({ runAutomationForAllBusinesses: runAutomation }));
vi.mock("@/lib/sequences", () => ({ runSequencesForAllBusinesses: runSequences }));
vi.mock("@/lib/staleApprovals", () => ({ remindStaleApprovalsForAllBusinesses: remindStale }));
vi.mock("@/lib/inboundEvents", () => ({ pruneInboundWebhookEvents: prune }));
vi.mock("@/lib/cronAuth", () => ({ requireCronSecret: cronAuth }));

import { GET } from "@/app/api/cron/automation/route";
import type { NextRequest } from "next/server";

const request = {} as NextRequest;
const call = async () => {
  const res = await GET(request);
  return { status: res.status, body: await res.json() };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  cronAuth.mockReturnValue(null); // authorised
  runAutomation.mockResolvedValue({ sent: 2, held: 1 });
  runSequences.mockResolvedValue({ advanced: 3 });
  remindStale.mockResolvedValue({ checked: 5, reminded: 1 });
  prune.mockResolvedValue({ deleted: 7 });
});

describe("a healthy tick", () => {
  it("runs all four and reports no errors", async () => {
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.errors).toEqual([]);
    expect(body.automation).toEqual({ sent: 2, held: 1 });
    expect(body.sequences).toEqual({ advanced: 3 });
    expect(body.staleApprovals).toEqual({ checked: 5, reminded: 1 });
    expect(body.pruned).toEqual({ deleted: 7 });
  });
});

describe("when one send path dies", () => {
  it("still runs the other one", async () => {
    runAutomation.mockRejectedValue(new Error("db down"));
    await call();
    expect(runSequences).toHaveBeenCalled();
  });

  it("still keeps the other one's results", async () => {
    // The regression: Promise.all threw away work that had already
    // happened, so the response could not say what had gone out.
    runAutomation.mockRejectedValue(new Error("db down"));
    const { body } = await call();
    expect(body.sequences).toEqual({ advanced: 3 });
    expect(body.automation).toBeNull();
  });

  it("still sends the stale-approval reminders and prunes", async () => {
    runAutomation.mockRejectedValue(new Error("db down"));
    await call();
    expect(remindStale).toHaveBeenCalled();
    expect(prune).toHaveBeenCalled();
  });

  it("names what failed, rather than failing silently", async () => {
    runSequences.mockRejectedValue(new Error("connection reset"));
    const { body } = await call();
    expect(body.success).toBe(false);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0]).toContain("sequences");
    expect(body.errors[0]).toContain("connection reset");
  });

  it("answers 200, because real work was done", async () => {
    // A 500 on a run that actually sent messages makes the response a
    // worse record than none. The console.error is what reaches Sentry.
    runAutomation.mockRejectedValue(new Error("db down"));
    const { status } = await call();
    expect(status).toBe(200);
  });
});

describe("when both send paths die", () => {
  it("answers 500, because the tick genuinely did nothing", async () => {
    runAutomation.mockRejectedValue(new Error("db down"));
    runSequences.mockRejectedValue(new Error("db down"));
    const { status, body } = await call();
    expect(status).toBe(500);
    expect(body.errors).toHaveLength(2);
  });

  it("still tries the reminders and the pruning first", async () => {
    // They read different tables. "Both send paths are down" is not
    // "everything is down", and a queue reminder that can still go out
    // should still go out.
    runAutomation.mockRejectedValue(new Error("db down"));
    runSequences.mockRejectedValue(new Error("db down"));
    await call();
    expect(remindStale).toHaveBeenCalled();
    expect(prune).toHaveBeenCalled();
  });
});

describe("the smaller jobs", () => {
  it("a failed reminder pass does not fail the tick", async () => {
    remindStale.mockRejectedValue(new Error("nope"));
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body.automation).toEqual({ sent: 2, held: 1 });
    expect(body.errors[0]).toContain("stale-approval reminders");
  });

  it("a failed prune does not fail the tick", async () => {
    prune.mockRejectedValue(new Error("nope"));
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body.pruned).toEqual({ deleted: 0 });
    expect(body.errors[0]).toContain("pruning");
  });
});

describe("the door", () => {
  it("refuses an unauthorised caller before doing any work", async () => {
    const denied = { status: 401 } as unknown as ReturnType<typeof cronAuth>;
    cronAuth.mockReturnValue(denied);
    await GET(request);
    expect(runAutomation).not.toHaveBeenCalled();
    expect(runSequences).not.toHaveBeenCalled();
    expect(remindStale).not.toHaveBeenCalled();
  });
});
