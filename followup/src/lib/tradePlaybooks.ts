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
    "other. Use the plain words agents use (listing, showing, offer, closing), and never sales pressure. ",
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
