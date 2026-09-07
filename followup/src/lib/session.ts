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
  };
}
