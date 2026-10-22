/**
 * The channel a screen names, which is not always the one a conversation is
 * stored under. Pure, no imports: server pages, client components and the
 * "Based on…" line all call it.
 *
 * A Facebook Lead Ads submission is kept on the "web" conversation, because
 * its replies go by email exactly as a website form's do (src/lib/inbound/
 * meta.ts). But the owner should read where the person really came from:
 * the first Lead Ad test showed "Website form" on Today and on the customer
 * page while "Came from" on the same page said Facebook (founder,
 * 2026-10-07). Only the label changes; sending still reads the stored
 * channel.
 */

/** Lead.source for a Lead Ads submission (src/lib/facebook.ts). */
export const LEAD_AD_SOURCE = "Facebook Lead Ad";

/** The display key for a Lead Ads submission. Never stored on a Conversation. */
export const LEAD_FORM = "lead_form";

export function displayChannel(channel: string | null | undefined, source: string | null | undefined): string | null {
  if (!channel) return null;
  if (channel === "web" && source === LEAD_AD_SOURCE) return LEAD_FORM;
  return channel;
}

/** A customer with no messages yet still came from somewhere: read it off the source's name. */
export function channelFromSource(source: string | null | undefined): string | null {
  const s = (source ?? "").toLowerCase();
  if (/gmail|outlook|mail/.test(s)) return "email";
  if (/instagram/.test(s)) return "instagram";
  if (/whatsapp/.test(s)) return "whatsapp";
  if (/facebook lead ad/.test(s)) return LEAD_FORM;
  if (/messenger|facebook/.test(s)) return "messenger";
  if (/website|form|widget/.test(s)) return "web";
  if (/call|voice|phone/.test(s)) return "call";
  if (/sms|text/.test(s)) return "text";
  return null;
}
