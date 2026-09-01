/**
 * NextAuth configuration — Google sign-in.
 *
 * This is a separate concern from Gmail *data* access
 * (src/lib/integrations/gmail.ts): this only proves who's signing into the
 * app. It reuses the same Google OAuth client (same GOOGLE_CLIENT_ID/
 * SECRET) since we already have one, but requests only basic profile/email
 * scopes — no Gmail scopes here. Uses JWT sessions (no database
 * Account/Session tables) and upserts into our own existing User/Business
 * tables on sign-in, the same find-or-create pattern gmail.ts's OAuth
 * callback already uses.
 *
 * ALLOWED_EMAILS gates who can sign in at all — without it, anyone with a
 * Google account could log into your app and see your real leads. Set it
 * to a comma-separated list of the email(s) allowed to sign in.
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

      let business = await prisma.business.findFirst();
      if (!business) {
        business = await prisma.business.create({ data: { name: "My Business" } });
      }

      await prisma.user.upsert({
        where: { email },
        update: { name: user.name ?? undefined, businessId: business.id },
        create: { email, name: user.name ?? undefined, businessId: business.id, role: "ADMIN" },
      });

      return true;
    },
    async session({ session }) {
      if (session.user?.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
        if (dbUser) {
          (session.user as typeof session.user & { id: string }).id = dbUser.id;
        }
      }
      return session;
    },
  },
};
