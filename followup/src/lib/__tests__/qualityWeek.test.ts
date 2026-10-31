/**
 * The founder's week with real customers (src/lib/qualityWeek.ts): drafts sent as written, changed or not sent by the
 * situation that produced them, and a model version that answered for the first time. Counts only.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const { sendAlertEmail } = vi.hoisted(() => ({ sendAlertEmail: vi.fn(async () => ({ sent: true as const })) }));
vi.mock("@/lib/alertEmail", () => ({ sendAlertEmail }));
vi.mock("@/lib/db", () => ({
  prisma: {
    followUp: {
      findMany: vi.fn(async () => [
        { trigger: "silence", status: "sent", draftEdited: false, editSize: 0 },
        { trigger: "silence", status: "sent", draftEdited: true, editSize: 0.4 },
        { trigger: "instant_ack", status: "sent", draftEdited: null, editSize: null },
        { trigger: "silence", status: "dismissed", draftEdited: null, editSize: null },
      ]),
    },
    businessFact: { count: vi.fn(async () => 2) },
    learningEvent: { groupBy: vi.fn(async () => [{ kind: "training_rule", action: "created", _count: { _all: 3 } }]) },
    aiDecision: {
      // Customers' calls first, then tests' (the order gatherQualityWeek asks).
      aggregate: vi
        .fn()
        .mockResolvedValueOnce({ _count: { _all: 2 }, _sum: { costMicros: 20_000 } })
        .mockResolvedValueOnce({ _count: { _all: 1 }, _sum: { costMicros: 15_000 } }),
      count: vi.fn(async () => 1),
      groupBy: vi
        .fn()
        .mockResolvedValueOnce([{ modelUsed: "gpt-5.5-2026-10-20", _count: { _all: 2 } }])
        .mockResolvedValueOnce([{ modelUsed: "gpt-5.5-2026-04-01" }]),
    },
    testRun: { aggregate: vi.fn(async () => ({ _count: { _all: 4 }, _sum: { costMicros: 3_100_000 } })) },
  },
}));

import { lessonWords, newModelVersions, qualityWeekText, sendFounderQualityWeek, sendRows } from "@/lib/qualityWeek";

describe("the week in numbers", () => {
  it("counts sent as written, changed, typed and not sent, by situation and in all", () => {
    const { sends, total } = sendRows([
      { trigger: "silence", status: "sent", draftEdited: false, editSize: 0 },
      { trigger: "silence", status: "sent", draftEdited: true, editSize: 0.5 },
      { trigger: "manual", status: "sent", draftEdited: null, editSize: null },
      { trigger: "silence", status: "dismissed", draftEdited: null, editSize: null },
      { trigger: "silence", status: "pending", draftEdited: null, editSize: null },
    ]);
    expect(sends.find((s) => s.label === "Follow-up after they went quiet")).toMatchObject({ sent: 2, asWritten: 1, edited: 1, notSent: 1, avgEdit: 0.25 });
    expect(sends.find((s) => s.label === "Sent by the owner")).toMatchObject({ sent: 1, typed: 1 });
    expect(total).toMatchObject({ sent: 3, asWritten: 1, edited: 1, typed: 1, notSent: 1 });
    expect(sends.some((s) => s.label === "Planned follow-up")).toBe(false);
  });

  it("says what changed on Train in plain words, one or many", () => {
    expect(lessonWords("owner_example", "created", 4)).toBe("4 owner's examples added");
    expect(lessonWords("training_rule", "rolled_back", 1)).toBe("1 rule rolled back");
    expect(lessonWords("something_new", "restored", 2)).toBe("2 something new put back");
  });

  it("flags a model version that answered for the first time", () => {
    expect(newModelVersions(["gpt-5.5-2026-10-20", "gpt-5.4-mini"], ["gpt-5.4-mini"])).toEqual(["gpt-5.5-2026-10-20"]);
    expect(newModelVersions(["gpt-5.4-mini"], ["gpt-5.4-mini"])).toEqual([]);
  });
});

describe("the founder's Monday email", () => {
  beforeEach(() => {
    sendAlertEmail.mockClear();
    vi.stubEnv("PLATFORM_ADMIN_EMAILS", "founder@example.com");
  });

  it("sends the week in numbers once per address, with the new model version called out", async () => {
    const out = await sendFounderQualityWeek(new Date("2026-11-02T13:00:00Z"));
    expect(out.sent).toBe(1);
    const email = (sendAlertEmail.mock.calls[0] as unknown as [{ to: string; subject: string; text: string; idempotencyKey: string }])[0];
    expect(email.to).toBe("founder@example.com");
    expect(email.subject).toMatch(/new AI model version/);
    expect(email.idempotencyKey).toBe("quality-week:2026-10-26:founder@example.com");
    expect(email.text).toContain("3 sent, 1 as written");
    expect(email.text).toContain("AI for customers: 2 calls, $0.02");
    expect(email.text).toContain("Tests run: 4, $3.10");
    expect(email.text).toContain("Train: 3 rules added.");
    expect(email.text).toContain("gpt-5.5-2026-10-20");
  });

  it("sends nothing when no founder address is set", async () => {
    vi.stubEnv("PLATFORM_ADMIN_EMAILS", "");
    expect(await sendFounderQualityWeek()).toEqual({ sent: 0 });
    expect(sendAlertEmail).not.toHaveBeenCalled();
  });

  it("never carries a message's words, only numbers and labels", () => {
    const text = qualityWeekText({
      from: "", to: "",
      sends: [], total: { label: "All", sent: 0, asWritten: 0, edited: 0, typed: 0, notSent: 0, avgEdit: null },
      learned: { factsLearned: 0, factsTold: 0, factsApproved: 0, lessons: [] },
      ai: { realCalls: 0, realCostMicros: 0, testCalls: 0, testCostMicros: 0, failedCalls: 0, models: [], newModels: [] },
      tests: { runs: 0, costMicros: 0 },
    });
    expect(text).not.toMatch(/"/);
  });
});
