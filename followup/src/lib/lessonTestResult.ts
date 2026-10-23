/**
 * A-319 (2026-10-23): what a test of the waiting lessons found, in the founder's words. Before a rule or example taught
 * on Admin → Train reaches every business of its kind, FollowUp writes that kind's test replies twice without the
 * waiting lessons and twice with them (src/lib/lessonTest.ts); this file compares the two, message by message, and
 * says what FollowUp recommends. Pure, so the Train page can use it too.
 *
 * A message passes on a side only when every try passed: a reply that is right only some of the time isn't right yet.
 * Comparing message by message (not only the two totals) is what makes a small test readable (research,
 * research/product/2026-10-23-self-improving-loop.md): what moved, which way, and with which replies.
 *
 * Plan step 3 (2026-10-23) adds three things. Messages written for each waiting rule (src/lib/ruleTestMessages.ts)
 * show whether the rule does its job; they count in better and worse, not in the two "of 20" scores. A check that code
 * decides (not a model's reading) failing on most tries with the lessons, and never without, blocks them outright.
 * And a chance check, the same messages answered twice with nothing changed, says how many move on their own.
 */

/** Kinds of business with test messages today. Others have none, and the founder's OK alone puts a lesson to work. */
export const TESTED_TRADES: readonly string[] = ["Real estate"];

export function hasLessonTest(trade: string): boolean {
  return TESTED_TRADES.includes(trade);
}

/** Each test message is answered this many times on each side. */
export const LESSON_TEST_TRIES = 3;

/**
 * One reply and what was wrong with it (src/lib/replyEval.ts). `hard` is the part code decided. An error is a reply that
 * couldn't be written. Tests from before plan step 3 have no `hard`.
 */
export type TryOutcome = { reply: string; problems: string[]; hard?: string[]; error?: string };
/**
 * One test message: the customer's last words, and its replies without and with the waiting lessons. `rule` is set on
 * a message written for one of the waiting rules.
 */
export type CaseOutcome = { name: string; said: string; rule?: string; without: TryOutcome[]; with: TryOutcome[] };

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

/** A code check counts as caused by the lessons when it fails on at least this many tries with them, and none without. */
export const BLOCK_AT = 2;

/**
 * The code checks the lessons broke (plan step 3): each failed on most of the replies written with them (BLOCK_AT of
 * three) and on none written without. Once is left to "worse", which the founder can still overrule: one reply in
 * three can be chance. A check that fails without the lessons too isn't theirs to answer for.
 */
export function blockingChecks(c: Pick<CaseOutcome, "without" | "with">): string[] {
  const before = new Set(c.without.flatMap((t) => t.hard ?? []));
  const counts = new Map<string, number>();
  for (const t of c.with) for (const k of new Set(t.hard ?? [])) counts.set(k, (counts.get(k) ?? 0) + 1);
  const at = Math.min(BLOCK_AT, c.with.length);
  return [...counts].filter(([k, n]) => n >= at && !before.has(k)).map(([k]) => k);
}

export function caseChange(c: Pick<CaseOutcome, "without" | "with">): CaseChange {
  if (blockingChecks(c).length > 0) return "worse";
  const a = standing(c.without);
  const b = standing(c.with);
  if (RANK[b] > RANK[a]) return "better";
  if (RANK[b] < RANK[a]) return "worse";
  return a === "pass" ? "same_pass" : a === "fail" ? "same_fail" : "same_mixed";
}

export type TestSummary = {
  /** The kind's fixed test messages: the two scores are out of these. */
  cases: number;
  passedWithout: number;
  passedWith: number;
  /** Better and worse count every message, the ones written for the rules too. */
  better: number;
  worse: number;
  /** Messages where the lessons broke a code check (blockingChecks): these can't be put to work. */
  blocked: number;
  /** Messages written for the waiting rules. */
  targeted: number;
  /** Replies that couldn't be written, on either side. Any at all and the test doesn't count. */
  errors: number;
};

export function summarize(cases: readonly CaseOutcome[]): TestSummary {
  const changes = cases.map(caseChange);
  const fixed = cases.filter((c) => !c.rule);
  return {
    cases: fixed.length,
    passedWithout: fixed.filter((c) => standing(c.without) === "pass").length,
    passedWith: fixed.filter((c) => standing(c.with) === "pass").length,
    better: changes.filter((c) => c === "better").length,
    worse: changes.filter((c) => c === "worse").length,
    blocked: cases.filter((c) => blockingChecks(c).length > 0).length,
    targeted: cases.length - fixed.length,
    errors: cases.reduce((n, c) => n + [...c.without, ...c.with].filter((t) => t.error).length, 0),
  };
}

/**
 * The chance check: the same messages answered twice with nothing changed. `flips` is how many came out differently,
 * either way; a test that moves no more messages than that can't be told from no change at all.
 */
export type ChanceSummary = { cases: number; up: number; down: number; flips: number; errors: number };

export function chanceSummary(first: readonly TryOutcome[][], second: readonly TryOutcome[][]): ChanceSummary {
  let up = 0;
  let down = 0;
  first.forEach((a, i) => {
    const change = caseChange({ without: a, with: second[i] ?? [] });
    if (change === "better") up += 1;
    if (change === "worse") down += 1;
  });
  const errors = [...first, ...second].reduce((n, tries) => n + tries.filter((t) => t.error).length, 0);
  return { cases: first.length, up, down, flips: up + down, errors };
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
  rule: "didn't follow your rule",
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
  /** A code check the lessons broke: this one can't be overruled. */
  blocked: boolean;
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
    const broke = blockingChecks(c);
    const brokeOn = c.with.filter((t) => (t.hard ?? []).some((k) => broke.includes(k)));
    const sentence =
      broke.length > 0
        ? `With your changes it ${problemWords(broke.map((k) => ({ reply: "", problems: [k] })))} on ${brokeOn.length} of ${c.with.length} tries, and never without them. FollowUp checks that itself, so these changes can't be put to work.`
        : change === "better"
          ? `Now passes every time. Before, it ${sometimes(c.without)}${problemWords(c.without.filter((t) => !passed(t)))}.`
          : change === "worse"
            ? `Now ${sometimes(c.with)}fails: it ${problemWords(c.with.filter((t) => !passed(t)))}. Before, it ${standing(c.without) === "pass" ? "passed every time" : "passed some of the time"}.`
            : c.rule
              ? `Your rule didn't do its job here: with and without it, the reply ${problemWords([...c.without, ...c.with])}.`
              : `Fails with and without your changes: it ${problemWords([...c.without, ...c.with])}. Not caused by these changes.`;
    const failing = (tries: TryOutcome[]) => (broke.length > 0 ? brokeOn[0]?.reply : undefined) ?? shown(tries);
    views.push({
      name: heading(c.name),
      said: c.said,
      change,
      blocked: broke.length > 0,
      sentence,
      without: shown(c.without),
      with: failing(c.with),
    });
  }
  return views.sort((a, b) => order.indexOf(a.change) - order.indexOf(b.change));
}

/** The one sentence under the two numbers. */
export function verdictSentence(s: Pick<TestSummary, "better" | "worse"> & { blocked?: number }): { lead: string; rest: string } {
  const better = s.better === 0 ? "none" : String(s.better);
  const blocked = s.blocked ?? 0;
  if (blocked > 0) {
    return {
      lead: `Better on ${better}, worse on ${s.worse}.`,
      rest:
        `On ${blocked === 1 ? "one" : blocked} of them a reply broke one of FollowUp's own checks, so these changes can't be put ` +
        "to work. Change the wording or drop a change, then test again.",
    };
  }
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
