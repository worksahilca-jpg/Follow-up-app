/**
 * "FollowUp learns what you do" (A-099, src/lib/habits.ts). FollowUp asks
 * only after the owner has done the same thing by hand SUGGEST_AFTER times,
 * asks once per habit, and changes nothing until the owner says yes.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { ownerHabit, auditEvent, message } = vi.hoisted(() => ({
  ownerHabit: { findMany: vi.fn(), upsert: vi.fn() },
  auditEvent: { count: vi.fn(), findFirst: vi.fn() },
  message: { findFirst: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: { ownerHabit, auditEvent, message } }));

import { decideHabit, findHabitSuggestion, getHabits, habitOn, SUGGEST_AFTER, thanksIsNewest, weekendWaitUntil } from "@/lib/habits";

const NOW = new Date("2026-10-06T15:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  ownerHabit.findMany.mockResolvedValue([]);
  ownerHabit.upsert.mockResolvedValue({});
  auditEvent.count.mockResolvedValue(0);
  auditEvent.findFirst.mockResolvedValue(null);
  message.findFirst.mockResolvedValue(null);
});

describe("when Today asks", () => {
  it("asks nothing until the owner has done it enough times", async () => {
    auditEvent.count.mockResolvedValue(SUGGEST_AFTER - 1);
    expect(await findHabitSuggestion("biz1", NOW)).toBeNull();
  });

  it("asks about skipping thanks, with a short quote of the latest one", async () => {
    auditEvent.count.mockImplementation(async ({ where }) => (where.action === "ai.hold_dismissed" ? 4 : 0));
    auditEvent.findFirst.mockResolvedValue({ targetId: "lead1" });
    message.findFirst.mockResolvedValue({ body: "Thanks,\n got it!" });
    expect(await findHabitSuggestion("biz1", NOW)).toEqual({ kind: "skip_thanks", count: 4, example: "Thanks, got it!" });
    // Only this business's evidence, only "Don't send" on a thank-you, only the last 30 days.
    const where = auditEvent.count.mock.calls[0][0].where;
    expect(where).toMatchObject({ businessId: "biz1", action: "ai.hold_dismissed", meta: { path: ["thanksOnly"], equals: true } });
    expect(where.createdAt.gte.getTime()).toBe(NOW.getTime() - 30 * 86_400_000);
    expect(message.findFirst.mock.calls[0][0].where.conversation).toEqual({ leadId: "lead1", lead: { businessId: "biz1" } });
  });

  it("cuts a long example short", async () => {
    auditEvent.count.mockResolvedValue(5);
    auditEvent.findFirst.mockResolvedValue({ targetId: "lead1" });
    message.findFirst.mockResolvedValue({ body: "Thank you so much for all of your help with everything this week" });
    const s = await findHabitSuggestion("biz1", NOW);
    expect(s?.example?.length).toBe(40);
    expect(s?.example?.endsWith("…")).toBe(true);
  });

  it("never asks again about a habit the owner already answered, yes or no", async () => {
    auditEvent.count.mockResolvedValue(9);
    ownerHabit.findMany.mockResolvedValue([{ kind: "skip_thanks", status: "declined", evidence: 4, decidedAt: NOW }]);
    const s = await findHabitSuggestion("biz1", NOW);
    expect(s?.kind).toBe("weekend_wait");
    ownerHabit.findMany.mockResolvedValue([
      { kind: "skip_thanks", status: "declined", evidence: 4, decidedAt: NOW },
      { kind: "weekend_wait", status: "off", evidence: 5, decidedAt: NOW },
    ]);
    expect(await findHabitSuggestion("biz1", NOW)).toBeNull();
  });

  it("asks nothing when the read fails", async () => {
    auditEvent.count.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await findHabitSuggestion("biz1", NOW)).toBeNull();
  });
});

describe("the owner's answer", () => {
  it("records a yes with how many times it was seen", async () => {
    auditEvent.count.mockResolvedValue(6);
    await decideHabit("biz1", "u1", "skip_thanks", "on", NOW);
    const call = ownerHabit.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ businessId_kind: { businessId: "biz1", kind: "skip_thanks" } });
    expect(call.create).toMatchObject({ businessId: "biz1", kind: "skip_thanks", status: "on", evidence: 6, decidedById: "u1" });
  });

  it("Undo turns it off without recounting", async () => {
    await decideHabit("biz1", "u1", "weekend_wait", "off", NOW);
    expect(auditEvent.count).not.toHaveBeenCalled();
    expect(ownerHabit.upsert.mock.calls[0][0].update).toMatchObject({ status: "off" });
  });

  it("only a yes switches a habit on", async () => {
    ownerHabit.findMany.mockResolvedValue([
      { kind: "skip_thanks", status: "declined", evidence: 4, decidedAt: NOW },
      { kind: "weekend_wait", status: "on", evidence: 5, decidedAt: NOW },
      { kind: "something_old", status: "on", evidence: 1, decidedAt: NOW },
    ]);
    const habits = await getHabits("biz1");
    expect(habits.map((h) => h.kind)).toEqual(["skip_thanks", "weekend_wait"]);
    expect(habitOn(habits, "skip_thanks")).toBe(false);
    expect(habitOn(habits, "weekend_wait")).toBe(true);
  });

  it("reads no habits when the read fails, which changes nothing", async () => {
    ownerHabit.findMany.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await getHabits("biz1")).toEqual([]);
  });
});

describe("skip_thanks only covers the newest message", () => {
  const at = new Date("2026-10-06T12:00:00Z");
  it("skips when the thanks is the newest message", () => {
    expect(thanksIsNewest(at, at)).toBe(true);
  });
  it("answers as usual once they write again", () => {
    expect(thanksIsNewest(at, new Date("2026-10-06T12:05:00Z"))).toBe(false);
  });
  it("answers as usual when nothing was flagged", () => {
    expect(thanksIsNewest(null, at)).toBe(false);
    expect(thanksIsNewest(at, null)).toBe(false);
  });
});

describe("weekend_wait", () => {
  const tz = "America/Toronto";
  const saturday = new Date("2026-10-10T16:00:00Z"); // Sat noon in Toronto
  const mondayNine = new Date("2026-10-12T13:00:00Z"); // Mon 9 am in Toronto (EDT)

  it("holds a weekend message until Monday 9 am", () => {
    expect(weekendWaitUntil(saturday, saturday, tz)).toEqual(mondayNine);
  });
  it("lets it back from Monday 9 am", () => {
    expect(weekendWaitUntil(saturday, mondayNine, tz)).toBeNull();
  });
  it("never holds a weekday message", () => {
    const tuesday = new Date("2026-10-06T16:00:00Z");
    expect(weekendWaitUntil(tuesday, tuesday, tz)).toBeNull();
  });
});
