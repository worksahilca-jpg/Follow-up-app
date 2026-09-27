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

/**
 * Every address that is the business itself in a synced mailbox: the
 * connected inbox, plus the sign-in address of everyone on the team.
 *
 * The mail sync used to know only the connected inbox. An owner who signs
 * in as sam.smith@gmail.com and connects info@samsplumbing.ca, then
 * forwards a customer's email from his phone to info@ (or answers the
 * weekly email FollowUp sends him from info@), was filed as a new customer
 * called "Sam Smith": scored, drafted for, acknowledged, and followed up
 * on. A teammate writing to the shared inbox the same way. Mail from these
 * addresses is the business talking, never a customer.
 */
export function ownAddressSet(connectedInbox: string, teamEmails: ReadonlyArray<string | null | undefined>): Set<string> {
  const out = new Set<string>([connectedInbox.trim().toLowerCase()]);
  for (const email of teamEmails) if (email && email.includes("@")) out.add(bareAddress(email));
  return out;
}
