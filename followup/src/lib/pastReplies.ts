/**
 * "Write like me" (Settings → Your data): with the owner's yes, read the
 * replies they sent from Gmail in the last 12 months and keep a cleaned,
 * de-identified copy of each as a sample of how they write. src/lib/voice.ts
 * hands a few of them to THIS business's own drafts, so a draft sounds like
 * the person who will send it. Founder, 2026-09-28: "it should be totally
 * human, should not sound AI".
 *
 * Personal, never shared. Google's Workspace API user data policy allows
 * Gmail data to power a personalised feature for the same user and forbids
 * using it to develop, improve or train a generalised model, so nothing
 * here is ever read across businesses or fed to training of any kind. That
 * was the founder's first idea (one model trained on every tester's mail);
 * it was dropped for exactly that reason.
 *
 * The job runs a page at a time from its own cron (src/app/api/cron/
 * past-replies), carrying on where it stopped: one Gmail page, at most
 * PAGE_SIZE messages, per business per tick. It stops at MAX_KEPT samples
 * or MAX_SCANNED messages looked at, whichever comes first, so an inbox
 * with years of mail is still a bounded job.
 *
 * What counts as a reply worth keeping, decided by structure, never by
 * judging the prose:
 *  - it answers another message (In-Reply-To is set) and isn't a forward;
 *  - it went to someone outside the business: not the owner, not a
 *    teammate, not a colleague on the owner's own company domain, not an
 *    automated address;
 *  - FollowUp didn't send it (voice.ts's own test, against FollowUp rows);
 *  - what's left after cutting the quoted history and the signature is
 *    between MIN_LENGTH and MAX_LENGTH characters.
 *
 * Stored de-identified: the recipient's and the owner's names and
 * addresses become placeholders, then deidentifyText's backstop replaces
 * any other email, phone number or street address. The raw message is
 * never written anywhere.
 */

import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { listSentReplies, isAuthRevoked, type SentReply } from "@/lib/integrations/gmail";
import { deidentifyText, type KnownIdentifier } from "@/lib/deidentify";
import { machineSentIndex, isMachineSent } from "@/lib/voice";
import { isFollowUpSender } from "@/lib/ownSenders";

export const MAX_KEPT = 300;
export const MAX_SCANNED = 2000;
const PAGE_SIZE = 100;
export const MIN_LENGTH = 40;
export const MAX_LENGTH = 1500;

/** Where a work address is also a person's own address, a shared domain says nothing about being a colleague. */
const FREE_MAIL = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.ca",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "rogers.com",
  "shaw.ca",
  "sympatico.ca",
  "bell.net",
]);

const AUTOMATED = [/no-?reply/i, /do-?not-?reply/i, /notifications?@/i, /mailer-daemon/i, /postmaster@/i, /bounce/i];

/** "Sarah Lee <sarah@x.com>, bob@y.com" → the addresses and display names, in order. */
export function parseAddressList(raw: string): { name: string; email: string }[] {
  const out: { name: string; email: string }[] = [];
  // Split on commas outside quotes.
  const parts = raw.match(/(?:"[^"]*"|[^,])+/g) ?? [];
  for (const part of parts) {
    const m = part.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
    const email = (m ? m[2] : part).trim().toLowerCase();
    if (!email.includes("@")) continue;
    out.push({ name: m ? m[1].trim() : "", email });
  }
  return out;
}

function domainOf(email: string): string {
  return email.split("@")[1] ?? "";
}

/**
 * The part of a sent message the owner actually wrote: cut at the first
 * quoted-history marker (Gmail's "On … wrote:", Outlook's "From:" block or
 * "-----Original Message-----", ">"-quoted lines), at a signature delimiter,
 * and at a phone's "Sent from my …" line.
 */
export function cleanReplyBody(raw: string): string {
  const text = raw.replace(/\r\n/g, "\n");
  const markers = [
    /^On .{0,200}wrote:\s*$/im,
    /On [^\n]{0,200}? wrote:/i, // an HTML-only body arrives as one line
    /^>/m,
    /^-{2,}\s*Original Message\s*-{2,}/im,
    /^_{8,}\s*$/m,
    /^From:\s.+\n(?:.*\n){0,3}?(?:Sent|Date):\s/im,
    /^--\s*$/m,
    /^Sent from my /im,
    /^Get Outlook for /im,
  ];
  let cut = text.length;
  for (const re of markers) {
    const m = re.exec(text);
    if (m && m.index < cut) cut = m.index;
  }
  return text
    .slice(0, cut)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface KeepContext {
  /** Every address that is the business itself: the connected inbox and each teammate. */
  ownAddresses: Set<string>;
  /** The connected inbox's domain, when it is a company domain (not a free-mail one). */
  companyDomain: string | null;
}

/** The one outside person a reply went to, or null when it isn't a reply worth learning from. */
export function replyRecipient(r: SentReply, ctx: KeepContext): { name: string; email: string } | null {
  if (!r.inReplyTo.trim()) return null;
  if (/^\s*(fwd?|fw)\s*:/i.test(r.subject)) return null;
  const to = parseAddressList(r.to);
  const cc = parseAddressList(r.cc);
  // A reply-all to a crowd is a group email, not a conversation with a customer.
  if (to.length === 0 || to.length + cc.length > 3) return null;
  const first = to[0];
  if (ctx.ownAddresses.has(first.email)) return null;
  if (ctx.companyDomain && domainOf(first.email) === ctx.companyDomain) return null;
  if (AUTOMATED.some((re) => re.test(first.email)) || isFollowUpSender(first.email)) return null;
  return first;
}

/** Short, one-way: spreads samples across people without keeping who they were. */
export function recipientKey(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 16);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Names, then deidentifyText. A first name on its own ("Hi Sam,") is the
 * commonest way a name appears in a reply, and deidentifyText matches a
 * whole stored value as a substring, so first names are replaced here,
 * on word boundaries, where "Sam" can't eat the "Sam" in "Sample".
 */
export function deidentifyReply(
  body: string,
  people: { recipientName: string; recipientEmail: string; ownerName: string | null; ownerEmail: string }
): string {
  let text = body;
  const firstNames: [string, string][] = [];
  const recipientFirst = people.recipientName.split(/\s+/)[0] ?? "";
  const ownerFirst = (people.ownerName ?? "").split(/\s+/)[0] ?? "";
  if (recipientFirst.length >= 2) firstNames.push([recipientFirst, "[LEAD_NAME]"]);
  if (ownerFirst.length >= 2) firstNames.push([ownerFirst, "[OWNER_NAME]"]);
  const ids: KnownIdentifier[] = [];
  if (people.recipientName.trim()) ids.push({ value: people.recipientName.trim(), placeholder: "[LEAD_NAME]" });
  ids.push({ value: people.recipientEmail, placeholder: "[LEAD_EMAIL]" });
  if (people.ownerName?.trim()) ids.push({ value: people.ownerName.trim(), placeholder: "[OWNER_NAME]" });
  ids.push({ value: people.ownerEmail, placeholder: "[OWNER_EMAIL]" });
  // Whole names first, so "Sarah Lee" becomes one placeholder, not two.
  text = deidentifyText(text, ids);
  for (const [name, placeholder] of firstNames) {
    text = text.replace(new RegExp(`\\b${escapeRegExp(name)}\\b`, "gi"), placeholder);
  }
  return text;
}

type PageResult = { status: "reading" | "done" | "failed" | "skipped"; kept: number; scanned: number };

/**
 * One tick for one business: read the next page of its sent mail and keep
 * what qualifies. Does nothing unless the owner has said yes and the job
 * is still reading.
 */
export async function readPastRepliesPage(businessId: string): Promise<PageResult> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { pastRepliesAllowedAt: true, pastRepliesStatus: true, pastRepliesPageToken: true, pastRepliesScanned: true },
  });
  if (!business?.pastRepliesAllowedAt || business.pastRepliesStatus !== "reading") {
    return { status: "skipped", kept: 0, scanned: business?.pastRepliesScanned ?? 0 };
  }
  const allowedAt = business.pastRepliesAllowedAt;
  // Every write below is conditioned on the same yes still standing, so an
  // owner who switches it off mid-page is never overwritten by this tick.
  const stillAllowed = { id: businessId, pastRepliesAllowedAt: allowedAt };

  let page: Awaited<ReturnType<typeof listSentReplies>>;
  try {
    page = await listSentReplies(businessId, business.pastRepliesPageToken, PAGE_SIZE);
  } catch (err) {
    if (isAuthRevoked(err)) {
      await prisma.business.updateMany({
        where: stillAllowed,
        data: { pastRepliesStatus: "failed", pastRepliesError: "Gmail needs reconnecting before your past replies can be read." },
      });
      return { status: "failed", kept: 0, scanned: business.pastRepliesScanned };
    }
    throw err; // passing trouble: the next tick tries the same page again
  }
  if (!page) {
    await prisma.business.updateMany({
      where: stillAllowed,
      data: { pastRepliesStatus: "failed", pastRepliesError: "Connect Gmail first, then turn this on again." },
    });
    return { status: "failed", kept: 0, scanned: business.pastRepliesScanned };
  }

  const team = await prisma.user.findMany({ where: { businessId }, select: { email: true } });
  const ownAddresses = new Set([page.selfEmail, ...team.map((u) => u.email.toLowerCase())]);
  const selfDomain = domainOf(page.selfEmail);
  const ctx: KeepContext = { ownAddresses, companyDomain: FREE_MAIL.has(selfDomain) ? null : selfDomain };

  // FollowUp's own sends, found the way voice.ts finds them: the stored
  // Message for that Gmail id, checked against this business's FollowUp rows.
  const stored = await prisma.message.findMany({
    where: { externalId: { in: page.replies.map((r) => r.id) }, conversation: { lead: { businessId } } },
    select: { externalId: true, body: true, sentAt: true, conversation: { select: { leadId: true } } },
  });
  const sendIndex = await machineSentIndex([...new Set(stored.map((m) => m.conversation.leadId))]);
  const machineIds = new Set(
    stored.filter((m) => isMachineSent(sendIndex, m.conversation.leadId, m.body, m.sentAt)).map((m) => m.externalId)
  );

  const rows = [];
  for (const r of page.replies) {
    if (machineIds.has(r.id)) continue;
    const to = replyRecipient(r, ctx);
    if (!to) continue;
    const cleaned = cleanReplyBody(r.body);
    if (cleaned.length < MIN_LENGTH || cleaned.length > MAX_LENGTH) continue;
    rows.push({
      businessId,
      gmailMessageId: r.id,
      recipientKey: recipientKey(to.email),
      body: deidentifyReply(cleaned, {
        recipientName: to.name,
        recipientEmail: to.email,
        ownerName: page.ownerName,
        ownerEmail: page.selfEmail,
      }),
      sentAt: r.sentAt,
    });
  }

  const current = await prisma.business.findFirst({ where: stillAllowed, select: { id: true } });
  if (!current) return { status: "skipped", kept: 0, scanned: business.pastRepliesScanned };
  if (rows.length > 0) await prisma.pastReply.createMany({ data: rows, skipDuplicates: true });

  const kept = await prisma.pastReply.count({ where: { businessId } });
  const scanned = business.pastRepliesScanned + page.replies.length;
  const finished = !page.nextPageToken || scanned >= MAX_SCANNED || kept >= MAX_KEPT;
  const { count } = await prisma.business.updateMany({
    where: stillAllowed,
    data: {
      pastRepliesScanned: scanned,
      pastRepliesPageToken: finished ? null : page.nextPageToken,
      pastRepliesStatus: finished ? "done" : "reading",
      pastRepliesError: null,
    },
  });
  // Switched off between the check above and here: what this tick wrote
  // goes too, so "off" always means none kept.
  if (count === 0) {
    await prisma.pastReply.deleteMany({ where: { businessId } });
    return { status: "skipped", kept: 0, scanned };
  }
  return { status: finished ? "done" : "reading", kept, scanned };
}

/** Every business still reading, one page each, a few at a time. */
export async function readAllPastReplies(): Promise<{ businesses: number; failed: number }> {
  const reading = await prisma.business.findMany({
    where: { pastRepliesStatus: "reading", pastRepliesAllowedAt: { not: null } },
    select: { id: true },
    // A page is up to 100 Gmail reads; three businesses fit the 60-second
    // function comfortably, and the rest are next tick's.
    take: 3,
  });
  let failed = 0;
  for (const b of reading) {
    try {
      await readPastRepliesPage(b.id);
    } catch (err) {
      failed += 1;
      console.error(`Reading past replies failed for business ${b.id}:`, err instanceof Error ? err.message : err);
    }
  }
  return { businesses: reading.length, failed };
}

export interface PastRepliesState {
  on: boolean;
  status: "reading" | "done" | "failed" | null;
  kept: number;
  error: string | null;
}

export async function getPastRepliesState(businessId: string): Promise<PastRepliesState> {
  const [b, kept] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { pastRepliesAllowedAt: true, pastRepliesStatus: true, pastRepliesError: true },
    }),
    prisma.pastReply.count({ where: { businessId } }),
  ]);
  const status = b?.pastRepliesStatus;
  return {
    on: !!b?.pastRepliesAllowedAt,
    status: status === "reading" || status === "done" || status === "failed" ? status : null,
    kept,
    error: b?.pastRepliesError ?? null,
  };
}

/**
 * The switch. On starts reading from the newest sent mail. Off deletes
 * every kept reply and clears the job, in one transaction: off means none
 * kept, not "none kept from now on".
 */
export async function setPastRepliesAllowed(businessId: string, on: boolean): Promise<void> {
  if (on) {
    await prisma.business.update({
      where: { id: businessId },
      data: {
        pastRepliesAllowedAt: new Date(),
        pastRepliesStatus: "reading",
        pastRepliesPageToken: null,
        pastRepliesScanned: 0,
        pastRepliesError: null,
      },
    });
    return;
  }
  await prisma.$transaction([
    prisma.business.update({
      where: { id: businessId },
      data: {
        pastRepliesAllowedAt: null,
        pastRepliesStatus: null,
        pastRepliesPageToken: null,
        pastRepliesScanned: 0,
        pastRepliesError: null,
      },
    }),
    prisma.pastReply.deleteMany({ where: { businessId } }),
  ]);
}
