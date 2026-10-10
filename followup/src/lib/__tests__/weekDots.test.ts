/**
 * Results' dots (A-226): one per customer, on the day of their first answer,
 * so the days always add up to the week's number. Days are the business's
 * own calendar days.
 */
import { describe, it, expect } from "vitest";
import { bucketFirstAnswers } from "@/lib/weeklyDigest";

const H = 60 * 60 * 1000;
// Sunday Oct 4, midnight in Toronto, to Saturday Oct 10, noon in Toronto.
const from = new Date("2026-10-04T04:00:00Z");
const to = new Date("2026-10-10T16:00:00Z");

describe("customers answered, by day", () => {
  it("counts each customer once, on the day of their first answer", () => {
    const rows = [
      { leadId: "a", at: new Date(from.getTime() + 2 * H) },
      { leadId: "a", at: new Date(from.getTime() + 30 * H) },
      { leadId: "b", at: new Date(from.getTime() + 30 * H) },
      { leadId: "c", at: new Date(to.getTime() - 1 * H) },
    ];
    const days = bucketFirstAnswers(rows, from, to, "America/Toronto");
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.n)).toEqual([1, 1, 0, 0, 0, 0, 1]);
    expect(days.reduce((s, d) => s + d.n, 0)).toBe(new Set(rows.map((r) => r.leadId)).size);
  });

  it("puts a Tuesday evening answer under Tuesday, in the business's time zone", () => {
    // 9pm Tuesday Oct 6 in Toronto is already Wednesday in UTC.
    const days = bucketFirstAnswers([{ leadId: "a", at: new Date("2026-10-07T01:00:00Z") }], from, to, "America/Toronto");
    expect(days.map((d) => d.day).join("")).toBe("SMTWTFS");
    expect(days[2]).toEqual({ day: "T", n: 1 });
  });

  it("keeps the days right across the night the clocks change", () => {
    // Tue Oct 27 to Mon Nov 2 in Toronto; the clocks go back on Sunday Nov 1.
    const f = new Date("2026-10-27T04:00:00Z");
    const t = new Date("2026-11-02T17:00:00Z");
    const lateSunday = new Date("2026-11-02T04:30:00Z"); // 11:30pm Sunday, after the change
    const days = bucketFirstAnswers([{ leadId: "a", at: lateSunday }], f, t, "America/Toronto");
    expect(days.map((d) => d.day).join("")).toBe("TWTFSSM");
    expect(days[5]).toEqual({ day: "S", n: 1 });
  });

  it("finds the first answer even when rows come out of order", () => {
    const rows = [
      { leadId: "a", at: new Date(from.getTime() + 50 * H) },
      { leadId: "a", at: new Date(from.getTime() + 1 * H) },
    ];
    expect(bucketFirstAnswers(rows, from, to, "America/Toronto").map((d) => d.n)).toEqual([1, 0, 0, 0, 0, 0, 0]);
  });
});
