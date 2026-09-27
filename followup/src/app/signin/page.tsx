import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { readInviteCookie } from "@/lib/inviteToken";
import SignInClient from "@/components/landing/SignInClient";

// A signed-in user landing here (stale bookmark, back button, clicking
// "Get started" again with a live session already in the browser) used to
// still see the "Continue with Google" screen — clicking it re-triggered
// the full OAuth round trip, which for a returning user with an active
// Google session completes almost instantly, making it *look* like the
// click "skipped straight to the dashboard." Checking the session here,
// server-side, before any client UI mounts, means a genuinely signed-in
// user never sees this screen at all — no confusing double round trip.
// (app)/layout.tsx does the equivalent check in the other direction: no
// session there redirects back to here.
export default async function SignInPage() {
  const ctx = await getSessionContext();
  if (ctx) redirect("/dashboard");

  // This browser opened a team-invite link (/api/invite/accept), so the
  // sign-in below may join that team. Say which one, from the database —
  // never from the URL, which anyone can write (security audit 2026-09-26).
  const invite = await readInviteCookie();
  const inviteBusinessName = invite
    ? ((
        await prisma.invite
          .findUnique({ where: { id: invite.inviteId }, select: { business: { select: { name: true } } } })
          .catch(() => null)
      )?.business.name ?? null)
    : null;

  return <SignInClient inviteBusinessName={inviteBusinessName} />;
}
