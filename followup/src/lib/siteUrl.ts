/**
 * The public address of FollowUp — the one a search engine should index and
 * the one every canonical URL points at.
 *
 * This is deliberately NOT `NEXTAUTH_URL`. That variable answers a different
 * question — "where does the OAuth callback come back to" — and it is
 * legitimately a different value on a preview deployment. Three files used
 * it as the public site URL anyway (the root metadata, robots.txt and
 * sitemap.xml), each falling back to `follow-up-app-two.vercel.app` when it
 * was unset.
 *
 * That fallback is the bug. A sitemap served from the real domain but
 * listing vercel.app URLs invites Google to index the deployment host as a
 * second copy of the site, and when a search engine has two copies it picks
 * which pages to show from either — which is one plausible reason the
 * founder found the privacy policy surfacing for a search for the product
 * on 2026-09-21.
 *
 * `NEXT_PUBLIC_SITE_URL` overrides it where a deployment genuinely serves a
 * different public address. Otherwise this is the answer, and it does not
 * depend on an auth variable being set correctly.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.followupbase.io").replace(/\/$/, "");
