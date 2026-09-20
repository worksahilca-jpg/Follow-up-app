/**
 * What a follow-up looks like when it goes out as an Instagram or
 * Messenger DM instead of an email — and the deterministic check that
 * says whether a draft actually has that shape.
 *
 * Leaf module: imports only the shared Message type. The model call itself
 * is generateFollowUpMessage() in src/lib/integrations/openai.ts; this file
 * decides WHICH instruction it gets (from facts already in the database,
 * never from the model's own guess) and whether what came back is fit to
 * send.
 *
 * The rules are research/product/2026-09-16-instagram-getting-a-reply-
 * buttons-and-questions.md §6 (the situation sets) and §3 (the last
 * sentence), applied to the decision in design-brain design-decisions.md
 * (2026-09-16, DM-only): on a channel with a closing door the message's job
 * is to get a reaction, so it is short, ends in exactly one question a
 * person can answer in a word, and offers those words as chips.
 */

import type { Message } from "@/lib/types";
import { ungroundedCalendarWords } from "@/lib/grounding";
import { DM_MAX_BUTTONS, QUICK_REPLY_TITLE_MAX_CHARS, type DmButton } from "@/lib/quickReplies";

export const DM_CHANNELS: ReadonlySet<string> = new Set(["instagram", "messenger"]);

/** Which automatic message this draft is for. */
export type DmTouch =
  // The ~3-hour follow-up (the unanswered rule), or any owner-facing draft.
  | "reply"
  // The last automatic message before Meta's door shuts (~20 h). Not sent
  // by anything yet — the mechanism is its own PR — but the sets exist.
  | "last"
  // Days 2–7: the one message only a person may send, under Meta's
  // human-agent allowance. Drafted by the engine, sent by the owner's tap.
  | "handoff";

export interface DmSituation {
  /** Stable id, recorded in the chip payload and the audit trail. */
  id: string;
  /** The instruction appended to the drafter's prompt for this situation. */
  hint: string;
}

/**
 * The constraint block every DM draft gets, whatever the situation — the
 * shared paragraph from the research, restated to the model rather than
 * assumed. Kept as one exported string so the prompt test can pin it.
 */
export const DM_SHAPE_RULES =
  "This goes out as an Instagram or Messenger DM, not an email. 8 to 30 words, one or two sentences, no greeting, " +
  "no sign-off, no subject line. Exactly one question, and it is the last sentence. The question must be " +
  "answerable in one word by someone walking, without looking at any buttons. Provide two or three button " +
  `titles, each ${QUICK_REPLY_TITLE_MAX_CHARS} characters or fewer, in the same language as the lead's last message, each one a plain ` +
  "answer to that question (\"Morning\", not \"Choose morning\"). If the question is yes/no, the last button is an " +
  "honest no (\"Not now\") and is marked as the exit. Never a button the owner would have to interpret. Never a " +
  "question whose answer would not change what the owner does next. Never a deadline, a \"last chance\", a slot " +
  "count, or any fact not in the conversation. Never \"sound good?\", \"make sense?\", \"let me know if you have " +
  "any questions\", \"anything else I can help with?\", \"are you interested?\", \"just checking in\".";

const PRICE_RE = /precio|price|pricing|cost|cuánto|cuanto|quanto|combien|kimmat|kimat|keemat|\brate\b|quote|how much/i;
const AVAILABILITY_RE = /disponib|availab|available|\bbook|appointment|cita|turno|\bslot|schedule|saturday|sunday|monday|tuesday|wednesday|thursday|friday|weekend|tomorrow|this week/i;
const CURRENCY_RE = /[$€£₹¥]\s?\d|\d\s?(USD|EUR|GBP|INR|CAD|MXN|AUD|Rs\.?|dollars|euros|pounds|rupees)\b/i;
const SLOT_RE = /\b\d{1,2}[:.]\d{2}\b|\b\d{1,2}\s?(am|pm)\b|\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?\s+\d{1,2}(am|pm|:)/i;

function isAck(m: Message): boolean {
  return m.direction === "outbound" && m.trigger === "instant_ack";
}

/**
 * "The owner has replied": any outbound that FollowUp's automation did not
 * write. A manual send from the app, a reply synced from Gmail/Outlook (no
 * trigger at all), a Meta echo of a reply typed in the native inbox
 * (`source` set) all count; the instant ack and automated follow-ups do not.
 */
function ownerHasReplied(conversation: Message[]): boolean {
  return conversation.some(
    (m) => m.direction === "outbound" && (m.trigger === undefined || m.trigger === "manual")
  );
}

/**
 * Picks the situation set from facts in the thread. Every branch is a
 * fact FollowUp already stores: what the lead's last message asked about,
 * whether anyone from the business has replied, whether that reply named a
 * price or a slot, whether the lead's last message was a chip tap.
 */
export function pickDmSituation(conversation: Message[], touch: DmTouch): DmSituation {
  const inbound = conversation.filter((m) => m.direction === "inbound");
  const lastInbound = inbound[inbound.length - 1];
  const lastText = lastInbound?.body ?? "";
  const outboundText = conversation
    .filter((m) => m.direction === "outbound" && !isAck(m))
    .map((m) => m.body)
    .join("\n");
  const replied = ownerHasReplied(conversation);
  const priceGiven = replied && CURRENCY_RE.test(outboundText);
  const slotsNamed = replied && SLOT_RE.test(outboundText);
  const asksPrice = PRICE_RE.test(lastText);
  const asksAvailability = AVAILABILITY_RE.test(lastText);

  // Set 10 — the lead answered with a button. Confirm, say what happens
  // next, and do NOT ask again: chaining questions to keep them tapping is
  // the reset-farming pattern the research names first (§5.1).
  if (lastInbound?.quickReplyPayload) {
    return {
      id: "after_tap",
      hint:
        "The lead's latest message is a one-word answer to a question you asked (they tapped a button). Use the " +
        "answer: confirm it in their own word and say what happens next. Do not ask another question unless one " +
        "specific fact is still missing before anyone can act on their answer; if nothing is missing, end on a " +
        "plain statement and provide NO buttons. Never chain questions to keep them tapping.",
    };
  }

  // Set 12 — the owner's day-2–7 message. Written to the reactivation
  // rules: name the gap in one clause, lead with something concrete from
  // the thread, one question, the way out in the sentence, no apology
  // (they stopped replying to us, not the reverse). Plain text: chips on a
  // tagged send are unverified (api-facts §C). Meta's allowed usage is
  // "resolve what the lead asked", so the draft answers their question
  // where the thread lets it, and never a bare "still interested?".
  if (touch === "handoff") {
    return {
      id: "day2_7_owner",
      hint:
        "This message is sent by the business owner personally, a few days after the lead's last message, " +
        "because automatic replies are no longer allowed. Name the gap in one short clause (\"a couple of days " +
        "on\"), then lead with the most useful concrete thing the conversation allows: answer what they asked if " +
        "the business has already said it in this thread, otherwise say exactly what you'd need from them to " +
        "answer it. One question at the end, with the way out inside the sentence (\"...or shall I leave it?\"). " +
        "Do not apologise, do not say \"just checking in\", never mention any window or limit. Provide NO buttons.",
    };
  }

  if (touch === "last") {
    // Sets 3 and 9 — the last automatic message. Ask for the least, put the
    // exit in the sentence, no deadline, no "last message", no summary.
    if (asksPrice && !priceGiven) {
      return {
        id: "price_last",
        hint:
          "This is the last automatic message. Ask for the least: whether they still want the number, with the " +
          "way out in the sentence itself, like \"Still want a price on this, or leave it?\". Two buttons only: " +
          "one that means they still want it, one that means leave it (that one is the exit). No deadline, no " +
          "\"last chance\", no mention of any time limit.",
      };
    }
    return {
      id: "interest_last",
      hint:
        "This is the last automatic message, after earlier ones went unanswered. Two sentences at most. Say " +
        "you'll leave it with them. Ask whether they're still looking into this or it's sorted elsewhere. Two " +
        "buttons only: one meaning still looking, one meaning sorted elsewhere (that one is the exit). No third " +
        "button, no deadline, no summary of what was offered, and never tell them this is the last message.",
    };
  }

  if (replied) {
    // Sets 4, 6, 8 — a real exchange happened and the lead went quiet.
    if (priceGiven) {
      return {
        id: "price_given_quiet",
        hint:
          "The business already sent a price in this conversation. Do not repeat it and do not discount it. Ask " +
          "the one thing that moves this forward and lets them say no: whether they want a slot held or are still " +
          "deciding. Buttons: one meaning hold a slot, one meaning still deciding, one meaning not for me (the exit).",
      };
    }
    if (slotsNamed) {
      return {
        id: "slots_named_quiet",
        hint:
          "The business has already offered specific times in this conversation. Offer exactly those, in the " +
          "business's own words, and ask which works. Buttons: each offered time shortened to fit (\"Sat 10am\"), " +
          "plus one meaning neither works (the exit). If more than two times were offered, use the two most recent.",
      };
    }
    return {
      id: "replied_quiet",
      hint:
        "The business replied and the lead didn't come back. Read the business's reply and offer only the next " +
        "steps it actually makes available (a quote, a visit, a call, a booking) — never one it doesn't mention. " +
        "Buttons: those steps in two words each, plus one meaning not now (the exit). If the reply makes only one " +
        "step available, ask a yes/no on it with a yes button and a not-now button (the exit).",
    };
  }

  // Sets 2 and the availability/general variants — the owner hasn't
  // replied yet, ~3 hours in. Nothing is late yet, so no apology; add the
  // one fact the business would need, asked about THEIR situation.
  if (asksPrice) {
    return {
      id: "price_unanswered",
      hint:
        "They asked what something costs and the business hasn't answered yet. Do not apologise (nothing is late " +
        "yet) and do not guess a price. Add the one fact the business would obviously need to price this, phrased " +
        "as a question about their situation, not a menu. For a trade job, a photo is often the best ask: if you " +
        "ask for a photo, provide NO buttons — the photo is the reply. Otherwise buttons only if the question has " +
        "two or three natural one-word answers.",
    };
  }
  if (asksAvailability) {
    return {
      id: "availability_unanswered",
      hint:
        "They asked about availability and the business hasn't confirmed yet. Do not confirm or deny anything. " +
        "Say you're checking the specific thing they named, then ask a fact only they know that narrows it, such " +
        "as weekday or weekend, or morning or afternoon. Buttons: those two or three answers.",
    };
  }
  return {
    id: "general_unanswered",
    hint:
      "They asked about something the business does and nobody has answered yet. Do not apologise (nothing is " +
      "late yet). Name the thing they asked about so it is obvious you read it, then ask the one thing that " +
      "decides what happens next and that only they know, such as how soon they need it. Buttons: two or three " +
      "one-word answers, never a fact about the business.",
  };
}

/** What the drafter hands back for a DM. */
export interface DmDraft {
  body: string;
  buttons: DmButton[];
}

// The closers that read as a bot and get ignored (buttons research §3.2).
// English only, like HUMAN_VOICE_NOTICE's opener list: the ban in the
// prompt extends to the local equivalent, this check catches the ones that
// slip through in the language they come from.
const BANNED_CLOSER_RE =
  /let me know if you have any questions|feel free to reach out|anything else i can help|how can i assist|does that make sense|sound good\??$|fair enough\??$|are you interested|would you like to proceed|just checking|checking in|circling back|touching base/i;

const QUESTION_MARK_RE = /[?？؟]/g;
const NUMBER_RE = /\p{Nd}(?:[\p{Nd},.]*\p{Nd})?/gu;

/**
 * Deterministic, model-free, language-neutral where it can be — the same
 * posture as checkAckShape() in src/lib/acknowledge.ts. Runs on every DM
 * draft before it is stored or sent. `conversationText` is the whole
 * thread, so a number is allowed only if someone already wrote it: the
 * risk gate judges assertions, this only catches the shape.
 */
export function checkDmDraftShape(
  draft: DmDraft,
  conversationText: string,
  // The lead's own language tag, so the calendar rule below checks the
  // draft in the language it was actually written in. Optional: absent
  // falls back to English, which is what the rule did before it existed.
  locale?: string | null
): { ok: true } | { ok: false; rule: string } {
  const fail = (rule: string) => ({ ok: false as const, rule });
  const body = draft.body.trim();
  if (!body) return fail("empty");

  const words = body.split(/\s+/).filter(Boolean);
  // Scripts written with few or no spaces (Thai, Chinese, Japanese) come
  // out as a handful of very long "words"; judge those on characters so a
  // perfectly good Thai DM isn't refused as "too short". Twelve characters
  // per word is well past any spaced language's average.
  const spaced = body.length / words.length <= 12;
  if (spaced ? words.length < 8 : body.length < 24) return fail("too_short");
  if (spaced ? words.length > 30 : body.length > 160) return fail("too_long");

  const questionMarks = body.match(QUESTION_MARK_RE) ?? [];
  if (questionMarks.length === 0) {
    // A statement is only acceptable after a tap (after_tap set) — and
    // then it must carry no buttons, since there is nothing to answer.
    if (draft.buttons.length > 0) return fail("buttons_without_question");
  } else {
    if (questionMarks.length > 1) return fail("two_questions");
    const trailing = body.replace(/[\s"'”’)\]]+$/u, "");
    if (!/[?？؟]$/.test(trailing)) return fail("question_not_last");
  }

  if (BANNED_CLOSER_RE.test(body)) return fail("banned_closer");
  if (/https?:\/\//i.test(body) || /www\./i.test(body) || /\S+@\S+\.\S+/.test(body)) return fail("contact");

  const known = new Set(conversationText.match(NUMBER_RE) ?? []);
  if ((body.match(NUMBER_RE) ?? []).some((n) => !known.has(n))) return fail("digits");

  // The same invariant as the digits rule above, for a specific with no
  // digits in it. "Will this be for a weekday or weekend?" went out to a
  // real lead who had only ever said "Hey is this still available?" — no
  // numbers, so the rule above passed it, and the lead's reply was "What
  // do you mean". See src/lib/grounding.ts.
  //
  // draftDm regenerates once on any shape failure before giving up, so
  // this usually costs one extra call rather than a lost draft.
  if (ungroundedCalendarWords(body, conversationText, locale).length > 0) return fail("calendar");

  if (draft.buttons.length > DM_MAX_BUTTONS) return fail("too_many_buttons");
  const seen = new Set<string>();
  let exits = 0;
  for (const b of draft.buttons) {
    const title = b.title.trim();
    if (!title) return fail("empty_button");
    if (title.length > QUICK_REPLY_TITLE_MAX_CHARS) return fail("button_too_long");
    if (/[?？؟]/.test(title)) return fail("button_is_question");
    const key = title.toLowerCase();
    if (seen.has(key)) return fail("duplicate_button");
    seen.add(key);
    if (b.exit) exits++;
  }
  if (exits > 1) return fail("two_exits");
  if (draft.buttons.length === 1 && !draft.buttons[0].exit) return fail("single_yes_button");

  return { ok: true };
}

/** The whole thread as one string, for the digits rule above. */
export function conversationText(conversation: Message[]): string {
  return conversation.map((m) => m.body).join("\n");
}

/** Which channel the lead last wrote on, if it is one that takes DM-shaped drafts. */
export function dmChannelOf(conversation: Message[]): "instagram" | "messenger" | null {
  const inbound = [...conversation].reverse().find((m) => m.direction === "inbound");
  const channel = inbound?.channel;
  return channel === "instagram" || channel === "messenger" ? channel : null;
}
