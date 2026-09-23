/**
 * The grace period before a bulk send, and the race at the end of it.
 *
 * Founder, 2026-09-23, on the apple-design skill's "forgiveness"
 * principle applied to FollowUp: "undo is. Want me to build it?" → "sure".
 *
 * ## What is actually being protected
 *
 * `SafePileAction` sends up to a day's cap of real messages to real
 * customers from one press. Until now that press was final the instant
 * it landed. The queue it sits on is sorted, grouped and collapsed, so
 * the button an owner means to press and the button next to it are a
 * few pixels apart.
 *
 * The logic is in this module rather than in the component because the
 * repo's test setup is `environment: "node"` with no DOM — the same
 * reason `describeAutomationStatus` lives in a lib and the badge is a
 * thin wrapper over it. A component that holds its own timing rules
 * cannot be asserted here, and the rules are the part that must be
 * right.
 */
import { describe, it, expect } from "vitest";
import { UNDO_WINDOW_MS, secondsLeft, createSendGate } from "@/lib/undoWindow";

describe("the countdown label", () => {
  it("reads the full window the instant it opens", () => {
    // With Math.floor this is 9, and the grace visibly starts a second
    // short of what was promised.
    expect(secondsLeft(1_000_000 + UNDO_WINDOW_MS, 1_000_000)).toBe(10);
  });

  it("still reads 1 through the final second, not 0", () => {
    // A countdown that sits on "0s" while the send has not happened is
    // reporting a state the product is not in.
    expect(secondsLeft(10_000, 9_001)).toBe(1);
    expect(secondsLeft(10_000, 9_999)).toBe(1);
  });

  it("never goes negative when a backgrounded tab wakes up late", () => {
    // Phone in a pocket, tab suspended, `now` returns well past the end.
    expect(secondsLeft(10_000, 25_000)).toBe(0);
  });

  it("gives the owner longer than a desk-bound five seconds", () => {
    // Pinned against the ICP research, not against taste: the owner is
    // interrupted and on a phone. If someone shortens this to match
    // Gmail, that is a decision to re-argue, not a tidy-up.
    expect(UNDO_WINDOW_MS).toBeGreaterThanOrEqual(10_000);
  });
});

describe("the race between sending and cancelling", () => {
  it("lets the first caller through", () => {
    const gate = createSendGate();
    expect(gate.claim()).toBe(true);
  });

  it("refuses everyone after the first, whichever side they are", () => {
    // The real scenario: the timer fires and claims, then the owner's
    // press arrives a few milliseconds later. The press must lose.
    const gate = createSendGate();
    expect(gate.claim()).toBe(true);
    expect(gate.claim()).toBe(false);
    expect(gate.claim()).toBe(false);
  });

  it("works the other way round too — an undo in time beats the timer", () => {
    const gate = createSendGate();
    expect(gate.claim()).toBe(true); // the owner pressed Undo
    expect(gate.claim()).toBe(false); // the timer fires a moment later
  });

  it("gives each press its own gate, so one send never blocks the next", () => {
    // A stale gate shared across presses would mean the second "Send all"
    // on the same screen silently did nothing — the exact failure this
    // component's docstring says never to ship ("said 43 and sent 31").
    const first = createSendGate();
    first.claim();
    const second = createSendGate();
    expect(second.claim()).toBe(true);
  });
});
