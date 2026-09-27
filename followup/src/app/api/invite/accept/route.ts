import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/stripe";
import {
  INVITE_COOKIE,
  INVITE_COOKIE_MAX_AGE_SECONDS,
  inviteCookieValue,
  inviteTokenMatches,
} from "@/lib/inviteToken";
import { inviteWindowStart } from "@/lib/auth";

/**
 * GET /api/invite/accept?i=<inviteId>&t=<token> — the team-invite link.
 *
 * Public: the invitee has no account yet. Checks the link belongs to a
 * live invite (the token is an HMAC over the invite id and the invited
 * address, src/lib/inviteToken.ts), remembers it in a short-lived httpOnly
 * cookie, and sends them to sign in. Joining happens there, in the
 * sign-in callback, and only if the Google account's address is the one
 * the invite names — so a forwarded link is useless to anyone else.
 *
 * Every failure looks the same from outside ("that link isn't valid"), so
 * the route cannot be used to learn which invites exist.
 */
export async function GET(request: NextRequest) {
  const inviteId = request.nextUrl.searchParams.get("i") ?? "";
  const token = request.nextUrl.searchParams.get("t") ?? "";
  const invalid = () => NextResponse.redirect(new URL("/signin?error=InviteInvalid", appUrl()));

  if (!inviteId || !token) return invalid();

  const invite = await prisma.invite.findUnique({
    where: { id: inviteId },
    select: { id: true, email: true, createdAt: true },
  }).catch(() => null);
  if (!invite) return invalid();
  // The same window sign-in uses, from the same function.
  if (invite.createdAt < inviteWindowStart()) return invalid();
  if (!inviteTokenMatches(invite.id, invite.email, token)) return invalid();

  const res = NextResponse.redirect(new URL("/signin?invite=1", appUrl()));
  res.cookies.set(INVITE_COOKIE, inviteCookieValue(invite.id, token), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: INVITE_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
  return res;
}
