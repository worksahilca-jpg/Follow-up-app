/**
 * Where a connect flow puts you back down.
 *
 * Every "Connect X" button leaves the app entirely — Google's consent
 * screen, Meta's login — and the callback has to decide where the owner
 * lands on the way back. Until now only Gmail and Outlook could answer
 * "wherever you started": they carry a `next` cookie set by their connect
 * route (the cookie, rather than OAuth `state`, because `state` is a CSRF
 * token that must stay unforgeable — see the gmail connect route).
 *
 * Instagram, Facebook and WhatsApp hardcoded `/settings`. That was fine
 * while onboarding offered Gmail and nothing else. It stops being fine the
 * moment onboarding asks "where do your leads come from?": an owner who
 * runs on Instagram DMs would press Connect, authorise Meta, and be
 * dropped into Settings — out of the flow, mid-setup, with no way back to
 * the step they were on and no sign anything had gone right.
 *
 * One helper so all five agree, rather than the same three lines copied
 * into each callback and drifting.
 */

/** The cookie a connect route sets to remember where the owner started. */
export function oauthNextCookie(provider: string): string {
  return `${provider}_oauth_next`;
}

export const OAUTH_COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  maxAge: 600,
  path: "/",
} as const;

/**
 * The page to return to after a connect attempt, successful or not.
 *
 * `next === "onboarding"` is the only value that means anything; anything
 * else — absent, stale, or a value someone put there by hand — falls back
 * to Settings. A cookie is attacker-settable in principle, so this is an
 * allow-list of two known pages rather than a redirect to whatever it says,
 * which is the difference between a resume and an open redirect.
 *
 * `settingsHash` names the Settings section to scroll to, which matters
 * because those sections live inside tabs — without it the anchor lands on
 * a hidden panel. Onboarding has no tabs and takes no hash.
 */
export function oauthReturnUrl(next: string | undefined, settingsHash: string, base: string | URL): URL {
  if (next === "onboarding") return new URL("/onboarding", base);
  const url = new URL("/settings", base);
  url.hash = settingsHash;
  return url;
}
