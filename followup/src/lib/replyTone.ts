/**
 * Sales pressure and self-praise in a draft that may go out with nobody
 * reading it (founder, 2026-10-14, A-247: "it should not sound like AI…
 * not a salesperson like a bot").
 *
 * The reply prompt already asks for none of this (TRUST_NOTICE in
 * src/lib/integrations/openai.ts). This is the check behind the request,
 * the same split as BANNED_CLOSER_RE and the grounding rules: a prompt is
 * a request, a check is a guarantee. Why each family is here, from
 * reports/Realtor replies that win trust.md:
 *
 *   - pressure: controlling and scarcity wording causes pushback, more in
 *     text than face to face, and reads as manipulation on a big decision.
 *     A deadline that is real ("offers on Tuesday") comes from the owner,
 *     so it is allowed once a person at the business has written it.
 *   - brag: self-promotion annoys more than the promoter expects, and in
 *     Ontario a ranking or award needs a verifiable basis (RECO Bulletin
 *     5.1). Allowed when the owner has written it, in the thread or in
 *     what FollowUp knows about the business.
 *
 * English only, like BANNED_CLOSER_RE in src/lib/dmDrafts.ts: the prompt's
 * ban covers every language, this catches what slips through in English,
 * which is most of FollowUp's realtors today. It matches phrases, never
 * single words, so "no hurry" or "I'll hurry up and check" is not the
 * same as "hurry" said at them, and "I'm not a tax expert" is not "I'm the
 * Junction expert". Each phrase is narrow on purpose: a false hold
 * costs the owner a tap, a missed one costs the customer's trust.
 */

export type ToneRule = "pressure" | "brag";

const A = "['’]"; // straight or curly apostrophe

const PRESSURE: readonly RegExp[] = [
  new RegExp(`\\b(won${A}?t|will not|wouldn${A}?t) last\\b`, "i"),
  /\b(going|selling|moving) (really )?(fast|quickly)\b/i,
  /\bact (fast|now|quickly|soon)\b/i,
  /(?<!\bno |\bin no |\bnot in a )\bhurry\b(?! up and (check|find|ask|confirm))/i,
  /\bmiss(ing)? out\b/i,
  new RegExp(`\\b(don${A}?t|do not) miss (this|it|your chance)\\b`, "i"),
  /\blimited[- ]time\b/i,
  /\b(last|final) chance\b/i,
  /\bonly (a few|a couple|\d+) (left|remaining)\b/i,
  /\b(lots|tons|loads|a lot) of interest\b/i,
  /\b(so much|huge|high|crazy) (interest|demand)\b/i,
  new RegExp(`\\bbefore it${A}?s (gone|too late)\\b`, "i"),
  new RegExp(`\\bif (you${A}?re|you are) (really |actually |truly )?serious\\b`, "i"),
  /\b(have you given|did you give) up\b/i,
  /\byou (need|have|must|('ve )?got) to (act|move|decide|hurry|jump|commit)\b/i,
  /\btop dollar\b/i,
  new RegExp(`\\b(you${A}?ll|you will) (definitely |surely |for sure )?win\\b`, "i"),
  /\bguarantee(d|s)? (you|to sell|results|a sale|the sale)\b/i,
];

const BRAG: readonly RegExp[] = [
  /\btop[- ](agent|producer|producing|realtor|selling|seller|performer|performing|rated|ranked)\b/i,
  /\btop[- ]\d+(\.\d+)?\s?%/i,
  /(#\s?1|\bnumber one|\bno\.\s?1)\s+(agent|realtor|broker|team|expert|in)\b/i,
  /\baward[- ]winning\b/i,
  /\bbest (agent|realtor|broker|team)s? (in|for|around|on)\b/i,
  /\bthe best in (town|the city|the area|the gta|toronto|the region)\b/i,
  /\b(leading|premier|elite) (agent|realtor|broker|team)\b/i,
  new RegExp(`\\b(i${A}?m|i am|we${A}?re|we are) (the|a|an|your)( [\\w-]+){0,2} (expert|specialist|guru)\\b`, "i"),
];

const flat = (s: string) => s.toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ");

function firstUnsaid(text: string, patterns: readonly RegExp[], said: string): boolean {
  const grounding = flat(said);
  for (const re of patterns) {
    const hit = text.match(re);
    if (hit && !grounding.includes(flat(hit[0]))) return true;
  }
  return false;
}

/**
 * The rule a draft breaks, or null. `said` is what a person at the
 * business wrote in this thread (businessText in src/lib/grounding.ts):
 * it grounds both families. `facts` is what the owner has told FollowUp
 * (src/lib/businessFacts.ts) or typed as a step's note: it grounds a
 * ranking the owner stated, never pressure, because the ready plans' own
 * notes describe what NOT to say and must not make it look grounded.
 */
export function salesPressure(text: string, { said = "", facts = "" }: { said?: string; facts?: string } = {}): ToneRule | null {
  if (firstUnsaid(text, PRESSURE, said)) return "pressure";
  if (firstUnsaid(text, BRAG, `${said}\n${facts}`)) return "brag";
  return null;
}
