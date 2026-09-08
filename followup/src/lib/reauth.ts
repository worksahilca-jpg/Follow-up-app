import { NextResponse } from "next/server";
import { hasRecentAuth, type SessionContext } from "@/lib/session";

/**
 * Step-up gate for the handful of routes where a still-valid session
 * cookie isn't enough on its own: rotating a secret that immediately
 * revokes the old one, or permanently deleting a business. Returns a 401
 * the client recognizes and reacts to by forcing a fresh Google sign-in
 * (see handleReauthRequired in src/lib/reauthClient.ts) — or null when the
 * caller may proceed.
 */
export function requireRecentAuth(ctx: SessionContext): NextResponse | null {
  if (hasRecentAuth(ctx)) return null;
  return NextResponse.json(
    { success: false, code: "REAUTH_REQUIRED", message: "For your security, please sign in again to confirm." },
    { status: 401 }
  );
}
