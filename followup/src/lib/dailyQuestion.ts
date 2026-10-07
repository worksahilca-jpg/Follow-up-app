/**
 * One question a day on Today (A-101, founder 2026-10-07: "after an hour, or
 * whenever we need… make it easy for them so that they don't find it boring
 * or irritating").
 *
 * Replaces the row of questions right after setup (R-027). The honest kind
 * of psychology: FollowUp shows it is useful first, then asks one small
 * thing, at a quiet moment, with an easy "Not now".
 *
 *  - Never in the first hour, while FollowUp is still reading the inbox.
 *  - At most one a day: an answer or a "Not now" waits until tomorrow.
 *  - The page shows it only when nobody is waiting on the owner.
 *  - First, for everyone, "what does your business do?", the one question
 *    that fits any trade, and the one the lead check reads (see
 *    `businessAbout`). Then the trade's questions (src/lib/teachQuestions.ts),
 *    minus anything already known or set aside with "Not now". A question
 *    set aside comes back only as an answer blank, when a real customer asks.
 */
import { labelKey } from "@/lib/factLines";
import { teachQuestions, type TeachQuestion } from "@/lib/teachQuestions";

/** The fact's name for the owner's own description of the business. */
export const WHAT_YOU_DO_LABEL = "What you do";

const WHAT_YOU_DO_EXAMPLES: Record<string, string> = {
  "real estate": "e.g. I help families buy and sell homes in Brampton",
  "home services (contractor, cleaning, etc.)": "e.g. We renovate kitchens and bathrooms in Mississauga",
  "mortgage brokerage": "e.g. I help first-time buyers find the right mortgage in Ontario",
  "dental / medical clinic": "e.g. A family dental clinic in Oakville",
};

/** How long after setup before the first question: FollowUp reads the inbox first. */
export const FIRST_QUESTION_AFTER_MS = 60 * 60 * 1000;

/** After an answer or a "Not now", the next question waits about a day. */
export const NEXT_QUESTION_GAP_MS = 20 * 60 * 60 * 1000;

const norm = (t: string) => t.trim().toLowerCase().replace(/_/g, " ");

export function whatYouDoQuestion(trade: string | null | undefined): TeachQuestion {
  return {
    label: WHAT_YOU_DO_LABEL,
    question: "In a few words, what does your business do?",
    example: (trade && WHAT_YOU_DO_EXAMPLES[norm(trade)]) || "e.g. We clean homes and offices in Mississauga",
  };
}

const ASKED_BY: Record<string, string> = {
  "real estate": "Realtors",
  "mortgage brokerage": "Mortgage brokers",
  "dental / medical clinic": "Clinics",
};

/** The one line under the question: why it is worth ten seconds. */
export function whyAsk(question: TeachQuestion, trade: string | null | undefined): string {
  if (question.label === WHAT_YOU_DO_LABEL) {
    return "So FollowUp can tell real customers from newsletters, and write the way you would.";
  }
  const who = trade ? ASKED_BY[norm(trade)] : undefined;
  return `${who ? `${who} get asked this a lot.` : "Customers ask this a lot."} FollowUp will answer with your exact words.`;
}

/** Every label this card may ask about, for the route to check what it is sent. */
export function isAskableLabel(trade: string | null | undefined, label: string): boolean {
  const key = labelKey(label);
  return key === labelKey(WHAT_YOU_DO_LABEL) || teachQuestions(trade).some((q) => labelKey(q.label) === key);
}

export type DailyQuestionState = {
  trade: string | null;
  createdAt: Date;
  questionAfter: Date | null;
  questionsSkipped: readonly string[];
  knownLabels: readonly string[];
};

/** Today's question, or null when there is nothing to ask right now. */
export function pickDailyQuestion(state: DailyQuestionState, now: Date = new Date()): TeachQuestion | null {
  if (now.getTime() - state.createdAt.getTime() < FIRST_QUESTION_AFTER_MS) return null;
  if (state.questionAfter && state.questionAfter > now) return null;
  const done = [...state.knownLabels, ...state.questionsSkipped];
  const doneKeys = new Set(done.map(labelKey));
  if (!doneKeys.has(labelKey(WHAT_YOU_DO_LABEL))) return whatYouDoQuestion(state.trade);
  return teachQuestions(state.trade, done)[0] ?? null;
}

/** The owner's own description of the business, for the lead check, if they gave one. */
export function businessAbout(facts: readonly { label: string; value: string }[]): string | null {
  const fact = facts.find((f) => labelKey(f.label) === labelKey(WHAT_YOU_DO_LABEL));
  return fact?.value.trim() || null;
}
