/**
 * The two pure helpers for Instagram's phone-column-reuse trick, split out
 * of src/lib/instagram.ts into their own zero-dependency leaf module.
 *
 * Why: instagram.ts pulls in Prisma, sendInstagramMessage, and (as of
 * per-source routing) sourceRouting.ts -> sequences.ts -> sending.ts ->
 * the Gmail integration (googleapis, which needs Node's `tls` and breaks
 * a browser bundle). FollowUpCard.tsx is a client component that only
 * ever needed this one boolean check — importing it from full instagram.ts
 * dragged that entire server-only chain into the client bundle. Keeping
 * these two functions here, with nothing else imported, means a client
 * component can use them without pulling in anything server-only.
 */

const IG_ID_PREFIX = "ig:";

export function isInstagramLeadId(phone: string | null): phone is string {
  return !!phone?.startsWith(IG_ID_PREFIX);
}

export function instagramRecipientId(phone: string): string {
  return phone.slice(IG_ID_PREFIX.length);
}

export function instagramLeadId(senderId: string): string {
  return `${IG_ID_PREFIX}${senderId}`;
}

// Facebook Messenger uses the same trick with its own prefix: a Page-scoped
// user ID (PSID) stored in Lead.phone as "fb:<psid>". See src/lib/facebook.ts.
const FB_ID_PREFIX = "fb:";

export function isMessengerLeadId(phone: string | null): phone is string {
  return !!phone?.startsWith(FB_ID_PREFIX);
}

export function messengerRecipientId(phone: string): string {
  return phone.slice(FB_ID_PREFIX.length);
}

export function messengerLeadId(psid: string): string {
  return `${FB_ID_PREFIX}${psid}`;
}

/** True for any social-DM pseudo-id (Instagram or Messenger) — not a dialable number. */
export function isSocialLeadId(phone: string | null): phone is string {
  return isInstagramLeadId(phone) || isMessengerLeadId(phone);
}
