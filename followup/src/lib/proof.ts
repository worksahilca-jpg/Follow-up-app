/**
 * Proof on the landing page (design brain A-050, the Close study, and the
 * founder's reference strategy): a tester's own before and after, in their
 * own numbers and words. Never invented (A-023): the section renders only
 * when a story is complete AND the tester has said yes to it in writing.
 *
 * Add a story here only with the tester's written OK, and record when they
 * gave it. The reply times come from their own FollowUp records.
 */
export type ProofStory = {
  firstName: string;
  business: string; // "Business, city"
  before: string; // how long a customer waited before, e.g. "2 days"
  after: string; // with FollowUp, e.g. "9 min"
  quote: string; // their words, unedited
  consentedOn: string; // ISO date they agreed, in writing
};

export const PROOF_STORIES: ProofStory[] = [];

/** The stories that may be shown: every field filled in, and a consent date. */
export function realProof(stories: ProofStory[] = PROOF_STORIES): ProofStory[] {
  return stories.filter(
    (s) =>
      [s.firstName, s.business, s.before, s.after, s.quote].every((v) => typeof v === "string" && v.trim().length > 0) &&
      !Number.isNaN(Date.parse(s.consentedOn))
  );
}
