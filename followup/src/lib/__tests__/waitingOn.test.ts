/**
 * "Waiting on customers" and reply speed (A-050, the Close study).
 */
import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { describeNext, getWaitingOn, isWaitingOnCustomer, medianReplyMs, sentLabel } from "@/lib/waitingOn";
import { weekLine } from "@/lib/weekLine";
import type { BusinessAutomationRules } from "@/lib/automationStatus";
import type { Lead } from "@/lib/types";

const NOW = new Date("2026-09-26T16:00:00Z"); // Saturday noon in Toronto
const TZ = "America/Toronto";
const DAY = 86_400_000;
const MIN = 60_000;
const rules: BusinessAutomationRules = {
  canSend: true, holdAllForApproval: true, masterEnabled: true, silenceTriggerDays: 3,
  unansweredEnabled: true, unansweredHours: 24, deadLeadEnabled: true, deadLeadDays: 45,
};
function lead(name: string, over: Partial<Lead>): Lead {
  return { id: name, name, stage: "contacted", lastContacted: NOW.toISOString(), conversation: [], automationStatus: { kind: "sent" }, ...over } as unknown as Lead;
}
const msg = (direction: "inbound" | "outbound", msAgo: number, trigger?: string, body = "x") =>
  ({ id: `${direction}${msAgo}`, direction, channel: "email", body, date: new Date(NOW.getTime() - msAgo).toISOString(), trigger });

describe("who is waiting on the customer", () => {
  it("is anyone whose newest message is ours", () => {
    expect(isWaitingOnCustomer(lead("Omar", { conversation: [msg("inbound", 2 * DAY), msg("outbound", DAY)] as Lead["conversation"] }))).toBe(true);
    expect(isWaitingOnCustomer(lead("Priya", { conversation: [msg("outbound", 2 * DAY), msg("inbound", DAY)] as Lead["conversation"] }))).toBe(false);
  });

  it("doesn't count the instant acknowledgement as an answer", () => {
    expect(isWaitingOnCustomer(lead("Ana", { conversation: [msg("inbound", 10 * MIN), msg("outbound", 9 * MIN, "instant_ack")] as Lead["conversation"] }))).toBe(false);
  });

  it("leaves out closed customers and anyone waiting for your OK", () => {
    const won = lead("Won", { stage: "won", conversation: [msg("outbound", DAY)] as Lead["conversation"] });
    expect(isWaitingOnCustomer(won)).toBe(false);
    const held = lead("Held", { conversation: [msg("outbound", DAY)] as Lead["conversation"] });
    expect(getWaitingOn([held], rules, NOW, TZ, new Set(["Held"]))).toEqual([]);
  });
});

describe("what happens next, by name", () => {
  it("says the check-in and its condition", () => {
    const l = lead("Omar Haddad", {
      conversation: [msg("outbound", 2 * DAY)] as Lead["conversation"],
      lastContacted: new Date(NOW.getTime() - 2 * DAY).toISOString(),
    });
    expect(describeNext(l, rules, NOW, TZ)).toBe("First check-in tomorrow, unless Omar writes first.");
  });

  it("says when FollowUp is waiting after a call", () => {
    const l = lead("Devon Ruiz", { automationStatus: { kind: "talked", at: NOW.toISOString() } });
    expect(describeNext(l, rules, NOW, TZ)).toBe("You marked “We talked”. FollowUp waits for Devon.");
  });

  it("says when nothing more is planned", () => {
    const l = lead("Mike", { automationStatus: { kind: "sent" } });
    expect(describeNext(l, { ...rules, masterEnabled: false, deadLeadEnabled: false }, NOW, TZ)).toBe("FollowUp won’t write again unless Mike does.");
    expect(describeNext(lead("Off", { automationStatus: { kind: "off" } }), rules, NOW, TZ)).toBe("Follow-ups are off for Off.");
  });

  it("dates the last message looking back", () => {
    expect(sentLabel(new Date(NOW.getTime() - DAY), NOW, TZ)).toBe("Yesterday");
    expect(sentLabel(new Date(NOW.getTime() - 3 * DAY), NOW, TZ)).toBe("3 days ago");
  });
});

describe("how fast customers heard back", () => {
  const since = new Date(NOW.getTime() - 7 * DAY);

  it("is the median time from a customer writing to the first real reply", () => {
    const a = lead("A", { conversation: [msg("inbound", 60 * MIN), msg("outbound", 54 * MIN)] as Lead["conversation"] }); // 6 min
    const b = lead("B", { conversation: [msg("inbound", 2 * DAY), msg("outbound", 2 * DAY - 20 * MIN)] as Lead["conversation"] }); // 20 min
    const c = lead("C", { conversation: [msg("inbound", 3 * DAY), msg("outbound", 3 * DAY - 2 * MIN)] as Lead["conversation"] }); // 2 min
    expect(medianReplyMs([a, b, c], since, NOW)).toBe(6 * MIN);
  });

  it("skips the instant acknowledgement and measures from the first message of the turn", () => {
    const l = lead("L", {
      conversation: [msg("inbound", 60 * MIN), msg("outbound", 59 * MIN, "instant_ack"), msg("inbound", 50 * MIN), msg("outbound", 30 * MIN)] as Lead["conversation"],
    });
    expect(medianReplyMs([l], since, NOW)).toBe(30 * MIN);
  });

  it("is null with no replies this week, and never counts older turns", () => {
    const old = lead("Old", { conversation: [msg("inbound", 9 * DAY), msg("outbound", 9 * DAY - MIN)] as Lead["conversation"] });
    const unanswered = lead("U", { conversation: [msg("inbound", DAY)] as Lead["conversation"] });
    expect(medianReplyMs([old, unanswered], since, NOW)).toBeNull();
  });

  it("leads the week line when there is one", () => {
    expect(weekLine({ answered: 11, cameBack: 2, booked: 0, asWritten: 18, sent: 21, heardBackMs: 6 * MIN })).toBe(
      "This week: customers heard back in 6 min · 11 customers answered · 2 came back · 18 of 21 sent without changing a word"
    );
    expect(weekLine({ answered: 0, cameBack: 0, booked: 0, asWritten: 0, sent: 0, heardBackMs: null })).toBeNull();
  });
});
