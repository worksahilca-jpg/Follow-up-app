/**
 * NextAuth configuration — Google sign-in, and the actual multi-tenant
 * signup moment.
 *
 * This is a separate concern from Gmail *data* access
 * (src/lib/integrations/gmail.ts): this only proves who's signing into the
 * app. It reuses the same Google OAuth client (same GOOGLE_CLIENT_ID/
 * SECRET) since we already have one, but requests only basic profile/email
 * scopes — no Gmail scopes here.
 *
 * Multi-tenancy: a brand-new email signing in gets its OWN new Business —
 * that's the real "signup" — UNLESS someone already invited that exact
 * email to their team (see the Invite model / src/lib/team.ts), in which
 * case they join that business instead, at whatever role the invite named.
 * A returning email is attached to whatever business it already belongs
 * to; one that was removed from its team (businessId null — see
 * removeMember() in team.ts) is re-checked for a pending invite the same
 * way, and falls back to a fresh new business if there isn't one, so
 * nobody is ever permanently locked out. businessId + userId are embedded
 * in the JWT here so every server-side request can scope its data without
 * an extra DB round-trip — see src/lib/session.ts.
 *
 * ALLOWED_EMAILS gates who can sign in AT ALL, across every business —
 * useful while this is still private/in testing. Leave it empty once
 * you're ready for real strangers to sign up as their own tenants.
 */

import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/db";

const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// A session cookie is good for a week at most — after that, sign in again.
// Down from NextAuth's 30-day default: this app holds other people's
// conversations, so a stolen or forgotten-open cookie shouldn't stay a
// live credential for a month.
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

// How often a still-valid session gets its businessId re-checked against
// the DB (see the jwt callback below) — bounds how long someone removed
// from their team (removeMember() in team.ts sets businessId to null) can
// keep using an already-issued token, without paying a DB round trip on
// every single request the way a check-every-time approach would.
const REVALIDATE_INTERVAL_MS = 5 * 60 * 1000;

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const email = user.email.toLowerCase();

      if (allowedEmails.length > 0 && !allowedEmails.includes(email)) {
        return false; // not on the allowlist — reject the sign-in
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        // Returning user with a business already — nothing to create. If
        // their name changed on Google's side, keep it fresh.
        if (existing.businessId) {
          if (user.name && user.name !== existing.name) {
            await prisma.user.update({ where: { id: existing.id }, data: { name: user.name } });
          }
          return true;
        }

        // Existing but team-less (removed from a business — see
        // removeMember() in team.ts): falls through to the invite check
        // below, exactly like a brand-new signup, just updating the row
        // instead of creating one.
      }

      // Either a brand-new email, or a returning one with no business.
      // Someone may already have invited this exact email to their
      // team — join that business at the invited role instead of
      // spinning up a new one, and consume the invite either way.
      const pendingInvite = await prisma.invite.findFirst({ where: { email } });

      const businessId = pendingInvite
        ? pendingInvite.businessId
        : (
            await prisma.business.create({
              data: {
                name: user.name ? `${user.name}'s Business` : "My Business",
                // Follow-up is on from day one (see AutomationTier in
                // schema.prisma): the master switch exists so an owner can
                // turn it OFF, not something they have to discover to turn on.
                automations: {
                  create: [
                    { name: "Auto follow-up on silence", action: "auto_send", enabled: true, triggerDays: 5 },
                    { name: "Instant reply to new leads", action: "instant_ack", enabled: true, triggerDays: 0 },
                    { name: "Reply for me when I haven't", action: "unanswered_reply", enabled: true, triggerDays: 1, triggerHours: 24 },
                  ],
                },
              },
            })
          ).id;
      const role = pendingInvite ? pendingInvite.role : "ADMIN";

      if (existing) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { businessId, role, name: user.name ?? existing.name },
        });
      } else {
        await prisma.user.create({
          data: { email, name: user.name ?? undefined, businessId, role },
        });
      }
      if (pendingInvite) {
        await prisma.invite.delete({ where: { id: pendingInvite.id } });
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        // `user` is only present right after a real round-trip through
        // Google's own sign-in screen just completed — not on the
        // thousands of ordinary requests that merely reuse an existing
        // cookie. Stamping it here is what lets requireRecentAuth()
        // (src/lib/session.ts) tell "this session was actively re-proven
        // N minutes ago" from "this cookie has just been sitting in a
        // browser for days" — the step-up check before rotating a secret
        // or deleting a business.
        token.authTime = Date.now();
      }

      // Re-derived right after sign-in (when `user` is present) AND
      // retried on every later request as long as businessId is still
      // missing from the token — a token that never got it on that first
      // pass (a transient DB hiccup, timing) used to be stuck that way for
      // the token's whole lifetime, since this used to only ever run once:
      // signed in with Google successfully, but permanently bounced back
      // to /signin with no error, because getSessionContext() requires
      // businessId and nothing ever gave it a second chance to appear.
      // Once businessId is set, this is a no-op fast path on every future
      // request, same as before — no extra DB hit for the common case.
      const email = user?.email ?? token.email;
      if (!token.businessId && email) {
        const dbUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        if (dbUser?.businessId) {
          token.userId = dbUser.id;
          token.businessId = dbUser.businessId;
          token.checkedAt = Date.now();
        }
        return token;
      }

      // Periodic revalidation: without this, a user removed from their
      // team (businessId set to null — removeMember() in team.ts) or
      // whose whole business was deleted (src/lib/businessData.ts) keeps
      // an already-issued token that still claims the old businessId for
      // as long as the token itself is valid — up to SESSION_MAX_AGE_SECONDS.
      // Re-checking here on a short interval instead of trusting the token
      // forever bounds that exposure window to REVALIDATE_INTERVAL_MS,
      // while keeping the common case (checked within the last few
      // minutes) a zero-DB-hit no-op, same as before this existed.
      const lastChecked = typeof token.checkedAt === "number" ? token.checkedAt : 0;
      if (token.userId && Date.now() - lastChecked > REVALIDATE_INTERVAL_MS) {
        const dbUser = await prisma.user.findUnique({ where: { id: token.userId }, select: { businessId: true } });
        if (!dbUser?.businessId) {
          // Removed from their team, or the user row itself is gone —
          // strip the claims that grant data access. getSessionContext()
          // treats a token with no businessId as "not signed in."
          token.userId = undefined;
          token.businessId = undefined;
        } else {
          token.businessId = dbUser.businessId;
        }
        token.checkedAt = Date.now();
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId && token.businessId) {
        session.user.id = token.userId;
        session.user.businessId = token.businessId;
      }
      session.authTime = token.authTime ?? 0;
      return session;
    },
  },
};
