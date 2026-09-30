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
 * Lead sites and form services that send many people's enquiries from one
 * address, or from a small pool of them. Matched with their subdomains
 * ("mail.thumbtack.com"). Not exhaustive: a relay missing from here is
 * treated as a person, which is how every sender was treated before.
 */
const RELAY_DOMAINS = [
  // Lead marketplaces
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
  return RELAY_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}
