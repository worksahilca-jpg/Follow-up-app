/**
 * Which onboarding step to put someone back on.
 *
 * Every connect button in onboarding leaves the app entirely — Google's
 * consent screen, Meta's login — and the trip back is a fresh page load
 * with no client state at all. Something has to decide where they land.
 *
 * Deliberately derived rather than stored. A `Business.onboardingStep`
 * column would be a second copy of a fact the server can already work out,
 * and a second copy is a thing that can disagree with the first: a column
 * left at 3 by an abandoned session would show the sources step to someone
 * who had never seen the explainer.
 *
 * The rule: somebody is past the explainer if there is evidence they
 * already acted on the sources step. A connected source is evidence. A
 * dismissed one is evidence. And so is arriving back from a connect
 * attempt that *failed* — which is the case worth spelling out, because
 * getting it wrong is what makes a product feel broken: without it, a
 * refused Instagram connection drops the owner two steps back onto the
 * explainer, with the error rendered on a step that does not show errors.
 * The button would appear to have done nothing at all.
 */
export function shouldResumeAtSources(evidence: {
  /** Any lead source already connected. */
  anyConnected: boolean;
  /** Any setup step already marked "I don't use this". */
  anyDismissed: boolean;
  /** Landed here carrying a result from a provider's callback. */
  cameBackFromConnect: boolean;
}): boolean {
  return evidence.anyConnected || evidence.anyDismissed || evidence.cameBackFromConnect;
}

/**
 * The query keys a connect callback can come back with.
 *
 * Presence is what matters, not the value: `?instagram=connected` and
 * `?instagram=error` both mean "this owner pressed Connect and has come
 * back", which is the only question being asked here.
 */
export const CONNECT_RESULT_KEYS = ["gmail", "outlook", "instagram", "facebook"] as const;

export function cameBackFromConnect(params: Record<string, string | string[] | undefined>): boolean {
  return CONNECT_RESULT_KEYS.some((key) => params[key] !== undefined);
}
