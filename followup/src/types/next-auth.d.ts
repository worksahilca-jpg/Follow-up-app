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
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    businessId?: string;
  }
}
