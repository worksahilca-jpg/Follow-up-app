import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cronAuth";
import { keepWarm } from "@/lib/keepWarm";
import { inboundBaseUrl } from "@/lib/siteUrl";

// Ten pages at once, each given 10 s at most.
export const maxDuration = 30;

/**
 * GET /api/cron/keep-warm — every 3 minutes (vercel.json), opens the pages
 * owners use so none of them is asleep when an owner taps it
 * (src/lib/keepWarm.ts). The public address, not the apex: Vercel
 * redirects the apex to www at its edge, so a visit there would never
 * reach a page (see inboundBaseUrl).
 *
 * Protected by CRON_SECRET like every other /api/cron/* route (see
 * src/lib/cronAuth.ts).
 */
export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request, "keep-warm");
  if (unauthorized) return unauthorized;

  const pages = await keepWarm(inboundBaseUrl());
  return NextResponse.json({ success: true, pages });
}
