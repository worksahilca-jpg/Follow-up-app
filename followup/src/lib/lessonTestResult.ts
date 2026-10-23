/**
 * A-319 (2026-10-23): what a test of the waiting lessons found, in the founder's words. Before a rule or example taught
 * on Admin → Train reaches every business of its kind, FollowUp writes that kind's test replies twice without the
 * waiting lessons and twice with them (src/lib/lessonTest.ts); this file compares the two, message by message, and
 * says what FollowUp recommends. Pure, so the Train page can use it too.
 *
 * A message passes on a side only when every try passed: a reply that is right only some of the time isn't right yet.
 * Comparing message by message (not only the two totals) is what makes a small test readable (research,
 * research/product/2026-10-23-self-improving-loop.md): what moved, which way, and with which replies.
 */

/** Kinds of business with test messages today. Others have none, and the founder's OK alone puts a lesson to work. */
export const TESTED_TRADES: readonly string[] = ["Real estate"];

export function hasLessonTest(trade: string): boolean {
  return TESTED_TRADES.includes(trade);
}

/** Each test message is answered this many times on each side. */
export const LESSON_TEST_TRIES = 3;

/** One reply and what was wrong with it (src/lib/replyEval.ts). An error is a reply that couldn't be written. */
export type TryOutcome = { reply: string; problems: string[]; error?: string };
/** One test message: the customer's last words, and its replies without and with the waiting lessons. */
export type CaseOutcome = { name: string; said: string; without: TryOutcome[]; with: TryOutcome[] };

export type Standing = "pass" | "mixed" | "fail";
export type CaseChange = "better" | "worse" | "same_pass" | "same_fail" | "same_mixed";

const passed = (t: TryOutcome) => !t.error && t.problems.length === 0;

/** Pass when every try passed, fail when none did, mixed otherwise. No tries is a fail: nothing was shown to work. */
export function standing(tries: readonly TryOutcome[]): Standing {
  const n = tries.filter(passed).length;
  if (tries.length > 0 && n === tries.length) return "pass";
  return n === 0 ? "fail" : "mixed";
}

const RANK: Record<Standing, number> = { fail: 0, mixed: 1, pass: 2 };

export function caseChange(c: Pick<CaseOutcome, "without" | "with">): CaseChange {
  const a = standing(c.without);
  const b = standing(c.with);
  if (RANK[b] > RANK[a]) return "better";
  if (RANK[b] < RANK[a]) return "worse";
  return a === "pass" ? "same_pass" : a === "fail" ? "same_fail" : "same_mixed";
}

export type TestSummary = {
  cases: number;
  passedWithout: number;
  passedWith: number;
  better: number;
  worse: number;
  /** Replies that couldn't be written, on either side. Any at all and the test doesn't count. */
  errors: number;
};

export function summarize(cases: readonly CaseOutcome[]): TestSummary {
  const changes = cases.map(caseChange);
  return {
    cases: cases.length,
    passedWithout: cases.filter((c) => standing(c.without) === "pass").length,
    passedWith: cases.filter((c) => standing(c.with) === "pass").length,
    better: changes.filter((c) => c === "better").length,
    worse: changes.filter((c) => c === "worse").length,
    errors: cases.reduce((n, c) => n + [...c.without, ...c.with].filter((t) => t.error).length, 0),
  };
}

/** What was wrong with a reply, finishing "it …". */
const PROBLEM_WORDS: Record<string, string> = {
  shape: "broke a message rule",
  unanswered: "didn't answer their question",
  invented: "made something up",
  language: "answered in another language",
  missing_fact: "left out a fact you gave",
  echo: "handed their words back",
  pressure: "pushed or rushed them",
  brag: "praised the business",
  feeling: "missed or made up a feeling",
  generic: "could have gone to anyone",
};

/** "didn't answer their question and pushed or rushed them", from the failing tries of one side. */
export function problemWords(tries: readonly TryOutcome[]): string {
  if (tries.some((t) => t.error)) return "couldn't write a reply";
  const seen = [...new Set(tries.flatMap((t) => t.problems))].map((p) => PROBLEM_WORDS[p] ?? "broke a rule");
  if (seen.length === 0) return "broke a rule";
  return seen.length === 1 ? seen[0] : `${seen.slice(0, -1).join(", ")} and ${seen[seen.length - 1]}`;
}

/** The reply to show for one side: a failing one when that side failed at all, so the founder sees what went wrong. */
function shown(tries: readonly TryOutcome[]): string {
  const failing = tries.find((t) => !passed(t) && !t.error);
  return (failing ?? tries.find((t) => !t.error))?.reply ?? "";
}

/** "Is a listing available": a test message's name as a heading. */
function heading(name: string): string {
  return name ? name[0].toUpperCase() + name.slice(1) : name;
}

export type ChangeView = {
  name: string;
  said: string;
  change: Extract<CaseChange, "better" | "worse" | "same_fail">;
  sentence: string;
  without: string;
  with: string;
};

/** The messages worth a look, worse first: what got worse, what got better, then what fails either way. */
export function changeViews(cases: readonly CaseOutcome[]): ChangeView[] {
  const order: ChangeView["change"][] = ["worse", "better", "same_fail"];
  const views: ChangeView[] = [];
  for (const c of cases) {
    const change = caseChange(c);
    if (change !== "better" && change !== "worse" && change !== "same_fail") continue;
    const sometimes = (s: TryOutcome[]) => (standing(s) === "mixed" ? "sometimes " : "");
    const sentence =
      change === "better"
        ? `Now passes every time. Before, it ${sometimes(c.without)}${problemWords(c.without.filter((t) => !passed(t)))}.`
        : change === "worse"
          ? `Now ${sometimes(c.with)}fails: it ${problemWords(c.with.filter((t) => !passed(t)))}. Before, it ${standing(c.without) === "pass" ? "passed every time" : "passed some of the time"}.`
          : `Fails with and without your changes: it ${problemWords([...c.without, ...c.with])}. Not caused by these changes.`;
    views.push({ name: heading(c.name), said: c.said, change, sentence, without: shown(c.without), with: shown(c.with) });
  }
  return views.sort((a, b) => order.indexOf(a.change) - order.indexOf(b.change));
}

/** The one sentence under the two numbers. */
export function verdictSentence(s: Pick<TestSummary, "better" | "worse">): { lead: string; rest: string } {
  const better = s.better === 0 ? "none" : String(s.better);
  if (s.worse === 0) {
    return s.better === 0
      ? { lead: "No reply changed.", rest: "Nothing got worse, so FollowUp recommends putting them to work." }
      : { lead: `Better on ${better}, worse on none.`, rest: "FollowUp recommends putting them to work." };
  }
  return {
    lead: `Better on ${better}, worse on ${s.worse}.`,
    rest: "FollowUp recommends changing the wording, or dropping a change, then testing again.",
  };
}

/** A test counts for exactly the lessons it covered: anything added, changed or dropped since needs a new one. */
export function coversExactly(tested: readonly string[], waiting: readonly string[]): boolean {
  const a = new Set(tested);
  const b = new Set(waiting);
  return a.size === b.size && [...a].every((k) => b.has(k));
}
