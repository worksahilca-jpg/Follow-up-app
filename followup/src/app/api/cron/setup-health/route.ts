import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cronAuth";
import { runSetupHealth } from "@/lib/setupHealth";

export const maxDuration = 60;

/**
 * GET /api/cron/setup-health — once a day (see vercel.json).
 *
 * Tells the team when a key a live feature depends on is missing, or when
 * alert emails are due but none are going out — see src/lib/setupHealth.ts
 * for what is checked and why. Silent when everything is set.
 *
 * Protected by CRON_SECRET like every other /api/cron/* route.
 */
export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request, "setup-health");
  if (unauthorized) return unauthorized;

  try {
    const result = await runSetupHealth();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Setup check failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
