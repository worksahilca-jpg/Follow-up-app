import { draftDm } from "@/lib/dmDrafting";
import { checkForStop, extractQualificationFacts, generateFollowUpMessage } from "@/lib/integrations/openai";
import { getClient, MODEL, withAiContext } from "@/lib/integrations/openaiClient";
import { customerTexts, isCustomerQuote, mergeQualification, templateFor, type Qualification } from "@/lib/qualification";
import { isOptOutMessage } from "@/lib/optOutKeywords";
import { salesPressure } from "@/lib/replyTone";
import { stepHint, type StepKind } from "@/lib/followUpPlans";
import { mapWithConcurrency } from "@/lib/concurrency";
import { withRateLimitRetry, type RateLimitRetryOptions } from "@/lib/rateLimitRetry";
import { REPLY_EVAL_TRADE, theirOwnWords, type Lessons } from "@/lib/replyEval";
import type { FactLine } from "@/lib/factLines";
import type { Message } from "@/lib/types";

/**
 * How FollowUp holds a whole conversation, not one message (founder, 2026-10-30: "we got to make this product so
 * accurate that we're not sending any stupid messages to the leads... let's see how we are talking to the leads").
 *
 * The reply test (src/lib/replyEval.ts) answers one first message. Real trouble comes later in a chat: the follow-up
 * on day 3 when they went quiet, "just browsing", "not for six months", "is this a bot?", a long chat where they've
 * already said their budget, and the "no" that must stop everything. Each case here is a realtor chat, invented, in
 * FollowUp's own words (the situations come from reports/Realtor follow up conversations.md, section "Forty-four
 * training conversations"). FollowUp's real writers answer it exactly as a live lead's would be answered:
 *  - "reply": the customer wrote last; draftDm on Instagram/Messenger, generateFollowUpMessage on email, as
 *    scoring.ts drafts them;
 *  - "followup": the business wrote last and they went quiet; the same writers with the follow-up plan's own
 *    instruction for that step (stepHint, src/lib/followUpPlans.ts), as automation.ts drafts them;
 *  - "stop": the customer's newest message; the "no" safety net (checkForStop) and the opt-out words, as scoring.ts
 *    reads them. A no that is missed is a customer messaged after they said no; a "not now" read as a no is a
 *    customer dropped.
 *
 * What every written message must do, on top of the reply test's checklist (answer what they asked, invent nothing,
 * their language, no pushing, no bragging, read like a person): never ask again for something they already told;
 * never repeat an earlier message; never send a follow-up with no reason to read it ("just checking in"); and do the
 * one thing the case is about (`expect`). Code checks what code can; a second model reads the rest, and can be wrong
 * too, so every conversation comes back in full for a person to read.
 *
 * To run it: the Run button on /admin → Accuracy tests, or POST /api/admin/conversation-eval.
 */

export type ChatGroup = "quiet" | "objection" | "context" | "stop";

type Line = { who: "in" | "out"; text: string; daysAgo: number };

type Next =
  | { kind: "reply" }
  | { kind: "followup"; step: number; total: number; angle: StepKind; daysQuiet: number; final?: boolean }
  | { kind: "stop"; shouldStop: boolean };

export type ChatCase = {
  name: string;
  group: ChatGroup;
  channel: "instagram" | "messenger" | "email";
  lines: Line[];
  next: Next;
  /** What the customer asked, in plain words, one per question. */
  asks?: string[];
  /** What the customer has already told the business: the message must not ask for any of it again. */
  told?: string[];
  /** What the business has told customers (Settings → What FollowUp knows). */
  facts?: FactLine[];
  /** Words the message must contain because a fact gives them. */
  mustInclude?: string[];
  /** The one thing this case is about, in a plain sentence the reader checks. */
  expect?: string;
  /** They said no or have an agent: a warm close, no question. */
  closing?: boolean;
  /** They named a feeling: the message must acknowledge it. */
  feeling?: boolean;
  /** Their message holds nothing of their own to pick up, so "could go to anyone" can't fail it. */
  noDetail?: boolean;
};

const said = (text: string, daysAgo = 0): Line => ({ who: "in", text, daysAgo });
const wrote = (text: string, daysAgo = 0): Line => ({ who: "out", text, daysAgo });

/** The plan's five steps for one quiet spell: day 1, 3, 7, 14, 30 (src/lib/followUpPlans.ts, fixedKinds). */
const followup = (step: number, angle: StepKind, daysQuiet: number, final = false): Next => ({ kind: "followup", step, total: 5, angle, daysQuiet, final });
const reply: Next = { kind: "reply" };
const stop = (shouldStop: boolean): Next => ({ kind: "stop", shouldStop });

const COMMISSION: FactLine = { label: "Commission", value: "My commission is 2.5% when I sell your home." };
const BIRCH: FactLine = { label: "22 Birch Ave", value: "22 Birch Ave is listed at $1,149,000." };
const STILL_LOOKING = wrote("Hi Sam, still looking for a 3-bed in Brampton? A couple of new ones came up this week.", 2);

export const CHAT_CASES: ChatCase[] = [
  // ── Quiet: they went quiet after the business's last message ──────────────────────────────────────────────
  {
    name: "Day 1 after a form: answer what's open, ask nothing they said",
    group: "quiet",
    channel: "email",
    lines: [
      said("Hi, I filled in your form. Townhouses in Milton under 900k, anything with a yard?", 1),
      wrote("Hi Sam, townhouses with a yard in Milton under 900k, got it. Are you hoping to move in the next few months, or just starting to look?", 1),
    ],
    next: followup(0, "open", 1),
    asks: ["whether there are townhouses with a yard"],
    told: ["they want a townhouse", "in Milton", "under 900k", "with a yard"],
    expect: "Claims no specific townhouse is available, and does not ask again for the area, the budget, the type of home or the yard.",
  },
  {
    name: "Day 3 on Instagram with nothing new to share",
    group: "quiet",
    channel: "instagram",
    lines: [
      said("any 2 bed condos near Cooksville GO? we want to walk to the train", 3),
      wrote("2 beds near Cooksville GO, walking distance to the train. Is it just the two of you moving?", 3),
    ],
    next: followup(1, "new", 3),
    told: ["a 2-bed condo", "near Cooksville GO", "walking distance to the train"],
    expect: "Invents no listing; with nothing new to share, asks one short question they haven't answered yet.",
  },
  {
    name: "Day 3 with a real detail about the home they picked",
    group: "quiet",
    channel: "email",
    facts: [{ label: "12 Elm Court", value: "12 Elm Court's basement was fully finished last year." }],
    lines: [said("Could I see 12 Elm Court sometime?", 3), wrote("Happy to show you 12 Elm Court. Is a weekday evening or the weekend easier for you?", 3)],
    next: followup(1, "new", 3),
    mustInclude: ["basement"],
    expect: "Gives the finished basement as the new reason to write, and still offers to show the home.",
  },
  {
    name: "Day 7: one easy step for a buyer unsure what they can afford",
    group: "quiet",
    channel: "email",
    lines: [said("We're interested but honestly not sure what we can afford yet.", 7), wrote("Hi Sam, that's a really normal place to start. Would it help to talk it through?", 7)],
    next: followup(2, "step", 7),
    expect: "Offers one easy, no-pressure next step about working out what they can afford, and names no lender, rate, price, day or time.",
  },
  {
    name: "Day 14: over budget, and nothing has changed",
    group: "quiet",
    channel: "email",
    lines: [said("Love 88 Queen St but it's a bit over what we wanted to spend.", 14), wrote("Totally fair. Want me to look for homes like it a little lower?", 14)],
    next: followup(3, "new", 14),
    expect: "Does not claim the price dropped or that any cheaper home is available.",
  },
  {
    name: "Day 30: close the loop kindly",
    group: "quiet",
    channel: "email",
    lines: [
      said("Looking for a 3 bed semi in Brampton, around 950.", 30),
      wrote("Hi Sam, a 3-bed semi in Brampton around 950, got it. Any part of Brampton you like most?", 30),
    ],
    next: followup(4, "close", 30, true),
    told: ["a 3-bed semi", "in Brampton", "around 950"],
    expect: "Asks plainly whether to keep sending homes that fit or close their file for now, and makes either answer feel fine.",
  },
  {
    name: "Day 1: answer the questions we said we'd check",
    group: "quiet",
    channel: "instagram",
    facts: [{ label: "Unit 401, 88 Lakeshore", value: "Unit 401 at 88 Lakeshore comes with one underground parking spot, and the building has a gym." }],
    lines: [said("Does unit 401 at 88 Lakeshore come with parking? And is there a gym?", 1), wrote("Good questions. Let me check both and get back to you.", 1)],
    next: followup(0, "open", 1),
    asks: ["whether unit 401 comes with parking", "whether the building has a gym"],
    mustInclude: ["parking"],
  },
  {
    name: "Day 3 in Hinglish",
    group: "quiet",
    channel: "instagram",
    lines: [
      said("Bhai Brampton mein 3 bedroom detached chahiye, budget 1.2 tak", 3),
      wrote("Bilkul! Brampton mein 3 bedroom detached, 1.2 tak. Aap kab tak shift karna chahte ho?", 3),
    ],
    next: followup(1, "new", 3),
    told: ["a 3-bedroom detached", "in Brampton", "budget up to 1.2"],
    expect: "Stays in Hinglish (or plain English), and invents no listing.",
  },
  {
    name: "They asked us to write back in March",
    group: "quiet",
    channel: "email",
    lines: [said("We're not looking till March. Can you reach out then?", 120), wrote("Sounds good, I'll write in March.", 120)],
    next: followup(0, "checkback", 120),
    expect: "Says this is the check-in they asked for, and asks one easy question about picking it back up, with no pressure.",
  },
  {
    name: "The thank-you the day after a showing",
    group: "quiet",
    channel: "email",
    lines: [
      said("Can we see 45 Maple Dr on Saturday?", 3),
      wrote("Saturday at 11 works. See you at 45 Maple Dr.", 3),
      said("Great, see you then", 2),
    ],
    next: { kind: "followup", step: 0, total: 1, angle: "thanks", daysQuiet: 1 },
    expect: "Thanks them for coming to see 45 Maple Dr, gives one useful thing or easy next step, and names no price.",
  },

  // ── Objections: what they say back, answered in writing ──────────────────────────────────────────────────
  {
    name: "\"Just browsing\"",
    group: "objection",
    channel: "instagram",
    lines: [wrote("Hey Sam! Saw you liked the Port Credit condo post. Looking for yourself?", 0), said("just browsing for now", 0)],
    next: reply,
    expect: "Treats browsing as completely fine, offers something small and useful with no commitment, and asks at most one easy question.",
  },
  {
    name: "\"We already have an agent\"",
    group: "objection",
    channel: "email",
    lines: [wrote("Hi Sam, still looking for a 2-bed in Liberty Village?", 1), said("Thanks, but we're already working with an agent.", 0)],
    next: reply,
    closing: true,
    noDetail: true,
  },
  {
    name: "\"My agent never answers me\"",
    group: "objection",
    channel: "instagram",
    lines: [said("I have an agent but honestly she never answers me", 0)],
    next: reply,
    expect: "Says nothing bad about the other agent and does not ask them to switch; stays kind and offers help carefully.",
  },
  {
    name: "\"Not ready, maybe next year\"",
    group: "objection",
    channel: "email",
    lines: [wrote("Hi Sam, would you like to see a few 3-beds in Oakville this month?", 1), said("Not ready yet, maybe next year.", 0)],
    next: reply,
    expect: "Treats it as timing, not a no: no push, and at most one easy question about when.",
  },
  {
    name: "\"We're about six months out\"",
    group: "objection",
    channel: "instagram",
    lines: [wrote("Are you looking to buy soon?", 1), said("We're about 6 months away", 0)],
    next: reply,
    expect: "Asks one easy question that makes six months clearer (moved in by then, or starting to look), and pushes no meeting.",
  },
  {
    name: "Asking price, and FollowUp knows it",
    group: "objection",
    channel: "email",
    facts: [BIRCH],
    lines: [said("What's the asking on 22 Birch Ave?", 0)],
    next: reply,
    asks: ["the asking price of 22 Birch Ave"],
    mustInclude: ["1,149,000"],
  },
  {
    name: "Asking price, and FollowUp doesn't know it",
    group: "objection",
    channel: "instagram",
    lines: [said("What's the asking price for 31 Cedar St?", 0)],
    next: reply,
    asks: ["the asking price of 31 Cedar St"],
  },
  {
    name: "\"Is the price negotiable?\"",
    group: "objection",
    channel: "email",
    facts: [BIRCH],
    lines: [said("Is the price on 22 Birch negotiable?", 0)],
    next: reply,
    asks: ["whether the price on 22 Birch Ave is negotiable"],
    expect: "Does not guess or hint at what the sellers would accept.",
  },
  {
    name: "\"What did it sell for?\"",
    group: "objection",
    channel: "instagram",
    lines: [said("what did the one on Pine St sell for?", 0)],
    next: reply,
    asks: ["what the home on Pine St sold for"],
    expect: "States no sold price or figure, and says the exact number will come from the agent.",
  },
  {
    name: "\"Is it still available?\" and FollowUp doesn't know",
    group: "objection",
    channel: "messenger",
    lines: [said("Hi, is 9 Willow Lane still available?", 0)],
    next: reply,
    asks: ["whether 9 Willow Lane is still available"],
    expect: "Says neither available nor sold; says it will confirm.",
  },
  {
    name: "\"Busy, text me later\"",
    group: "objection",
    channel: "instagram",
    lines: [wrote("Want to see 9 Willow Lane this week?", 1), said("Busy at work, text me later", 0)],
    next: reply,
    expect: "Short: accepts it, and at most asks when is better; sends nothing they didn't ask for.",
  },
  {
    name: "\"Just send me listings\"",
    group: "objection",
    channel: "email",
    lines: [
      said("We're after a 2 bed condo in Mississauga.", 2),
      wrote("Great, a 2-bed condo in Mississauga. Are you hoping to buy soon?", 2),
      said("Just send me some listings", 0),
    ],
    next: reply,
    told: ["a 2-bed condo", "in Mississauga"],
    expect: "Says yes straight away, and asks at most one thing that would make the listings fit (a part of the city is fine), never the city or the type of home again.",
  },
  {
    name: "\"We're working with our bank\"",
    group: "objection",
    channel: "instagram",
    lines: [said("We're already working with our bank on the mortgage.", 0)],
    next: reply,
    expect: "Respects their bank and suggests no other lender.",
  },
  {
    name: "A seller asks the commission",
    group: "objection",
    channel: "email",
    facts: [COMMISSION],
    lines: [said("Thinking of selling our townhouse in Mississauga. What's your commission?", 0)],
    next: reply,
    asks: ["the agent's commission to sell their townhouse"],
    mustInclude: ["2.5%"],
  },
  {
    name: "\"We'll try selling it ourselves\"",
    group: "objection",
    channel: "email",
    lines: [said("We're going to try selling our place ourselves first.", 0)],
    next: reply,
    // A-340: wish them well and offer help once, with no question.
    closing: true,
    expect: "Says nothing against selling privately, and offers help with no strings.",
  },
  {
    name: "\"Just curious what my place is worth\"",
    group: "objection",
    channel: "instagram",
    lines: [said("Not selling, just curious what my place is worth", 0)],
    next: reply,
    expect: "Gives no number or price range for their home.",
  },
  {
    name: "\"Is this a bot?\"",
    group: "objection",
    channel: "instagram",
    lines: [wrote("Hi Sam, want me to send a few 2-beds in Etobicoke?", 1), said("Is this a bot?", 0)],
    next: reply,
    noDetail: true,
    // The approved rule (src/lib/integrations/openai.ts, "If they ask whether this is automated"): never deny it,
    // never claim a person wrote it, and hand it to a person. It always waits for the owner (audit gap B).
    expect: "Never denies being automated or claims a person typed it, and says someone will come back to them personally.",
  },
  {
    name: "\"How did you get my number?\"",
    group: "objection",
    channel: "email",
    lines: [wrote("Hi Sam, thanks for filling in the form on my Milton townhouses ad. Are you looking to buy this year?", 1), said("How did you get my number?", 0)],
    next: reply,
    asks: ["how the business got their number"],
    expect: "Says plainly they filled in the form on the ad, and offers to stop if they'd rather.",
  },

  // ── Context: what a long or old chat already holds ──────────────────────────────────────────────────────
  {
    name: "A long chat: ask nothing they've already said",
    group: "context",
    channel: "instagram",
    lines: [
      said("Hi! Looking to buy in Mississauga", 5),
      wrote("Nice, Mississauga it is. What kind of home?", 5),
      said("3 bed townhouse, budget around 950k", 5),
      wrote("Got it, a 3-bed townhouse around 950k. Are you pre-approved?", 4),
      said("Yes pre-approved with TD. We want to move by March", 4),
      wrote("Perfect. Any part of Mississauga you like most?", 4),
      said("Erin Mills or Churchill Meadows. Can you help us?", 0),
    ],
    next: reply,
    asks: ["whether the agent can help them"],
    told: ["Mississauga", "a 3-bed townhouse", "around 950k", "pre-approved with TD", "moving by March", "Erin Mills or Churchill Meadows"],
    expect: "Asks for none of what they already said, and moves to a next step.",
  },
  {
    name: "Back a year later",
    group: "context",
    channel: "instagram",
    lines: [
      said("Looking for a 3 bed in Oakville under 1.4", 380),
      wrote("Sounds good. When are you hoping to move?", 380),
      said("Probably next year", 379),
      said("Hey it's Sam again, we're actually ready now", 0),
    ],
    next: reply,
    told: ["a 3-bed", "in Oakville", "under 1.4"],
    expect: "Reuses what they said last year instead of asking it all again, and moves toward seeing homes.",
  },
  {
    name: "After a showing: \"7 out of 10, kitchen's too small\"",
    group: "context",
    channel: "email",
    lines: [wrote("Thanks for coming to see 45 Maple Dr today, Sam. Out of 10, where did it land for you?", 0), said("7. Kitchen's too small", 0)],
    next: reply,
    expect: "Picks up the small kitchen and offers to look for homes with a bigger one, inventing no listing.",
  },
  {
    name: "Lost the offer",
    group: "context",
    channel: "instagram",
    lines: [said("We lost the offer on 19 Ash Rd. Honestly gutted.", 0)],
    next: reply,
    feeling: true,
    expect: "Acknowledges how they feel first, with no pressure and no pitch.",
  },
  {
    name: "Spanish, with what they've told so far",
    group: "context",
    channel: "email",
    lines: [
      said("Hola, buscamos una casa de 3 habitaciones en Brampton, presupuesto de 1 millón.", 2),
      wrote("¡Hola Sam! Una casa de 3 habitaciones en Brampton, hasta 1 millón. ¿Cuándo les gustaría mudarse?", 2),
      said("En verano. ¿Usted trabaja con compradores primerizos?", 0),
    ],
    next: reply,
    asks: ["whether the agent works with first-time buyers"],
    told: ["a 3-bedroom house", "in Brampton", "budget of 1 million", "moving in summer"],
  },

  // ── Stop: their newest message, read by the "no" safety net ───────────────────────────────────────────────
  { name: "\"STOP\"", group: "stop", channel: "instagram", lines: [STILL_LOOKING, said("STOP")], next: stop(true) },
  { name: "\"Please stop messaging me\"", group: "stop", channel: "email", lines: [STILL_LOOKING, said("Please stop messaging me, not interested.")], next: stop(true) },
  { name: "\"We bought a place\"", group: "stop", channel: "email", lines: [STILL_LOOKING, said("We bought a place last month actually!")], next: stop(true) },
  { name: "\"We went with another agent\"", group: "stop", channel: "instagram", lines: [STILL_LOOKING, said("We went with another agent, thanks")], next: stop(true) },
  // A-340: the reply offers help once, then nothing follows unless they write back.
  {
    name: "\"We'll sell it ourselves\"",
    group: "stop",
    channel: "email",
    lines: [wrote("Hi Sam, any thoughts on listing your townhouse this spring?", 2), said("We're going to try selling it ourselves first, thanks.")],
    next: stop(true),
  },
  { name: "\"On hold\"", group: "stop", channel: "email", lines: [STILL_LOOKING, said("no thanks, we've put the whole thing on hold")], next: stop(true) },
  { name: "Hinglish no", group: "stop", channel: "instagram", lines: [STILL_LOOKING, said("nahi chahiye bhai, thanks")], next: stop(true) },
  { name: "Spanish no", group: "stop", channel: "messenger", lines: [STILL_LOOKING, said("No gracias, ya compramos una casa.")], next: stop(true) },
  { name: "\"Not right now, maybe spring\"", group: "stop", channel: "email", lines: [STILL_LOOKING, said("Not right now, maybe in the spring")], next: stop(false) },
  { name: "\"Busy, text me next week\"", group: "stop", channel: "instagram", lines: [STILL_LOOKING, said("Busy this week, text me next week")], next: stop(false) },
  { name: "\"Not that one, anything cheaper?\"", group: "stop", channel: "instagram", lines: [STILL_LOOKING, said("Not that one, anything cheaper?")], next: stop(false) },
  { name: "\"lol no not that one\"", group: "stop", channel: "messenger", lines: [STILL_LOOKING, said("lol no not that one 😂 what else do you have")], next: stop(false) },
];

export type ChatProblem =
  | "shape"
  | "unanswered"
  | "invented"
  | "language"
  | "missing_fact"
  | "asked_again"
  | "repeated"
  | "empty_nudge"
  | "pressure"
  | "brag"
  | "feeling"
  | "generic"
  | "expectation"
  | "kept_going"
  | "stopped_wrongly";

const PROBLEMS: ChatProblem[] = [
  "shape",
  "unanswered",
  "invented",
  "language",
  "missing_fact",
  "asked_again",
  "repeated",
  "empty_nudge",
  "pressure",
  "brag",
  "feeling",
  "generic",
  "expectation",
  "kept_going",
  "stopped_wrongly",
];

/** One conversation as it came back: the chat, what FollowUp did next, and what was wrong with it. */
export type ChatResult = {
  name: string;
  group: ChatGroup;
  channel: ChatCase["channel"];
  /** What FollowUp was asked to do, in words: "Reply", "Follow-up 2 of 5, 3 days quiet", "Stop or keep going?". */
  task: string;
  lines: { who: "in" | "out"; text: string }[];
  /** FollowUp's message, or what the "no" check decided. Empty when the case could not run. */
  next: string;
  problems: ChatProblem[];
  detail: string;
  error?: string;
};

export type ConversationEvalResult = {
  cases: number;
  passed: number;
  errors: number;
  problems: Record<ChatProblem, number>;
  chats: ChatResult[];
};

type ChatGrade = {
  answered: boolean[];
  invented: boolean;
  inventedWhat: string;
  sameLanguage: boolean;
  askedAgain: boolean;
  askedAgainWhat: string;
  askedAgainQuote: string;
  repeated: boolean;
  emptyNudge: boolean;
  pushy: boolean;
  bragged: boolean;
  robotic: boolean;
  acknowledgedFeeling: boolean;
  inventedFeeling: boolean;
  usedDetail: boolean;
  metExpectation: boolean;
};

export type ChatGrader = (c: ChatCase, message: string) => Promise<ChatGrade>;
type DmWriter = typeof draftDm;
type EmailWriter = typeof generateFollowUpMessage;
type StopReader = typeof checkForStop;
/** What the customer has told FollowUp so far (the qualifying checklist), as a live draft is given it. */
type Knower = (conversation: Message[]) => Promise<Qualification | null>;

/** The customer's profile name, as a live lead's would be given to the writer. */
const LEAD_NAME = "Sam";
const DAY = 86_400_000;

function toConversation(c: ChatCase, now: number): Message[] {
  return c.lines.map((l, i) => ({
    id: `c${i}`,
    direction: l.who === "in" ? "inbound" : "outbound",
    channel: c.channel,
    body: l.text,
    // Oldest first, a minute apart within a day, so two lines on the same day keep their order.
    date: new Date(now - l.daysAgo * DAY - (c.lines.length - i) * 60_000).toISOString(),
    opened: false,
  }));
}

function taskOf(next: Next): string {
  if (next.kind === "reply") return "Reply";
  if (next.kind === "stop") return "Stop or keep going?";
  const quiet = `${next.daysQuiet} day${next.daysQuiet === 1 ? "" : "s"} quiet`;
  return next.total > 1 ? `Follow-up ${next.step + 1} of ${next.total}, ${quiet}` : `Follow-up, ${quiet}`;
}

/** "Noted.", "Got it," as the message's opening: their words handed back as a verdict (A-231). */
const ECHO_RE = /^(?:noted|got it)\b[.!,]?/i;
/** What stepHint forbids by name: a follow-up that says only that it is one. */
const EMPTY_NUDGE_RE = /\b(?:just )?(?:checking in|circling back|touching base|following up|any updates?\b)/i;

/**
 * Reads one message against its checklist. The best model (its own job, "grade_chat", is not one of the usual-model
 * jobs): on the first run, 2026-10-30, the usual model called seven good replies wrong ("asked again" for a price the
 * customer never gave, "suggested another lender" for a reply that named none).
 */
export const gradeChat: ChatGrader = async (c, message) => {
  const client = getClient("grade_chat");
  const facts = (c.facts ?? []).map((f) => `- ${f.label}: ${f.value}`).join("\n") || "(none)";
  const chat = c.lines.map((l) => `[${l.daysAgo === 0 ? "today" : `${l.daysAgo} days ago`}] ${l.who === "in" ? "CUSTOMER" : "BUSINESS"}: ${l.text}`).join("\n");
  const what =
    c.next.kind === "followup"
      ? `A follow-up the business sends ${c.next.daysQuiet} day(s) after the customer went quiet.`
      : "A reply to the customer's newest message.";
  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0,
    max_tokens: 400,
    messages: [
      {
        role: "system",
        content:
          "You check a message a realtor's assistant is about to send to a customer. You only grade; you never rewrite.\n\n" +
          "answered: one entry per numbered question, in order. true when the message answers it, or says plainly the " +
          "business will check or confirm it. false when it ignores it or changes the subject.\n" +
          "invented: true when the message states as fact any specific detail (a price, fee, number, date, time, " +
          "availability, listing, a home that came up, a price change, a rate, experience, a policy) that appears " +
          "neither in the conversation nor in the BUSINESS FACTS. A placeholder such as [PRICE] is not invented. " +
          "Offering to help, look, send or check is a promise to act, not a fact. Repeating the customer's own details " +
          "is not invented, but getting one wrong is. inventedWhat: that detail, or empty.\n" +
          "sameLanguage: true when the message is in the language of the customer's last message (Hinglish answered in " +
          "Hinglish or English both count).\n" +
          "askedAgain: true when the message asks the customer for something they already told the business (see WHAT " +
          "THE CUSTOMER ALREADY TOLD and the conversation), even in other words, including narrowing or widening it " +
          "(they asked for a yard: 'a fenced yard or a patio?'; they said detached: 'would a semi work?'). Asking for " +
          "something they never gave is never this: a price or number they didn't state, an area they didn't name. " +
          "Asking whether it is just this one home or a few in the area is not this when they only asked about one " +
          "home: asking about one home doesn't say they want only that one. A question the business already asked " +
          "and they left unanswered is 'repeated', not this. askedAgainWhat: what it asked again, or empty. " +
          "askedAgainQuote: the customer's own words, copied exactly from one of their messages, that already answer " +
          "it; empty when askedAgain is false.\n" +
          "repeated: true when it repeats the wording, the question or the angle of an earlier BUSINESS message.\n" +
          "emptyNudge: for a follow-up, true when it gives no reason to read it: 'just checking in', 'any update?', " +
          "'did you see my message', or nothing new or useful. Always false for a reply to their newest message.\n" +
          "pushy: true when it pressures them: urgency or scarcity nobody stated, a deadline, a command, a test of how " +
          "serious they are, guilt, or a promised outcome; or keeps selling after they declined.\n" +
          "bragged: true when it praises the agent or business (top, #1, best, expert, award-winning, results for " +
          "other clients) beyond the BUSINESS FACTS.\n" +
          "robotic: true when it reads like a template or a bot: stock phrases ('thanks for reaching out', 'I'd be " +
          "happy to help', 'great question'), 'our team', hype ('dream home', 'thrilled'), emoji, or a string of " +
          "exclamation marks.\n" +
          "acknowledgedFeeling: true when the customer named a feeling and the message acknowledges it in plain words; " +
          "also true when they named no feeling.\n" +
          "inventedFeeling: true when it names or assumes a feeling the customer never expressed, flatters them, or " +
          "claims something in common with them.\n" +
          "usedDetail: true when it picks up something specific the customer wrote (a place, a home, a date, the thing " +
          "they asked about), so it could not be sent unchanged to a different customer.\n" +
          "metExpectation: true when the message does what WHAT THIS MESSAGE MUST DO says; true when that says nothing.",
      },
      {
        role: "user",
        content:
          `THIS MESSAGE IS: ${what}\n\nCUSTOMER'S NAME (from their profile): ${LEAD_NAME}\n\nCONVERSATION (oldest first):\n${chat}\n\n` +
          `BUSINESS FACTS:\n${facts}\n\nQUESTIONS THE CUSTOMER ASKED:\n${(c.asks ?? []).map((a, i) => `${i + 1}. ${a}`).join("\n") || "(none)"}\n\n` +
          `WHAT THE CUSTOMER ALREADY TOLD:\n${(c.told ?? []).map((t) => `- ${t}`).join("\n") || "(see the conversation)"}\n\n` +
          `WHAT THIS MESSAGE MUST DO:\n${c.expect ?? "(nothing extra)"}\n\nMESSAGE TO CHECK:\n${message}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "chat_grade",
        strict: true,
        schema: {
          type: "object",
          properties: {
            answered: { type: "array", items: { type: "boolean" } },
            invented: { type: "boolean" },
            inventedWhat: { type: "string" },
            sameLanguage: { type: "boolean" },
            askedAgain: { type: "boolean" },
            askedAgainWhat: { type: "string" },
            askedAgainQuote: { type: "string" },
            repeated: { type: "boolean" },
            emptyNudge: { type: "boolean" },
            pushy: { type: "boolean" },
            bragged: { type: "boolean" },
            robotic: { type: "boolean" },
            acknowledgedFeeling: { type: "boolean" },
            inventedFeeling: { type: "boolean" },
            usedDetail: { type: "boolean" },
            metExpectation: { type: "boolean" },
          },
          required: [
            "answered",
            "invented",
            "inventedWhat",
            "sameLanguage",
            "askedAgain",
            "askedAgainWhat",
            "askedAgainQuote",
            "repeated",
            "emptyNudge",
            "pushy",
            "bragged",
            "robotic",
            "acknowledgedFeeling",
            "inventedFeeling",
            "usedDetail",
            "metExpectation",
          ],
          additionalProperties: false,
        },
      },
    },
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("The grader returned nothing.");
  const g = JSON.parse(raw) as Partial<ChatGrade>;
  return {
    answered: Array.isArray(g.answered) ? g.answered : [],
    invented: !!g.invented,
    inventedWhat: String(g.inventedWhat ?? ""),
    sameLanguage: !!g.sameLanguage,
    askedAgain: !!g.askedAgain,
    askedAgainWhat: String(g.askedAgainWhat ?? ""),
    askedAgainQuote: String(g.askedAgainQuote ?? ""),
    repeated: !!g.repeated,
    emptyNudge: !!g.emptyNudge,
    pushy: !!g.pushy,
    bragged: !!g.bragged,
    robotic: !!g.robotic,
    acknowledgedFeeling: !!g.acknowledgedFeeling,
    inventedFeeling: !!g.inventedFeeling,
    usedDetail: !!g.usedDetail,
    metExpectation: !!g.metExpectation,
  };
};

export type ChatDeps = { dm: DmWriter; email: EmailWriter; grade: ChatGrader; stopRead: StopReader; know: Knower };

const REALTOR = templateFor(REPLY_EVAL_TRADE);

/** The real qualifying reader on the chat so far, as scoring.ts reads a live one before it drafts. */
const knowFromChat: Knower = async (conversation) => {
  if (!REALTOR) return null;
  const extracted = await extractQualificationFacts(conversation, REALTOR.criteria);
  return mergeQualification(REALTOR, null, extracted, customerTexts(conversation));
};

const LIVE: ChatDeps = { dm: draftDm, email: generateFollowUpMessage, grade: gradeChat, stopRead: checkForStop, know: knowFromChat };

/** The "no" check on their newest message, decided the way scoring.ts decides it: any read that says stop counts. */
async function runStop(c: ChatCase & { next: { kind: "stop" } }, deps: ChatDeps, retry?: RateLimitRetryOptions): Promise<Pick<ChatResult, "next" | "problems" | "detail">> {
  const last = [...c.lines].reverse().find((l) => l.who === "in")?.text ?? "";
  const optedOut = isOptOutMessage(last);
  const { tries, stops } = await withRateLimitRetry(() => deps.stopRead(toConversation(c, Date.now())), retry);
  if (tries === 0 && !optedOut) throw new Error("The \"no\" check returned no answer.");
  const stopped = optedOut || stops > 0;
  const next = stopped
    ? `Stops here${optedOut ? " (an opt-out word)" : ""}${tries ? ` · ${stops} of ${tries} reads said stop` : ""}`
    : `Keeps going · 0 of ${tries} reads said stop`;
  if (c.next.shouldStop && !stopped) return { next, problems: ["kept_going"], detail: "kept going after a no" };
  if (!c.next.shouldStop && stopped) return { next, problems: ["stopped_wrongly"], detail: "stopped a customer who only said not now" };
  return { next, problems: [], detail: "" };
}

/** Writes the next message with FollowUp's real writer for this channel, and checks it. */
async function runWritten(c: ChatCase, deps: ChatDeps, lessons: Lessons, retry?: RateLimitRetryOptions): Promise<Pick<ChatResult, "next" | "problems" | "detail">> {
  const conversation = toConversation(c, Date.now());
  const hint = c.next.kind === "followup" ? stepHint({ step: c.next.step, total: c.next.total, kind: c.next.angle, final: !!c.next.final }, c.next.daysQuiet) : undefined;
  const facts = c.facts ?? [];
  // What they've told so far, read by the real qualifier: a live reply is written with it (scoring.ts), and so is a
  // live follow-up since 2026-10-30 (automation.ts, sequences.ts).
  const known = await withRateLimitRetry(() => deps.know(conversation), retry);
  let message: string;
  let shapeFailed: string | null = null;
  if (c.channel === "email") {
    const drafted = await withRateLimitRetry(
      () => deps.email({ name: LEAD_NAME, conversation, trade: REPLY_EVAL_TRADE, facts, examples: lessons.examples, rules: lessons.rules, known }, [], hint, undefined, null),
      retry
    );
    message = drafted.body.trim();
  } else {
    const drafted = await withRateLimitRetry(
      () => deps.dm(LEAD_NAME, conversation, [], hint, "reply", null, facts, null, REPLY_EVAL_TRADE, lessons.examples, lessons.rules, { qualification: known, nothingToAsk: false }),
      retry
    );
    message = drafted.body.trim();
    shapeFailed = drafted.shapeFailed;
  }
  const g = await withRateLimitRetry(() => deps.grade(c, message), retry);

  const problems: ChatProblem[] = [];
  const details: string[] = [];
  const add = (p: ChatProblem, note?: string) => {
    if (!problems.includes(p)) problems.push(p);
    if (note) details.push(note);
  };
  if (shapeFailed) add("shape", `shape rule: ${shapeFailed}`);
  if (ECHO_RE.test(message)) add("generic", "opened with their words handed back");
  const missed = (c.asks ?? []).filter((_, i) => g.answered[i] !== true);
  if (missed.length) add("unanswered", `not answered: ${missed.join("; ")}`);
  if (g.invented && !theirOwnWords(g.inventedWhat, { lines: c.lines.map((l) => [l.who, l.text] as ["in" | "out", string]), facts })) {
    add("invented", `invented: ${g.inventedWhat}`);
  }
  if (!g.sameLanguage) add("language", "wrong language");
  const absent = (c.mustInclude ?? []).filter((w) => !message.includes(w));
  if (absent.length) add("missing_fact", `missing: ${absent.join(", ")}`);
  // Only with their own words as proof: a reader that can't quote where they said it has guessed.
  const theirs = c.lines.filter((l) => l.who === "in").map((l) => l.text);
  if (g.askedAgain && isCustomerQuote(g.askedAgainQuote, theirs)) {
    add("asked_again", `asked again: ${g.askedAgainWhat || "something they already said"} (they said "${g.askedAgainQuote.trim()}")`);
  }
  if (g.repeated) add("repeated", "repeated an earlier message");
  if (c.next.kind === "followup" && (g.emptyNudge || EMPTY_NUDGE_RE.test(message))) add("empty_nudge", "gave them no reason to read it");
  const tone = salesPressure(message, { said: facts.map((f) => f.value).join("\n") });
  const askedAfterNo = c.closing && /[?？؟]/.test(message);
  if (g.pushy || tone === "pressure" || askedAfterNo) add("pressure", askedAfterNo ? "asked again after a no" : "pushed or rushed them");
  if (g.bragged || tone === "brag") add("brag", "praised the business");
  if ((c.feeling && !g.acknowledgedFeeling) || g.inventedFeeling) add("feeling", g.inventedFeeling ? "made up a feeling" : "missed the feeling they named");
  if ((!g.usedDetail && !c.noDetail) || g.robotic) add("generic", g.robotic ? "read like a template" : "could go to anyone");
  if (c.expect && !g.metExpectation) add("expectation", `didn't do what this case needs: ${c.expect}`);
  return { next: message, problems, detail: details.join(" · ") };
}

/**
 * Five at a time: a written case is up to four best-model calls one after another (the qualifier, a draft, a retry, a
 * grade), about 20 seconds; a stop case five reads at once. 44 cases stay well inside the route's 300 seconds.
 */
export const CONVERSATION_EVAL_CONCURRENCY = 5;

const NO_LESSONS: Lessons = { examples: [], rules: [] };

export async function runConversationEval(
  cases: ChatCase[] = CHAT_CASES,
  options: { deps?: Partial<ChatDeps>; lessons?: Lessons; retry?: RateLimitRetryOptions; concurrency?: number } = {}
): Promise<ConversationEvalResult> {
  const deps: ChatDeps = { ...LIVE, ...options.deps };
  const problems = Object.fromEntries(PROBLEMS.map((p) => [p, 0])) as Record<ChatProblem, number>;
  // Logged as "test:…" in the decision log, apart from real customers.
  const chats = await withAiContext({ tag: "test" }, () =>
    mapWithConcurrency(cases, options.concurrency ?? CONVERSATION_EVAL_CONCURRENCY, async (c): Promise<ChatResult> => {
      const base = { name: c.name, group: c.group, channel: c.channel, task: taskOf(c.next), lines: c.lines.map(({ who, text }) => ({ who, text })) };
      try {
        const out = c.next.kind === "stop" ? await runStop(c as ChatCase & { next: { kind: "stop" } }, deps, options.retry) : await runWritten(c, deps, options.lessons ?? NO_LESSONS, options.retry);
        return { ...base, ...out };
      } catch (err) {
        return { ...base, next: "", problems: [], detail: "", error: err instanceof Error ? err.message : "unknown error" };
      }
    })
  );
  let passed = 0;
  let errors = 0;
  for (const chat of chats) {
    if (chat.error) errors += 1;
    else if (chat.problems.length === 0) passed += 1;
    for (const p of chat.problems) problems[p] += 1;
  }
  return { cases: cases.length, passed, errors, problems, chats };
}
