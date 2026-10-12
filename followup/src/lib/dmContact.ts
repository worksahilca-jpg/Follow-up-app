import { prisma } from "@/lib/db";
import type { Criterion } from "@/lib/qualification";
import type { Message } from "@/lib/types";

/**
 * How to keep following up with an Instagram or Messenger customer after
 * Meta's 24-hour window closes (founder, 2026-10-12, A-238; supersedes
 * R-003).
 *
 * Meta stops automatic DMs 24 hours after the customer's last message.
 * Most people who go quiet do it inside that day, so the day-2 and day-7
 * follow-ups never reached them. So, once, in a reply, FollowUp asks for
 * the best email and mobile number to reach them. What they type back is
 * kept apart from `Lead.email` and `Lead.phone`:
 *
 *  - `dmEmail`: an automatic follow-up past the window goes here instead of
 *    nowhere (sending.ts, detectAutomatedReplyChannel). Inside the window
 *    the DM is always used. STOP in the DM stops the email too.
 *  - `dmPhone`: for the owner to call. Texts aren't switched on
 *    (CARRIER_CHANNELS_AVAILABLE), so nothing is sent to it.
 *
 * Only words the customer typed are read. Nothing is guessed or looked up:
 * that is the difference from what R-003 rejected, an automatic switch of
 * channel the customer never offered.
 */

/** What the reply may end by asking, in the same slot a qualifying question uses (qualifyPromptBlock). */
export const DM_CONTACT_ASK: Pick<Criterion, "ask"> = {
  ask:
    "the best email address and mobile number to reach them on, so you can send them more details or give them a " +
    "quick call; ask for both in the one question",
};

/**
 * Whether this reply should ask for their email and mobile: a DM customer
 * who has just written, has been answered at least once (never in the very
 * first reply, which only answers them), and has neither given an email nor
 * been asked before.
 */
export function shouldAskForContact(
  lead: { email: string | null; dmEmail: string | null; dmContactAskedAt: Date | null },
  conversation: readonly Pick<Message, "direction">[]
): boolean {
  if (lead.email || lead.dmEmail || lead.dmContactAskedAt) return false;
  return conversation.some((m) => m.direction === "outbound");
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/i;

/** The first email address in what they wrote, lower-cased, or null. */
export function findEmail(text: string): string | null {
  const match = text.match(EMAIL_RE)?.[0];
  if (!match || match.length > 254) return null;
  return match.toLowerCase();
}

// A run that starts and ends on a digit, with the separators people type
// in a phone number between: spaces, dots, dashes, brackets, a leading +.
const PHONE_CANDIDATE_RE = /\+?\(?\d[\d\s().-]{7,}\d/g;

/**
 * The first phone number in what they wrote, as they typed it, or null.
 *
 * 10 to 15 digits. A number split into groups ("416-555-1234",
 * "+91 98765 43210") has no group longer than 5 digits, so a price range
 * like "600000-700000" is not read as a phone number. One unbroken run of
 * 10 to 13 digits ("4165551234") counts.
 */
export function findPhone(text: string): string | null {
  for (const match of text.matchAll(PHONE_CANDIDATE_RE)) {
    const typed = match[0].trim();
    const groups = typed.split(/\D+/).filter(Boolean);
    const digits = groups.join("");
    if (digits.length < 10 || digits.length > 15) continue;
    if (groups.length === 1 ? digits.length > 13 : groups.some((g) => g.length > 5)) continue;
    if (/^(\d)\1+$/.test(digits)) continue;
    return typed.slice(0, 32);
  }
  return null;
}

/**
 * Keeps the email and mobile a DM customer typed. The newest one wins, so
 * "sorry, it's jo.smith@…" corrects a typo. An email is kept only while the
 * customer has no `Lead.email`: one they already have is the one to use.
 * Scoped to the business, like every write here.
 */
export async function rememberDmContact(businessId: string, leadId: string, ownWords: string): Promise<{ email: string | null; phone: string | null }> {
  const email = findEmail(ownWords);
  const phone = findPhone(ownWords);
  if (email) await prisma.lead.updateMany({ where: { id: leadId, businessId, email: null }, data: { dmEmail: email } });
  if (phone) await prisma.lead.updateMany({ where: { id: leadId, businessId }, data: { dmPhone: phone } });
  return { email, phone };
}

/**
 * The customer an email address belongs to: the one whose email it is, or
 * else an Instagram or Messenger customer who gave it in a DM. Without the
 * second, their answer to FollowUp's email would be filed as a new customer
 * and the conversation split in two. Newest first if two DM customers gave
 * the same address.
 */
export async function findLeadByAnyEmail(businessId: string, email: string): Promise<{ id: string; lastContacted: Date | null } | null> {
  const select = { id: true, lastContacted: true } as const;
  return (
    (await prisma.lead.findUnique({ where: { businessId_email: { businessId, email } }, select })) ??
    (await prisma.lead.findFirst({ where: { businessId, email: null, dmEmail: email }, orderBy: { createdAt: "desc" }, select }))
  );
}
