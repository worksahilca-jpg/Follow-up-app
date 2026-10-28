import { prisma } from "@/lib/db";
import { GRAPH_API } from "@/lib/instagram";
import { getPageFromTenantUrl } from "@/lib/ssrf";
import { MAX_PAGES, MAX_POSTS, MAX_SITE_CHARS, pageText, pagesWorthReading, postsText, siteOwnName } from "@/lib/siteRead";

/**
 * Reading the owner's own website and Instagram (A-328; the rules are in src/lib/siteRead.ts). Every fetch of the
 * website goes through the SSRF guard (src/lib/ssrf.ts): public addresses only, checked again at connect time, at most
 * a few redirects, only HTML, never more than half a megabyte a page. Nothing here throws: a page or a post that can't
 * be read is left out, and the caller says so.
 */

/** How long the whole site may take to read: the owner is waiting on the screen. */
const SITE_BUDGET_MS = 25_000;

/** The pages read, their words, and what the first page says the site is called (A-332; "" when it doesn't say). */
export type SiteRead = { pages: string[]; text: string; name: string };

/** A page's address as kept and shown: without what follows "?" or "#", which can carry someone's private bits. */
function plainAddress(u: string): string {
  try {
    const url = new URL(u);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return u;
  }
}

/**
 * The owner's site: the page they gave, then up to MAX_PAGES - 1 pages on the same site a customer's questions are
 * answered on, read two at a time. Null when even the first page can't be read.
 */
export async function readWebsite(url: string): Promise<SiteRead | null> {
  const started = Date.now();
  let first;
  try {
    first = await getPageFromTenantUrl(url);
  } catch (err) {
    console.error("Could not read a business's website:", err instanceof Error ? err.message : err);
    return null;
  }
  const pages = [plainAddress(first.url)];
  const texts = [pageText(first.body)];
  const more = pagesWorthReading(first.body, first.url, MAX_PAGES - 1);
  for (let i = 0; i < more.length; i += 2) {
    if (Date.now() - started > SITE_BUDGET_MS) break;
    const got = await Promise.all(
      more.slice(i, i + 2).map((u) =>
        getPageFromTenantUrl(u, { timeoutMs: 6000 }).catch(() => null)
      )
    );
    for (const page of got) {
      if (!page) continue;
      pages.push(plainAddress(page.url));
      texts.push(pageText(page.body));
    }
  }
  const text = texts.filter(Boolean).join("\n\n").slice(0, MAX_SITE_CHARS);
  return text.trim() ? { pages, text, name: siteOwnName(first.body) } : null;
}

export type PostsRead = { posts: number; text: string };

async function graph(path: string, token: string): Promise<Record<string, unknown> | null> {
  try {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(`${GRAPH_API}/${path}${sep}access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      // Meta's status only, never the token or the body.
      console.error(`Instagram read ${path.split("?")[0]} failed: HTTP ${res.status}`);
      return null;
    }
    return (await res.json().catch(() => null)) as Record<string, unknown> | null;
  } catch (err) {
    console.error(`Instagram read ${path.split("?")[0]} failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * The business's own Instagram: its bio (when Meta gives it) and the captions of its newest MAX_POSTS posts, with the
 * token the owner connected. Never comments, never messages. Null when Instagram isn't connected or nothing came back.
 */
export async function readInstagramPosts(businessId: string): Promise<PostsRead | null> {
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { instagramUserId: true, instagramAccessToken: true } });
  // Connected means what the send path means (sendChannels.ts): an id and a token.
  const token = business?.instagramUserId ? business.instagramAccessToken : null;
  if (!token) return null;
  const [me, media] = await Promise.all([graph("me?fields=biography", token), graph(`me/media?fields=caption&limit=${MAX_POSTS}`, token)]);
  const bio = typeof me?.biography === "string" ? me.biography : null;
  const captions = (Array.isArray(media?.data) ? media.data : [])
    .map((m) => (m && typeof m === "object" && typeof (m as { caption?: unknown }).caption === "string" ? ((m as { caption: string }).caption) : ""))
    .filter(Boolean);
  const text = postsText(bio, captions);
  return text ? { posts: captions.length, text } : null;
}
