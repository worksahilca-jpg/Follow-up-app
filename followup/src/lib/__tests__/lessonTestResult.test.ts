/**
 * A-319: what a test of the waiting lessons found, message by message, and what FollowUp recommends.
 */
import { describe, it, expect } from "vitest";
import {
  blockingChecks,
  caseChange,
  chanceSummary,
  changeViews,
  coversExactly,
  hasLessonTest,
  problemWords,
  standing,
  summarize,
  verdictSentence,
  type CaseOutcome,
  type TryOutcome,
} from "@/lib/lessonTestResult";
import { REPLY_EVAL_TRADE } from "@/lib/replyEval";

const pass = (reply = "ok"): TryOutcome => ({ reply, problems: [] });
const fail = (reply = "bad", problems = ["unanswered"]): TryOutcome => ({ reply, problems });
const err: TryOutcome = { reply: "", problems: [], error: "boom" };
const c = (name: string, without: TryOutcome[], withIt: TryOutcome[]): CaseOutcome => ({ name, said: `${name}?`, without, with: withIt });

describe("standing", () => {
  it("passes only when every try passed, fails when none did", () => {
    expect(standing([pass(), pass(), pass()])).toBe("pass");
    expect(standing([pass(), fail(), pass()])).toBe("mixed");
    expect(standing([fail(), fail()])).toBe("fail");
  });

  it("a try that couldn't be written never counts as a pass, and no tries is a fail", () => {
    expect(standing([pass(), err])).toBe("mixed");
    expect(standing([err])).toBe("fail");
    expect(standing([])).toBe("fail");
  });
});

describe("caseChange", () => {
  it("compares each message with itself, without and with", () => {
    expect(caseChange(c("a", [fail()], [pass()]))).toBe("better");
    expect(caseChange(c("a", [pass(), fail()], [pass(), pass()]))).toBe("better");
    expect(caseChange(c("a", [pass()], [fail()]))).toBe("worse");
    expect(caseChange(c("a", [pass(), pass()], [pass(), fail()]))).toBe("worse");
    expect(caseChange(c("a", [pass()], [pass()]))).toBe("same_pass");
    expect(caseChange(c("a", [fail()], [fail()]))).toBe("same_fail");
    expect(caseChange(c("a", [pass(), fail()], [fail(), pass()]))).toBe("same_mixed");
  });
});

describe("summarize", () => {
  it("counts passes on each side, what moved each way, and replies that couldn't be written", () => {
    const s = summarize([
      c("a", [fail()], [pass()]),
      c("b", [pass()], [pass()]),
      c("c", [pass()], [fail()]),
      c("d", [fail()], [err]),
    ]);
    expect(s).toEqual({ cases: 4, passedWithout: 2, passedWith: 2, better: 1, worse: 1, blocked: 0, targeted: 0, errors: 1 });
  });

  it("scores the fixed messages out of their own number, and counts what the rule's messages moved in better and worse", () => {
    const s = summarize([
      c("a", [pass()], [pass()]),
      { ...c("for the rule", [fail("x", ["rule"])], [pass()]), rule: "Say when the owner will confirm." },
    ]);
    expect(s).toMatchObject({ cases: 1, passedWithout: 1, passedWith: 1, better: 1, worse: 0, targeted: 1 });
  });
});

// Plan step 3: a check code decides, broken by the lessons on most tries and never without them.
const hardFail = (problem = "shape"): TryOutcome => ({ reply: "Two questions? Really?", problems: [problem], hard: [problem] });

describe("blockingChecks", () => {
  it("blocks a code check the lessons broke on most tries and never without them", () => {
    expect(blockingChecks(c("a", [pass(), pass(), pass()], [hardFail(), hardFail(), pass()]))).toEqual(["shape"]);
  });

  it("leaves a single slip to 'worse', where the founder can still overrule it", () => {
    const once = c("a", [pass(), pass(), pass()], [hardFail(), pass(), pass()]);
    expect(blockingChecks(once)).toEqual([]);
    expect(caseChange(once)).toBe("worse");
  });

  it("never blames the lessons for a check that fails without them too, or for what only a model's reading found", () => {
    expect(blockingChecks(c("a", [hardFail(), pass(), pass()], [hardFail(), hardFail(), hardFail()]))).toEqual([]);
    expect(blockingChecks(c("a", [pass(), pass(), pass()], [fail(), fail(), fail()]))).toEqual([]);
  });

  it("counts as worse even when the two sides' scores look the same", () => {
    const sameScore = c("a", [fail(), pass(), pass()], [hardFail(), hardFail(), pass()]);
    expect(caseChange(sameScore)).toBe("worse");
    expect(summarize([sameScore])).toMatchObject({ worse: 1, blocked: 1 });
  });
});

describe("chanceSummary", () => {
  it("counts the messages that came out differently when nothing changed, either way", () => {
    const first = [[pass(), pass(), pass()], [fail(), fail(), fail()], [pass(), pass(), pass()]];
    const second = [[pass(), fail(), pass()], [pass(), pass(), pass()], [pass(), pass(), pass()]];
    expect(chanceSummary(first, second)).toEqual({ cases: 3, up: 1, down: 1, flips: 2, errors: 0 });
    expect(chanceSummary([[err]], [[pass()]]).errors).toBe(1);
  });
});

describe("changeViews", () => {
  it("shows what got worse first, then what got better, then what fails either way, and leaves out the rest", () => {
    const views = changeViews([
      c("asks if a home is available", [fail("Buy or rent?")], [pass("Yes, it is. See it this week?")]),
      c("plain search", [pass()], [pass()]),
      c("just looking", [pass("No problem.")], [fail("Book a call this week?", ["pressure"])]),
      c("has an agent", [fail("x", ["pressure"])], [fail("y", ["pressure"])]),
    ]);
    expect(views.map((v) => [v.name, v.change])).toEqual([
      ["Just looking", "worse"],
      ["Asks if a home is available", "better"],
      ["Has an agent", "same_fail"],
    ]);
    expect(views[0]).toMatchObject({ sentence: "Now fails: it pushed or rushed them. Before, it passed every time.", without: "No problem.", with: "Book a call this week?" });
    expect(views[1]).toMatchObject({ sentence: "Now passes every time. Before, it didn't answer their question.", without: "Buy or rent?" });
    expect(views[2].sentence).toBe("Fails with and without your changes: it pushed or rushed them. Not caused by these changes.");
  });

  it("says when a message passed only some of the time, and shows a failing reply for that side", () => {
    const [v] = changeViews([c("a", [pass("good"), fail("bad")], [pass("good"), pass("good")])]);
    expect(v.sentence).toBe("Now passes every time. Before, it sometimes didn't answer their question.");
    expect(v.without).toBe("bad");
  });

  it("names the code check the lessons broke, how often, and that it can't be overruled, with a reply that broke it", () => {
    const [v] = changeViews([c("two questions", [pass("One question?"), pass(), pass()], [hardFail(), pass("fine"), hardFail()])]);
    expect(v).toMatchObject({ change: "worse", blocked: true, with: "Two questions? Really?" });
    expect(v.sentence).toBe(
      "With your changes it broke a message rule on 2 of 3 tries, and never without them. FollowUp checks that itself, so these changes can't be put to work."
    );
  });

  it("says plainly when a rule didn't do its job on a message written for it", () => {
    const rule = { ...c("“Say when the owner will confirm.” · message 1", [fail("x", ["rule"])], [fail("y", ["rule"])]), rule: "Say when the owner will confirm." };
    const [v] = changeViews([rule]);
    expect(v.sentence).toBe("Your rule didn't do its job here: with and without it, the reply didn't follow your rule.");
    const [better] = changeViews([{ ...rule, with: [pass()] }]);
    expect(better.sentence).toBe("Now passes every time. Before, it didn't follow your rule.");
  });
});

describe("the words", () => {
  it("names every problem a reply had, in plain words", () => {
    expect(problemWords([fail("x", ["unanswered", "pressure"]), fail("y", ["pressure", "generic"])])).toBe(
      "didn't answer their question, pushed or rushed them and could have gone to anyone"
    );
    expect(problemWords([err])).toBe("couldn't write a reply");
  });

  it("recommends putting them to work only when nothing got worse", () => {
    expect(verdictSentence({ better: 1, worse: 0 })).toEqual({ lead: "Better on 1, worse on none.", rest: "FollowUp recommends putting them to work." });
    expect(verdictSentence({ better: 0, worse: 0 }).lead).toBe("No reply changed.");
    expect(verdictSentence({ better: 2, worse: 1 })).toEqual({
      lead: "Better on 2, worse on 1.",
      rest: "FollowUp recommends changing the wording, or dropping a change, then testing again.",
    });
    expect(verdictSentence({ better: 0, worse: 1 }).lead).toBe("Better on none, worse on 1.");
  });

  it("says a broken code check stops them, with no recommendation to go ahead", () => {
    expect(verdictSentence({ better: 3, worse: 1, blocked: 1 })).toEqual({
      lead: "Better on 3, worse on 1.",
      rest: "On one of them a reply broke one of FollowUp's own checks, so these changes can't be put to work. Change the wording or drop a change, then test again.",
    });
  });
});

describe("the gate", () => {
  it("a test counts for exactly what it covered: an added, changed or dropped lesson needs a new one", () => {
    expect(coversExactly(["rule:r1:1", "example:e1"], ["example:e1", "rule:r1:1"])).toBe(true);
    expect(coversExactly(["rule:r1:1"], ["rule:r1:2"])).toBe(false);
    expect(coversExactly(["rule:r1:1"], ["rule:r1:1", "example:e2"])).toBe(false);
    expect(coversExactly(["rule:r1:1", "example:e2"], ["rule:r1:1"])).toBe(false);
  });

  it("only the kinds with test messages have a test: realtors today", () => {
    expect(hasLessonTest(REPLY_EVAL_TRADE)).toBe(true);
    expect(hasLessonTest("Legal")).toBe(false);
  });
});
