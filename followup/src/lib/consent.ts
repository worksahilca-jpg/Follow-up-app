/**
 * Turns Lead.source (already stored on every lead — see Lead.source in
 * schema.prisma) into a plain-English answer to "why is it okay for
 * FollowUp to contact this person." This is deliberately NOT a new field
 * or a new capture-time prompt: task #67 already gives every lead a
 * source label at creation (Gmail, Website form, CSV import, Instagram,
 * a CRM sync, ...), and research/market/2026-09-08-product-direction-
 * synthesis.md recommendation #2 is about turning what's already stored
 * into something a business owner can actually read, not collecting more
 * data. A source this function doesn't recognize still gets a real
 * (if generic) answer — never a blank or "undefined."
 *
 * Deliberately pattern-matched (not an exact-match table): sources drift
 * in small ways across capture paths ("Gmail" vs. "Gmail (spam)", a CRM's
 * own display name, a CSV column someone typed by hand) and a fragile
 * exact match would silently fall through to the generic case for
 * spelling variants that are still obviously the same channel.
 */

export interface ConsentBasis {
  /** Short label for a pill/badge. */
  label: string;
  /** One sentence explaining the legal/practical basis for contact. */
  explanation: string;
}

const RULES: Array<{ test: RegExp; basis: ConsentBasis }> = [
  {
    test: /website form|widget|webhook|zapier|make\.com/i,
    basis: {
      label: "Submitted a form",
      explanation: "This lead filled out a form on your site — they gave you their contact details expecting a reply.",
    },
  },
  {
    test: /csv|import/i,
    basis: {
      label: "Bulk import",
      explanation: "Added in a bulk import. Consent should already exist wherever this list came from — worth confirming before autonomous outreach.",
    },
  },
  {
    test: /manual/i,
    basis: {
      label: "Added by your team",
      explanation: "A teammate added this lead directly — confirm there's a real relationship or prior contact before sending automated messages.",
    },
  },
  {
    test: /gmail|outlook|\bemail\b|microsoft 365/i,
    basis: {
      label: "Emailed you first",
      explanation: "They emailed your business first — replying to an inbound email doesn't require separate consent.",
    },
  },
  {
    test: /instagram|messenger|facebook/i,
    basis: {
      label: "Messaged your page",
      explanation: "They messaged your business's social page directly — contact is governed by that platform's own messaging terms.",
    },
  },
  {
    test: /whatsapp/i,
    basis: {
      label: "Messaged on WhatsApp",
      explanation: "They messaged your WhatsApp Business number first — replies are consented under WhatsApp's business messaging policy.",
    },
  },
  {
    test: /twilio|\bsms\b|\btext\b/i,
    basis: {
      label: "Texted your number",
      explanation: "They texted your business number first — this is the inbound contact that establishes SMS consent under TCPA.",
    },
  },
  {
    test: /voice|call|voicemail/i,
    basis: {
      label: "Called your number",
      explanation: "They called your business number — a follow-up call or text is responding to their own outreach.",
    },
  },
  {
    test: /referral|past client|cold outreach|linkedin/i,
    basis: {
      label: "Outside relationship",
      explanation: "This lead didn't contact you first — confirm you have a legitimate basis to reach out before an automated send goes out.",
    },
  },
];

// Anything synced in from an outside CRM (Follow Up Boss, HubSpot, ...) —
// see src/lib/crmSync.ts, which sets Lead.source to the CRM's own display
// label, so this can't be a fixed string list.
const CRM_LIKE = /follow up boss|hubspot/i;

export function deriveConsentBasis(source: string | null | undefined): ConsentBasis {
  if (!source || source === "Unknown") {
    return {
      label: "Not recorded",
      explanation: "No source was recorded for this lead — where they came from, and why contact is okay, isn't known.",
    };
  }
  if (CRM_LIKE.test(source)) {
    return {
      label: "Synced from your CRM",
      explanation: `Synced in from ${source} — consent was already established there before it reached FollowUp.`,
    };
  }
  for (const rule of RULES) {
    if (rule.test.test(source)) return rule.basis;
  }
  return {
    label: source,
    explanation: `Sourced from "${source}." No specific consent rule is known for this source — review before automated outreach.`,
  };
}
