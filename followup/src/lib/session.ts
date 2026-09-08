/**
 * The one place every session-gated server code reads "who is this, and
 * which business's data are they allowed to touch." userId/businessId
 * come straight off the JWT (see src/lib/auth.ts) — no extra DB query.
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export interface SessionContext {
  userId: string;
  businessId: string;
  email: string;
  // Epoch ms of the last real Google sign-in behind this session — see
  // authTime in src/lib/auth.ts. Backs hasRecentAuth() below.
  authTime: number;
}

// Google sign-in is the only credential this app has (no password), so
// "recent auth" means "actually went through Google's login screen again
// in the last few minutes" — not a password re-prompt. Reserved for the
// handful of actions where a still-valid session cookie genuinely isn't
// enough: rotating a secret that immediately revokes the old one, or
// permanently deleting a business.
const REAUTH_WINDOW_MS = 5 * 60 * 1000;

export function hasRecentAuth(ctx: SessionContext): boolean {
  return Date.now() - ctx.authTime < REAUTH_WINDOW_MS;
}

/**
 * Role gate for account-level settings (integrations, billing, team,
 * automation defaults, bulk deletes). Looked up fresh rather than trusted
 * from the JWT so a demotion takes effect on the next request, not at
 * token expiry.
 */
export async function requireAdmin(ctx: SessionContext): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { role: true, businessId: true } });
  return !!user && user.businessId === ctx.businessId && user.role === "ADMIN";
}

export async function getSessionContext(): Promise<SessionContext | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.businessId || !session.user.email) return null;
  return {
    userId: session.user.id,
    businessId: session.user.businessId,
    email: session.user.email,
    authTime: session.authTime ?? 0,
  };
}
