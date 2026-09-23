/**
 * The "what FollowUp saved you" report must never flatter itself: only
 * replies to messages FollowUp sent on its own count, each lead counts
 * once, and money is split into in-play vs closed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: { followUp: { findMany: vi.fn() }, booking: { count: vi.fn() } },
}));

import { prisma } from "@/lib/db";
import { getRescueReport, renderRescueDigest } from "@/lib/rescued";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const h = (hours: number) => new Date(Date.now() - hours * 3_600_000);

function sentRow(leadId: string, over: Record<string, unknown> = {}) {
  return {
    leadId,
    trigger: "unanswered",
    sentAt: h(50),
    repliedAt: h(40),
    lead: { id: leadId, name: `Lead ${leadId}`, dealValue: 1000, stage: "NEW" },
    ...over,
  };
}

beforeEach(() => {
  p.booking.count.mockResolvedValue(0);
});

describe("rescue report", () => {
  it("only asks for automated sends — manual replies are the owner's own work", async () => {
    p.followUp.findMany.mockResolvedValue([]);
    await getRescueReport("biz1", 7);
    expect(p.followUp.findMany.mock.calls[0][0].where).toMatchObject({ automated: true, status: "sent" });
  });

  it("counts a lead once even if several automated messages got replies", async () => {
    p.followUp.findMany.mockResolvedValue([sentRow("a"), sentRow("a", { trigger: "silence" }), sentRow("b", { repliedAt: null })]);
    const r = await getRescueReport("biz1", 7);
    expect(r.answeredForYou).toBe(3);
    expect(r.rescued).toBe(1);
    expect(r.leads[0]).toMatchObject({ id: "a", repliedAfterHours: 10 });
  });

  it("splits value into in-play and closed, and counts bookings for rescued leads only", async () => {
    p.followUp.findMany.mockResolvedValue([
      sentRow("a", { lead: { id: "a", name: "A", dealValue: 5000, stage: "WON" } }),
      sentRow("b", { lead: { id: "b", name: "B", dealValue: 2000, stage: "QUALIFIED" } }),
      sentRow("c", { lead: { id: "c", name: "C", dealValue: 900, stage: "LOST" } }),
    ]);
    p.booking.count.mockResolvedValue(2);
    const r = await getRescueReport("biz1", 7);
    expect(r.won).toBe(1);
    expect(r.wonValue).toBe(5000);
    expect(r.valueInPlay).toBe(2000);
    expect(r.booked).toBe(2);
    expect(p.booking.count.mock.calls[0][0].where.leadId.in.sort()).toEqual(["a", "b", "c"]);
  });

  // The query is ordered sentAt DESC, so the oldest follow-up is iterated
  // LAST. The dedup used to compare `f.repliedAt > new Date(existing.repliedAfterHours)`
  // — a real Date against a DURATION-in-hours reinterpreted as epoch
  // milliseconds (new Date(2) is 2ms past 1970) — which is always true, so
  // the last row always won and every lead was attributed to its OLDEST
  // follow-up.
  it("attributes a lead to the follow-up it replied to MOST recently, not the oldest one", async () => {
    p.followUp.findMany.mockResolvedValue([
      // Newest send first, as the sentAt: "desc" query returns them.
      sentRow("a", { trigger: "unanswered", sentAt: h(10), repliedAt: h(6) }),
      sentRow("a", { trigger: "silence", sentAt: h(100), repliedAt: h(98) }),
    ]);

    const r = await getRescueReport("biz1", 7);

    expect(r.rescued).toBe(1);
    // Was { trigger: "silence", repliedAfterHours: 2 } — the 100-hour-old
    // message, not the one that actually brought them back.
    expect(r.leads[0]).toMatchObject({ id: "a", trigger: "unanswered", repliedAfterHours: 4 });
  });

  it("orders leads by most recent reply first, which is what the digest's top-10 slice depends on", async () => {
    p.followUp.findMany.mockResolvedValue([
      sentRow("older", { sentAt: h(20), repliedAt: h(19) }),
      sentRow("newer", { sentAt: h(30), repliedAt: h(2) }),
    ]);

    const r = await getRescueReport("biz1", 7);

    expect(r.leads.map((l) => l.id)).toEqual(["newer", "older"]);
  });

  it("renders a digest an owner can read in ten seconds", async () => {
    p.followUp.findMany.mockResolvedValue([sentRow("a")]);
    const r = await getRescueReport("biz1", 7);
    const text = renderRescueDigest("MJ Homes", r, "https://followupbase.io");
    expect(text).toContain("Conversations won back: 1");
    expect(text).toContain("Lead a — replied when you hadn't, replied 10h later");
    expect(text).toContain("https://followupbase.io/dashboard");
  });
});

/**
 * The weekly digest on an account that holds every message for approval
 * — which is every account by default since `Business.holdAllForApproval`
 * became `@default(true)` on 2026-09-21.
 *
 * ## The line this replaces
 *
 *   "Nobody came back this week yet — every lead that wrote in was still
 *    answered within a minute."
 *
 * Two things wrong with it, one fatal.
 *
 * Fatal: on a holding account nothing was answered at all. holdAllForApproval
 * stops the instant acknowledgement too — acknowledge.ts withdrew that
 * message's exemption deliberately ("the only thing that could reach a
 * stranger with nobody having read it"). So this was an email, sent to the
 * owner's own inbox, telling them their leads had been answered within a
 * minute while those replies sat unsent in their own approval queue.
 *
 * Structural, and true on every account: this report counts automated
 * sends and the leads who replied to them. It never counted how many
 * leads wrote in. "Every lead that wrote in was answered" was not
 * something it knew — it was inferred from an empty list, and it happened
 * to read well.
 *
 * The replacement says what the week actually was, and names the one
 * thing that needs the owner.
 */
describe("the weekly digest's quiet week", () => {
  const EMPTY = {
    days: 7,
    answeredForYou: 0,
    rescued: 0,
    booked: 0,
    won: 0,
    valueInPlay: 0,
    wonValue: 0,
    leads: [],
  };

  it("never claims leads were answered when replies are sitting in the queue", () => {
    const body = renderRescueDigest("Acme Plumbing", EMPTY, "https://followupbase.io", 12);
    expect(body, "the digest still claims an answer it did not send").not.toMatch(/answered within a minute/i);
  });

  it("tells the owner what is waiting, and that it will not go without them", () => {
    const body = renderRescueDigest("Acme Plumbing", EMPTY, "https://followupbase.io", 12);
    expect(body).toMatch(/12 replies written and waiting for your OK/);
    expect(body, "the owner is not told the queue is theirs to release").toMatch(/Nothing goes out until you send it/);
  });

  it("counts one reply in the singular — an owner reads this in their inbox", () => {
    const body = renderRescueDigest("Acme Plumbing", EMPTY, "https://followupbase.io", 1);
    expect(body).toMatch(/there is 1 reply written/);
    expect(body).not.toMatch(/1 replies/);
  });

  it("drops the fabricated claim even on an account with nothing waiting", () => {
    // The structural half. With no queue and no rescues there is simply
    // nothing to report, and the old line filled that silence with a fact
    // the report never had.
    const body = renderRescueDigest("Acme Plumbing", EMPTY, "https://followupbase.io", 0);
    expect(body).not.toMatch(/answered within a minute/i);
    expect(body).toMatch(/nothing is waiting on you/i);
  });

  it("does not invent a waiting line when nothing is waiting", () => {
    const body = renderRescueDigest("Acme Plumbing", EMPTY, "https://followupbase.io", 0);
    expect(body).not.toMatch(/waiting for your OK/);
  });

  it("still leads with the rescues when the week actually had some", () => {
    // The held count must not bury a real result. A week with leads who
    // came back is still a week about those leads.
    const withLeads = {
      ...EMPTY,
      rescued: 1,
      leads: [{ id: "l1", name: "Sarah", trigger: "unanswered", repliedAfterHours: 3, dealValue: 0, stage: "CONTACTED" }],
    } as unknown as Parameters<typeof renderRescueDigest>[1];
    const body = renderRescueDigest("Acme Plumbing", withLeads, "https://followupbase.io", 4);
    expect(body).toMatch(/Who came back:/);
    expect(body).toMatch(/Sarah/);
    // …and the queue is still reported, in the summary block at the top.
    expect(body).toMatch(/Written and waiting for your OK: 4/);
  });
});
