import { createHash } from "node:crypto";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { founderEmails } from "@/lib/helpAlert";
import { sendPushToUser } from "@/lib/webPush";

/**
 * Someone new is in: the founder's phone buzzes (founder, 2026-10-11: "yes
 * build the sign-up buzz too"). A new account of its own, or someone joining
 * a team through an invite link. Returning people never buzz.
 *
 * A buzz only, on every device the founders (PLATFORM_ADMIN_EMAILS) turned
 * alerts on for. The name, never the address: it shows on a locked screen.
 * Tapping it opens /admin, where the rest is. It runs after the sign-in has
 * answered and swallows its own failures, so it can never slow or stop
 * anyone signing in.
 */
export type NewSignup = {
  userEmail: string;
  name: string | null;
  businessId: string;
  /** Joined an existing team through an invite, rather than starting a business of their own. */
  joinedTeam: boolean;
};

export function signupBuzzText(name: string | null, team: string | null | false): { title: string; body: string } {
  const who = name?.trim() || "Someone new";
  if (team === false) return { title: "New sign-up", body: `${who} just signed up.` };
  return { title: "New sign-up", body: team ? `${who} joined the team at ${team}.` : `${who} joined a team.` };
}

export async function buzzFounderAboutSignup(s: NewSignup): Promise<number> {
  // Not the founders themselves signing up (a second account, a test).
  const emails = founderEmails().filter((e) => e.toLowerCase() !== s.userEmail.toLowerCase());
  if (emails.length === 0) return 0;
  const founders = await prisma.user.findMany({
    where: { email: { in: emails, mode: "insensitive" } },
    select: { id: true },
  });
  const team = s.joinedTeam
    ? ((await prisma.business.findUnique({ where: { id: s.businessId }, select: { name: true } }))?.name ?? null)
    : false;
  const words = signupBuzzText(s.name, team);
  const results = await Promise.allSettled(
    // The tag keeps a retried sign-in to one buzz; a hash, so the address isn't in it.
    founders.map((f) => sendPushToUser(f.id, { ...words, url: "/admin", tag: `signup-${signupTag(s.userEmail)}` }))
  );
  return results.filter((r) => r.status === "fulfilled" && r.value.delivered > 0).length;
}

function signupTag(email: string): string {
  return createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 16);
}

/** Called from the sign-in callback: schedules the buzz after the response. */
export async function tellFounderAboutSignup(s: NewSignup): Promise<void> {
  const work = () =>
    buzzFounderAboutSignup(s)
      .then(() => undefined)
      .catch((err) => console.error("Sign-up buzz failed:", err instanceof Error ? err.message : "unknown error"));
  try {
    after(work);
  } catch {
    await work();
  }
}
