import type { Prisma } from "@prisma/client";

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

/**
 * The prisma select for the team's addresses (see teamAddresses): each
 * person's sign-in address and every mailbox they connected. Addresses only:
 * no token column is read.
 */
export const TEAM_ADDRESS_SELECT = {
  email: true,
  integrations: { where: { provider: { in: ["gmail", "outlook"] } }, select: { accountEmail: true } },
} satisfies Prisma.UserSelect;

/**
 * Everyone on the team, as addresses: their sign-in, and every inbox any
 * of them connected. Each admin can connect their own inbox, and it need
 * not be the address they sign in with (Jo signs in as jo@samsplumbing.ca
 * and connected jo.bookings@gmail.com). Read through the business's other
 * inbox, Jo's mail was a stranger's: her reply to a customer was stored as
 * the customer writing again, and a lead she forwarded became a customer
 * called Jo.
 */
export function teamAddresses(
  users: ReadonlyArray<{ email: string | null; integrations?: ReadonlyArray<{ accountEmail: string | null }> }>
): (string | null)[] {
  return users.flatMap((u) => [u.email, ...(u.integrations ?? []).map((i) => i.accountEmail)]);
}
