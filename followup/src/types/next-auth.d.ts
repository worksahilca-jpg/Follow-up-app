/**
 * Type augmentation: every signed-in session carries the real User id and
 * businessId (embedded in the JWT at sign-in — see src/lib/auth.ts), not
 * just the standard name/email/image. This is what every multi-tenant
 * scoping check in the app relies on.
 */
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      businessId: string;
    } & DefaultSession["user"];
    // When the last real Google sign-in (not just "the cookie is still
    // valid") happened, in epoch ms — see authTime in src/lib/auth.ts and
    // requireRecentAuth() in src/lib/session.ts.
    authTime: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    businessId?: string;
    authTime?: number;
    // Last time businessId was re-verified against the DB — see the
    // periodic-revalidation comment in src/lib/auth.ts's jwt callback.
    checkedAt?: number;
    // Set by the jwt callback once the sign-in behind this token is older
    // than the absolute session limit — the token then carries nothing
    // else, and the session callback reports "signed out".
    expired?: boolean;
  }
}
