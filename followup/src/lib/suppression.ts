/**
 * Email suppression — the unsubscribe FollowUp did not have.
 *
 * The gap this closes
 * -------------------
 * `Lead.optedOutAt` is the TCPA/CTIA mechanism: a lead texts STOP and every
 * SMS and WhatsApp send to them is blocked. It is deliberately scoped to
 * those two channels, because STOP is the SMS-specific legal instrument.
 *
 * Email had nothing. No unsubscribe link, no `List-Unsubscribe` header, no
 * suppression list. The only way a lead could stop automated email was for
 * the business owner to notice and set that one lead to OFF by hand. That
 * is not a mechanism — it is a hope.
 *
 * Why a table and not a column on Lead
 * -----------------------------------
 * Suppression belongs to the ADDRESS, not the row. A lead can be deleted
 * and re-imported from the same mailbox tomorrow, arrive a second time
 * through a different channel, or exist twice before a merge. A column
 * would forget in every one of those cases, and the person who
 * unsubscribed would start receiving mail again with no way to tell
 * anyone. Keyed on (businessId, channel, address), it survives all of it.
 *
 * What it blocks, and what it deliberately does not
 * ------------------------------------------------
 * It blocks AUTOMATED email: the silence follow-up, the unanswered nudge,
 * the reactivation batch, workflow steps, the instant acknowledgement.
 * It does NOT block a human at the business typing a reply themselves.
 *
 * That is a deliberate line, and the copy is written to match it exactly —
 * the link says "stop automated follow-ups", not "never contact me". A
 * person who clicks unsubscribe on an automated nudge has not asked their
 * builder to stop answering their questions, and a product that silently
 * severed that conversation would be doing them harm in the name of
 * consent. CAN-SPAM's own exemption for relationship and transactional
 * messages draws the line in the same place.
 *
 * Every manual send to a suppressed address is still recorded in the audit
 * trail, so "who emailed someone who had unsubscribed" is answerable.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/stripe";

export type SuppressionChannel = "email";

/** Addresses are compared case-insensitively and without surrounding space. */
export function normaliseAddress(address: string): string {
  return address.trim().toLowerCase();
}

function signingSecret(): string {
  // Reuses the app's existing session secret rather than adding another
  // env var to configure: an unsubscribe token needs to be unforgeable,
  // not separately rotatable, and a deploy missing NEXTAUTH_SECRET is
  // already non-functional for far more important reasons.
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set — unsubscribe links cannot be signed.");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

/**
 * A self-contained, unguessable token identifying "this address, for this
 * business". Signed rather than random so nothing has to be stored before
 * the mail goes out, and so a token still works months later when the lead
 * row it was generated for may have been merged or deleted.
 *
 * It carries no expiry on purpose. An unsubscribe link that has quietly
 * expired is worse than no link at all: the recipient clicks it, believes
 * they are done, and keeps receiving mail.
 */
export function unsubscribeToken(businessId: string, address: string): string {
  const payload = `${businessId}:${normaliseAddress(address)}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

export function verifyUnsubscribeToken(token: string): { businessId: string; address: string } | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }

  // Constant-time, and length-checked first because timingSafeEqual throws
  // on a length mismatch rather than returning false.
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length) return null;
  if (!timingSafeEqual(expected, given)) return null;

  const sep = payload.indexOf(":");
  if (sep <= 0) return null;
  const businessId = payload.slice(0, sep);
  const address = payload.slice(sep + 1);
  if (!businessId || !address) return null;
  return { businessId, address };
}

/** The one-click URL that goes in the List-Unsubscribe header and the footer. */
export function unsubscribeUrl(businessId: string, address: string): string {
  return `${appUrl()}/api/unsubscribe?t=${unsubscribeToken(businessId, address)}`;
}

/** Has this address asked this business to stop automated email? */
export async function isSuppressed(
  businessId: string,
  address: string | null | undefined,
  channel: SuppressionChannel = "email"
): Promise<boolean> {
  if (!address) return false;
  const hit = await prisma.suppression.findUnique({
    where: {
      businessId_channel_address: { businessId, channel, address: normaliseAddress(address) },
    },
    select: { id: true },
  });
  return hit !== null;
}

export type SuppressionReason = "unsubscribe_link" | "one_click" | "manual" | "complaint";

/**
 * Records the opt-out. Idempotent: clicking the link twice, or a mail
 * client prefetching it and the human clicking it afterwards, must both
 * end in "you're unsubscribed" rather than an error.
 */
export async function suppress(
  businessId: string,
  address: string,
  reason: SuppressionReason
): Promise<void> {
  const normalised = normaliseAddress(address);
  await prisma.suppression.upsert({
    where: { businessId_channel_address: { businessId, channel: "email", address: normalised } },
    update: {},
    create: { businessId, channel: "email", address: normalised, reason },
  });
}

/**
 * Removes a suppression. Only ever called by the business owner from
 * Settings, for the case where a customer says "actually, please do keep
 * emailing me" — never automatically, and never as a side effect of the
 * lead becoming active again.
 */
export async function unsuppress(businessId: string, address: string): Promise<void> {
  await prisma.suppression.deleteMany({
    where: { businessId, channel: "email", address: normaliseAddress(address) },
  });
}

/**
 * The footer appended to automated email. Deliberately plain text and
 * deliberately specific about what it stops — a vague "unsubscribe" would
 * promise more than this honours.
 */
export function unsubscribeFooter(businessId: string, address: string): string {
  return `\n\n—\nDon't want automated follow-ups like this? ${unsubscribeUrl(businessId, address)}`;
}

/**
 * RFC 2369 + RFC 8058 headers. The Post header is what lets Gmail and
 * Outlook show their own native "Unsubscribe" button next to the sender
 * name, which is where most people actually click — and which mailbox
 * providers increasingly require of bulk senders.
 */
export function unsubscribeHeaders(businessId: string, address: string): string[] {
  const url = unsubscribeUrl(businessId, address);
  return [`List-Unsubscribe: <${url}>`, "List-Unsubscribe-Post: List-Unsubscribe=One-Click"];
}
