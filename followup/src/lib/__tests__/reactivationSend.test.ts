/**
 * The two promises the reactivation batch makes to a business owner:
 *
 *   1. Stop means stop. Not "stop at the end of the batch", not "hide the
 *      button" — the remaining messages do not go out. The owner watched
 *      themselves press it; if the other 31 send anyway, nothing else this
 *      product does will be believed again.
 *   2. Nobody is messaged twice. Not once per run — once, ever.
 *
 * Both are tested here against the real failure shapes: Stop landing in a
 * different invocation mid-loop, and two overlapping invocations reaching
 * the same lead.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const generateFollowUpMessage = vi.fn();
vi.mock("@/lib/integrations/openai", () => ({
  generateFollowUpMessage: (...a: unknown[]) => generateFollowUpMessage(...a),
}));

const sendFollowUpToLead = vi.fn();
vi.mock("@/lib/sending", () => ({
  sendFollowUpToLead: (...a: unknown[]) => sendFollowUpToLead(...a),
}));

vi.mock("@/lib/sender", () => ({
  composeFollowUpEmail: async (_n: string, _b: string, body: string) => `Hi,\n\n${body}\n\nThanks`,
  latestInboundText: () => "",
}));

vi.mock("@/lib/voice", () => ({ getVoiceSamples: async () => [] }));

const leadFindFirst = vi.fn();
const leadUpdateMany = vi.fn();
const leadCount = vi.fn();
const runFindFirst = vi.fn();
const runFindUnique = vi.fn();
const runCreate = vi.fn();
const runUpdate = vi.fn();
const runUpdateMany = vi.fn();
const automationFindFirst = vi.fn();
const auditCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    lead: {
      findFirst: (...a: unknown[]) => leadFindFirst(...a),
      findMany: vi.fn(),
      updateMany: (...a: unknown[]) => leadUpdateMany(...a),
      count: (...a: unknown[]) => leadCount(...a),
    },
    reactivationRun: {
      findFirst: (...a: unknown[]) => runFindFirst(...a),
      findUnique: (...a: unknown[]) => runFindUnique(...a),
      create: (...a: unknown[]) => runCreate(...a),
      update: (...a: unknown[]) => runUpdate(...a),
      updateMany: (...a: unknown[]) => runUpdateMany(...a),
    },
    business: { findUnique: vi.fn() },
    automation: { findFirst: (...a: unknown[]) => automationFindFirst(...a) },
    auditEvent: { create: (...a: unknown[]) => auditCreate(...a) },
  },
}));

import { startReactivationRun, stopReactivationRun, runReactivationSend } from "@/lib/reactivationSend";

function coldLead(id: string) {
  return {
    id,
    name: "Ana Reyes",
    businessId: "biz-1",
    lastContacted: new Date("2026-06-01T10:00:00.000Z"),
    createdAt: new Date("2026-05-01T10:00:00.000Z"),
    quietOutcomeReason: "Quote was never answered.",
    conversations: [
      {
        channel: "email",
        messages: [
          { id: "m1", direction: "inbound", body: "What would a refit cost?", sentAt: new Date("2026-06-01T09:00:00.000Z"), opened: false },
          { id: "m2", direction: "outbound", body: "About $12k.", sentAt: new Date("2026-06-01T10:00:00.000Z"), opened: false },
        ],
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  automationFindFirst.mockResolvedValue(null);
  generateFollowUpMessage.mockResolvedValue({ subject: "Your kitchen quote", body: "Still thinking it over?" });
  sendFollowUpToLead.mockResolvedValue({ success: true });
  leadUpdateMany.mockResolvedValue({ count: 1 });
  runUpdate.mockResolvedValue({});
  runUpdateMany.mockResolvedValue({ count: 1 });
  leadCount.mockResolvedValue(0);
});

describe("startReactivationRun", () => {
  it("refuses to open a second batch while one is running", async () => {
    runFindFirst.mockResolvedValue({ id: "run-existing" });
    const result = await startReactivationRun("biz-1");
    expect(result).toEqual({ error: "A reactivation batch is already running." });
    expect(runCreate).not.toHaveBeenCalled();
  });

  it("refuses to open a batch with nothing in it", async () => {
    runFindFirst.mockResolvedValue(null);
    leadCount.mockResolvedValue(0);
    const result = await startReactivationRun("biz-1");
    expect(result).toEqual({ error: "There are no cold leads to reach out to." });
    expect(runCreate).not.toHaveBeenCalled();
  });

  // The number on the screen and the number the loop can reach have to be
  // the same number. "You approved 43" and "51 went out" is a consent
  // failure, not a rounding error.
  it("captures the approved total from the same query the sender uses", async () => {
    runFindFirst.mockResolvedValue(null);
    leadCount.mockResolvedValue(43);
    runCreate.mockResolvedValue({ id: "run-1" });

    const result = await startReactivationRun("biz-1");

    expect(result).toEqual({ runId: "run-1", totalPlanned: 43 });
    expect(runCreate).toHaveBeenCalledWith({ data: { businessId: "biz-1", totalPlanned: 43 } });
    expect(leadCount.mock.calls[0][0].where).toMatchObject({
      businessId: "biz-1",
      quietOutcome: "COLD",
      reactivationSentAt: null,
      optedOutAt: null,
    });
  });

  it("records who approved messaging the back catalogue", async () => {
    runFindFirst.mockResolvedValue(null);
    leadCount.mockResolvedValue(43);
    runCreate.mockResolvedValue({ id: "run-1" });

    await startReactivationRun("biz-1");
    await new Promise((r) => setTimeout(r, 0)); // recordAudit is fire-and-forget

    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "reactivation.batch_approved", targetId: "run-1" }),
      })
    );
  });
});

describe("stopReactivationRun", () => {
  it("scopes the stop to the caller's own business", async () => {
    await stopReactivationRun("biz-1", "run-1", "user-1");
    // Without businessId in the WHERE, anyone who learned a run id could
    // stop another business's batch.
    expect(runUpdateMany.mock.calls[0][0].where).toMatchObject({
      id: "run-1",
      businessId: "biz-1",
      status: "RUNNING",
    });
  });

  // A second press, or a press landing just as the run finishes, must not
  // rewrite a COMPLETED run into a STOPPED one — that would destroy the
  // only record of what actually happened.
  it("only stops a run that is still running", async () => {
    runUpdateMany.mockResolvedValue({ count: 0 });
    const result = await stopReactivationRun("biz-1", "run-1", "user-1");
    expect(result).toEqual({ stopped: false });
    expect(auditCreate).not.toHaveBeenCalled();
  });
});

describe("runReactivationSend — Stop means stop", () => {
  it("stops within one message when Stop lands mid-batch", async () => {
    runFindFirst.mockResolvedValue({ id: "run-1", status: "RUNNING", sent: 0, failed: 0, skipped: 0 });

    // The owner presses Stop in another invocation after the 2nd pre-send
    // check. The loop only finds out by re-reading the row.
    let checks = 0;
    runFindUnique.mockImplementation(async () => {
      checks += 1;
      return { status: checks <= 2 ? "RUNNING" : "STOPPED" };
    });
    leadFindFirst.mockImplementation(async () => coldLead(`lead-${checks}`));

    const result = await runReactivationSend("biz-1", "run-1", { spacingMs: 0 });

    expect(result.status).toBe("STOPPED");
    // Two sends got through; the third check saw STOPPED and broke before
    // sending. Crucially NOT 40 — the batch did not run to completion.
    expect(sendFollowUpToLead).toHaveBeenCalledTimes(2);
    expect(result.sent).toBe(2);
  });

  // The whole reason the run is a row. If the loop trusted a value read
  // once at the top, Stop could never reach it.
  it("re-reads the run's status before every single send", async () => {
    runFindFirst.mockResolvedValue({ id: "run-1", status: "RUNNING", sent: 0, failed: 0, skipped: 0 });
    let calls = 0;
    runFindUnique.mockImplementation(async () => {
      calls += 1;
      return { status: calls <= 3 ? "RUNNING" : "STOPPED" };
    });
    leadFindFirst.mockImplementation(async () => coldLead(`lead-${calls}`));

    await runReactivationSend("biz-1", "run-1", { spacingMs: 0 });

    // One status read per send attempt, plus the one that caught the stop.
    expect(runFindUnique).toHaveBeenCalledTimes(sendFollowUpToLead.mock.calls.length + 1);
  });

  it("does nothing at all on a run that was already stopped", async () => {
    runFindFirst.mockResolvedValue({ id: "run-1", status: "STOPPED", sent: 12, failed: 0, skipped: 0 });
    const result = await runReactivationSend("biz-1", "run-1", { spacingMs: 0 });
    expect(sendFollowUpToLead).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: "STOPPED", sent: 12 });
  });

  it("refuses a run id belonging to another business", async () => {
    runFindFirst.mockResolvedValue(null); // the businessId filter excluded it
    const result = await runReactivationSend("biz-1", "someone-elses-run", { spacingMs: 0 });
    expect(result.status).toBe("FAILED");
    expect(sendFollowUpToLead).not.toHaveBeenCalled();
  });
});

describe("runReactivationSend — nobody is messaged twice", () => {
  it("claims a lead before spending anything on it", async () => {
    runFindFirst.mockResolvedValue({ id: "run-1", status: "RUNNING", sent: 0, failed: 0, skipped: 0 });
    runFindUnique.mockResolvedValueOnce({ status: "RUNNING" }).mockResolvedValue({ status: "STOPPED" });
    leadFindFirst.mockResolvedValue(coldLead("lead-1"));

    await runReactivationSend("biz-1", "run-1", { spacingMs: 0 });

    // Claimed conditionally on still being unclaimed — and claimed BEFORE
    // the OpenAI call, so a crash mid-draft costs one lead rather than
    // producing a duplicate message.
    expect(leadUpdateMany).toHaveBeenCalledWith({
      where: { id: "lead-1", reactivationSentAt: null },
      data: { reactivationSentAt: expect.any(Date) },
    });
    const claimOrder = leadUpdateMany.mock.invocationCallOrder[0];
    const draftOrder = generateFollowUpMessage.mock.invocationCallOrder[0];
    expect(claimOrder).toBeLessThan(draftOrder);
  });

  it("skips a lead another invocation already claimed, without drafting or sending", async () => {
    runFindFirst.mockResolvedValue({ id: "run-1", status: "RUNNING", sent: 0, failed: 0, skipped: 0 });
    runFindUnique.mockResolvedValueOnce({ status: "RUNNING" }).mockResolvedValue({ status: "STOPPED" });
    leadFindFirst.mockResolvedValue(coldLead("lead-1"));
    leadUpdateMany.mockResolvedValue({ count: 0 }); // lost the race

    const result = await runReactivationSend("biz-1", "run-1", { spacingMs: 0 });

    expect(generateFollowUpMessage).not.toHaveBeenCalled();
    expect(sendFollowUpToLead).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });

  // A send that threw after the provider accepted the message is
  // indistinguishable from one that never left. "We might have already
  // emailed them" has to resolve to "don't email them again."
  it("keeps the claim when a send throws", async () => {
    runFindFirst.mockResolvedValue({ id: "run-1", status: "RUNNING", sent: 0, failed: 0, skipped: 0 });
    runFindUnique.mockResolvedValueOnce({ status: "RUNNING" }).mockResolvedValue({ status: "STOPPED" });
    leadFindFirst.mockResolvedValue(coldLead("lead-1"));
    sendFollowUpToLead.mockRejectedValue(new Error("SMTP exploded"));

    const result = await runReactivationSend("biz-1", "run-1", { spacingMs: 0 });

    expect(result.failed).toBe(1);
    const releases = leadUpdateMany.mock.calls.filter(
      (c) => (c[0] as { data: Record<string, unknown> }).data.reactivationSentAt === null
    );
    expect(releases).toHaveLength(0);
  });
});

/**
 * A batch larger than SENDS_PER_INVOCATION is finished by a SECOND call to
 * runReactivationSend, and the progress counters are written straight onto
 * the run row. Starting them at zero each time meant invocation two
 * overwrote invocation one's totals: the owner's progress bar reset, and
 * the reactivation.batch_completed audit event — the record of how many of
 * their past customers were actually messaged on their say-so — reported
 * only the last slice.
 */
describe("runReactivationSend — progress survives being resumed", () => {
  it("continues the run's totals instead of restarting them at zero", async () => {
    // A resumed run: 40 already went out in an earlier invocation.
    runFindFirst.mockResolvedValue({ id: "run-1", status: "RUNNING", sent: 40, failed: 2, skipped: 1 });
    runFindUnique.mockResolvedValueOnce({ status: "RUNNING" }).mockResolvedValue({ status: "STOPPED" });
    leadFindFirst.mockResolvedValue(coldLead("lead-41"));

    const result = await runReactivationSend("biz-1", "run-1", { spacingMs: 0 });

    expect(sendFollowUpToLead).toHaveBeenCalledTimes(1);
    expect(result.sent).toBe(41);
    expect(result.failed).toBe(2);
    expect(result.skipped).toBe(1);
    // And the row the owner's screen polls carries the cumulative figure,
    // not this invocation's one send.
    expect(runUpdate).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: { sent: 41, failed: 2, skipped: 1 },
    });
  });

  it("reports the whole run's totals on the completion audit event", async () => {
    runFindFirst.mockResolvedValue({ id: "run-1", status: "RUNNING", sent: 40, failed: 0, skipped: 0 });
    runFindUnique.mockResolvedValue({ status: "RUNNING" });
    leadFindFirst.mockResolvedValueOnce(coldLead("lead-41")).mockResolvedValue(null);
    leadCount.mockResolvedValue(0);

    const result = await runReactivationSend("biz-1", "run-1", { spacingMs: 0 });
    await new Promise((r) => setTimeout(r, 0)); // recordAudit is fire-and-forget

    expect(result.status).toBe("COMPLETED");
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "reactivation.batch_completed",
          meta: expect.objectContaining({ sent: 41 }),
        }),
      })
    );
  });
});

describe("runReactivationSend — who can be reached", () => {
  it("only ever sends to the COLD bucket", async () => {
    runFindFirst.mockResolvedValue({ id: "run-1", status: "RUNNING", sent: 0, failed: 0, skipped: 0 });
    runFindUnique.mockResolvedValue({ status: "STOPPED" });
    leadFindFirst.mockResolvedValue(null);

    await runReactivationSend("biz-1", "run-1", { spacingMs: 0 });

    // COLD_UNANSWERED is the one that matters here: those leads wrote to us
    // and got nothing back. A "still interested?" to them makes it worse.
    for (const call of leadFindFirst.mock.calls) {
      expect(call[0].where.quietOutcome).toBe("COLD");
    }
  });

  // The approved list is a snapshot. An owner can spend ten minutes reading
  // it, and in that time a lead can reply, text STOP, or be marked won.
  it("re-checks eligibility at send time, not just when the batch was built", async () => {
    runFindFirst.mockResolvedValue({ id: "run-1", status: "RUNNING", sent: 0, failed: 0, skipped: 0 });
    runFindUnique.mockResolvedValueOnce({ status: "RUNNING" }).mockResolvedValue({ status: "STOPPED" });
    leadFindFirst.mockResolvedValue(coldLead("lead-1"));

    await runReactivationSend("biz-1", "run-1", { spacingMs: 0 });

    // Re-queried per send rather than fetched once as a list.
    expect(leadFindFirst.mock.calls[0][0].where).toMatchObject({
      optedOutAt: null,
      stage: { notIn: ["WON", "LOST"] },
      reactivationSentAt: null,
    });
  });

  it("completes when there is nobody left, and says so once", async () => {
    runFindFirst.mockResolvedValue({ id: "run-1", status: "RUNNING", sent: 0, failed: 0, skipped: 0 });
    runFindUnique.mockResolvedValue({ status: "RUNNING" });
    leadFindFirst.mockResolvedValue(null); // nothing to send
    leadCount.mockResolvedValue(0);

    const result = await runReactivationSend("biz-1", "run-1", { spacingMs: 0 });

    expect(result.status).toBe("COMPLETED");
    expect(runUpdateMany).toHaveBeenCalledWith({
      where: { id: "run-1", status: "RUNNING" },
      data: { status: "COMPLETED", endedAt: expect.any(Date) },
    });
  });
});
