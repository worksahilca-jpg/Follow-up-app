/**
 * The addresses FollowUp itself sends from. Mail from these is never a
 * customer.
 *
 * Owner alerts ("Sahil wrote by email… FollowUp's reply is ready") go to
 * the owner's own inbox, and that inbox is the one FollowUp reads. Without
 * this check the next sync took the alert in as a new customer called
 * "FollowUp", held it and drafted a reply to it. The generic automated
 * patterns (no-reply, notifications@) do not catch alerts@.
 */
const DEFAULT_ALERT_ADDRESS = "alerts@followupbase.io";

/** The bare address from "Name <addr>" or "addr". */
function bareAddress(value: string): string {
  const m = value.match(/<([^>]+)>/);
  return (m ? m[1] : value).trim().toLowerCase();
}

export function followUpSendingAddresses(): string[] {
  const configured = process.env.ALERT_FROM_EMAIL;
  const out = new Set([DEFAULT_ALERT_ADDRESS]);
  if (configured && configured.includes("@")) out.add(bareAddress(configured));
  return [...out];
}

export function isFollowUpSender(email: string): boolean {
  return followUpSendingAddresses().includes(bareAddress(email));
}
