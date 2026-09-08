import { NextRequest, NextResponse } from "next/server";
import { recordAuthFailure } from "@/lib/monitoring";

/**
 * The CRON_SECRET check every /api/cron/* route runs first — was
 * duplicated five times identically before this; centralized so a change
 * to it (or to what gets reported) only has one place to make. Returns a
 * ready-to-return 401 response on failure, or null when the request is
 * genuinely from Vercel Cron (or anyone else who knows CRON_SECRET).
 *
 * Route name is passed in explicitly (rather than read off the request)
 * so the Sentry event names which cron job was hit without depending on
 * Next's internal route-matching being available this early.
 */
export function requireCronSecret(request: NextRequest, route: string): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    recordAuthFailure("cron_secret", { route });
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  return null;
}
