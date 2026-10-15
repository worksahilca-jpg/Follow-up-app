import { prisma } from "@/lib/db";
import { isSharedSender } from "@/lib/sharedSenders";
import { isInstagramLeadId, isMessengerLeadId } from "@/lib/instagramId";
import { isNotCustomerReason, type NotCustomerReason } from "@/lib/notCustomerReasons";

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
 * Since A-259 a "not a customer" can carry the owner's answer to "Who is
 * this?" (friend, work, selling, spam; src/lib/notCustomerReasons.ts). The
 * answer travels with the example, and an Instagram or Messenger contact
 * with an answer is remembered too, by its lead key (recordContactVerdict),
 * so their next message is set aside instead of judged afresh.
 *
 * No other business's corrections are ever read, no message body is kept,
 * and nothing trains a model: the privacy page's promise stands.
 *
 * "Not a customer" is never remembered for a shared sender (backlog b002):
 * a website form's notifier or a lead site like Thumbtack sends every
 * enquiry from one address, so a rule about the address would set aside
 * the whole source. The owner's call still covers that message's own
 * threads (the not-customer route sets them aside); it just goes no
 * further. Checked on read as well as write, so a row stored before this
 * rule suppresses nothing either.
 */

export type SenderVerdictKind = "customer" | "not_customer";

export type OwnerCorrection = { sender: string; subject: string | null; verdict: SenderVerdictKind; reason?: NotCustomerReason | null };

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
  subject: string | null,
  // The owner's answer to "Who is this?" (A-259). Kept on a "not a
  // customer" only; a "customer" clears it.
  reason: NotCustomerReason | null = null
): Promise<void> {
  const key = normalizeSender(sender);
  // An address, never free text: a From header with no angle brackets
  // parses whole as "the email", and "unknown" stands in for a missing one.
  // Neither is a sender to remember, and both would reach the classifier.
  if (!SENDER_ADDRESS.test(key)) return;
  // One person's "not a customer" is not the next person's (see header).
  if (verdict === "not_customer" && isSharedSender(key)) return;
  const trimmed = subject?.trim().slice(0, 200) || null;
  const why = verdict === "not_customer" ? reason : null;
  await prisma.senderVerdict.upsert({
    where: { businessId_sender: { businessId, sender: key } },
    update: { verdict, subject: trimmed, reason: why },
    create: { businessId, sender: key, verdict, subject: trimmed, reason: why },
  });
}

/** An Instagram or Messenger contact's lead key (ig:… / fb:…), the only non-address sender kept. */
function isContactKey(key: string): boolean {
  return isInstagramLeadId(key) || isMessengerLeadId(key);
}

/**
 * The owner said an Instagram or Messenger contact is not a customer and
 * said who they were (A-259): remembered, so the next message from them is
 * set aside without a fresh look (src/lib/inbound/dmContactGate.ts). With no
 * answer nothing is kept, and the chat is checked again as before.
 */
export async function recordContactVerdict(businessId: string, contactKey: string, reason: NotCustomerReason): Promise<void> {
  // Read back through normalizeSender (ownerSaidNotCustomer, forgetSender), so stored the same way.
  const key = normalizeSender(contactKey);
  if (!isContactKey(key)) return;
  await prisma.senderVerdict.upsert({
    where: { businessId_sender: { businessId, sender: key } },
    update: { verdict: "not_customer", subject: null, reason },
    create: { businessId, sender: key, verdict: "not_customer", subject: null, reason },
  });
}

/**
 * True when the owner has said this sender is not a customer, and hasn't
 * said otherwise since. A failed read answers false: the thread is then
 * judged as it would have been before this existed, never dropped. Always
 * false for a shared sender, whatever is stored (see header).
 */
export async function ownerSaidNotCustomer(businessId: string, sender: string): Promise<boolean> {
  if (isSharedSender(sender)) return false;
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
      select: { sender: true, subject: true, verdict: true, reason: true },
    });
    return rows
      .filter((r): r is typeof r & { verdict: SenderVerdictKind } => r.verdict === "customer" || r.verdict === "not_customer")
      // A stored "not a customer" on a shared sender would teach the
      // classifier the same over-broad rule (see header).
      .filter((r) => !(r.verdict === "not_customer" && isSharedSender(r.sender)))
      .map((r) => ({
        // A contact's lead key means nothing to the checker; the channel does.
        sender: isInstagramLeadId(r.sender) ? "an Instagram chat" : isMessengerLeadId(r.sender) ? "a Messenger chat" : r.sender,
        subject: r.subject,
        verdict: r.verdict,
        reason: isNotCustomerReason(r.reason) ? r.reason : null,
      }));
  } catch (err) {
    console.error(`Could not read owner corrections for business ${businessId}:`, err);
    return [];
  }
}

/**
 * What the owner has taught FollowUp, by answer (Settings › Your business ›
 * Who isn't a customer, and the "from now on" question): how many senders
 * carry each answer, and when the latest was given.
 */
export async function notCustomerCounts(businessId: string): Promise<Partial<Record<NotCustomerReason, { count: number; latest: Date }>>> {
  const rows = await prisma.senderVerdict.groupBy({
    by: ["reason"],
    where: { businessId, verdict: "not_customer", reason: { not: null } },
    _count: { _all: true },
    _max: { updatedAt: true },
  });
  const out: Partial<Record<NotCustomerReason, { count: number; latest: Date }>> = {};
  for (const r of rows) {
    if (isNotCustomerReason(r.reason) && r._max.updatedAt) out[r.reason] = { count: r._count._all, latest: r._max.updatedAt };
  }
  return out;
}

/** "Undo" on one answer in Settings: FollowUp forgets everyone the owner gave that answer for. */
export async function forgetReason(businessId: string, reason: NotCustomerReason): Promise<number> {
  const { count } = await prisma.senderVerdict.deleteMany({ where: { businessId, verdict: "not_customer", reason } });
  return count;
}
