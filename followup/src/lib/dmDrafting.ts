/**
 * Drafting an Instagram/Messenger DM end to end: pick the situation from
 * the thread (src/lib/dmDrafts.ts), ask the model (src/lib/integrations/
 * openai.ts), shape-check the answer, retry once, hand back the draft and
 * its buttons. Shared by the automation pass, the scoring pass and the
 * regenerate route so all three write the same kind of DM.
 */

import { generateFollowUpMessage } from "@/lib/integrations/openai";
import type { LeadLanguage } from "@/lib/leadLanguage";
import { businessText, checkDmDraftShape, conversationText, pickDmSituation, putsOffOwnExperience, type DmTouch } from "@/lib/dmDrafts";
import { answerSlotFor } from "@/lib/priceSlot";
import type { StoredQuickReplies } from "@/lib/quickReplies";
import type { Message } from "@/lib/types";
import { factsText, type FactLine } from "@/lib/factLines";
import type { Criterion, Qualification } from "@/lib/qualification";
import type { OwnerExampleLine } from "@/lib/ownerExampleLines";

/** Lead.suggestedQuickReplies as stored, or null for anything that isn't the shape. */
export function readStoredQuickReplies(value: unknown): StoredQuickReplies | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { question?: unknown; buttons?: unknown };
  if (typeof v.question !== "string" || !Array.isArray(v.buttons)) return null;
  const buttons = v.buttons
    .filter((b): b is { title: string; exit?: unknown } => !!b && typeof b === "object" && typeof (b as { title?: unknown }).title === "string")
    .map((b) => ({ title: b.title, exit: b.exit === true }));
  return { question: v.question, buttons };
}

/**
 * What the second attempt is told when the first broke a rule (founder,
 * 2026-10-14: "the second try is told exactly what was wrong"). The retry
 * used to be the same request again, so a model that wrote "I charge
 * buyers nothing" or offered a Saturday nobody named tended to write it
 * again, and the owner got a held draft to fix by hand. Keyed by the rule
 * ids of checkDmDraftShape (src/lib/dmDrafts.ts).
 */
const RETRY_NOTES: Record<string, string> = {
  calendar:
    "It named a day, date or time of day that nobody in this conversation mentioned, in the text or a button. Name no " +
    "day or time the customer didn't write word for word: \"this weekend\" does not let you name Saturday or Sunday, " +
    "because only the business knows when it is free. If timing matters, ask an open question such as when would " +
    "suit them, with no day or time buttons.",
  digits: "It used a number nobody in this conversation or the business facts wrote. Use no such number.",
  fee: "It said what the business charges or who pays it, which the business has not said. Say it will be confirmed instead.",
  availability: "It said whether something is available. Only the business knows that: say you're checking.",
  booking: "It said a time is booked or confirmed. Only the business confirms a booking: say you'll check and get back to them.",
  done: "It said the business already sent, called or arranged something this conversation doesn't show. Don't.",
  policy: "It said what's free, included, refundable or guaranteed, which the business has not said. Say it will be confirmed instead.",
  hours: "It said when the business is open, which the business has not said. Say it will be confirmed instead.",
  service: "It said what the business covers, offers or accepts, which the business has not said. Say it will be confirmed instead.",
  confirm: "It vouched for something on the business's behalf (\"I can confirm\"). Say what you'll check instead.",
  pressure: "It rushed or pushed them. Leave out any urgency, deadline or push.",
  brag: "It praised the business with a ranking or title the business never stated. Leave it out.",
  too_long: "It was too long. Keep it under 30 words.",
  too_short: "It was too short. Write a full reply of at least 8 words.",
  two_questions: "It asked more than one question. Ask exactly one, as the last thing.",
  question_not_last: "Its question was not the last thing in it. End with the one question.",
  buttons_without_question: "It had buttons but asked nothing. Ask one question or give no buttons.",
  banned_closer: "It used a stock closing line such as \"let me know if you have any questions\". Leave it out.",
  contact: "It included a link or an email address. Include none.",
  experience:
    "They asked how long you have done this work, and it put the answer off. If WHAT THIS BUSINESS HAS TOLD " +
    `CUSTOMERS says, use that; otherwise write the sentence that answers it with the exact blank ${answerSlotFor("years in business")} ` +
    `where the number goes, e.g. "I've been a realtor for ${answerSlotFor("years in business")}." Never say you'll confirm or check your own experience.`,
  empty: "It was empty. Write the message.",
};
const BUTTONS_NOTE =
  "Its reply buttons broke the rules: at most three, each a few words, none a question, no two the same, at most one way out.";
for (const rule of ["too_many_buttons", "empty_button", "button_too_long", "button_is_question", "duplicate_button", "two_exits", "single_yes_button"]) {
  RETRY_NOTES[rule] = BUTTONS_NOTE;
}

/** The retry's correction, for any rule the shape check can fail. */
export function retryNote(rule: string): string {
  const what = RETRY_NOTES[rule] ?? "It broke one of the message rules above.";
  return `Your previous draft of this message was refused. ${what} Write it again with that fixed and every other rule kept.`;
}

/**
 * Drafts an Instagram/Messenger DM: the situation is picked from the
 * thread (src/lib/dmDrafts.ts), the model writes to it, and the result is
 * shape-checked. One retry on a shape failure, told what failed, then the
 * caller holds it —
 * a draft with two questions or a chip nobody asked for never goes out
 * unreviewed. Returns the draft either way so the owner sees what was
 * attempted rather than nothing.
 */
export async function draftDm(
  leadName: string,
  conversation: Message[],
  voiceSamples: string[],
  messageHint: string | undefined,
  touch: DmTouch = "reply",
  // How this lead writes, decided once (src/lib/leadLanguage.ts).
  // Passed straight through; absent changes nothing.
  leadLanguage?: Partial<LeadLanguage> | null,
  // What the business has told customers (src/lib/businessFacts.ts, A-096):
  // in the draft's instructions, and counted as the business's own words by
  // the shape check, so "My commission is 2.5%" is grounded, not invented.
  facts: readonly FactLine[] = [],
  // The one thing still to learn from this customer (src/lib/qualification.ts),
  // which the reply may end by asking about. Null asks nothing new. Also the
  // one-time ask for a DM customer's email and mobile (src/lib/dmContact.ts).
  qualify: Pick<Criterion, "ask"> | null = null,
  // The business's line of work, for its playbook (src/lib/tradePlaybooks.ts).
  // DMs went without it until 2026-10-11: the founder's Instagram test asked
  // "how much do you charge" and got asked for a listing link, because
  // nothing told the drafter a realtor's fee is a question about the agent.
  trade: string | null = null,
  // How the owner answers, by example ("Write it better", A-290). Approach only: an example's numbers or dates are
  // not counted as the business's words by the shape check below, so a draft that copies one is held.
  examples: readonly OwnerExampleLine[] = [],
  // The founder's rules for this kind of business ("Tell FollowUp what's wrong", A-297).
  rules: readonly string[] = [],
  // What the customer has already told FollowUp, and whether the checklist has nothing for this reply (knownPromptBlock).
  told: { qualification: Qualification | null; nothingToAsk: boolean } | null = null
): Promise<{ body: string; quickReplies: StoredQuickReplies; shapeFailed: string | null; responseId?: string }> {
  const situation = pickDmSituation(conversation, touch);
  const known = factsText(facts);
  const text = known ? `${conversationText(conversation)}\n${known}` : conversationText(conversation);
  const saidByBusiness = known ? `${businessText(conversation)}\n${known}` : businessText(conversation);
  let lastRule: string | null = null;
  let ask = situation;
  for (let attempt = 0; attempt < 2; attempt++) {
    const draft = await generateFollowUpMessage({ name: leadName, conversation, facts, qualify, trade, examples, rules, known: told?.qualification ?? null, nothingToAsk: told?.nothingToAsk ?? false }, voiceSamples, messageHint, ask, leadLanguage);
    const buttons = draft.buttons ?? [];
    // The draft is written in the lead's language, so the calendar rule
    // has to read it in that language — an English-only day list would be
    // the exact shortcut the founder rejected on the WhatsApp filter.
    const shape = checkDmDraftShape({ body: draft.body, buttons }, text, leadLanguage?.language, saidByBusiness);
    const putOff = putsOffOwnExperience(conversation, draft.body);
    if (shape.ok && !putOff) return { body: draft.body, quickReplies: { question: situation.id, buttons }, shapeFailed: null, responseId: draft.responseId };
    // Only the buttons broke a rule (the accuracy test, 2026-10-17: "Which day would suit you best?" with Saturday
    // and Sunday chips, when the customer only said "this weekend"). Buttons are optional; the reply goes without them.
    if (!putOff && buttons.length > 0 && checkDmDraftShape({ body: draft.body, buttons: [] }, text, leadLanguage?.language, saidByBusiness).ok) {
      return { body: draft.body, quickReplies: { question: situation.id, buttons: [] }, shapeFailed: null, responseId: draft.responseId };
    }
    lastRule = shape.ok ? "experience" : shape.rule;
    if (attempt === 1) return { body: draft.body, quickReplies: { question: situation.id, buttons: [] }, shapeFailed: lastRule, responseId: draft.responseId };
    ask = { ...situation, hint: `${situation.hint}\n\n${retryNote(lastRule)}` };
  }
  /* istanbul ignore next -- unreachable, the loop always returns */
  throw new Error("draftDm: unreachable");
}
