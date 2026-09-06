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

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  session: { strategy: "jwt" },
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
                  create: { name: "Auto follow-up on silence", action: "auto_send", enabled: true, triggerDays: 5 },
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
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId && token.businessId) {
        session.user.id = token.userId;
        session.user.businessId = token.businessId;
      }
      return session;
    },
  },
};
