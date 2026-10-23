/**
 * The Customers page's places (All · Needs you · Going quiet · Waiting).
 *
 * The tabs showed `places[p].length` as their count, while the rows under
 * a tab came from a map in which each customer has ONE place (needs you,
 * then going quiet, then waiting). A customer FollowUp answered who has
 * been silent for a week is both "waiting on the customer" and at risk of
 * being lost, so they were counted in both tabs and listed under one:
 * "Waiting 5", then four rows.
 */
import { describe, expect, it } from "vitest";
import { customerPlaces } from "@/lib/customerPlaces";

describe("customerPlaces", () => {
  it("puts a customer who is both going quiet and waiting in Going quiet only", () => {
    const places = customerPlaces(new Set(["n1"]), ["q1", "both"], ["w1", "both", "w2"]);
    expect(places.quiet).toEqual(["q1", "both"]);
    expect(places.waiting).toEqual(["w1", "w2"]);
  });

  it("never lists anyone who needs you in another place", () => {
    const places = customerPlaces(new Set(["n1"]), ["n1", "q1"], ["n1", "w1"]);
    expect(places.needs).toEqual(["n1"]);
    expect(places.quiet).toEqual(["q1"]);
    expect(places.waiting).toEqual(["w1"]);
  });

  it("the three counts add up to the number of distinct customers placed", () => {
    const places = customerPlaces(new Set(["a", "b"]), ["b", "c", "d"], ["a", "d", "e"]);
    const all = [...places.needs, ...places.quiet, ...places.waiting];
    expect(all.length).toBe(new Set(all).size);
    expect(new Set(all)).toEqual(new Set(["a", "b", "c", "d", "e"]));
  });
});

describe("customerGroups (A-220)", () => {
  it("puts each customer in one group, in order: needs you, booked, ready, quiet, waiting", async () => {
    const { customerGroups } = await import("@/lib/customerPlaces");
    const g = customerGroups({
      needs: ["a"],
      ready: ["a", "b", "c"],
      booked: ["c", "d"],
      quiet: ["b", "d", "e"],
      waiting: ["e", "f"],
    });
    expect(g).toEqual({ needs: ["a"], ready: ["b"], booked: ["c", "d"], quiet: ["e"], waiting: ["f"] });
  });

  it("keeps the order each list came in", async () => {
    const { customerGroups } = await import("@/lib/customerPlaces");
    expect(customerGroups({ needs: ["z", "y"], ready: [], booked: [], quiet: [], waiting: [] }).needs).toEqual(["z", "y"]);
  });
});

describe("newArrivals (founder, 2026-10-23: new customers on top)", () => {
  const now = new Date("2026-10-23T18:00:00Z");
  const h = (n: number) => now.getTime() - n * 3_600_000;

  it("lists everyone who arrived in the last day, newest first", async () => {
    const { newArrivals } = await import("@/lib/customerPlaces");
    const leads = [
      { id: "old", createdAtMs: h(30), stage: "new" },
      { id: "morning", createdAtMs: h(8), stage: "contacted" },
      { id: "justNow", createdAtMs: h(0.1), stage: "new" },
      { id: "edge", createdAtMs: h(24), stage: "new" },
    ];
    expect(newArrivals(leads, now)).toEqual(["justNow", "morning", "edge"]);
  });

  it("leaves out someone already closed as won or lost", async () => {
    const { newArrivals } = await import("@/lib/customerPlaces");
    const leads = [
      { id: "won", createdAtMs: h(1), stage: "won" },
      { id: "lost", createdAtMs: h(2), stage: "lost" },
      { id: "open", createdAtMs: h(3), stage: "qualified" },
    ];
    expect(newArrivals(leads, now)).toEqual(["open"]);
  });
});
