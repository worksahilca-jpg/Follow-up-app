import { prisma } from "@/lib/db";

/**
 * Resolves WHICH existing Lead a P2002 on `lead.create` just collided with.
 *
 * Lead carries two unique constraints, not one — `@@unique([businessId, email])`
 * AND `@@unique([businessId, phone])` (prisma/schema.prisma). Both the embed
 * form and the inbound lead webhook accept a submission with an email, a
 * phone, or both, so either constraint can be the one that fires.
 *
 * Both recovery paths used to look the conflict up by email alone. When the
 * collision was actually on PHONE — the same person submitting again from a
 * different email address, or a phone-only submission repeated at all (those
 * leads are stored with `email: null`, so an email lookup can never match
 * one) — the lookup found nothing, the handler fell through to its "nothing
 * more to do" branch, and the visitor got a success response for an enquiry
 * that was never recorded anywhere. A silently dropped lead is the single
 * worst outcome this product can produce, so the lookup has to cover the
 * same ground the constraints do.
 *
 * Email is tried first because it's the more specific identity of the two: a
 * phone number gets reassigned and mistyped more often than an address does,
 * and an email match is the one the original recovery path was written
 * around. Exact-string matching on both is deliberate — it's exactly what
 * the unique index compared to raise P2002 in the first place, so anything
 * fuzzier here would resolve to a different row than the one that actually
 * collided.
 */
export async function findConflictingLead(businessId: string, email: string, phone: string) {
  if (email) {
    const byEmail = await prisma.lead.findUnique({ where: { businessId_email: { businessId, email } } });
    if (byEmail) return byEmail;
  }
  if (phone) {
    const byPhone = await prisma.lead.findUnique({ where: { businessId_phone: { businessId, phone } } });
    if (byPhone) return byPhone;
  }
  return null;
}
