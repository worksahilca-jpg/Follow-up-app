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

/**
 * The base for every address FollowUp gives ANOTHER SERVICE to call it on
 * — a Meta webhook, a Zapier lead webhook, a Twilio callback, Gmail's
 * Pub/Sub push.
 *
 * Not appUrl() (NEXTAUTH_URL), because in production that is the apex,
 * https://followupbase.io, and Vercel redirects the apex to www. A browser
 * follows that redirect happily, which is why OAuth redirect URIs can stay
 * on the apex. A server posting a webhook often does not: on 2026-09-25
 * Meta's POSTs to the apex arrived at www as GETs and were refused, so not
 * one WhatsApp or Instagram webhook had been processed since Sep 19.
 * Stripe and Pub/Sub push do not follow redirects at all.
 *
 * So: when the app's own address is exactly the apex of the public site,
 * hand out the public site. Anywhere else (localhost, a preview
 * deployment) the app's own address is the only one that reaches it.
 */
export function inboundBaseUrl(): string {
  const app = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.followupbase.io").replace(/\/$/, "");
  try {
    const a = new URL(app);
    const s = new URL(site);
    if (a.protocol === s.protocol && s.hostname === `www.${a.hostname}`) return site;
  } catch {
    // An unparseable NEXTAUTH_URL is appUrl()'s problem too; answer as it would.
  }
  return app;
}
