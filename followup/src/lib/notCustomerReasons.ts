/**
 * "Not a customer", and why (A-259, extends A-073).
 *
 * When the owner taps Not a customer, one optional question asks who the
 * person was. The answer decides what FollowUp remembers:
 *
 *  - friend, work: a person. That address or Instagram/Messenger contact is
 *    never treated as a customer again (src/lib/senderVerdicts.ts), where
 *    before a chat was judged afresh the next time they wrote.
 *  - selling, spam: a kind of sender. Remembered for that person too, and
 *    FollowUp's checker is shown the owner's answers as examples. After the
 *    third of one kind, one question, once: "Set these aside from now on?"
 *    A yes becomes a standing rule for the checker.
 *
 * Only the owner's answer is kept, with the address or contact it applies
 * to. Never message text (the privacy page's promise).
 */

export const NOT_CUSTOMER_REASONS = ["friend", "work", "selling", "spam"] as const;
export type NotCustomerReason = (typeof NOT_CUSTOMER_REASONS)[number];

/** The kinds the "from now on" question is asked about. A friend or a colleague is a person, not a pattern. */
export const SET_ASIDE_KINDS = ["selling", "spam"] as const;
export type SetAsideKind = (typeof SET_ASIDE_KINDS)[number];

/** The question comes after this many answers of one kind. */
export const ASK_AFTER = 3;

/** The answers, as the owner reads them in the confirm box. */
export const REASON_LABEL: Record<NotCustomerReason, string> = {
  friend: "A friend or family",
  work: "Someone I work with",
  selling: "Selling me something",
  spam: "Spam",
};

/** The row titles in Settings › Your business › Who isn't a customer. */
export const REASON_GROUP: Record<NotCustomerReason, string> = {
  friend: "Friends and family",
  work: "People you work with",
  selling: "Selling you something",
  spam: "Spam",
};

/** How the checker is told what the owner said. Our words, never the sender's. */
const CHECKER_PHRASE: Record<NotCustomerReason, string> = {
  friend: "a friend or family member of the owner",
  work: "someone the owner works with (another agent, a lender, a lawyer, a supplier)",
  selling: "someone selling the owner something (a vendor, marketer, recruiter or ad offer)",
  spam: "spam or a bot",
};

/** The standing rules, as the checker is told them once the owner said "from now on". */
const KIND_RULE: Record<SetAsideKind, string> = {
  selling: "anyone selling to the owner: vendors, marketers, recruiters, lead sellers and ad offers",
  spam: "spam, scams and bots",
};

export function isNotCustomerReason(v: unknown): v is NotCustomerReason {
  return typeof v === "string" && (NOT_CUSTOMER_REASONS as readonly string[]).includes(v);
}

export function isSetAsideKind(v: unknown): v is SetAsideKind {
  return typeof v === "string" && (SET_ASIDE_KINDS as readonly string[]).includes(v);
}

/** Only the known kinds, each once: the column is a plain string array and is read defensively. */
export function cleanKinds(value: unknown): SetAsideKind[] {
  if (!Array.isArray(value)) return [];
  return SET_ASIDE_KINDS.filter((k) => value.includes(k));
}

export function checkerPhrase(reason: NotCustomerReason): string {
  return CHECKER_PHRASE[reason];
}

/** One sentence for the checker's instructions, or "" when the owner set no standing rule. */
export function standingRuleNotice(kinds: readonly SetAsideKind[]): string {
  if (kinds.length === 0) return "";
  const what = kinds.map((k) => KIND_RULE[k]).join("; and ");
  return (
    ` This owner has asked for these to be set aside without asking them: ${what}. A thread that clearly is one of` +
    " these is not customer business, however it is worded. A person asking about the owner's own service still is."
  );
}

/**
 * The line under the answers: what FollowUp will do, said before the owner
 * confirms. `email` is true for someone who wrote by email.
 */
export function whatFollowUpWillDo(reason: NotCustomerReason | null, name: string, email: string | null): string {
  if (reason === "friend" || reason === "work") {
    return `FollowUp won't treat ${name} as a customer again, and keeps their messages out of Today.`;
  }
  const what = email ? "this email" : "this chat";
  if (reason === "selling") return `FollowUp sets ${what} aside and gets better at spotting pitches like it. It never deletes them.`;
  if (reason === "spam") return `FollowUp sets ${what} aside and gets better at spotting spam like it. It never deletes it.`;
  // No answer: as before A-259. The box's first line already says they leave your customers.
  return email ? `Future emails from ${email} are set aside too.` : "If they write again, FollowUp checks again.";
}

/** Whether to ask "Set these aside from now on?" after this answer. */
export function shouldAskAlways(reason: NotCustomerReason | null, countOfKind: number, asked: readonly string[]): reason is SetAsideKind {
  return isSetAsideKind(reason) && countOfKind >= ASK_AFTER && !asked.includes(reason);
}
