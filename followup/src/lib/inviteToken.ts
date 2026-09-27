/**
 * The invite link: proof that the person signing in came through the
 * invitation, not merely that someone once typed their address.
 *
 * ## Why (security audit 2026-09-16 H-2, fixed 2026-09-26)
 *
 * Sign-in used to join a new account to whichever business had a pending
 * invite for that email, silently. The invite is created by a third party
 * — any admin of any business — without the invitee doing anything, so an
 * admin could pre-claim an address: the day that person first signed in
 * (as an approved tester, say, meaning to set up their own workspace) they
 * landed inside the stranger's business instead, as an ADMIN if the invite
 * said so, and everything they then connected or entered — their Gmail
 * inbox, their leads — belonged to that tenant.
 *
 * Now joining needs the link. The link carries an HMAC over the invite id
 * and the invited address, keyed with NEXTAUTH_SECRET, so it cannot be
 * made up and only works for the address it was issued to. Opening it
 * sets a short-lived httpOnly cookie; the sign-in callback joins the team
 * only when that cookie names a live invite for the signing-in address.
 *
 * Stateless on purpose: no migration, nothing new to store or to leak.
 * Cancelling the invite (deleting the row) kills the link with it.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { appUrl } from "@/lib/stripe";

export const INVITE_COOKIE = "fu_invite";
export const INVITE_COOKIE_MAX_AGE_SECONDS = 60 * 60; // an hour to finish signing in

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/; // base64url SHA-256

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  // Same stance as the unsubscribe signer: no secret, no links. A link
  // signed with a guessable key would be worse than none.
  if (!s) throw new Error("NEXTAUTH_SECRET is not set — invite links cannot be signed.");
  return s;
}

export function inviteToken(inviteId: string, email: string): string {
  return createHmac("sha256", secret()).update(`invite:v1:${inviteId}:${email.trim().toLowerCase()}`).digest("base64url");
}

export function inviteTokenMatches(inviteId: string, email: string, token: string): boolean {
  if (!ID_RE.test(inviteId) || !TOKEN_RE.test(token)) return false;
  const expected = Buffer.from(inviteToken(inviteId, email));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** The link an admin shares; it lands on /api/invite/accept. */
export function inviteLink(inviteId: string, email: string): string {
  const url = new URL("/api/invite/accept", appUrl());
  url.searchParams.set("i", inviteId);
  url.searchParams.set("t", inviteToken(inviteId, email));
  return url.toString();
}

export function inviteCookieValue(inviteId: string, token: string): string {
  return `${inviteId}.${token}`;
}

export function parseInviteCookie(value: string | undefined | null): { inviteId: string; token: string } | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const inviteId = value.slice(0, dot);
  const token = value.slice(dot + 1);
  if (!ID_RE.test(inviteId) || !TOKEN_RE.test(token)) return null;
  return { inviteId, token };
}

/**
 * The invite cookie on the request being handled, if any. Read through
 * next/headers, which only works inside a request (the NextAuth route
 * handler is one); anywhere else there is simply no cookie.
 */
export async function readInviteCookie(): Promise<{ inviteId: string; token: string } | null> {
  try {
    const { cookies } = await import("next/headers");
    return parseInviteCookie((await cookies()).get(INVITE_COOKIE)?.value);
  } catch {
    return null;
  }
}
