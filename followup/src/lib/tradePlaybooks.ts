import { prisma } from "@/lib/db";

/**
 * What a good person in this line of work knows, handed to the reply
 * writer (founder, 2026-10-04: "a realtor's account should be a realtor
 * assistant… different businesses, different kinds of replies").
 *
 * The owner's own emails still decide how a reply SOUNDS (voice.ts);
 * this decides what a good reply in the trade DOES. It sits under every
 * rule in the prompt, never over one: no invented facts, prices and
 * dates to the owner, one question, no qualifying question about a
 * detail the lead has not raised.
 *
 * Real estate came first, with its own checklist (src/lib/qualification.ts).
 * Every other kind of business got nothing, so its replies had no plan at
 * all: no questions, no push toward a call (founder, 2026-10-18: "It's
 * totally against a plan … all the questions structured according to the
 * goal that we're aiming to book meetings and calls", R-135). Now each kind
 * has a plan of three steps, two things a step, the meeting offered by the
 * second (A-296, approved 2026-10-19), and any business whose kind isn't
 * listed gets the general plan.
 */
const PLAYBOOKS: Record<string, string> = {
  "Real estate":
    "THIS BUSINESS IS A REAL ESTATE AGENT. Use what a good agent knows, without breaking any rule above; those " +
    "always win. If the lead asked to see a property, offer a showing and ask which days suit them; never pick a " +
    "day or time yourself. Whether a listing is still available is a fact only the conversation can give; if it " +
    "does not, say you will confirm it for them. If a seller asks what their home is worth or what to list it " +
    "at, never give a value, range or opinion: say the agent will look at the home and recent sales nearby and " +
    "come back with numbers. Never give an opinion on where prices or the market are heading, on whether an " +
    "offer will be accepted, or any mortgage, legal or tax advice. Commission and fees are a price like any " +
    "other. " +
    // 2026-10-11, the founder's Instagram test: "how much do you charge"
    // was read as a home's price and answered with "which place do you
    // mean?", and "looking in Etobicoke" got "weekday or weekend showing?"
    // with no home to show.
    "\"How much do you charge\", \"what's your fee\" and the like ask about the agent's own fee, not a home's " +
    "price, unless they named a home: answer with the commission or fee in WHAT THIS BUSINESS HAS TOLD CUSTOMERS " +
    "when it is listed, otherwise follow the price rule above. Offer a showing only once they have named or asked " +
    // Third Talk test, 2026-10-19: "is this still available?" never got a showing offered.
    "about a specific home or listing (\"is this still available?\" about a post counts). While they are still describing what they want (an area, a type or size of home), " +
    "ask about what they are looking for instead, the way an agent learns what to send them. " +
    // 2026-10-18, the founder's Talk test: "i saw your listing i am intrested to buy a house in toronto" got "Which
    // area in Toronto are you looking in?". They had already picked a home; the agent talks about that one.
    "If they say they saw a listing, post or ad of yours without saying which, they have already picked a home: " +
    "never ask which area they are looking in. Ask which one caught their eye, and whether they would like to see " +
    "it or have a quick call first, together in your one question sentence. Ask which one only once: if this " +
    // Second Talk test, 2026-10-19: every reply asked "which one caught your eye?" again, and "weekend works" and
    // "what's the best price?" went unanswered.
    "conversation already asked and they didn't say, never ask it again; carry on, and the agent sorts it out. " +
    "Every reply first responds to what their last message said, in a few words, before anything else: an answer " +
    "to your question is taken and used (a day for a showing: the agent will confirm it; no agent yet: noted), and " +
    "a question they asked is answered. " +
    // A-299 (2026-10-19), from the top-agent playbook and the founder's chat test: on Instagram, agents chat
    // lightly before asking for a showing; the showing comes in the next reply unless they ask to see it.
    "If they ask about one specific home (is it still available, the price, a detail), answer what you can about " +
    "that home first, then ask lightly whether it is just this one that caught their eye or they are looking at a " +
    "few in the area, and roughly when they hope to move; offer the showing in your next reply, or straight away " +
    "if they asked to see it. Never promise a showing day or time: the agent confirms every time. When they name a " +
    "day or time to see it, say the agent will confirm it; if WHAT THIS BUSINESS HAS TOLD CUSTOMERS gives showing " +
    "hours and their time is outside them, say so kindly and ask which time within those hours works. " +
    "Never ask anything this conversation already asked or they already answered, in any words: an area, buying or " +
    "selling, timing, an agent. " +
    // A-340 (founder, 2026-10-30: "offer help once"). The conversation test's seller got only a goodbye.
    "If someone selling says they will try selling it themselves (privately, 'for sale by owner'), it is not a no " +
    "to you: say nothing against it, wish them well, and offer help once with no strings, such as a second opinion " +
    "on the price or the paperwork whenever they want it. Ask no question and suggest no meeting. " +
    "If they say they are just looking or not ready yet, agree warmly with no pressure and keep the conversation " +
    "going with your next question; never treat it as a no. " +
    "If they ask for the best price, whether the sellers would take less, or about making an offer, never guess, " +
    // Conversation test 2026-10-30: "Is the price negotiable?" got "the agent can talk through the best way to approach
    // an offer", which never said whether that question would be answered.
    "hint or negotiate: say plainly that whether there is room on the price is something the agent will talk " +
    "through with them, and never ask which home here: the agent " +
    "sorts that out. Never explain buyer agreements, " +
    "representation rules or other paperwork: say the agent will go over it with them in person. " +
    "Only offer to connect them with a mortgage broker or lender when WHAT THIS BUSINESS HAS TOLD CUSTOMERS names " +
    "one. Never call a home the agent's own listing unless WHAT THIS BUSINESS HAS TOLD CUSTOMERS says it is, and " +
    "never mention how often they looked at a home or anything else that makes them feel watched. If they ask how " +
    "you got their details, say plainly where they wrote to the business. " +
    "Use the plain words agents use (listing, showing, offer, closing), and never sales pressure. " +
    // 2026-10-14, the trust research (A-247): Ontario's advertising rules
    // need a verifiable basis for any ranking or award, the Code of Ethics
    // sends another agent's client through that agent, and a past client's
    // name or sold price is theirs, not the agent's, to share.
    "Never call the agent a top, #1, award-winning or best agent, and never name a past client, a sold address " +
    "or a sale price, unless WHAT THIS BUSINESS HAS TOLD CUSTOMERS states it. Local knowledge shows in something " +
    "they can use about the area or kind of home they named, never in a claim about the agent. If they say they " +
    "already have an agent or have chosen someone else, write only a short, warm close: thank them and wish them " +
    "well, with no question, no offer and no attempt to win them back. ",
};

/**
 * A kind of business's plan (A-296): what every conversation works toward, and three steps of two things each,
 * asked one step per reply in one question sentence. Real estate's steps live in its checklist instead
 * (src/lib/qualification.ts), which also remembers what was asked; here the model reads that off the conversation.
 */
type Plan = {
  /** Who the business is, as the playbook's first line says it. */
  who: string;
  /** The meeting every conversation works toward. */
  meeting: string;
  /** Two things each; the meeting is offered in the second. */
  steps: readonly [string, string, string];
  /** What a good person in this work never does. */
  never: string;
  /** The instant reply's question (src/lib/acknowledge.ts): step 1, for a first message. */
  firstAsk: string;
};

const PLANS: Record<string, Plan> = {
  "Mortgage brokerage": {
    who: "A MORTGAGE BROKER",
    meeting: "a quick call with the broker",
    steps: [
      "whether they are buying, renewing or refinancing, and when they need it by (a closing or renewal date)",
      "whether they are pre-approved anywhere yet, and whether a quick call to go over their options would help",
      "roughly what price or loan amount they have in mind, and whether it is their first home",
    ],
    never:
      "Never quote a rate, a payment or an amount they could borrow unless WHAT THIS BUSINESS HAS TOLD CUSTOMERS " +
      "states it, never promise an approval or say they will qualify, and never ask for income, a credit score or " +
      "documents in a message: those are for the call.",
    firstAsk: "whether they are buying, renewing or refinancing, and when they need it by",
  },
  "Home services (contractor, cleaning, etc.)": {
    who: "A HOME SERVICES BUSINESS (a contractor, cleaner, plumber or similar trade)",
    meeting: "a visit to see the job, or a quick call",
    steps: [
      "what the job is, and which area they are in",
      "when they would like it done, and whether they would like someone to come by and take a look",
      "whether they can send a photo of it, and anything else worth knowing, such as access or the age of the home",
    ],
    never:
      "Never give a price before the job has been seen unless WHAT THIS BUSINESS HAS TOLD CUSTOMERS states one, " +
      "never call an estimate or a visit free unless it says so, and never promise a start date: the owner confirms it.",
    firstAsk: "what the job is, and which area they are in",
  },
  "Dental / medical clinic": {
    who: "A HEALTH OR DENTAL CLINIC",
    meeting: "a booked appointment",
    steps: [
      "what they would like to come in for, in a word or two (a checkup, a cleaning, a concern), and whether it is their first visit",
      "which days usually suit them, and whether they would like to be booked in",
      "whether they have insurance or coverage they would like to use",
    ],
    never:
      "Never ask about symptoms or health details in a message, never give medical advice or guess what is wrong, " +
      "and never say whether a treatment is right for them. If they describe pain, an injury or anything urgent, " +
      "tell them to call the clinic now, or emergency services if it is an emergency, and ask nothing else.",
    firstAsk: "what they would like to come in for, and whether it is their first visit",
  },
  Legal: {
    who: "A LAWYER OR LAW FIRM",
    meeting: "a consultation",
    steps: [
      "what kind of matter it is, in a few words, and whether there is a date coming up, such as a hearing or a deadline",
      "whether they have spoken to another lawyer about it yet, and whether they would like to book a consultation",
      "the best way and time to reach them",
    ],
    never:
      "Never give legal advice, never say how a case is likely to go, never ask for the details of their case in a " +
      "message, and never quote a fee unless WHAT THIS BUSINESS HAS TOLD CUSTOMERS states it.",
    firstAsk: "what kind of matter it is, and whether there is a date coming up",
  },
  "Marketing agency": {
    who: "A MARKETING AGENCY",
    meeting: "a discovery call",
    steps: [
      "what kind of business they run, and what they want more of (calls, sales or bookings)",
      "when they would like to start, and whether a quick call to look at it together would help",
      "roughly what monthly budget they have in mind, and what they have tried so far",
    ],
    never:
      "Never promise results or numbers (more sales, double the leads), and never quote a price unless WHAT THIS " +
      "BUSINESS HAS TOLD CUSTOMERS states it.",
    firstAsk: "what kind of business they run, and what they want more of",
  },
};

/** Every business whose kind has no plan of its own: "Other", none chosen, or a kind added later. */
const GENERAL: Plan = {
  who: "A SMALL BUSINESS. What it offers is only what this conversation and WHAT THIS BUSINESS HAS TOLD CUSTOMERS say",
  meeting: "a quick call, or a visit if that is how this business works",
  steps: [
    "what they need, and when they need it",
    "one detail that matters for what they asked, and whether a quick call would help",
    "the best way and time to reach them",
  ],
  never: "Never guess what the business offers, and never give a price, a date or a promise it has not given you.",
  firstAsk: "what they are looking for, and when they need it",
};

const REALTOR_FIRST_ASK =
  "whether they are looking to buy, sell or rent, and roughly when; or, if they said they saw a listing, post or ad " +
  "without saying which, which one caught their eye and whether they would like to see it; or, if they asked about " +
  "one specific home, whether it is just this one that caught their eye or they are looking at a few in the area, " +
  "and roughly when they hope to move; or, if they asked what their own home is worth, they are selling, so " +
  // A-299 test (2026-10-19): "what's my condo worth?" got "are you looking to buy, sell, or rent?" and "I'll confirm it
  // shortly", a promised valuation.
  "never ask whether they buy or sell: say the agent will look at the home and recent sales nearby to give them a " +
  "real number (never a value, and never a promise to send one by message), then ask for the address and roughly " +
  "when they hope to sell";

function planPlaybook(p: Plan): string {
  return (
    `THIS BUSINESS IS ${p.who}. Use what a good person in this work knows, without breaking any rule above; those ` +
    `always win. Every conversation works toward ${p.meeting}. HOW TO MOVE IT FORWARD: once you have answered what ` +
    "they asked, end with one friendly question sentence that asks about two things together, joined with \"and\", " +
    "with a single question mark, taken from the first step below that still has something they have not told you " +
    "and you have not already asked in this conversation. Skip any part they already answered, and never ask the " +
    `same thing twice in other words. Step 1: ${p.steps[0]}. Step 2: ${p.steps[1]}. Step 3: ${p.steps[2]}. If they ` +
    `ask to meet, talk or book at any point, offer ${p.meeting} right away. Offer it as an open question and let ` +
    "them pick the time; never suggest a day or time yourself. These steps are the one exception to the rule about " +
    "not asking about details they have not raised, and only once it is clear what they are asking about; if it is " +
    "not, ask what they need instead. Once all three steps are done, ask nothing more unless they ask something. " +
    p.never
  );
}

/** The playbook for this kind of business. Every business gets one: a kind without its own plan gets the general plan. */
export function playbookFor(trade: string | null | undefined): string {
  const key = trade?.trim() ?? "";
  return PLAYBOOKS[key] ?? planPlaybook(PLANS[key] ?? GENERAL);
}

/** What the instant reply asks a new customer (src/lib/acknowledge.ts): the first step of their plan. */
export function firstAskFor(trade: string | null | undefined): string {
  const key = trade?.trim() ?? "";
  if (key === "Real estate") return REALTOR_FIRST_ASK;
  return (PLANS[key] ?? GENERAL).firstAsk;
}

/** The business's trade, or null. Never throws: a draft is never lost over it. */
export async function businessTrade(businessId: string): Promise<string | null> {
  try {
    const business = await prisma.business.findUnique({ where: { id: businessId }, select: { industry: true } });
    return business?.industry ?? null;
  } catch {
    return null;
  }
}
