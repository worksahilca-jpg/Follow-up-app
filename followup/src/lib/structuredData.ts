import { SITE_URL } from "@/lib/siteUrl";

/**
 * What FollowUp tells a search engine it is, in the one format they read as
 * fact rather than prose.
 *
 * ## Why this exists
 *
 * On 2026-09-21 Google's AI Overview described FollowUp, unprompted, as:
 *
 *   "an AI-driven sales communication platform [...] The tool primarily
 *    caters to independent sales representatives and field sales teams
 *    (such as solar sales and door-to-door sales) to prevent prospects
 *    from slipping through the cracks."
 *
 * Not one clause of that came from this codebase. The same result page
 * listed Follow Up Boss underneath, so at least part of it is a competitor
 * bleeding into the summary; the rest is a model filling a vacuum, because
 * the site shipped no structured data at all and the only crawl on file was
 * three weeks stale.
 *
 * "Door-to-door sales" is not a neutral mistake. `CLAUDE.md` is explicit
 * that FollowUp is never designed as a spam tool or an aggressive sales
 * platform — not in its visuals, not in its copy, not in its defaults — and
 * that is exactly the shelf a searcher just put it on. A prospect who reads
 * that summary and leaves never sees the site at all.
 *
 * Meta tags describe a PAGE. This describes the THING, which is what an
 * answer engine is trying to summarise. It cannot force a correction, but
 * it replaces a vacuum with a citable source.
 *
 * ## What is deliberately absent
 *
 * No `aggregateRating`, no `review`, no user or customer counts. There are
 * none yet — the first ten testers have not arrived. Inventing them would
 * be the exact thing `CLAUDE.md` forbids, and Google penalises fabricated
 * review markup anyway. An honest gap beats a number nobody can stand
 * behind.
 *
 * No `offers` block either. Pricing has moved three times this month, and
 * structured data that contradicts the pricing page is worse than none.
 *
 * ## Where the words come from
 *
 * Nothing here is newly written marketing copy. `description` is the
 * metadata description from layout.tsx verbatim, so the site says one thing
 * in one voice. `audience` and `abstract` are the canonical positioning
 * from PRODUCT_DIRECTION.md — "business owners are not able to follow up",
 * the CEO's wording, marked canonical there.
 */

/** The metadata description, verbatim. One product, one sentence, one voice. */
const DESCRIPTION =
  "FollowUp watches your inbox, tells you who is going quiet and why, and writes the reply. Only for owners who have leads and don't have time to reply.";

export function buildStructuredData() {
  const organization = {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "FollowUp",
    url: SITE_URL,
    description: DESCRIPTION,
    // The legal name and address as registered in Ontario on 2026-09-20
    // (BIN 1001751889). Stated because an answer engine conflating this
    // product with a similarly-named competitor is the failure being
    // fixed, and a verifiable registration is the strongest way to say
    // "this is a different company".
    legalName: "FOLLOWUP",
    foundingDate: "2026",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Etobicoke",
      addressRegion: "ON",
      addressCountry: "CA",
    },
  };

  const software = {
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}/#software`,
    name: "FollowUp",
    url: SITE_URL,
    description: DESCRIPTION,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    publisher: { "@id": `${SITE_URL}/#organization` },
    /*
     * The correction, stated positively rather than as a denial.
     *
     * PRODUCT_DIRECTION.md, canonical: "business owners are not able to
     * follow up. That is the main thing." The audience is the owner who
     * runs the business AND the follow-ups — not a sales team, and
     * emphatically not a field sales rep working a door list.
     */
    audience: {
      "@type": "Audience",
      audienceType: "Small business owners who handle their own sales follow-up",
    },
    abstract:
      "A follow-up assistant for the owner who is too busy to reply. It captures leads from email, " +
      "web forms, DMs and CRMs, notices who has gone quiet, drafts the reply in the owner's own words, " +
      "and holds it for approval before anything reaches a customer.",
    featureList: [
      "Captures leads from email, website forms, webhooks, DMs and CRMs",
      "Notices when a lead has gone quiet and says why",
      "Drafts the follow-up in the owner's own words",
      "Holds every message for the owner's approval before it sends",
      "Works in the language the lead wrote in",
    ],
  };

  return {
    "@context": "https://schema.org",
    "@graph": [organization, software],
  };
}
