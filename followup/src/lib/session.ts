/**
 * The one place every session-gated server code reads "who is this, and
 * which business's data are they allowed to touch." userId/businessId
 * come straight off the JWT (see src/lib/auth.ts) — no extra DB query.
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export interface SessionContext {
  userId: string;
  businessId: string;
  email: string;
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
