/**
 * The conversation test (src/lib/conversationEval.ts). The writers, the grader and the "no" check are the real model
 * in a run; here all are stand-ins, so this proves only that every way a conversation can go wrong is caught, counted
 * and shown in full.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/dmDrafting", () => ({ draftDm: vi.fn() }));
vi.mock("@/lib/integrations/openai", () => ({ generateFollowUpMessage: vi.fn(), checkForStop: vi.fn(), extractQualificationFacts: vi.fn() }));
vi.mock("@/lib/integrations/openaiClient", () => ({
  getClient: vi.fn(),
  MODEL: "test",
  withAiContext: (_where: unknown, run: () => Promise<unknown>) => run(),
}));

import { CHAT_CASES, runConversationEval, type ChatCase, type ChatDeps } from "@/lib/conversationEval";

const noWait = { retry: { maxRetries: 0, sleep: async () => {} } };

type G = Awaited<ReturnType<ChatDeps["grade"]>>;
const GOOD: G = {
  answered: [true, true],
  invented: false,
  inventedWhat: "",
  sameLanguage: true,
  askedAgain: false,
  askedAgainWhat: "",
  askedAgainQuote: "",
  repeated: false,
  emptyNudge: false,
  pushy: false,
  bragged: false,
  robotic: false,
  acknowledgedFeeling: true,
  inventedFeeling: false,
  usedDetail: true,
  metExpectation: true,
};

const dmSays = (body: string, shapeFailed: string | null = null) =>
  vi.fn(async () => ({ body, quickReplies: { question: "reply", buttons: [] }, shapeFailed })) as unknown as ChatDeps["dm"];
const emailSays = (body: string) => vi.fn(async () => ({ subject: "", body })) as unknown as ChatDeps["email"];
const grades = (g: Partial<G> = {}) => vi.fn(async () => ({ ...GOOD, ...g }));
const stops = (n: number, of = 5) => vi.fn(async () => ({ tries: of, stops: n }));

const dmReply: ChatCase = {
  name: "dm reply",
  group: "objection",
  channel: "instagram",
  lines: [{ who: "in", text: "Do you work in Brampton?", daysAgo: 0 }],
  next: { kind: "reply" },
  asks: ["whether the agent works in Brampton"],
};
const emailFollowUp: ChatCase = {
  name: "email follow-up",
  group: "quiet",
  channel: "email",
  lines: [
    { who: "in", text: "Looking for a 3 bed in Brampton", daysAgo: 3 },
    { who: "out", text: "Got it, a 3-bed in Brampton. When are you hoping to move?", daysAgo: 3 },
  ],
  next: { kind: "followup", step: 1, total: 5, angle: "new", daysQuiet: 3 },
  told: ["a 3-bed", "in Brampton"],
};
const stopCase = (text: string, shouldStop: boolean): ChatCase => ({
  name: text,
  group: "stop",
  channel: "instagram",
  lines: [{ who: "out", text: "Still looking?", daysAgo: 2 }, { who: "in", text, daysAgo: 0 }],
  next: { kind: "stop", shouldStop },
});

async function run(cases: ChatCase[], deps: Partial<ChatDeps>) {
  return runConversationEval(cases, { deps: { know: async () => null, ...deps }, ...noWait, concurrency: 1 });
}

describe("the cases", () => {
  it("are about forty, each with its own name, covering all four kinds", () => {
    expect(CHAT_CASES.length).toBeGreaterThanOrEqual(40);
    expect(new Set(CHAT_CASES.map((c) => c.name)).size).toBe(CHAT_CASES.length);
    for (const group of ["quiet", "objection", "context", "stop"]) expect(CHAT_CASES.some((c) => c.group === group)).toBe(true);
  });

  it("have the business writing last before every follow-up, and the customer last before every reply and stop", () => {
    for (const c of CHAT_CASES) {
      const last = c.lines[c.lines.length - 1];
      if (c.next.kind === "followup" && c.next.angle !== "thanks") expect(last.who, c.name).toBe("out");
      if (c.next.kind !== "followup") expect(last.who, c.name).toBe("in");
    }
  });

  it("only demand words a stored fact gives", () => {
    for (const c of CHAT_CASES) {
      for (const word of c.mustInclude ?? []) expect((c.facts ?? []).some((f) => f.value.includes(word)), `${c.name}: ${word}`).toBe(true);
    }
  });

  it("test both sides of the no: some must stop, some must keep going", () => {
    const stopsOn = CHAT_CASES.filter((c) => c.next.kind === "stop" && c.next.shouldStop);
    const goesOn = CHAT_CASES.filter((c) => c.next.kind === "stop" && !c.next.shouldStop);
    expect(stopsOn.length).toBeGreaterThanOrEqual(5);
    expect(goesOn.length).toBeGreaterThanOrEqual(3);
  });
});

describe("a written message", () => {
  it("passes when every check passes, and comes back in full", async () => {
    const r = await run([dmReply], { dm: dmSays("Yes, I work in Brampton a lot. Buying or selling?"), grade: grades() });
    expect(r).toMatchObject({ cases: 1, passed: 1, errors: 0 });
    expect(r.chats[0]).toMatchObject({ task: "Reply", next: "Yes, I work in Brampton a lot. Buying or selling?", problems: [] });
    expect(r.chats[0].lines).toEqual([{ who: "in", text: "Do you work in Brampton?" }]);
  });

  it("uses the email writer on email and the DM writer on Instagram, a follow-up with its plan step's instruction", async () => {
    const dm = dmSays("ok");
    const email = emailSays("A new 3-bed in Brampton came up. Want the details?");
    await run([dmReply, emailFollowUp], { dm, email, grade: grades() });
    expect(dm).toHaveBeenCalledTimes(1);
    expect(email).toHaveBeenCalledTimes(1);
    const hint = (email as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][2] as string;
    expect(hint).toContain("follow-up 2 of 5");
    expect((dm as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][3]).toBeUndefined();
  });

  it("catches asking again for what they already said, with their own words as proof", async () => {
    const r = await run([emailFollowUp], {
      email: emailSays("Which area are you looking in?"),
      grade: grades({ askedAgain: true, askedAgainWhat: "the area", askedAgainQuote: "3 bed in Brampton" }),
    });
    expect(r.chats[0].problems).toEqual(["asked_again"]);
    expect(r.chats[0].detail).toContain("the area");
    expect(r.chats[0].detail).toContain('they said "3 bed in Brampton"');
    expect(r.problems.asked_again).toBe(1);
  });

  it("doesn't count an 'asked again' the reader can't quote from the customer (2026-10-30: a price they never gave)", async () => {
    const r = await run([emailFollowUp], {
      email: emailSays("What price would feel comfortable for you?"),
      grade: grades({ askedAgain: true, askedAgainWhat: "the price", askedAgainQuote: "under 900k" }),
    });
    expect(r.chats[0].problems).not.toContain("asked_again");
    const fromBusiness = await run([emailFollowUp], {
      email: emailSays("When are you hoping to move?"),
      grade: grades({ askedAgain: true, askedAgainWhat: "timing", askedAgainQuote: "When are you hoping to move?" }),
    });
    expect(fromBusiness.chats[0].problems).not.toContain("asked_again");
  });

  it("gives both writers what the customer already told, read by the qualifier, as a live draft gets it", async () => {
    const told = { v: 2, template: "realtor", items: [{ key: "area", value: "Brampton", quote: "in Brampton" }] } as unknown as Awaited<ReturnType<ChatDeps["know"]>>;
    const know = vi.fn(async () => told);
    const dm = dmSays("ok");
    const email = emailSays("ok");
    await run([dmReply, emailFollowUp], { dm, email, grade: grades(), know });
    expect(know).toHaveBeenCalledTimes(2);
    expect((dm as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][11]).toEqual({ qualification: told, nothingToAsk: false });
    expect((email as unknown as { mock: { calls: { known?: unknown }[][] } }).mock.calls[0][0].known).toBe(told);
  });

  it("shows and grades a DM with its tap buttons, as the customer sees it", async () => {
    const dm = vi.fn(async () => ({
      body: "Great, Oakville 3-beds under 1.4. What's easier next?",
      quickReplies: { question: "reply", buttons: [{ title: "Send listings", exit: false }, { title: "Quick call", exit: false }] },
      shapeFailed: null,
    })) as unknown as ChatDeps["dm"];
    const grade = grades();
    const r = await run([dmReply], { dm, grade });
    expect(r.chats[0].next).toBe("Great, Oakville 3-beds under 1.4. What's easier next?\n[Buttons: Send listings | Quick call]");
    expect((grade as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][1]).toContain("[Buttons: Send listings | Quick call]");
  });

  it("catches an empty follow-up by its words, even when the reader missed it", async () => {
    const r = await run([emailFollowUp], { email: emailSays("Just checking in on your search!"), grade: grades() });
    expect(r.chats[0].problems).toContain("empty_nudge");
  });

  it("never calls a reply to their newest message an empty follow-up", async () => {
    const r = await run([dmReply], { dm: dmSays("Following up on your question: yes, I work in Brampton."), grade: grades({ emptyNudge: true }) });
    expect(r.chats[0].problems).not.toContain("empty_nudge");
  });

  it("catches a question after a no", async () => {
    const no: ChatCase = { ...dmReply, name: "no", closing: true, asks: [], noDetail: true };
    const r = await run([no], { dm: dmSays("All the best! Can I ask who you went with?"), grade: grades() });
    expect(r.chats[0].problems).toContain("pressure");
    expect(r.chats[0].detail).toContain("asked again after a no");
  });

  it("catches a message that misses what the case is about, and says what that was", async () => {
    const c: ChatCase = { ...dmReply, expect: "Gives no number for their home." };
    const r = await run([c], { dm: dmSays("It's probably worth about 900k."), grade: grades({ metExpectation: false }) });
    expect(r.chats[0].problems).toContain("expectation");
    expect(r.chats[0].detail).toContain("Gives no number for their home.");
  });

  it("counts an invented fact, but not their own words read back", async () => {
    const invented = await run([dmReply], { dm: dmSays("Yes, and 9 Elm St just listed at 800k."), grade: grades({ invented: true, inventedWhat: "9 Elm St listed at 800k" }) });
    expect(invented.problems.invented).toBe(1);
    const own = await run([dmReply], { dm: dmSays("Yes, Brampton."), grade: grades({ invented: true, inventedWhat: "work in Brampton" }) });
    expect(own.problems.invented).toBe(0);
  });

  it("counts the DM shape rules and a missing fact", async () => {
    const c: ChatCase = { ...dmReply, facts: [{ label: "Area", value: "I work across Brampton and Mississauga." }], mustInclude: ["Mississauga"] };
    const r = await run([c], { dm: dmSays("Yes, I do.", "two questions"), grade: grades() });
    expect(r.chats[0].problems).toEqual(expect.arrayContaining(["shape", "missing_fact"]));
  });

  it("shows a case that couldn't run as an error, never as passed", async () => {
    const dm = vi.fn(async () => {
      throw new Error("OpenAI is down");
    }) as unknown as ChatDeps["dm"];
    const r = await run([dmReply], { dm, grade: grades() });
    expect(r).toMatchObject({ passed: 0, errors: 1 });
    expect(r.chats[0].error).toBe("OpenAI is down");
  });
});

describe("the no", () => {
  it("passes a no that stops, and a not-now that keeps going", async () => {
    const r1 = await run([stopCase("We bought a place", true)], { stopRead: stops(3) });
    expect(r1.passed).toBe(1);
    expect(r1.chats[0].next).toContain("Stops here");
    const r2 = await run([stopCase("Not right now, maybe spring", false)], { stopRead: stops(0) });
    expect(r2.passed).toBe(1);
    expect(r2.chats[0].next).toContain("Keeps going");
  });

  it("counts a missed no as kept going: the one that must be zero", async () => {
    const r = await run([stopCase("We went with another agent", true)], { stopRead: stops(0) });
    expect(r.problems.kept_going).toBe(1);
    expect(r.passed).toBe(0);
  });

  it("stops on one read in five, the way live follow-ups do", async () => {
    const r = await run([stopCase("hmm no", true)], { stopRead: stops(1) });
    expect(r.passed).toBe(1);
  });

  it("counts a not-now read as a no as stopping them wrongly", async () => {
    const r = await run([stopCase("Busy, text me next week", false)], { stopRead: stops(2) });
    expect(r.problems.stopped_wrongly).toBe(1);
  });

  it("stops on an opt-out word even when every read says go", async () => {
    const r = await run([stopCase("STOP", true)], { stopRead: stops(0) });
    expect(r.passed).toBe(1);
    expect(r.chats[0].next).toContain("opt-out word");
  });

  it("is an error, not a pass, when no read came back", async () => {
    const r = await run([stopCase("We bought a place", true)], { stopRead: stops(0, 0) });
    expect(r.errors).toBe(1);
  });
});
