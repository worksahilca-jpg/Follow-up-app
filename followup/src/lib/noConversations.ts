/**
 * Fifty made-up conversations for the "no" safety net (A-326), written 2026-10-26 to test what FollowUp does when a
 * customer might be saying no. No real customers. The label is what FollowUp should do, from what realtors do
 * (`reports/Realtor follow up conversations.md`; founder: "we need to know how that business owner or realtors react,
 * not me") and the founder's default for "not now" (A-329: stop, the owner decides). A realtor checks the hardest ones.
 *
 * The groups: clear no, has an agent, maybe a no ("not now"), not a no (the tricky ones: a preference, a change of
 * channel, a question about the business's own agents), texted STOP, and changed their mind (only the newest message
 * counts). Each ends with the customer's newest message, the one FollowUp reads.
 */

/** What FollowUp should do. "maybe": stop for now and the reply waits for the owner (A-326, A-329). */
export type NoExpect = "stop" | "agent" | "maybe" | "keep" | "optout";

export type NoConversation = {
  id: string;
  group: string;
  channel: string;
  /** Oldest first: "you" is the business, "them" the customer. */
  msgs: ["you" | "them", string][];
  expect: NoExpect;
  why: string;
};

export const NO_CONVERSATIONS: NoConversation[] = [
  { id: "a01", group: "Clear no", channel: "Text", msgs: [["you", "Hi Maya, the 3-bedroom on Elm St is still open. Want to see it Thursday?"], ["them", "Thanks, but we're not interested anymore."]], expect: "stop", why: "A plain no." },
  { id: "a02", group: "Clear no", channel: "Email", msgs: [["you", "Following up on the condos we talked about last week."], ["them", "Please stop emailing me."]], expect: "stop", why: "They asked you to stop." },
  { id: "a03", group: "Clear no", channel: "Instagram", msgs: [["you", "Hey! Still thinking about selling this spring?"], ["them", "we decided to stay put for a few more years 🙂 thanks though"]], expect: "stop", why: "They decided to stay. A polite no." },
  { id: "a04", group: "Clear no", channel: "Text", msgs: [["you", "Just checking in on your home search!"], ["them", "We bought a house last month, all good"]], expect: "stop", why: "They already bought." },
  { id: "a05", group: "Clear no", channel: "Text", msgs: [["you", "Hi Daniel, any thoughts on the listing I sent?"], ["them", "Lose my number."]], expect: "stop", why: "Rude, but a clear no." },
  { id: "a06", group: "Clear no", channel: "Email", msgs: [["you", "Bonjour Sophie, avez-vous eu le temps de regarder les maisons?"], ["them", "Merci, mais nous ne sommes plus intéressés."]], expect: "stop", why: "French: \"Thanks, but we're no longer interested.\"" },
  { id: "a07", group: "Clear no", channel: "Text", msgs: [["you", "Hi Harpreet, want to book a time to see homes in Brampton this weekend?"], ["them", "Nahi ji, sanu hun ghar nahi chahida. Thank you"]], expect: "stop", why: "Punjabi: \"No, we don't want a house anymore.\" FollowUp's word list doesn't know Punjabi, so this tests the AI reading. Is it a no, or only \"not now\"?" },
  { id: "a08", group: "Clear no", channel: "Text", msgs: [["you", "Hi Ahmed, just following up on the kitchen quote."], ["them", "We went ahead with another company, thanks for your time."]], expect: "stop", why: "They chose someone else. Same as a no." },
  { id: "a09", group: "Clear no", channel: "Text", msgs: [["you", "Would Saturday or Sunday work for a showing?"], ["them", "No thank you. Please remove me from your list."]], expect: "stop", why: "They asked to be removed." },
  { id: "a10", group: "Clear no", channel: "Email", msgs: [["you", "Hi Chloe, did you get a chance to look at the website proposal?"], ["them", "We've decided not to redo the website this year. Appreciate it."]], expect: "stop", why: "They decided not to go ahead." },
  { id: "a11", group: "Clear no", channel: "Text", msgs: [["you", "Following up on the house hunt, anything I can help with?"], ["them", "Not looking anymore. Thanks."]], expect: "stop", why: "They stopped looking." },
  { id: "b01", group: "Has an agent", channel: "Text", msgs: [["you", "Want me to send you new listings in Milton?"], ["them", "My cousin is our realtor, so we're covered."]], expect: "agent", why: "Family member is their agent. The word list won't catch this wording; the AI has to." },
  { id: "b02", group: "Has an agent", channel: "Instagram", msgs: [["you", "Hey Jordan, still house hunting?"], ["them", "yes but we signed with another agent last week"]], expect: "agent", why: "Signed with someone else." },
  { id: "b03", group: "Has an agent", channel: "Email", msgs: [["you", "I can help you price your home before you list."], ["them", "We already have a realtor, thank you."]], expect: "agent", why: "Already has a realtor." },
  { id: "b04", group: "Has an agent", channel: "Text", msgs: [["you", "Hi Wei, want to see the townhouse on Main?"], ["them", "Our agent is booking it for us, thanks!"]], expect: "agent", why: "Their own agent is handling it." },
  { id: "b05", group: "Has an agent", channel: "Text", msgs: [["you", "Checking in on your search."], ["them", "We're working with someone from another brokerage now"]], expect: "agent", why: "Working with another brokerage." },
  { id: "b06", group: "Has an agent", channel: "Email", msgs: [["you", "Toujours à la recherche d'une maison?"], ["them", "Oui, mais on a déjà un courtier."]], expect: "agent", why: "French: \"Yes, but we already have a broker.\"" },
  { id: "c01", group: "Maybe a no", channel: "Text", msgs: [["you", "Want to see a few homes this weekend?"], ["them", "Probably going to hold off for now."]], expect: "maybe", why: "Holding off. Could be a no, could be later." },
  { id: "c02", group: "Maybe a no", channel: "Text", msgs: [["you", "Hi Sofia, any update on selling?"], ["them", "Not right now. Maybe next spring."]], expect: "maybe", why: "Not now, maybe later." },
  { id: "c03", group: "Maybe a no", channel: "Text", msgs: [["you", "Hi Ravi, shall I set up a viewing?"], ["them", "My wife isn't keen on moving anymore."]], expect: "maybe", why: "One partner has cooled off." },
  { id: "c04", group: "Maybe a no", channel: "Email", msgs: [["you", "Following up on the renovation quote."], ["them", "We'll let you know if we decide to go ahead."]], expect: "maybe", why: "The ball is in their court." },
  { id: "c05", group: "Maybe a no", channel: "Text", msgs: [["you", "Still thinking about the 2-bed?"], ["them", "Honestly not sure we're buying at all this year"]], expect: "maybe", why: "Unsure about buying at all." },
  { id: "c06", group: "Maybe a no", channel: "Text", msgs: [["you", "Want me to send you listings?"], ["them", "Not at this time."]], expect: "maybe", why: "A polite brush-off." },
  { id: "c07", group: "Maybe a no", channel: "Text", msgs: [["you", "Hi Arjun, want to see homes this week?"], ["them", "Abhi nahi, thanks. Baad mein dekhenge."]], expect: "maybe", why: "Hindi: \"Not now, thanks. We'll see later.\"" },
  { id: "c08", group: "Maybe a no", channel: "Text", msgs: [["you", "Just following up!"], ["them", "We're taking a break from looking."]], expect: "maybe", why: "A break, not a clear no." },
  { id: "c09", group: "Maybe a no", channel: "Instagram", msgs: [["you", "Hey Grace, still want that market report?"], ["them", "nah I'm good"]], expect: "maybe", why: "A soft no to the report. Maybe to everything." },
  { id: "c10", group: "Maybe a no", channel: "Email", msgs: [["you", "Did the mortgage pre-approval go through?"], ["them", "Bank said no, so we're stuck for now."]], expect: "maybe", why: "Blocked by the bank, not saying no to you." },
  { id: "c11", group: "Maybe a no", channel: "Text", msgs: [["you", "Hi Leila, want to book a call about selling?"], ["them", "I'll reach out when I'm ready."]], expect: "maybe", why: "They'll come back on their own time." },
  { id: "d01", group: "Not a no", channel: "Text", msgs: [["you", "Here are 3 condos in your budget."], ["them", "Not interested in condos, only detached homes."]], expect: "keep", why: "A no to condos, not to you. Trick: \"not interested\" is on FollowUp's word list." },
  { id: "d02", group: "Not a no", channel: "Text", msgs: [["you", "Do you have an agent already?"], ["them", "No, I don't have an agent."]], expect: "keep", why: "They don't have an agent. Good news." },
  { id: "d03", group: "Not a no", channel: "Text", msgs: [["you", "Want to see homes in Mississauga?"], ["them", "We found a place we really like! Can you book a showing?"]], expect: "keep", why: "They want a showing. Trick: \"found a place\" is on the word list." },
  { id: "d04", group: "Not a no", channel: "Text", msgs: [["you", "Here are this week's new listings."], ["them", "Can you stop sending listings above 900k? Under that is fine"]], expect: "keep", why: "A price limit, not a stop. Trick: \"stop sending\" is on the word list." },
  { id: "d05", group: "Not a no", channel: "Email", msgs: [["you", "Should I keep sending the weekly listings?"], ["them", "Please take me off the condo alerts but keep the houses coming."]], expect: "keep", why: "Fewer emails, not none. Trick: \"take me off\" is on the word list." },
  { id: "d06", group: "Not a no", channel: "Text", msgs: [["you", "Hi Owen, this is Sam from Bright Homes."], ["them", "Do you have an agent who speaks Punjabi? My parents are buying."]], expect: "keep", why: "A question about your team. A new customer." },
  { id: "d07", group: "Not a no", channel: "Text", msgs: [["you", "When's a good time to call?"], ["them", "Not now, I'm at work. Call me after 6?"]], expect: "keep", why: "Asking for a later time." },
  { id: "d08", group: "Not a no", channel: "Text", msgs: [["you", "Just checking in!"], ["them", "No rush on my end, still saving for the down payment. Keep me posted on anything under 600k."]], expect: "keep", why: "They asked to be kept posted." },
  { id: "d09", group: "Not a no", channel: "Text", msgs: [["you", "Want to see the place on Oak St?"], ["them", "Not interested in renting, we want to buy."]], expect: "keep", why: "Wants to buy. Trick: \"not interested\" again." },
  { id: "d10", group: "Not a no", channel: "Text", msgs: [["you", "Any interest in the open house Sunday?"], ["them", "We'll pass on this one, too far from the school. Anything closer?"]], expect: "keep", why: "Passing on one house, asking for others." },
  { id: "d11", group: "Not a no", channel: "Instagram", msgs: [["you", "Still interested in the condo?"], ["them", "idk prices are crazy rn"]], expect: "keep", why: "A worry about price. A good reply answers it." },
  { id: "d12", group: "Not a no", channel: "Text", msgs: [["you", "Shall I set up a showing?"], ["them", "We already bought a house in 2019, now we want a rental property."]], expect: "keep", why: "A second purchase. Trick: \"bought a house\" is on the word list." },
  { id: "d13", group: "Not a no", channel: "Text", msgs: [["you", "Following up on the kitchen quote."], ["them", "Not interested in the granite, can you price quartz?"]], expect: "keep", why: "Wants a different option." },
  { id: "d14", group: "Not a no", channel: "Email", msgs: [["you", "Can I help with your search?"], ["them", "If we're not interested we'll tell you, don't worry! Send me what you have."]], expect: "keep", why: "They asked for listings." },
  { id: "d15", group: "Not a no", channel: "Text", msgs: [["you", "Do you prefer email or text?"], ["them", "Text please, you can stop emailing me"]], expect: "keep", why: "A change of channel. Trick: \"stop emailing\" is on the word list." },
  { id: "d16", group: "Not a no", channel: "Text", msgs: [["you", "Did you see the listing I sent?"], ["them", "Ugh sorry, crazy week. Still interested! Can we talk Friday?"]], expect: "keep", why: "Busy, but interested." },
  { id: "d17", group: "Not a no", channel: "Email", msgs: [["you", "Voulez-vous visiter la maison samedi?"], ["them", "Pas cette semaine, mais la semaine prochaine oui!"]], expect: "keep", why: "French: \"Not this week, but next week yes!\"" },
  { id: "d18", group: "Not a no", channel: "Text", msgs: [["you", "Do you have a lawyer for the closing?"], ["them", "No we don't have a lawyer or an agent yet, can you recommend one?"]], expect: "keep", why: "Asking for help." },
  { id: "e01", group: "Texted STOP", channel: "Text", msgs: [["you", "New listings this week in your area!"], ["them", "STOP"]], expect: "optout", why: "A text opt-out. By law, no more texts." },
  { id: "e02", group: "Texted STOP", channel: "Text", msgs: [["you", "Hi! Quick update on prices in Oakville."], ["them", "Unsubscribe"]], expect: "optout", why: "Same as STOP." },
  { id: "f01", group: "Changed their mind", channel: "Text", msgs: [["them", "Not interested right now."], ["you", "No problem! One note: rates dropped this week, in case it helps."], ["them", "Oh actually that changes things, can we talk?"]], expect: "keep", why: "Their newest message says yes. FollowUp reads the newest one fresh." },
  { id: "f02", group: "Changed their mind", channel: "Email", msgs: [["them", "We have an agent, thanks."], ["them", "Things didn't work out with our agent. Are you still available?"]], expect: "keep", why: "They came back. A new chance." },
];
