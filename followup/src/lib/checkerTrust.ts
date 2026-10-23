import type { TryOutcome } from "@/lib/lessonTestResult";

/**
 * Plan step 4, "Check the checker" (A-321, founder 2026-10-23: "yes build it"). FollowUp's checker reads every test
 * reply before a lesson reaches a kind of business (src/lib/replyEval.ts). On Admin → Train → Mark replies the founder
 * reads the same kind of replies and says whether they'd send each one, and what's wrong when they wouldn't
 * (src/lib/checkerRounds.ts). This file compares the two, check by check, and says which checks can be trusted.
 *
 * A check that disagrees with the founder too often becomes advice only: the lesson test (src/lib/lessonTest.ts) still
 * shows what it found, but a lesson isn't marked worse because of it. Checks decided in code (a message rule, a fact
 * given, their words handed back, the pressure and bragging words) aren't marked here and always count. Pure.
 */

/** The checks the founder marks: the ones a model's reading decides, in the words the app already uses for them. */
export const MARK_CHECKS = ["unanswered", "invented", "pressure", "language", "generic", "brag", "feeling"] as const;
export type MarkCheck = (typeof MARK_CHECKS)[number];

export const CHECK_WORDS: Record<MarkCheck | "other", string> = {
  unanswered: "Didn't answer their question",
  invented: "Made something up",
  pressure: "Pushed or rushed them",
  language: "Wrong language",
  generic: "Could have gone to anyone",
  brag: "Praised the business",
  feeling: "Missed or made up a feeling",
  other: "Something else",
};

export function isMarkCheck(k: string): k is MarkCheck {
  return (MARK_CHECKS as readonly string[]).includes(k);
}

/** A check is trusted when it catches at least this share of the replies the founder flagged for it… */
export const TRUST_CATCH = 0.8;
/** …and wrongly flags no more than this share of the replies the founder would send. */
export const TRUST_FALSE_ALARM = 0.1;
/** Fewer founder flags than this and the catch rate says too little: the check keeps counting, as before step 4. */
export const MIN_FLAGS = 5;
/** Fewer replies the founder would send than this and the false-alarm rate says too little. */
export const MIN_PASSED = 10;

export type MarkedReply = { verdict: string | null; marked: readonly string[]; checker: readonly string[] };

export type TrustStatus = "trusted" | "advice" | "too_few";

export type CheckTrust = {
  check: MarkCheck;
  /** Replies the founder wouldn't send because of this. */
  flagged: number;
  /** Of those, the ones the checker flagged too. */
  caught: number;
  missed: number;
  /** Replies the founder would send that the checker flagged for this. */
  falseAlarms: number;
  status: TrustStatus;
};

const judged = (r: MarkedReply) => r.verdict === "send" || r.verdict === "fix";

/**
 * Each check against the founder's marks. Skipped and unmarked replies don't count. Too many false alarms makes a check
 * advice only even before it has enough flags to judge its catches: a check that flags 9 replies the founder would send
 * is already known to be wrong too often.
 */
export function checkTrust(replies: readonly MarkedReply[]): CheckTrust[] {
  const done = replies.filter(judged);
  const passed = done.filter((r) => r.verdict === "send");
  return MARK_CHECKS.map((check) => {
    const flaggedBy = done.filter((r) => r.verdict === "fix" && r.marked.includes(check));
    const caught = flaggedBy.filter((r) => r.checker.includes(check)).length;
    const falseAlarms = passed.filter((r) => r.checker.includes(check)).length;
    const flagged = flaggedBy.length;
    let status: TrustStatus = "too_few";
    if (passed.length >= MIN_PASSED && falseAlarms / passed.length > TRUST_FALSE_ALARM) status = "advice";
    else if (flagged >= MIN_FLAGS) status = caught / flagged >= TRUST_CATCH ? "trusted" : "advice";
    return { check, flagged, caught, missed: flagged - caught, falseAlarms, status };
  });
}

/** The checks that are advice only. */
export function advisoryChecks(replies: readonly MarkedReply[]): MarkCheck[] {
  return checkTrust(replies)
    .filter((t) => t.status === "advice")
    .map((t) => t.check);
}

/** Did the founder and the checker agree on whether this reply could go out as it is? */
export function agrees(r: MarkedReply): boolean {
  return (r.verdict === "fix") === (r.checker.length > 0);
}

export type Agreement = { judged: number; agreed: number };

export function agreement(replies: readonly MarkedReply[]): Agreement {
  const done = replies.filter(judged);
  return { judged: done.length, agreed: done.filter(agrees).length };
}

/** One check's line on the results, in plain words. */
export function trustLine(t: CheckTrust): string {
  const alarms =
    t.falseAlarms === 0 ? "It flagged none you were fine with." : `It flagged ${t.falseAlarms} you were fine with.`;
  if (t.flagged === 0) return t.falseAlarms === 0 ? "You flagged none, and neither did the checker." : `You flagged none. ${alarms}`;
  const caught =
    t.missed === 0
      ? t.flagged === 1
        ? "The checker caught it."
        : `The checker caught all ${t.flagged}.`
      : t.caught === 0
        ? `The checker missed ${t.flagged === 1 ? "it" : `all ${t.flagged}`}.`
        : `The checker caught ${t.caught} and missed ${t.missed}.`;
  return `You flagged ${t.flagged}. ${caught} ${alarms}`;
}

export const STATUS_WORDS: Record<TrustStatus, string> = { trusted: "Trusted", advice: "Advice only", too_few: "Too few to tell" };

/**
 * The lesson test's tries with advice-only checks set aside (A-321): a problem from such a check moves from `problems`
 * to `advice`, unless code decided it too (`hard`), which always counts. Everything that compares the two sides then
 * works as before, on what counts.
 */
export function withAdvice(t: TryOutcome, advisory: ReadonlySet<string>): TryOutcome {
  if (advisory.size === 0) return t;
  const hard = new Set(t.hard ?? []);
  const advice = t.problems.filter((p) => advisory.has(p) && !hard.has(p));
  if (advice.length === 0) return t;
  return { ...t, problems: t.problems.filter((p) => !advice.includes(p)), advice };
}
