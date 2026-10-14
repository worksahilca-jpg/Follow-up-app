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
 * Real estate first and only, on purpose: the testers and the Gmail
 * research are realtors, and one trade done right beats six done thinly.
 * Every other trade gets no playbook, which is exactly what every reply
 * had before this file.
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
    "when it is listed, otherwise follow the price rule above. Offer a showing only once they have named a " +
    "specific home or listing. While they are still describing what they want (an area, a type or size of home), " +
    "ask about what they are looking for instead, the way an agent learns what to send them. " +
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

/** The playbook for this trade, or "" when there is none. */
export function playbookFor(trade: string | null | undefined): string {
  return trade ? PLAYBOOKS[trade.trim()] ?? "" : "";
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
