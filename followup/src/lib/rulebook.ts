import { CHAT_CASES, type ChatCase } from "@/lib/conversationEval";
import { REPLY_CASES, type ReplyCase } from "@/lib/replyEval";
import { QUAL_EVAL_CASES, type QualEvalCase } from "@/lib/qualificationEval";
import { EVAL_CASES, type EvalCase } from "@/lib/classifierEval";
import { DM_JUDGE_CASES, type DmJudgeCase } from "@/lib/dmJudgeEval";
import type { TestId } from "@/lib/testRunMath";

/**
 * FollowUp's rulebook: the rules that decide what it writes and decides, in one organised place (night plan B1 + B3,
 * 2026-10-31, research/product/2026-10-31-make-followup-easy-to-train-and-fix.md).
 *
 * The rules themselves still live in the prompts that carry them (the long instructions in
 * src/lib/integrations/openai.ts, the realtor playbook in src/lib/tradePlaybooks.ts, the follow-up angles in
 * src/lib/followUpPlans.ts, the checklist in src/lib/qualification.ts) and in the code checks behind them. Before
 * this, nobody could list them: 19 dated patches went in on Oct 30 alone, rules started to clash, and every change
 * meant rerunning every test ($12–14). Each rule here has:
 *  - a plain name and why it exists (who asked, or which test caught what);
 *  - where it lives: a few exact words of the instruction or code, which a test checks are still there, so this list
 *    can't quietly drift from the prompts;
 *  - the test cases that prove it, picked from the accuracy tests, so changing a rule reruns only its own tests
 *    (Admin → Rulebook, "Run its tests"), for cents.
 *
 * Changing how FollowUp talks: find the rule here, change the words where it lives, run its tests. A new rule: add it
 * here with where it lives and at least one test, or the test of this file fails.
 */

export type RuleArea = "message" | "followup" | "no" | "realtor" | "sorting" | "qualifying";

export const AREAS: { id: RuleArea; title: string; what: string }[] = [
  { id: "message", title: "Every message a customer reads", what: "Replies and follow-ups, on every channel." },
  { id: "followup", title: "Follow-ups", what: "What each follow-up says when a customer has gone quiet." },
  { id: "no", title: "\"No\", \"not now\" and stopping", what: "When FollowUp stops, and when it must not." },
  { id: "realtor", title: "Realtors", what: "What a good agent knows. Sits under every rule above, never over one." },
  { id: "sorting", title: "Is this a customer?", what: "Sorting emails and first DMs." },
  { id: "qualifying", title: "What the customer has told", what: "The realtor checklist: known only when they said it." },
];

type Pickers = {
  conversations?: (c: ChatCase) => boolean;
  replies?: (c: ReplyCase) => boolean;
  qualifying?: (c: QualEvalCase) => boolean;
  "email-check"?: (c: EvalCase) => boolean;
  "dm-check"?: (c: DmJudgeCase) => boolean;
};

export type Rule = {
  id: string;
  area: RuleArea;
  /** The rule in plain words. */
  name: string;
  /** Why it exists: who asked for it, or what went wrong without it. */
  why: string;
  /** What it looks like done right, and wrong, when an example helps. */
  good?: string;
  bad?: string;
  /** Where it lives: a file, and exact words in it (checked by src/lib/__tests__/rulebook.test.ts). */
  where: { file: string; words: string }[];
  /** The test cases that prove it. */
  tests: Pickers;
};

const named =
  (...names: string[]) =>
  (c: { name: string }) =>
    names.includes(c.name);
const nameHas =
  (re: RegExp) =>
  (c: { name: string }) =>
    re.test(c.name);
const written = (c: ChatCase) => c.next.kind !== "stop";
const angle = (a: string) => (c: ChatCase) => c.next.kind === "followup" && c.next.angle === a;
const OTHER_LANGUAGE = /Hinglish|Spanish|Punjabi|Hindi|French/i;

const OPENAI = "src/lib/integrations/openai.ts";
const PLAYBOOK = "src/lib/tradePlaybooks.ts";
const PLANS = "src/lib/followUpPlans.ts";
const CHECKLIST = "src/lib/qualification.ts";

export const RULES: Rule[] = [
  // ── Every message ─────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "answer-first",
    area: "message",
    name: "Answer what they asked first, or say you'll check.",
    why: "An unanswered question is the first thing a customer notices. \"I'll check\" is honest; changing the subject isn't.",
    good: "\"Yes, the Elm Ct house has a finished basement. Want to see it this week?\"",
    bad: "\"Great! When are you hoping to move?\" (their question ignored)",
    where: [
      { file: PLAYBOOK, words: "Every reply first responds to what their last message said" },
      { file: OPENAI, words: "write the sentence that answers it with the exact placeholder" },
    ],
    tests: { replies: (c) => c.asks.length > 0, conversations: (c) => (c.asks?.length ?? 0) > 0 },
  },
  {
    id: "never-invent",
    area: "message",
    name: "Never invent a price, date, listing or claim. Leave a blank like [PRICE] for the owner.",
    why: "A made-up price or \"it's still available\" is a promise the owner never made. The owner fills a blank before it goes out.",
    good: "\"It's listed at [PRICE]. Want to see it?\"",
    bad: "\"It's listed at $899k\" when nobody said so.",
    where: [
      { file: OPENAI, words: "Never invent facts" },
      { file: OPENAI, words: "write the sentence that answers it with the exact placeholder" },
    ],
    tests: { replies: () => true, conversations: written },
  },
  {
    id: "facts-as-told",
    area: "message",
    name: "Use what the business told customers (Settings → What FollowUp knows), as it was told.",
    why: "The owner's own facts are the only figures FollowUp may state; the checks treat them as the owner's words.",
    where: [{ file: OPENAI, words: "detail in the draft that matches one of them word for word is the business's own statement" }],
    tests: { replies: (c) => !!c.facts?.length || !!c.mustInclude?.length, conversations: (c) => !!c.facts?.length || !!c.mustInclude?.length },
  },
  {
    id: "their-language",
    area: "message",
    name: "Write in the language of their last message. Hinglish stays Hinglish, in the same script.",
    why: "Founder, Sep 2026: a customer who switches language gets the reply in the language they switched to.",
    where: [{ file: OPENAI, words: "in the same language as the lead's most recent message" }],
    tests: { replies: nameHas(OTHER_LANGUAGE), conversations: nameHas(OTHER_LANGUAGE) },
  },
  {
    id: "polite-you",
    area: "message",
    name: "Use the polite \"you\" in their language (aap, usted, vous), never the familiar one.",
    why: "Founder's Instagram test, Oct 18: \"tujhe\" read as rude from a business.",
    where: [{ file: OPENAI, words: "polite form of 'you'" }],
    tests: { replies: nameHas(/Hinglish/i), conversations: nameHas(/Hinglish/i) },
  },
  {
    id: "owner-voice",
    area: "message",
    name: "Sound like the owner typing on their phone: no stock phrases, no em dashes, no emoji.",
    why: "One \"I hope this finds you well\" tells the customer a machine wrote it, in the first six words.",
    bad: "\"Thanks for reaching out! I'd be happy to help with your dream home journey.\"",
    where: [{ file: OPENAI, words: "Write this the way the owner of the business would type it themselves" }],
    tests: { replies: () => true, conversations: written },
  },
  {
    id: "first-person",
    area: "message",
    name: "Write as the owner, in the first person: \"I'll confirm the time\", never \"the agent will\".",
    why: "Runs 3 and 4 of the conversation test (Oct 30) wrote \"something the agent can talk through\", naming the writer as someone else. The realtor rules now say \"the agent\" means the writer (Oct 31).",
    good: "\"I'll find out if there's any room on the price.\"",
    bad: "\"The agent can talk through the best way to approach an offer.\"",
    where: [
      { file: OPENAI, words: "You are the owner, writing in the first person" },
      { file: PLAYBOOK, words: "means the business you write as" },
    ],
    tests: { conversations: named("\"Is the price negotiable?\"", "Asking price, and FollowUp doesn't know it"), replies: named("experience") },
  },
  {
    id: "warm-opening",
    area: "message",
    name: "Sound glad they wrote: a few warm words about what they said, never \"thanks for writing\".",
    why: "Founder's Talk test, Oct 18 (R-135): replies read like a form.",
    where: [{ file: OPENAI, words: "Sound glad they wrote" }],
    tests: { replies: () => true },
  },
  {
    id: "show-you-read-it",
    area: "message",
    name: "Pick up something they wrote, so the message could only go to them.",
    why: "Trust research (A-247): a question only someone who read it could ask is what makes a reply feel human.",
    where: [{ file: OPENAI, words: "Show you read their message" }],
    tests: { replies: (c) => !c.noDetail, conversations: (c) => written(c) && !c.noDetail },
  },
  {
    id: "no-bragging",
    area: "message",
    name: "Be useful, never praise yourself: no \"top agent\", awards or other clients' results unless the owner's facts say so.",
    why: "Trust research (A-247): self-promotion annoys more than the promoter thinks; Ontario's rules need proof of any ranking.",
    where: [
      { file: OPENAI, words: "Show you know the work by being useful, never by praising" },
      { file: PLAYBOOK, words: "Never call the agent a top, #1, award-winning or best agent" },
    ],
    tests: { replies: named("knows the area: useful, no bragging", "experience") },
  },
  {
    id: "feelings",
    area: "message",
    name: "If they named a feeling, acknowledge it once, tied to what caused it. Never invent one.",
    why: "\"Sorry to hear that\" could go to anyone; \"losing 3 offers in a row is exhausting\" couldn't.",
    where: [{ file: OPENAI, words: "If they named a feeling (tired, worried, stressed" }],
    tests: { replies: (c) => !!c.feeling || c.name === "plain search: invents no feeling", conversations: (c) => !!c.feeling },
  },
  {
    id: "no-pressure",
    area: "message",
    name: "Offer, never push: no urgency, deadlines, commands or promised outcomes.",
    why: "Pressure in text causes more pushback than face to face. A code check backs the prompt: a prompt is a request, a check is a guarantee.",
    bad: "\"Homes like this won't last, you need to book this week.\"",
    where: [
      { file: OPENAI, words: "Offer, never push" },
      { file: "src/lib/replyTone.ts", words: "export function salesPressure" },
    ],
    tests: { replies: named("weekend viewing: no pressure"), conversations: (c) => c.group === "objection" },
  },
  {
    id: "never-ask-again",
    area: "message",
    name: "Never ask again for something they already told, in any words, not even to narrow it.",
    why: "The conversation test's most common failure on Oct 30: they said townhouses, it asked \"freehold or condo?\".",
    where: [
      { file: CHECKLIST, words: "WHAT THIS CUSTOMER HAS ALREADY TOLD YOU" },
      { file: PLAYBOOK, words: "Never ask anything this conversation already asked or they already answered" },
    ],
    tests: { conversations: (c) => !!c.told?.length },
  },
  {
    id: "never-repeat",
    area: "message",
    name: "Never repeat a sentence or an opening the business already sent.",
    why: "Founder's Instagram test, Oct 18: every reply opened with the same sentence.",
    where: [{ file: OPENAI, words: "Never repeat a sentence, or the same opening" }],
    tests: { conversations: (c) => c.group === "quiet" },
  },
  {
    id: "no-false-answered",
    area: "message",
    name: "Never say something was answered unless a message actually answered it.",
    why: "Founder's Instagram test, Oct 18: \"I've already answered both\" when nothing had been.",
    where: [{ file: OPENAI, words: "Never say you have answered, covered or sorted something" }],
    tests: { conversations: named("Day 1: answer the questions we said we'd check") },
  },
  {
    id: "dm-shape",
    area: "message",
    name: "On Instagram and Messenger: short, no subject, one question last, two or three tap buttons.",
    why: "A DM is read on a phone between other things; a code check refuses a draft that breaks the shape.",
    where: [
      { file: OPENAI, words: "Two or three reply buttons" },
      { file: "src/lib/dmDrafts.ts", words: "export function checkDmDraftShape" },
    ],
    tests: { replies: () => true, conversations: (c) => written(c) && c.channel !== "email" },
  },

  {
    id: "each-kind-its-plan",
    area: "message",
    name: "Each kind of business has its own plan: what it never says (no legal or medical advice, no rates) and the meeting it works toward.",
    why: "Founder, Oct 18 (A-296): a non-realtor's replies had no plan at all. The conversation test covers each kind since Oct 31.",
    where: [
      { file: PLAYBOOK, words: "A MORTGAGE BROKER" },
      { file: PLAYBOOK, words: "Never give legal advice" },
    ],
    tests: { conversations: (c) => !!c.trade },
  },

  // ── Follow-ups ────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "followup-has-a-reason",
    area: "followup",
    name: "Every follow-up carries something for them: never \"just checking in\".",
    why: "A follow-up with nothing in it is the top complaint about business texts (49%, 2023 SMS survey).",
    bad: "\"Hi Sam, just checking in!\"",
    where: [{ file: OPENAI, words: "A message whose only point is that you are still there is never acceptable" }],
    tests: { conversations: (c) => c.next.kind === "followup" },
  },
  {
    id: "followup-needs-first",
    area: "followup",
    name: "A follow-up starts from what the chat still needs: an unanswered question, a showing not booked, a worry they named. The day's angle comes only after.",
    why: "Night plan D1 (Oct 31): the angle came from the day alone, so on day 14 with nothing new FollowUp had to invent something, where most of the Oct 30 test failures were.",
    where: [{ file: PLANS, words: "First, read what this conversation still needs" }],
    tests: { conversations: (c) => c.next.kind === "followup" && ["open", "new", "step"].includes(c.next.angle) },
  },
  {
    id: "followup-open",
    area: "followup",
    name: "Day 1: answer anything left open; if nothing answers it, say you'll check. Never fill the gap with a claim about the market.",
    why: "Conversation test, Oct 30: \"anything with a yard?\" got \"some only have small patios\", which nobody had said.",
    where: [{ file: PLANS, words: "never a general claim about the market" }],
    tests: { conversations: angle("open") },
  },
  {
    id: "followup-new",
    area: "followup",
    name: "Day 3 and 14: one new, useful thing; never an offer the business already made. Nothing new: one short new question.",
    why: "Conversation test, Oct 30: day 14 repeated the day-1 offer to look lower on price.",
    where: [{ file: PLANS, words: "never make again an offer the" }],
    tests: { conversations: angle("new") },
  },
  {
    id: "followup-step",
    area: "followup",
    name: "Day 7: one small next step the business hasn't already offered.",
    why: "Conversation test, Oct 30: after \"would it help to talk it through?\", day 7 offered a call again.",
    where: [{ file: PLANS, words: "one the business hasn't already offered" }],
    tests: { conversations: angle("step") },
  },
  {
    id: "followup-close",
    area: "followup",
    name: "Day 30: close the loop kindly, with either answer fine.",
    why: "A last message that makes \"no\" easy keeps the door open and the owner's name good.",
    where: [{ file: PLANS, words: "close the loop with one easy question" }],
    tests: { conversations: angle("close") },
  },
  {
    id: "followup-checkback",
    area: "followup",
    name: "When they asked to hear back at a time, say so in their words and ask if now suits.",
    why: "\"Write me in March\" is a promise to keep, in their terms.",
    where: [{ file: PLANS, words: "they asked you to get back to them around now" }],
    tests: { conversations: angle("checkback") },
  },
  {
    id: "followup-thanks",
    area: "followup",
    name: "The day after a showing: thank them, and never write as if it is still to come.",
    why: "Conversation test, Oct 30: the day after the showing it wrote \"see you then\".",
    where: [{ file: PLANS, words: "never write as if it is still to come" }],
    tests: { conversations: angle("thanks") },
  },

  // ── No and not now ────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "no-warm-close",
    area: "no",
    name: "After a no: a short, warm close. No question, no offer, no attempt to change their mind.",
    why: "FollowUp is never a spam tool. A kind goodbye is the last thing they remember about the owner.",
    good: "\"Thanks for letting me know, Sam. All the best with the new place.\"",
    where: [{ file: OPENAI, words: "warm close instead: thank them and wish them well" }],
    tests: { conversations: (c) => !!c.closing, replies: (c) => !!c.closing },
  },
  {
    id: "no-stays-no",
    area: "no",
    name: "Once they've said no, every later reply stays a warm close, however they answer.",
    why: "Founder's Instagram test, Oct 18: after a no and a kind close, \"you too\" got a new pitch.",
    where: [{ file: OPENAI, words: "Once they have said no anywhere in this conversation" }],
    tests: { conversations: (c) => c.next.kind === "stop" && c.next.shouldStop },
  },
  {
    id: "stop-check",
    area: "no",
    name: "Before any automatic message, five separate reads ask \"did they say no?\"; any one yes stops everything.",
    why: "A-326 (Oct 25): a missed no is a customer messaged after they said no. Opt-out words (STOP) stop it without asking the AI.",
    where: [
      { file: OPENAI, words: "export async function checkForStop" },
      { file: OPENAI, words: "export const STOP_TRIES = 5" },
    ],
    tests: { conversations: (c) => c.next.kind === "stop" },
  },
  {
    id: "not-now-is-not-no",
    area: "no",
    name: "\"Not now\", \"busy\", \"just looking\" and \"not that one\" are not a no: keep going, gently.",
    why: "A customer dropped because they said \"maybe spring\" is a customer lost for nothing.",
    where: [
      { file: OPENAI, words: "If it says it isn't the right time yet" },
      { file: PLAYBOOK, words: "never treat it as a no" },
    ],
    tests: {
      conversations: (c) =>
        (c.next.kind === "stop" && !c.next.shouldStop) ||
        ["\"Just browsing\"", "\"Not ready, maybe next year\"", "\"We're about six months out\"", "\"Busy, text me later\""].includes(c.name),
    },
  },
  {
    id: "has-an-agent",
    area: "no",
    name: "They have an agent: a warm close, nothing about the agent, nothing suggested, even if they complain.",
    why: "The Code of Ethics sends another agent's client through that agent; run 4 (Oct 30) offered help to someone whose agent never answers.",
    where: [{ file: PLAYBOOK, words: "say nothing about the agent and suggest nothing" }],
    tests: {
      conversations: named("\"We already have an agent\"", "\"My agent never answers me\"", "\"We went with another agent\""),
      replies: named("has an agent: a warm close"),
    },
  },
  {
    id: "real-person",
    area: "no",
    name: "\"Is this a bot?\" always waits for the owner.",
    why: "Only a person can answer that honestly; FollowUp never claims to be one.",
    where: [{ file: OPENAI, words: "whether they are talking to a real person, a bot, AI" }],
    tests: { conversations: named("\"Is this a bot?\"") },
  },

  // ── Realtors ──────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "realtor-price",
    area: "realtor",
    name: "A price nobody gave stays a blank for the owner; what a home sold for or what someone paid is \"I'll check\".",
    why: "Run 4 (Oct 30): \"what did it sell for?\" got \"sold for [PRICE]\", a figure that isn't the owner's to share.",
    where: [{ file: OPENAI, words: "never what a home sold for or what someone else paid" }],
    tests: {
      conversations: named("Asking price, and FollowUp knows it", "Asking price, and FollowUp doesn't know it", "\"What did it sell for?\"", "A seller asks the commission"),
      replies: nameHas(/fee/),
    },
  },
  {
    id: "realtor-negotiable",
    area: "realtor",
    name: "\"Is it negotiable?\": never guess or hint; I'll find out if there's room and talk it through.",
    why: "Conversation test, Oct 30: it hinted, then named the writer as someone else.",
    where: [{ file: PLAYBOOK, words: "never ask which home here: the agent" }],
    tests: { conversations: named("\"Is the price negotiable?\"") },
  },
  {
    id: "realtor-bad-news",
    area: "realtor",
    name: "Bad news (an offer lost): sorry first, in their terms; then at most one gentle offer, not a question.",
    why: "Run 4 (Oct 30): \"we lost the offer, gutted\" got straight to \"should I look for similar homes?\".",
    where: [{ file: PLAYBOOK, words: "say you're sorry in your own words first" }],
    tests: { conversations: named("Lost the offer"), replies: named("lost offers: acknowledges the feeling") },
  },
  {
    id: "realtor-showings",
    area: "realtor",
    name: "Offer a showing once they name a home; never pick or promise a day or time: the owner confirms every time.",
    why: "A promised time the owner can't make is worse than no time.",
    where: [
      { file: PLAYBOOK, words: "never pick a day or time yourself" },
      { file: PLAYBOOK, words: "Never promise a showing day or time" },
    ],
    tests: {
      replies: named("asks for a viewing time", "weekend viewing: no pressure"),
      conversations: named("The thank-you the day after a showing", "After a showing: \"7 out of 10, kitchen's too small\""),
    },
  },
  {
    id: "realtor-sell-yourself",
    area: "realtor",
    name: "\"We'll sell it ourselves\" isn't a no: wish them well and offer help once, no strings.",
    why: "Founder, Oct 30 (A-340): \"offer help once\".",
    where: [{ file: PLAYBOOK, words: "it is not a no" }],
    tests: { conversations: named("\"We'll try selling it ourselves\"", "\"We'll sell it ourselves\"") },
  },
  {
    id: "realtor-home-value",
    area: "realtor",
    name: "\"What's my home worth?\": never a value or range; I'll look at the home and recent sales and come back.",
    why: "A number in a DM is a valuation the owner never gave.",
    where: [{ file: PLAYBOOK, words: "never give a value, range or opinion" }],
    tests: { conversations: named("\"Just curious what my place is worth\"") },
  },

  // ── Sorting ───────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "real-person-is-a-customer",
    area: "sorting",
    name: "A real person asking for a price, a quote, a time or about work is a customer, even outside the business's usual line.",
    why: "The owner can set a wrong one aside in one tap; a customer never answered is lost.",
    where: [{ file: OPENAI, words: "a customer who is never answered" }],
    tests: { "email-check": (c) => c.expectLead, "dm-check": (c) => c.expectCustomer },
  },
  {
    id: "marketplace-leads",
    area: "sorting",
    name: "A lead marketplace passing on one person's request is a customer; its receipts, reports and promotions are not.",
    why: "Backlog b007: many trades get their customers this way, from a no-reply address.",
    where: [{ file: OPENAI, words: "One kind of platform notification IS customer business" }],
    tests: { "email-check": nameHas(/^marketplace:/) },
  },
  {
    id: "not-a-customer",
    area: "sorting",
    name: "Friends, pitches, newsletters and spam are set aside.",
    why: "Every one let through is a draft the owner has to wave away.",
    where: [{ file: OPENAI, words: "export async function classifyWithSecondLook" }],
    tests: { "email-check": (c) => !c.expectLead, "dm-check": (c) => !c.expectCustomer },
  },

  // ── Qualifying ────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "known-only-when-said",
    area: "qualifying",
    name: "Something is known only when the customer said it, and the quote must be their own words.",
    why: "A made-up item is shown to the owner as fact; a missed one is just asked about once more.",
    where: [{ file: CHECKLIST, words: "export function isCustomerQuote" }],
    tests: { qualifying: () => true },
  },
  {
    id: "listing-is-not-a-want",
    area: "qualifying",
    name: "The words for the one home they asked about (\"the Pine Ct house\") say which listing, not what they want.",
    why: "Run 3 (Oct 30): a named home was read as the kind of home they wanted, so FollowUp stopped asking.",
    where: [{ file: CHECKLIST, words: "The plain word for the one home they asked about" }],
    tests: { qualifying: () => true },
  },
];

/** Each test's cases, to pick a rule's tests from. */
const CASES: { [K in keyof Pickers]-?: readonly { name: string }[] } = {
  conversations: CHAT_CASES,
  replies: REPLY_CASES,
  qualifying: QUAL_EVAL_CASES,
  "email-check": EVAL_CASES,
  "dm-check": DM_JUDGE_CASES,
};

/**
 * A rule's test cases, by test: the names a "run only these" sends. Chats for other kinds of business are their own
 * test, so a rule's run is saved beside the row it belongs to on Accuracy tests, never mixed into the realtors' one.
 */
export function ruleTests(rule: Rule): Partial<Record<TestId, string[]>> {
  const out: Partial<Record<TestId, string[]>> = {};
  for (const test of Object.keys(rule.tests) as (keyof Pickers)[]) {
    const pick = rule.tests[test] as ((c: { name: string }) => boolean) | undefined;
    if (!pick) continue;
    const picked = CASES[test].filter((c) => pick(c));
    const split: [TestId, readonly { name: string }[]][] =
      test === "conversations"
        ? [
            ["conversations", (picked as ChatCase[]).filter((c) => !c.trade)],
            ["conversations-other-kinds", (picked as ChatCase[]).filter((c) => !!c.trade)],
          ]
        : [[test, picked]];
    for (const [id, cases] of split) if (cases.length) out[id] = cases.map((c) => c.name);
  }
  return out;
}

/** Every rule with its tests worked out, for the Rulebook page. */
export type RuleWithTests = Omit<Rule, "tests"> & { tests: Partial<Record<TestId, string[]>> };

export function rulebook(): RuleWithTests[] {
  return RULES.map((r) => ({ ...r, tests: ruleTests(r) }));
}

/** How many cases each test has, so a price can be shown before any run of it is saved. */
export function caseTotals(): Record<TestId, number> {
  return {
    "email-check": EVAL_CASES.length,
    "dm-check": DM_JUDGE_CASES.length,
    qualifying: QUAL_EVAL_CASES.length,
    replies: REPLY_CASES.length,
    conversations: CHAT_CASES.filter((c) => !c.trade).length,
    "conversations-other-kinds": CHAT_CASES.filter((c) => !!c.trade).length,
    "conversations-real": 0,
    "replies-gpt-5.4-mini": REPLY_CASES.length,
    "replies-gpt-5.4": REPLY_CASES.length,
  };
}
