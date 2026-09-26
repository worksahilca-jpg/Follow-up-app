import { describe, it, expect } from "vitest";
import { buildActivation, findStuck, formatSpan, summarize, type TesterJourney } from "@/lib/activation";

const H = 60 * 60 * 1000;
const D = 24 * H;
const t0 = new Date("2026-09-01T12:00:00Z");
const at = (ms: number) => new Date(t0.getTime() + ms);

function journey(id: string, steps: Partial<TesterJourney["at"]>, extra: Partial<TesterJourney> = {}): TesterJourney {
  return {
    id,
    name: id,
    email: `${id}@example.com`,
    business: null,
    at: { invited: t0, signedIn: null, connected: null, firstCustomer: null, replyReady: null, replySent: null, answered: null, ...steps },
    inboxDisconnected: false,
    cameBackWeek2: null,
    ...extra,
  };
}

describe("formatSpan", () => {
  it("reads as minutes, hours, then days", () => {
    expect(formatSpan(20 * 60_000)).toBe("20 min");
    expect(formatSpan(4 * H)).toBe("4 h");
    expect(formatSpan(30 * H)).toBe("1 day");
    expect(formatSpan(3 * D)).toBe("3 days");
  });
});

describe("buildActivation", () => {
  const now = at(30 * D);
  const full = journey("a", {
    signedIn: at(D),
    connected: at(D + 2 * H),
    firstCustomer: at(D + 6 * H),
    replyReady: at(D + 7 * H),
    replySent: at(3 * D),
    answered: at(4 * D),
  }, { cameBackWeek2: true });
  const lateValue = journey("b", { signedIn: at(D), connected: at(2 * D), firstCustomer: at(2 * D), replyReady: at(2 * D), replySent: at(12 * D) }, { cameBackWeek2: false });
  const manualOnly = journey("c", { signedIn: at(D), firstCustomer: at(2 * D) });
  const neverIn = journey("d", {});

  const a = buildActivation([full, lateValue, manualOnly, neverIn], now);

  it("counts a tester at every step up to the furthest one reached", () => {
    expect(a.funnel.map((s) => s.count)).toEqual([4, 3, 3, 3, 2, 2, 1, 1]);
  });

  it("activates only first value within 7 days of first sign-in", () => {
    expect(a.activated).toBe(1);
    expect(a.signedIn).toBe(3);
  });

  it("asks week 2 only of activated testers", () => {
    expect(a.week2).toEqual({ came: 1, of: 1 });
  });

  it("times a step only where both dates are known", () => {
    const connected = a.funnel.find((s) => s.step === "connected")!;
    expect(connected.medianMs).toBe(Math.round((2 * H + D) / 2));
  });

  it("does not count an unknown date in any median", () => {
    const j = journey("e", { signedIn: at(D), connected: "unknown", firstCustomer: at(3 * D) });
    const b = buildActivation([j], now);
    expect(b.funnel.find((s) => s.step === "connected")!.medianMs).toBeNull();
    expect(b.funnel.find((s) => s.step === "connected")!.count).toBe(1);
  });
});

describe("summarize", () => {
  it("names the biggest drop and the slowest step", () => {
    const funnel = [
      { step: "invited", label: "Invited", count: 9, medianMs: null },
      { step: "signedIn", label: "Signed in", count: 8, medianMs: D },
      { step: "connected", label: "Connected a source", count: 5, medianMs: 2 * H },
      { step: "firstCustomer", label: "First customer", count: 5, medianMs: 4 * H },
      { step: "replyReady", label: "First reply ready", count: 5, medianMs: 20 * 60_000 },
      { step: "replySent", label: "First reply sent", count: 4, medianMs: 2 * D },
      { step: "answered", label: "Customer answered", count: 2, medianMs: D },
    ] as const;
    expect(summarize(funnel.map((f) => ({ ...f })))).toBe(
      "The biggest drop is at Connected a source: 8 signed in, 5 connected. The slowest step is First reply sent: a median of 2 days after the reply was ready."
    );
  });

  it("says so when there is nothing to go on", () => {
    expect(summarize([{ step: "invited", label: "Invited", count: 1, medianMs: null }])).toBe("Not enough yet to say where testers stop.");
  });
});

describe("findStuck", () => {
  const now = at(10 * D);
  it("lists everyone short of first value, longest first, with a reason", () => {
    const stuck = findStuck(
      [
        journey("leo", { signedIn: at(6 * D) }),
        journey("dana", { signedIn: at(D), connected: at(5 * D) }, { inboxDisconnected: true }),
        journey("done", { signedIn: at(D), replySent: at(2 * D) }),
        journey("today", { signedIn: at(10 * D - H) }),
      ],
      now
    );
    expect(stuck.map((s) => [s.name, s.days, s.lastStep])).toEqual([
      ["dana", 5, "Connected a source"],
      ["leo", 4, "Signed in"],
    ]);
    expect(stuck[0].reason).toBe("Gmail or Outlook is disconnected.");
    expect(stuck[1].reason).toBe("Hasn’t connected anything yet.");
  });
});
