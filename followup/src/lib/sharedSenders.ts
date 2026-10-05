/**
 * Addresses that are not one person.
 *
 * Kept free of imports on purpose: senderVerdicts.ts, gmail.ts and
 * outlook.ts all read it, and none of them should have to pull the others
 * in to do so.
 */

/**
 * Machine senders: bounces, no-reply mailers, platform notifications. The
 * mail syncs never take one of these as a thread's customer (gmail.ts,
 * outlook.ts).
 */
const AUTOMATED_SENDER_PATTERNS = [/no-?reply/i, /do-?not-?reply/i, /notifications?@/i, /mailer-daemon/i, /postmaster@/i];

export function isAutomatedAddress(email: string): boolean {
  return AUTOMATED_SENDER_PATTERNS.some((p) => p.test(email));
}

/**
 * The mailbox names a website form's notifier sends from, on the business's
 * own domain or a form service's ("wordpress@", "form-submission@",
 * "website@"). Whole-name matches only: "formica@" or "jo.website@" are
 * people.
 */
const FORM_LOCAL_PARTS = [
  /^(?:web[-_.]?)?forms?(?:[-_.]?(?:submissions?|notifications?|mailer))?$/,
  /^(?:contact|lead|quote|booking|enquiry|inquiry)[-_.]?forms?$/,
  /^(?:form[-_.]?)?submissions?$/,
  /^(?:wordpress|website|webmaster|mailer|notify)$/,
];

/**
 * Lead marketplaces: sites that pass a customer's request on to the
 * business, usually from a no-reply address (backlog b007). Also relays,
 * below.
 */
const LEAD_MARKETPLACE_DOMAINS = [
  "zillow.com",
  "trulia.com",
  "realtor.com",
  "thumbtack.com",
  "angi.com",
  "angieslist.com",
  "homeadvisor.com",
  "houzz.com",
  "yelp.com",
  "bark.com",
  "porch.com",
  "networx.com",
  // Canada (founder, 2026-09-30: most FollowUp businesses are Canadian)
  "homestars.com",
  "kijiji.ca",
  "realtor.ca",
];

/**
 * Lead sites and form services that send many people's enquiries from one
 * address, or from a small pool of them. Matched with their subdomains
 * ("mail.thumbtack.com"). Not exhaustive: a relay missing from here is
 * treated as a person, which is how every sender was treated before.
 */
const RELAY_DOMAINS = [
  ...LEAD_MARKETPLACE_DOMAINS,
  "craigslist.org",
  "facebookmail.com",
  // Form services
  "squarespace.info",
  "wix.com",
  "wixforms.com",
  "jotform.com",
  "typeform.com",
  "typeformmail.com",
  "formspree.io",
  "wufoo.com",
  "cognitoforms.com",
  "123formbuilder.com",
  "formstack.com",
];

/**
 * True for an address that speaks for many people rather than one: a
 * no-reply or notification mailer, a website form's notifier, or a lead
 * site relaying enquiries. Anything learned about one message from such an
 * address says nothing about the next one (backlog b002), so it must never
 * become a rule about the address.
 */
export function isSharedSender(email: string): boolean {
  const address = email.trim().toLowerCase();
  if (isAutomatedAddress(address)) return true;
  const at = address.lastIndexOf("@");
  if (at <= 0) return false;
  const local = address.slice(0, at);
  const domain = address.slice(at + 1);
  if (FORM_LOCAL_PARTS.some((p) => p.test(local))) return true;
  return onDomain(domain, RELAY_DOMAINS);
}

function onDomain(domain: string, list: string[]): boolean {
  return list.some((d) => domain === d || domain.endsWith(`.${d}`));
}

/**
 * Gmail search terms for mail from any lead marketplace. Gmail's `from:`
 * with a bare domain also matches its subdomains (mail.thumbtack.com).
 */
export function leadMarketplaceFromQuery(): string {
  return `from:(${LEAD_MARKETPLACE_DOMAINS.join(" OR ")})`;
}

/** True for an address on a lead marketplace's domain or a subdomain of it. */
export function isLeadMarketplaceAddress(email: string): boolean {
  const address = email.trim().toLowerCase();
  const at = address.lastIndexOf("@");
  return at > 0 && onDomain(address.slice(at + 1), LEAD_MARKETPLACE_DOMAINS);
}

/**
 * The marketplace's own mail: billing, reports, promotions, account and
 * review notices. Checked before the lead signals and wins over them, so
 * "Your receipt for a new lead" stays out.
 */
// Words a lead card itself uses ("Budget: $500", "for sale", "Log in to
// reply", "5 credits to respond") are left out on purpose.
const MARKETPLACE_HOUSEKEEPING = new RegExp(
  [
    // money the business owes or paid
    "receipts?", "invoices?", "billing", "bills?", "payments?", "charged", "refunds?", "statements?", "card ending",
    // reports about the business's own profile
    "profile (?:views?|visits)", "\\d+ (?:people )?(?:views?|visits|searches)", "impressions", "performance",
    "insights", "stats", "(?:weekly|monthly) (?:summary|report|recap)", "digest", "ranking",
    // the marketplace's marketing
    "tips", "newsletter", "webinar", "promo(?:tion)?s?", "discount", "\\d+% off", "save \\$?\\d+", "upgrade",
    "free trial", "special offer", "limited time",
    // account and review notices
    "password", "verify", "verification", "reviews?", "rated you", "survey",
    // the owner's OWN request, made as a buyer on the platform (founder's
    // inbox, 2026-10-04: Bark's "Do this to boost your request, Sahil" and
    // "Here's what to expect next" became customers). The person in these
    // is the owner, not someone who wants to buy from them.
    "boost your request", "your request (?:has been|was|is) (?:sent|received|posted|live|submitted)",
    "what to expect next", "responses? to your request",
    "(?:professionals?|pros|providers|businesses) (?:will|may|are going to|can now) (?:contact|reach out to|respond to|message) you",
    "you(?:'ve| have) been matched with (?:\\d+ )?(?:professionals?|pros|providers|businesses)",
  ]
    .map((w) => `\\b${w}\\b`)
    .join("|"),
  "i"
);

/**
 * One person's request, as marketplaces word it: "You have a new lead",
 * "New quote request", "Jane D. wants a quote", "Jane sent you a message",
 * "Jane is interested in 14 Birch Lane", "Jane is looking for a
 * bookkeeper". Plural "customers are looking for pros like you" is a
 * promotion, and is deliberately not here.
 */
const MARKETPLACE_LEAD_SIGNALS = [
  /\bnew (?:lead|request|job|project|quote|estimate|inquiry|enquiry|opportunity|message|contact|customer|booking)\b/i,
  /\b(?:quote|estimate|job|project|service|booking|price|pricing) requests?\b/i,
  /\brequest(?:ed|s)? (?:a |an |your )?(?:quote|estimate|consultation|price|pricing|showing|tour|information|info|callback)\b/i,
  /\bwants? (?:a |an |your )?(?:quote|estimate|price|pricing|consultation|to hire|to hear from you|to connect|to talk|to book|to see|to tour)\b/i,
  /\b(?:sent|messaged|contacted) you\b/i,
  /\bis (?:interested in|looking for)\b/i,
  /\bmatched (?:you )?with (?:a |an )?(?:customer|homeowner|client|buyer)\b/i,
  // Kijiji: "New message about your ad", "Someone replied to your ad"
  /\b(?:about|replied to|reply to|responded to) your (?:ad|listing|post)\b/i,
  // REALTOR.ca: "Inquiry about 88 Queen St E"
  /\b(?:inquiry|enquiry) (?:about|for|regarding|on)\b/i,
];

function hasLeadSignal(text: string): boolean {
  return MARKETPLACE_LEAD_SIGNALS.some((p) => p.test(text));
}

/**
 * How much of the body is read when the subject says nothing either way.
 * The opening is where a notification says what it is; the footer of every
 * marketplace email ("manage notifications", "unsubscribe") is not.
 */
const BODY_OPENING = 800;

/**
 * True for a lead marketplace passing on one person's request (backlog
 * b007): from a marketplace's domain, and reading like "new lead", "quote
 * request" or "a customer messaged you". Deterministic and deliberately
 * narrow. It only lets the email reach the classifier, which still
 * decides; everything else from these domains, and every other no-reply
 * sender, is skipped exactly as before.
 *
 * The subject decides when it says anything: housekeeping words first,
 * then lead words. With neither, the body's opening is read the same way.
 */
export function isMarketplaceLeadNotice(message: { from: { email: string }; subject?: string | null; body?: string | null }): boolean {
  if (!isLeadMarketplaceAddress(message.from.email)) return false;
  const subject = message.subject ?? "";
  if (MARKETPLACE_HOUSEKEEPING.test(subject)) return false;
  if (hasLeadSignal(subject)) return true;
  const opening = (message.body ?? "").slice(0, BODY_OPENING);
  return hasLeadSignal(opening) && !MARKETPLACE_HOUSEKEEPING.test(opening);
}

/**
 * The customer's name from a structured notification body: a line
 * "Name: Jane Doe" (or "Customer name:", "Contact:" …), and only when the
 * body also carries a "Phone:" or "Email:" line, the shape of a lead card
 * rather than prose that happens to contain "name:". Line by line only: a
 * value with another "Label:" in it (HTML flattened onto one line) is
 * refused rather than guessed at. Null when anything is unclear.
 *
 * Only the name is taken. The phone and email stay in the message: a
 * marketplace's contact details are often a relay or a masked number, and
 * putting them on the lead would change where replies go.
 */
export function contactNameFromBody(body: string | null | undefined): string | null {
  const text = (body ?? "").slice(0, 5000);
  const hasContact =
    /^[ \t]*(?:phone|phone number|tel|telephone|mobile|cell)[ \t]*:[ \t]*\+?[\d(][\d\s().+-]{6,}$/im.test(text) ||
    /^[ \t]*e-?mail(?: address)?[ \t]*:[ \t]*\S+@\S+\.\S+[ \t]*$/im.test(text);
  if (!hasContact) return null;
  const match = text.match(/^[ \t]*(?:customer|client|contact|full|lead|buyer|homeowner)?[ \t]*name[ \t]*:[ \t]*(.+?)[ \t]*$/im);
  const name = match?.[1]?.trim() ?? "";
  if (!name || name.length > 60 || name.includes(":") || name.includes("@") || /\d/.test(name) || /https?:|www\./i.test(name)) {
    return null;
  }
  if (!/\p{L}/u.test(name) || name.split(/\s+/).length > 5) return null;
  return name;
}

type Party = { name: string; email: string };

/**
 * The name a person signed their message with, or null (backlog b033,
 * founder 2026-10-01: "do it").
 *
 * A lead is named from the sender's account name. When a couple shares
 * one address, or someone writes from a partner's account, that name is
 * the wrong person's: the card shows it and the reply greets them by it.
 * Found on the founder's own demo, where "Priya" wrote from his inbox and
 * became a lead called "Sahil".
 *
 * Read from what the person wrote, before any quoted history or phone
 * footer: the last lines, where a closing ("Thanks," "Best regards,"
 * "Cheers") is followed by a name, on the same line or the next. Only a
 * name-shaped thing counts — one to three capitalised words, letters
 * only, no digits, no "@", not a placeholder — and anything unclear is
 * null, so the account name stays. A closing with no name after it
 * ("Thanks!") says nothing.
 */
const CLOSINGS =
  /^(?:thanks?(?: you)?(?: so much| a lot| again| in advance)?|many thanks|thx|ty|cheers|best|all the best|best regards|kind regards|warm regards|warmest regards|regards|rgds|sincerely|yours(?: truly| sincerely| faithfully)?|talk soon|take care|much appreciated|appreciate it|with thanks|gracias|merci)[\s!.,-]*$/i;

export function signOffName(body: string | null | undefined): string | null {
  const text = (body ?? "").slice(0, 8000).replace(/\r\n/g, "\n");
  // Same cuts as pastReplies.cleanReplyBody, kept inline: this module has no
  // server imports and that one pulls in Prisma.
  const markers = [/^On .{0,200}wrote:\s*$/im, /On [^\n]{0,200}? wrote:/i, /^>/m, /^-{2,}\s*Original Message\s*-{2,}/im, /^_{8,}\s*$/m, /^From:\s.+\n(?:.*\n){0,3}?(?:Sent|Date):\s/im, /^--\s*$/m, /^Sent from my /im, /^Get Outlook for /im];
  let cut = text.length;
  for (const re of markers) {
    const m = re.exec(text);
    if (m && m.index < cut) cut = m.index;
  }
  const lines = text
    .slice(0, cut)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  // The closing and the name are within the last few lines; a signature
  // block (title, phone, address) can follow the name, so look back up to
  // five lines from the end.
  const tail = lines.slice(-6);
  for (let i = tail.length - 1; i >= 0; i--) {
    const line = tail[i];
    // "Thanks, Priya" / "Regards - Priya Sharma" on one line. The separator
    // has to be punctuation: "Thanks Sahil" with only a space is the
    // customer thanking the OWNER by name, and taking it would rename the
    // lead after the person they wrote to.
    const oneLine = line.match(/^(.{2,30}?)\s*[,:;\-–—]\s*([^,]{2,40})$/);
    if (oneLine && CLOSINGS.test(oneLine[1] + ",")) {
      const name = asPersonName(oneLine[2]);
      if (name) return name;
    }
    // "Thanks," on its own line, the name on the next.
    if (CLOSINGS.test(line) && i + 1 < tail.length) {
      const name = asPersonName(tail[i + 1]);
      if (name) return name;
    }
  }
  return null;
}

/** "Priya", "Priya Sharma", "Jean-Luc Picard" — or null for anything that isn't plainly a person's name. */
function asPersonName(raw: string): string | null {
  const name = raw.replace(/[.,!]+$/, "").trim();
  if (name.length < 2 || name.length > 40) return null;
  if (/[\d@:/]/.test(name) || /https?|www\./i.test(name)) return null;
  const words = name.split(/\s+/);
  if (words.length > 3) return null;
  if (!words.every((w) => /^\p{Lu}[\p{L}'’.-]*$/u.test(w))) return null;
  if (CLOSINGS.test(name) || /^(?:sent|me|team|the team|admin|support|sales|info|office|everyone|all)$/i.test(name)) return null;
  return name;
}

/**
 * The name to give a lead from this message: the one they signed with
 * when it is clear and the account's name doesn't already carry it
 * ("Priya Sharma" signing "Priya" keeps the fuller account name), else
 * the account's name as before.
 */
export function customerDisplayName(accountName: string, body: string | null | undefined): string {
  const signed = signOffName(body);
  if (!signed) return accountName;
  const first = signed.split(/\s+/)[0].toLowerCase();
  if (accountName.toLowerCase().split(/[\s.<>"'()-]+/).includes(first)) return accountName;
  return signed;
}

/**
 * Who a mail thread is with, and whether that address can be matched to a
 * lead (backlog b011).
 *
 * Leads are matched by email. A website form's notifier ("website@",
 * "wordpress@", "form-submission@squarespace.info") sends every visitor's
 * enquiry from the same address, so matching on it merged different people
 * into one lead. Such notifiers usually set Reply-To to the visitor, so
 * that address is the customer when it is a person's. When there is no
 * such Reply-To the thread's party is `shared`: the caller must give the
 * thread a lead of its own and never match the address to an existing one.
 *
 * The first message not from `isNotCustomer` (the business itself, machine
 * senders) decides, as it always has. A normal sender is returned exactly
 * as before.
 *
 * One exception to "machine senders never count" (backlog b007): a lead
 * marketplace's no-reply notice passing on one person's request
 * (isMarketplaceLeadNotice) counts, so it reaches the classifier instead of
 * being skipped. The business's own addresses are never on a marketplace's
 * domain, so this can only ever let a marketplace notice through. Such a
 * thread is `shared` unless its Reply-To is a person, like any relay; its
 * lead is named from a "Name:" line in the notice when there is a clear
 * one (contactNameFromBody), else after the sender, as before.
 */
export function threadCustomer(
  messages: { from: Party; replyTo?: Party | null; subject?: string | null; body?: string | null }[],
  isNotCustomer: (email: string) => boolean
): (Party & { shared: boolean; site?: { name: string; url: string | null } }) | null {
  const first = messages.find((m) => m.from.email && (!isNotCustomer(m.from.email) || isMarketplaceLeadNotice(m)));
  if (!first) return null;
  if (!isSharedSender(first.from.email)) return { ...first.from, name: customerDisplayName(first.from.name, first.body), shared: false };
  const replyTo = first.replyTo;
  if (replyTo?.email && !isNotCustomer(replyTo.email) && !isSharedSender(replyTo.email)) {
    return { ...replyTo, name: customerDisplayName(replyTo.name, first.body), shared: false };
  }
  const site = leadSiteOf(first.from.email);
  const named = site ? contactNameFromBody(first.body) : null;
  return {
    ...first.from,
    name: named ?? first.from.name,
    shared: true,
    ...(site ? { site: { name: site.name, url: leadSiteLink(first.body, site.domain) } } : {}),
  };
}

/** How each lead site is named to the owner ("Reply on Thumbtack"). */
const LEAD_SITE_NAMES: Record<string, string> = {
  "zillow.com": "Zillow",
  "trulia.com": "Trulia",
  "realtor.com": "Realtor.com",
  "thumbtack.com": "Thumbtack",
  "angi.com": "Angi",
  "angieslist.com": "Angi",
  "homeadvisor.com": "HomeAdvisor",
  "houzz.com": "Houzz",
  "yelp.com": "Yelp",
  "bark.com": "Bark",
  "porch.com": "Porch",
  "networx.com": "Networx",
  "homestars.com": "HomeStars",
  "kijiji.ca": "Kijiji",
  "realtor.ca": "REALTOR.ca",
};

/** The site's own address, for "Open {site}" when its notice had no link to the customer. */
export function leadSiteHome(name: string): string | null {
  const domain = Object.keys(LEAD_SITE_NAMES).find((d) => LEAD_SITE_NAMES[d] === name);
  return domain ? `https://www.${domain}/` : null;
}

/**
 * The lead site an address belongs to, by its registered domain
 * ("no-reply@mail.thumbtack.com" is Thumbtack). Null for anyone else.
 */
export function leadSiteOf(email: string): { name: string; domain: string } | null {
  const address = email.trim().toLowerCase();
  const at = address.lastIndexOf("@");
  if (at <= 0) return null;
  const host = address.slice(at + 1);
  const domain = LEAD_MARKETPLACE_DOMAINS.find((d) => host === d || host.endsWith(`.${d}`));
  return domain ? { name: LEAD_SITE_NAMES[domain] ?? domain, domain } : null;
}

/**
 * The first https link in a lead site's notice that points at that same
 * site ("View lead", "Reply on Thumbtack"), for the owner's "Open {site}"
 * (backlog b018, A-075). A link to anywhere else is never returned: the
 * body is the sender's words, and this becomes a link the owner clicks.
 * Null when there is none, and the owner gets the site's own address.
 */
export function leadSiteLink(body: string | null | undefined, domain: string): string | null {
  for (const raw of (body ?? "").slice(0, 20_000).match(/https:\/\/[^\s<>"')\]]+/gi) ?? []) {
    const candidate = raw.replace(/[.,;:!?]+$/, "");
    if (candidate.length > 1000) continue;
    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      continue;
    }
    const host = url.hostname.toLowerCase();
    if (url.protocol === "https:" && !url.username && !url.password && (host === domain || host.endsWith(`.${domain}`))) {
      return url.toString();
    }
  }
  return null;
}

/**
 * A phone number a lead site's notice shows on a "Phone:" line, for the
 * owner's Call button. Read when the page is drawn, never stored on the
 * lead: putting it on the lead would let texts go to a number the site may
 * have masked (see contactNameFromBody). Null when there isn't a clear one.
 */
export function contactPhoneFromBody(body: string | null | undefined): string | null {
  const match = (body ?? "").slice(0, 5000).match(/^[ \t]*(?:phone|phone number|tel|telephone|mobile|cell)[ \t]*:[ \t]*(\+?[\d(][\d\s().+-]{6,}?)[ \t]*$/im);
  if (!match) return null;
  const phone = match[1].trim();
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 ? phone : null;
}
