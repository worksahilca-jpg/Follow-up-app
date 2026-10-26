/**
 * "Did they just turn us down?", in their own plain words (step 5 of the self-improving plan, A-326; founder
 * 2026-10-24: "yes to both"). The AI reads every message too (src/lib/scoring.ts), but a missed no is a customer
 * followed up after they asked us not to, so the unmistakable ways people say it stop FollowUp even when the AI
 * misses them. This list is the safety net beside the AI, never the only reader.
 *
 * Not the opt-out record: a bare STOP is consent and lives in src/lib/optOutKeywords.ts. A match here stops the
 * follow-ups (Lead.saidNoAt) and tells the owner, who can tap "Keep following up".
 *
 * A phrase inside a longer message counts ("Thanks, but we're not interested anymore"). It doesn't count when a
 * negation, an "if" or a "you" sits just before it: "I don't have an agent", "if we're not interested we'll say",
 * "do you have an agent who speaks Punjabi?". Nor when the same message goes on to ask for something ("not interested
 * in condos, only detached", "we found a place we like, can you book a showing?") or moves to another channel ("text
 * please, you can stop emailing me"): that is a preference, not a no, and the AI readings decide (the 50 test
 * conversations, src/lib/noConversations.ts). Zero imports, like optOutKeywords.ts.
 */

export type DeclineKind = "no" | "agent" | "stop";

const PHRASES: { kind: DeclineKind; re: RegExp }[] = [
  // Asked to stop being contacted.
  { kind: "stop", re: /\bstop (?:messaging|texting|emailing|contacting|calling|sending|writing)\b/ },
  { kind: "stop", re: /\bremove me\b/ },
  { kind: "stop", re: /\btake me off\b/ },
  { kind: "stop", re: /\bunsubscribe me\b/ },
  { kind: "stop", re: /\b(?:don'?t|do not) (?:contact|message|text|email|call) me\b/ },
  { kind: "stop", re: /\bleave me alone\b/ },
  { kind: "stop", re: /\bno more (?:messages|texts|emails)\b/ },
  { kind: "stop", re: /\bne (?:me )?contactez plus\b/ },
  { kind: "stop", re: /\barr[eê]te[rz]? de m'?[ée]crire\b/ },
  // Turned the business down.
  { kind: "no", re: /\b(?:not|no longer) interested\b/ },
  { kind: "no", re: /\bnot looking any ?more\b/ },
  { kind: "no", re: /\bno longer looking\b/ },
  { kind: "no", re: /\b(?:already )?(?:found|bought|purchased) (?:a|our|my|the) (?:place|home|house|condo|property|apartment)\b/ },
  { kind: "no", re: /\bdecided (?:not to|to stay)\b/ },
  { kind: "no", re: /\b(?:pas|plus) int[ée]ress[ée]e?s?\b/ },
  // Already has an agent, or went with someone else.
  { kind: "agent", re: /\b(?:have|got) (?:an?|our|my) (?:agent|realtor|real estate agent|broker)\b/ },
  { kind: "agent", re: /\bwork(?:ing)? with (?:an?|another|our|my) (?:agent|realtor|real estate agent|broker)\b/ },
  { kind: "agent", re: /\bwent with (?:another|a different|someone else|somebody else)\b/ },
  { kind: "agent", re: /\bsigned with (?:another|an?|a different) (?:agent|realtor|brokerage|broker)\b/ },
  { kind: "agent", re: /\bhired (?:an?|another) (?:agent|realtor)\b/ },
  { kind: "agent", re: /\bd[ée]j[àa] un (?:agent|courtier)\b/ },
];

/** A word just before the phrase that turns it around. */
const GUARD = /\b(?:not|no|never|don'?t|do not|doesn'?t|haven'?t|without|if|unless|whether)\b[^.!?]{0,12}$/;
/** For "have an agent": also a question about the business's own agents ("do you have an agent who…"). */
const AGENT_GUARD = /\b(?:not|no|never|don'?t|do not|doesn'?t|haven'?t|without|if|unless|whether|you|u)\b[^.!?]{0,12}$/;

/**
 * After a "no" or "stop" phrase, words that show the customer still wants something: a narrower choice, a request, a
 * price limit. "Not interested in condos, only detached"; "take me off the condo alerts but keep the houses coming".
 */
const STILL_WANTS =
  /\b(?:only|instead|rather|prefer|but keep|keep (?:the|me|sending|them|it|those)|can you|could you|would you|can we|we want|i want|we'?d like|i'?d like|looking for|send me|book|showing|any ?thing (?:else|closer|cheaper|bigger|smaller)|(?:above|over|under|below) \$?\d|is fine|are fine|works for (?:me|us))\b/;
/** Anywhere else in the message: a move to another channel ("text please, you can stop emailing me"). */
const OTHER_CHANNEL = /\b(?:text|call|whatsapp|email|dm) (?:me|please|instead)\b|\bby (?:text|email|phone)\b/;

/** The first plain way of saying no in this message, or null. */
export function declineIn(body: string): { kind: DeclineKind; phrase: string } | null {
  const text = body.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ");
  for (const { kind, re } of PHRASES) {
    const m = re.exec(text);
    if (!m) continue;
    const before = text.slice(Math.max(0, m.index - 24), m.index);
    // The phrase itself may start with "not" or "don't"; only what comes before it can turn it around.
    if ((kind === "agent" ? AGENT_GUARD : GUARD).test(before)) continue;
    // A preference or a change of channel, not a no: the AI readings decide. An agent stays an agent.
    const after = text.slice(m.index + m[0].length);
    if (kind !== "agent" && (STILL_WANTS.test(after) || OTHER_CHANNEL.test(text.slice(0, m.index) + " " + after))) continue;
    return { kind, phrase: m[0] };
  }
  return null;
}

/** How a no was read (Lead.saidNoHow). */
export type NoHow = "clear" | "unsure" | "agent";

/**
 * Everything that read the customer's newest message, put together (A-326): any one that reads a stop stops the
 * follow-ups. Their own words, an agent, or a sure AI reading make it clear; most of the five readings agreeing makes
 * it clear too; only some of them is unsure, and Today says so.
 */
export function readNo(input: { phrase: DeclineKind | null; aiSure: boolean; hasAgent: boolean; tries: number; stops: number }): NoHow | null {
  if (input.hasAgent || input.phrase === "agent") return "agent";
  if (input.phrase || input.aiSure) return "clear";
  if (input.stops === 0) return null;
  return input.stops * 2 > input.tries ? "clear" : "unsure";
}
