import { prisma } from "@/lib/db";

/**
 * Learning from the owner's corrections, one business at a time (founder,
 * 2026-09-29: "learn from corrections").
 *
 * When the owner overrules FollowUp on who is a customer — "this was a
 * customer" on a set-aside email, or "Not a customer" on a customer — the
 * call is remembered for that sender, in that business only:
 *
 *  - A sender marked "not a customer" is set aside from then on without
 *    asking the model. Set aside, never dropped: the thread still lands in
 *    Settings → filtered emails with the reason, one tap from coming back.
 *  - A sender marked "customer" already has a lead, and a known customer is
 *    never re-judged (gmail.ts, outlook.ts). Recorded anyway so the latest
 *    word wins in either direction.
 *  - The most recent few corrections, sender and subject line only, go to
 *    the classifier as this owner's own examples (see classifyAsProspect).
 *
 * No other business's corrections are ever read, no message body is kept,
 * and nothing trains a model: the privacy page's promise stands.
 */

export type SenderVerdictKind = "customer" | "not_customer";

export type OwnerCorrection = { sender: string; subject: string | null; verdict: SenderVerdictKind };

/** How many recent corrections the classifier is shown. Enough to show a pattern, few enough to stay a hint. */
export const MAX_CORRECTION_EXAMPLES = 8;

/** The reason shown in Settings → filtered emails when the owner's own call, not the model, set a thread aside. */
export const OWNER_SAID_NOT_CUSTOMER = "You marked this sender as not a customer.";

export function normalizeSender(email: string): string {
  return email.trim().toLowerCase();
}

/** A plain email address, and nothing else. */
const SENDER_ADDRESS = /^[a-z0-9._%+'-]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/**
 * A customer who is deleted outright takes the owner's earlier call on
 * them along, so their address stops going to the classifier as an example
 * (audit 2026-09-29). Best-effort.
 */
export async function forgetSender(businessId: string, sender: string | null): Promise<void> {
  if (!sender) return;
  try {
    await prisma.senderVerdict.deleteMany({ where: { businessId, sender: normalizeSender(sender) } });
  } catch (err) {
    console.error(`Could not forget a sender for business ${businessId}:`, err);
  }
}

export async function recordSenderVerdict(
  businessId: string,
  sender: string,
  verdict: SenderVerdictKind,
  subject: string | null
): Promise<void> {
  const key = normalizeSender(sender);
  // An address, never free text: a From header with no angle brackets
  // parses whole as "the email", and "unknown" stands in for a missing one.
  // Neither is a sender to remember, and both would reach the classifier.
  if (!SENDER_ADDRESS.test(key)) return;
  const trimmed = subject?.trim().slice(0, 200) || null;
  await prisma.senderVerdict.upsert({
    where: { businessId_sender: { businessId, sender: key } },
    update: { verdict, subject: trimmed },
    create: { businessId, sender: key, verdict, subject: trimmed },
  });
}

/**
 * True when the owner has said this sender is not a customer, and hasn't
 * said otherwise since. A failed read answers false: the thread is then
 * judged as it would have been before this existed, never dropped.
 */
export async function ownerSaidNotCustomer(businessId: string, sender: string): Promise<boolean> {
  try {
    const row = await prisma.senderVerdict.findUnique({
      where: { businessId_sender: { businessId, sender: normalizeSender(sender) } },
      select: { verdict: true },
    });
    return row?.verdict === "not_customer";
  } catch (err) {
    console.error(`Could not read the owner's verdict on a sender for business ${businessId}:`, err);
    return false;
  }
}

/**
 * This business's latest corrections, newest first, for the classifier.
 * Best-effort: a failed read means no examples this run, never a failed
 * sync.
 */
export async function recentCorrections(businessId: string): Promise<OwnerCorrection[]> {
  try {
    const rows = await prisma.senderVerdict.findMany({
      where: { businessId },
      orderBy: { updatedAt: "desc" },
      take: MAX_CORRECTION_EXAMPLES,
      select: { sender: true, subject: true, verdict: true },
    });
    return rows
      .filter((r): r is OwnerCorrection => r.verdict === "customer" || r.verdict === "not_customer")
      .map((r) => ({ sender: r.sender, subject: r.subject, verdict: r.verdict }));
  } catch (err) {
    console.error(`Could not read owner corrections for business ${businessId}:`, err);
    return [];
  }
}
