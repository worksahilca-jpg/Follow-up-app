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
