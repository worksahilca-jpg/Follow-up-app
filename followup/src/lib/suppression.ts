/**
 * Suppression — the opt-out for the channels `Lead.optedOutAt` doesn't cover.
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
 * Instagram and Messenger DMs had exactly the same nothing, and it mattered
 * more: they are now the product's core channels (CARRIER_CHANNELS_AVAILABLE
 * in src/lib/pricing.ts — SMS, voicemail and calls are dropped). A lead who
 * DMed "stop" kept getting automated follow-ups, and the business believed
 * they were compliant because the SMS path honours STOP. That is the worst
 * shape a compliance bug can take. `channel` covers "instagram" and
 * "messenger" now — see the key argument below.
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
 * For a DM the "address" is the platform-scoped user id — an IGSID on
 * Instagram, a PSID on Messenger — which is the strongest form of that
 * argument, not the weakest. That id is stable for a given person and a
 * given business account, and it is the only identifier the platform ever
 * gives us: there is no email, often no name, and the id is the literal
 * thing `sendInstagramMessage` addresses. FollowUp stores it inside
 * `Lead.phone` as "ig:<igsid>" / "fb:<psid>" (see src/lib/instagramId.ts),
 * so putting the opt-out on the Lead row would tie consent to a row that a
 * business owner can delete from the leads table in one tap — and the next
 * DM from that same person would rebuild the row with a clean slate and
 * start the follow-ups again. The table forgets nothing.
 *
 * `channel` (not the "ig:"/"fb:" prefix) is what separates the two
 * platforms, because the ids are separate namespaces: an IGSID and a PSID
 * can collide as strings and mean two different people. Storing the raw
 * platform id as `address` with the channel beside it is the same shape
 * the email rows already use, and it reads correctly in the unique index.
 *
 * What it blocks, and what it deliberately does not
 * ------------------------------------------------
 * EMAIL: it blocks AUTOMATED email — the silence follow-up, the unanswered
 * nudge, the reactivation batch, workflow steps, the instant
 * acknowledgement. It does NOT block a human at the business typing a reply
 * themselves.
 *
 * DMs: it blocks EVERY send on that channel, automated or manual, exactly
 * like `Lead.optedOutAt` does for SMS. The two are different because the
 * act is different. An email suppression is created by someone clicking a
 * link that says "stop automated follow-ups"; a DM suppression is created
 * by a person typing the word STOP at a business, which is the same
 * keyword, the same intent and the same expectation as the text message
 * that has always stopped everything. Honouring it half way — quietly
 * still allowing the owner to DM them — would mean the product decided it
 * knew better than the word the lead used. It is undone the same way too:
 * by them, with START (see `unsuppress`).
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
import {
  instagramRecipientId,
  isInstagramLeadId,
  isMessengerLeadId,
  messengerRecipientId,
} from "@/lib/instagramId";

/**
 * Suppression.channel is a String in the schema precisely so this list can
 * grow without a migration — adding the two DM channels needed none.
 */
export type SuppressionChannel = "email" | "instagram" | "messenger";

/** The two DM channels, where an "address" is a platform-scoped user id. */
export type DmSuppressionChannel = Extract<SuppressionChannel, "instagram" | "messenger">;

/** Addresses are compared case-insensitively and without surrounding space. */
export function normaliseAddress(address: string): string {
  return address.trim().toLowerCase();
}

/**
 * The suppression key for a lead that IS a DM thread — i.e. one whose
 * `phone` column holds an "ig:"/"fb:" pseudo-id rather than a number.
 * Returns null for anything else, which is how src/lib/sending.ts knows the
 * DM check doesn't apply to this send.
 *
 * Deliberately derived from `Lead.phone` rather than from the channel the
 * caller asked for: the recipient id the send path actually addresses comes
 * from that column, so the value we check consent for and the value we send
 * to are the same string by construction.
 */
export function dmSuppressionKey(
  phone: string | null | undefined
): { channel: DmSuppressionChannel; address: string } | null {
  if (isInstagramLeadId(phone ?? null)) return { channel: "instagram", address: instagramRecipientId(phone!) };
  if (isMessengerLeadId(phone ?? null)) return { channel: "messenger", address: messengerRecipientId(phone!) };
  return null;
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

/**
 * Has this address asked this business to stop? Automated email for
 * `channel: "email"`; everything on the channel for a DM — see the
 * "what it blocks" section above.
 */
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

/** `keyword` is a DM STOP — the lead typed it, the same way they'd text it. */
export type SuppressionReason = "unsubscribe_link" | "one_click" | "manual" | "complaint" | "keyword";

/**
 * Records the opt-out. Idempotent: clicking the link twice, or a mail
 * client prefetching it and the human clicking it afterwards, must both
 * end in "you're unsubscribed" rather than an error. Same for a lead who
 * sends STOP twice in a DM.
 */
export async function suppress(
  businessId: string,
  address: string,
  reason: SuppressionReason,
  channel: SuppressionChannel = "email"
): Promise<void> {
  const normalised = normaliseAddress(address);
  await prisma.suppression.upsert({
    where: { businessId_channel_address: { businessId, channel, address: normalised } },
    update: {},
    create: { businessId, channel, address: normalised, reason },
  });
}

/**
 * Removes a suppression.
 *
 * For EMAIL: only ever called by the business owner from Settings, for the
 * case where a customer says "actually, please do keep emailing me" — never
 * automatically, and never as a side effect of the lead becoming active
 * again.
 *
 * For a DM: also called when the lead themselves sends START or UNSTOP
 * (src/lib/inbound/meta.ts), which is the exact mirror of how a STOP got
 * them here and of what the SMS path already does with Lead.optedOutAt. An
 * opt-out nobody can undo isn't consent, it's a trap — and the person
 * undoing it here is the person who set it.
 */
export async function unsuppress(
  businessId: string,
  address: string,
  channel: SuppressionChannel = "email"
): Promise<void> {
  await prisma.suppression.deleteMany({
    where: { businessId, channel, address: normaliseAddress(address) },
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
