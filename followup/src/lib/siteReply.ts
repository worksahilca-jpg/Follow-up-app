import type { Lead } from "@/lib/types";
import { contactPhoneFromBody, leadSiteHome } from "@/lib/sharedSenders";

/** What the "Reply on {site}" card needs (backlog b018, design brain A-075). */
export interface SiteReply {
  /** "Thumbtack", "HomeStars", "Kijiji"… */
  name: string;
  /** This customer on the site when the notice linked to them, else the site itself. */
  url: string | null;
  /** A number the site's notice showed on a "Phone:" line, for Call. Never stored on the lead. */
  phone: string | null;
}

/**
 * Whether this customer has to be answered on a lead site: they came
 * through one that kept their contact private, and FollowUp has no email
 * for them. Null for everyone else, who keep the normal reply card.
 */
export function siteReplyFor(lead: Pick<Lead, "email" | "viaSite" | "viaSiteUrl" | "conversation">): SiteReply | null {
  const newestInbound = [...lead.conversation].reverse().find((m) => m.direction === "inbound");
  return siteReplyFrom(lead, newestInbound?.body);
}

/** The same, from the lead's columns and its newest inbound message's body (Today's cards). */
export function siteReplyFrom(
  lead: { email?: string | null; viaSite?: string | null; viaSiteUrl?: string | null },
  newestInboundBody: string | null | undefined
): SiteReply | null {
  if (!lead.viaSite || lead.email) return null;
  return {
    name: lead.viaSite,
    url: lead.viaSiteUrl || leadSiteHome(lead.viaSite),
    phone: contactPhoneFromBody(newestInboundBody),
  };
}
