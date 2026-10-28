/**
 * FollowUp reads the owner's own website and Instagram posts (A-328, founder 2026-10-26: "read their businesses …
 * reading their websites", "also read their social media", "ask them in onboarding too"). What it finds goes into the
 * "Tell FollowUp" meeting's draft (A-314) under the meeting's own question names, so the meeting asks only what's
 * missing, and nothing is quoted to a customer before the owner's "Looks right".
 *
 * Everything here is plain functions the page may use too; the fetching is in src/lib/siteReadData.ts.
 *
 *  - Only the owner's own public pages: the link they gave, and up to MAX_PAGES - 1 pages on the same site whose
 *    address says what a customer asks about (about, services, prices, contact, FAQ, areas, hours, booking).
 *  - Only the owner's own posts and bio on Instagram, never comments or messages.
 *  - Every value is copied from what was read, word for word, or dropped (correctionRows in tellFollowUp.ts), and a
 *    value that names someone (an @handle) or carries an email address is dropped: a post congratulating a customer
 *    is not a fact about the business.
 */

/** The most pages read from one site: the link given, and this many minus one on the same site. */
export const MAX_PAGES = 6;
/** The words kept from one page, and from the whole site. */
export const MAX_PAGE_CHARS = 4000;
export const MAX_SITE_CHARS = 12000;
/** The posts read from Instagram, newest first, and the words kept from them. */
export const MAX_POSTS = 30;
export const MAX_POST_CHARS = 6000;
/** The longest link FollowUp takes. */
const MAX_LINK = 200;

/** Where a line of the play-back came from (A-328): "From your website", "From your Instagram". */
export type ReadSource = "website" | "instagram";

/** What was read, kept with the meeting's draft for the play-back's "From … · See what it read". */
export type SiteNote = {
  /** The site as the owner gave it, or null when only Instagram was read. */
  url: string | null;
  /** The pages read, in order. */
  pages: string[];
  /** How many Instagram posts were read. */
  posts: number;
  /** Where each line FollowUp took came from, by the line's name (labelKey). A line the owner answers since is theirs. */
  from: Record<string, ReadSource>;
};

const squash = (t: string) => t.replace(/\s+/g, " ").trim();

/**
 * The owner's link as an address FollowUp can open, or null. Takes what people type: "mysite.ca", "www.mysite.ca/",
 * "https://mysite.ca/about". Only http and https, a real-looking host name (a dot, no spaces), no user name or password.
 */
export function normalizeWebsite(input: string): string | null {
  const raw = input.trim();
  if (!raw || raw.length > MAX_LINK || /\s/.test(raw)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (!host.includes(".") || host.startsWith(".") || host.endsWith(".")) return null;
  url.hash = "";
  return url.toString();
}

/** "yourwebsite.ca": the site as people say it, for the screens. */
export function siteName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…" };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]{1,8}|#\d{1,8}|[a-z]{1,16});/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : " ";
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

/** Tags whose insides a visitor never reads. */
const HIDDEN = ["script", "style", "noscript", "svg", "template", "iframe", "head"];

/**
 * The page without comments and HIDDEN blocks, in one pass: each opening is matched to its closing with indexOf, and
 * one left open drops the rest of the page. A regex with a lazy `[\s\S]*?` here goes quadratic on a page made of
 * thousands of unclosed tags, which anyone's website could be.
 */
function withoutHidden(html: string): string {
  const lower = html.toLowerCase();
  const opening = new RegExp(`<!--|<(${HIDDEN.join("|")})\\b`, "g");
  let out = "";
  let at = 0;
  for (;;) {
    opening.lastIndex = at;
    const m = opening.exec(lower);
    if (!m) return out + html.slice(at);
    out += html.slice(at, m.index) + " ";
    const close = m[0] === "<!--" ? "-->" : `</${m[1]}`;
    const end = lower.indexOf(close, m.index + m[0].length);
    if (end < 0) return out;
    // Past the closing tag's ">" (or the comment's "-->").
    const gt = m[0] === "<!--" ? end + 2 : lower.indexOf(">", end);
    if (gt < 0) return out;
    at = gt + 1;
  }
}

/** The page's <title>, raw (entities still encoded), at most 300 characters; "" when it has none. */
function pageTitle(html: string): string {
  const titleAt = html.search(/<title[^>]{0,200}>/i);
  const titleEnd = titleAt >= 0 ? html.toLowerCase().indexOf("</title>", titleAt) : -1;
  return titleAt >= 0 && titleEnd > titleAt ? html.slice(html.indexOf(">", titleAt) + 1, titleEnd).slice(0, 300) : "";
}

/**
 * A page's words, as a visitor reads them: its title and description, then the text, without scripts, styles, menus'
 * markup or hidden parts. Blocks end in a line break so the reading keeps sentences apart. At most MAX_PAGE_CHARS.
 * Every pattern is bounded, so a hostile page costs no more than a normal one.
 */
export function pageText(html: string): string {
  const title = pageTitle(html);
  const description =
    html.match(/<meta[^>]{0,500}name=["']description["'][^>]{0,500}content=["']([^"']{0,500})["']/i)?.[1] ??
    html.match(/<meta[^>]{0,500}content=["']([^"']{0,500})["'][^>]{0,500}name=["']description["']/i)?.[1] ??
    "";
  const body = withoutHidden(html)
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/section|\/article|\/tr|\/header|\/footer|\/ul|\/ol)\b[^>]{0,500}>/gi, "\n")
    .replace(/<[^<>]{1,2000}>/g, " ");
  const lines = decodeEntities([title, description, body].join("\n"))
    .split("\n")
    .map(squash)
    .filter((l) => l.length > 1);
  // The same line (a menu, a footer) repeated across a page says nothing new.
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const l of lines) {
    const k = l.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    kept.push(l);
  }
  return kept.join("\n").slice(0, MAX_PAGE_CHARS);
}

/** What a page's address says it is about, best first: the pages a customer's questions are answered on. */
const PAGE_WORDS = ["service", "price", "pricing", "rate", "fee", "about", "faq", "question", "contact", "area", "location", "hour", "book", "appointment", "what-we-do", "how-it-works", "team", "work-with"];

/**
 * Up to `max` more pages on the same site worth reading, from the links on the first page: same host (with or without
 * "www."), plain pages (no files, no mail or phone links), ordered by PAGE_WORDS. Never the page itself twice.
 */
export function pagesWorthReading(html: string, pageUrl: string, max = MAX_PAGES - 1): string[] {
  let base: URL;
  try {
    base = new URL(pageUrl);
  } catch {
    return [];
  }
  const host = base.hostname.replace(/^www\./i, "").toLowerCase();
  const found = new Map<string, number>();
  for (const m of html.matchAll(/<a\b[^>]{0,500}href=["']([^"'#]{1,500})["']/gi)) {
    let u: URL;
    try {
      u = new URL(decodeEntities(m[1]), base);
    } catch {
      continue;
    }
    if (u.protocol !== "https:" && u.protocol !== "http:") continue;
    if (u.hostname.replace(/^www\./i, "").toLowerCase() !== host) continue;
    if (/\.(pdf|jpe?g|png|gif|webp|svg|zip|mp4|mp3|docx?|xlsx?)$/i.test(u.pathname)) continue;
    u.hash = "";
    u.search = "";
    const key = u.toString();
    if (key === base.toString() || u.pathname === "/" || found.has(key)) continue;
    const path = u.pathname.toLowerCase();
    const rank = PAGE_WORDS.findIndex((w) => path.includes(w));
    if (rank >= 0) found.set(key, rank);
  }
  return [...found.entries()].sort((a, b) => a[1] - b[1]).slice(0, Math.max(0, max)).map(([u]) => u);
}

/** Title parts that name no business: "Home | Maple Realty" is Maple Realty's. */
const GENERIC_TITLE = /^(home|homepage|home page|welcome|welcome to .{0,80}|official (web)?site|website|index|main|start|landing|untitled)$/i;

/**
 * What the site calls itself (A-332): its og:site_name when it has one, else its title without the generic parts,
 * so the owner can be asked "This site calls itself X. Is that your business?". "" when the page says nothing usable.
 */
export function siteOwnName(html: string): string {
  const og =
    html.match(/<meta[^>]{0,500}property=["']og:site_name["'][^>]{0,500}content=["']([^"']{1,200})["']/i)?.[1] ??
    html.match(/<meta[^>]{0,500}content=["']([^"']{1,200})["'][^>]{0,500}property=["']og:site_name["']/i)?.[1] ??
    "";
  const ogName = squash(decodeEntities(og));
  if (ogName) return ogName.slice(0, 80);
  const parts = squash(decodeEntities(pageTitle(html)))
    .split(/\s*[|–—·•]\s*|\s+-\s+|\s*::\s*|:\s+/)
    .map(squash)
    .filter((p) => p && !GENERIC_TITLE.test(p));
  return parts.join(" – ").slice(0, 80);
}

/** Words that say nothing about which business this is: "The Maple Realty Group Inc" is "maple". */
const GENERIC_WORDS = new Set([
  "the", "and", "of", "for", "a", "an", "in", "at", "to", "by", "with", "inc", "ltd", "llc", "corp", "co", "company", "group",
  "team", "service", "services", "solutions", "realty", "real", "estate", "realtor", "realtors", "brokerage", "homes", "home",
  "properties", "property", "agency", "studio", "consulting", "consultants", "law", "legal", "dental", "clinic", "design",
  "designs", "web", "media", "marketing", "sales", "partners", "associates", "international", "local", "pro", "pros",
  "official", "site", "website", "online", "shop", "store",
]);

/** Lower-case, accents dropped, anything that isn't a letter or digit turned into a space. */
function plainWords(s: string): string[] {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);
}

/** The words of a business name that could tell it from another: 3 letters or more, not GENERIC_WORDS, with a letter in them. */
export function distinctiveWords(businessName: string): string[] {
  return plainWords(businessName).filter((w) => w.length >= 3 && /[a-z]/.test(w) && !GENERIC_WORDS.has(w));
}

/**
 * Whether the site plausibly belongs to this business (A-332; founder 2026-10-28: "what if someone pasted someone
 * else's website?"): a distinctive word of the business's name is on the first page, in what the site calls itself,
 * or in the address; or the name squeezed together ("maplerealty") is in the address or the words. A name with no
 * distinctive word ("Real Estate Group") can't be told apart, so it passes: the play-back's "Looks right" is still the
 * owner's check. Never a verdict on who owns a site, only whether to ask one question before reading on.
 */
export function siteLooksLike(businessName: string, ownName: string, text: string, url: string): boolean {
  const words = distinctiveWords(businessName);
  if (words.length === 0) return true;
  const host = siteName(url);
  const hostSqueezed = plainWords(host).join("");
  const haystack = new Set(plainWords(`${ownName} ${text}`));
  const haystackSqueezed = [...haystack].join(" ");
  const squeezed = plainWords(businessName).join("");
  if (squeezed.length >= 4 && (hostSqueezed.includes(squeezed) || haystackSqueezed.replace(/ /g, "").includes(squeezed))) return true;
  return words.some((w) => haystack.has(w) || (w.length >= 4 && hostSqueezed.includes(w)));
}

/** The one question before reading a site that doesn't look like the business's (A-332). */
export function ownerCheckLine(ownName: string, url: string): string {
  return ownName
    ? `This site calls itself "${ownName}". Is that your business?`
    : `FollowUp can't tell whose site ${siteName(url)} is. Is it yours?`;
}

/** The bio and the captions as one text to read, newest post first, at most MAX_POST_CHARS. */
export function postsText(bio: string | null, captions: readonly string[]): string {
  return [bio ?? "", ...captions.slice(0, MAX_POSTS)]
    .map((t) => t.trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_POST_CHARS);
}

/**
 * Whether a value FollowUp took may stand as a fact about the business: not a person's handle, not an email address
 * (A-328; a post thanking a customer is about them, not the business).
 */
export function businessValue(value: string): boolean {
  return !/@\w|[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(value);
}

/** Where a value was copied from: the website when its words are there, else Instagram. */
export function sourceOf(value: string, siteText: string): ReadSource {
  return squash(siteText).toLowerCase().includes(squash(value).toLowerCase()) ? "website" : "instagram";
}

/** "6 pages", "1 page". */
function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * The one plain line after reading (A-328): what was read and how many questions are left.
 * "Read 6 pages of yourwebsite.ca and your last 30 Instagram posts. They answered 6 of the 9 questions, so 3 are left.
 * You check all of it at the end."
 */
export function readLine(note: Pick<SiteNote, "url" | "pages" | "posts">, found: number, total: number, left: number): string {
  const what = whatWasRead(note);
  if (found === 0) return `Read ${what}. It didn't answer any of the questions, so they're all still to ask.`;
  const answered = `${found === 1 ? "It" : "They"} answered ${found} of the ${total} questions`;
  if (left === 0) return `Read ${what}. ${answered}, so there's nothing left to ask. You check all of it now.`;
  return `Read ${what}. ${answered}, so ${left === 1 ? "1 is" : `${left} are`} left. You check all of it at the end.`;
}

/** "6 pages of yourwebsite.ca and your last 30 Instagram posts". */
function whatWasRead(note: Pick<SiteNote, "url" | "pages" | "posts">): string {
  const parts: string[] = [];
  if (note.url && note.pages.length > 0) parts.push(`${count(note.pages.length, "page", "pages")} of ${siteName(note.url)}`);
  if (note.posts > 0) parts.push(`your last ${count(note.posts, "Instagram post", "Instagram posts")}`);
  return parts.join(" and ") || "what you shared";
}

/**
 * The line on setup's waiting screen once the site is read (A-328): what was read and what it saves the owner. The
 * meeting comes later, so no count of what's left.
 */
export function setupReadLine(note: Pick<SiteNote, "url" | "pages" | "posts">, found: number): string {
  const what = whatWasRead(note);
  if (found === 0) return `Read ${what}. It didn't answer FollowUp's questions, so it asks you later.`;
  return `Read ${what}. That's ${found === 1 ? "1 question" : `${found} questions`} FollowUp won't need to ask you. You check what it found before it's ever used.`;
}

/** "From yourwebsite.ca (6 pages), 30 Instagram posts and your 3 answers", for the top of the play-back. */
export function fromLine(note: Pick<SiteNote, "url" | "pages" | "posts">, answers: number): string {
  const parts: string[] = [];
  if (note.url && note.pages.length > 0) parts.push(`${siteName(note.url)} (${count(note.pages.length, "page", "pages")})`);
  if (note.posts > 0) parts.push(count(note.posts, "Instagram post", "Instagram posts"));
  if (answers > 0) parts.push(`your ${count(answers, "answer", "answers")}`);
  if (parts.length === 0) return "";
  const last = parts.pop();
  return `From ${parts.length ? `${parts.join(", ")} and ${last}` : last}`;
}

/** The note as stored, checked again: it comes back from the database as plain JSON. Null when there is none. */
export function readSiteNote(raw: unknown): SiteNote | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const url = typeof o.url === "string" ? normalizeWebsite(o.url) : null;
  const pages = (Array.isArray(o.pages) ? o.pages : []).filter((p): p is string => typeof p === "string" && p.length <= 500).slice(0, MAX_PAGES);
  const posts = typeof o.posts === "number" && Number.isFinite(o.posts) ? Math.max(0, Math.min(MAX_POSTS, Math.round(o.posts))) : 0;
  const from: Record<string, ReadSource> = {};
  if (o.from && typeof o.from === "object") {
    for (const [k, v] of Object.entries(o.from as Record<string, unknown>)) {
      if (k.length <= 60 && (v === "website" || v === "instagram")) from[k] = v;
    }
  }
  if (!url && posts === 0) return null;
  return { url, pages, posts, from };
}
