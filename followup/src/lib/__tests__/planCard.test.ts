/**
 * What the customer's page says about their plan (A-245): the next message
 * and when, the day they asked for, or why nothing will go out, never a
 * date the engine won't keep (app analysis 2026-10-14, fix 2).
 */
import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { planCard } from "@/lib/planCard";
import type { BusinessAutomationRules } from "@/lib/automationStatus";
import type { Lead } from "@/lib/types";

const NOW = new Date("2026-10-14T16:00:00Z"); // Wednesday noon in Toronto
const TZ = "America/Toronto";
const H = 3_600_000;
const D = 24 * H;
const rules: BusinessAutomationRules = {
  canSend: true, holdAllForApproval: false, masterEnabled: true, followUpPlans: {},
  unansweredEnabled: true, unansweredHours: 24, deadLeadEnabled: true, deadLeadDays: 45,
};
const msg = (direction: "inbound" | "outbound", msAgo: number) => ({ id: `${direction}${msAgo}`, direction, channel: "email", body: "x", date: new Date(NOW.getTime() - msAgo).toISOString() });
function lead(over: Partial<Lead> = {}): Lead {
  return {
    id: "l1",
    name: "Priya Shah",
    lastContacted: new Date(NOW.getTime() - 6 * H).toISOString(),
    conversation: [msg("inbound", 7 * H), msg("outbound", 6 * H)],
    automationStatus: { kind: "sent" },
    ...over,
  } as unknown as Lead;
}

describe("the plan line on a customer's page", () => {
  it("names the plan and the next message, as drawn", () => {
    const c = planCard(lead(), rules, NOW, TZ)!;
    expect(c.title).toBe("On the Fast plan");
    expect(c.sentence).toBe("Next message Thursday, Oct 15, the first of 5. It stops when they book, reply or say no. Nothing for you to do.");
  });

  it("says each message waits for the owner on an account that holds them", () => {
    expect(planCard(lead(), { ...rules, holdAllForApproval: true }, NOW, TZ)!.sentence).toMatch(/Each one waits for your OK on Today\.$/);
  });

  it("holds for the day they asked for, then carries on", () => {
    const c = planCard(lead({ followUp: { tier: "later", notBeforeMs: Date.UTC(2027, 2, 1, 12) } }), rules, NOW, TZ)!;
    expect(c.title).toBe("On the Long plan");
    expect(c.sentence).toBe("Priya asked to hear back in March, so nothing goes out before Monday, Mar 1. Then the Long plan carries on. Nothing for you to do.");
    expect(c.waitingFor).toBe("Mar 1");
  });

  it("says Paused, and why, instead of a date when nothing can go out", () => {
    expect(planCard(lead(), { ...rules, canSend: false }, NOW, TZ)!.sentence).toBe("Paused: nothing can go out until you reconnect your email or Instagram in Settings.");
    expect(planCard(lead(), { ...rules, masterEnabled: false }, NOW, TZ)!.sentence).toBe("Paused: check-ins are switched off in Settings.");
    expect(planCard(lead({ automationStatus: { kind: "off" } }), rules, NOW, TZ)!.sentence).toMatch(/^Paused: you turned FollowUp off for Priya/);
  });

  it("says the plan stopped when they booked", () => {
    const c = planCard(lead({ followUp: { bookings: [{ createdAt: NOW.getTime() - H, scheduledAt: NOW.getTime() + 2 * D }] } }), rules, NOW, TZ)!;
    expect(c.sentence).toBe("Priya booked, so the plan stopped. If they write again, it starts again.");
  });

  it("waits for the reply when they wrote last, and shows nothing on a closed deal", () => {
    expect(planCard(lead({ conversation: [msg("outbound", 7 * H), msg("inbound", 6 * H)] as Lead["conversation"] }), rules, NOW, TZ)!.sentence).toBe(
      "It starts once Priya has had your reply."
    );
    expect(planCard(lead({ automationStatus: { kind: "closed" } }), rules, NOW, TZ)).toBeNull();
  });
});
