import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cronAuth";
import { reportCronFailure } from "@/lib/monitoring";
import { runSetupHealth } from "@/lib/setupHealth";
import { refreshAllInstagramTokens } from "@/lib/instagramTokenRefresh";
import { sendStuckTesters } from "@/lib/stuckTesters";
import { sendReconnectReminders } from "@/lib/reconnectReminders";

export const maxDuration = 60;

/**
 * GET /api/cron/setup-health — once a day (see vercel.json).
 *
 * Tells the team when a key a live feature depends on is missing, or when
 * alert emails are due but none are going out — see src/lib/setupHealth.ts
 * for what is checked and why. Silent when everything is set.
 *
 * Also renews every connected Instagram account's 60-day token (see
 * src/lib/instagramTokenRefresh.ts). Daily upkeep with no schedule of its
 * own worth a separate cron entry; run first and on its own, so a failure
 * in either never stops the other.
 *
 * And emails the founder the testers who are stuck short of their first
 * sent reply (src/lib/stuckTesters.ts), quiet when there are none. Also on
 * its own, for the same reason.
 *
 * And reminds owners whose Gmail or Outlook still needs reconnecting, 2 days and 7 days after it stopped
 * (src/lib/reconnectReminders.ts). Also on its own.
 *
 * Protected by CRON_SECRET like every other /api/cron/* route.
 */
export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request, "setup-health");
  if (unauthorized) return unauthorized;

  const instagramTokens = await refreshAllInstagramTokens().catch((err) => {
    reportCronFailure("setup-health", err, "instagram token renewal");
    return null;
  });

  const stuckTesters = await sendStuckTesters().catch((err) => {
    reportCronFailure("setup-health", err, "stuck testers email");
    return null;
  });

  const reconnectReminders = await sendReconnectReminders().catch((err) => {
    reportCronFailure("setup-health", err, "reconnect reminders");
    return null;
  });

  try {
    const result = await runSetupHealth();
    return NextResponse.json({ success: true, ...result, instagramTokens, stuckTesters, reconnectReminders });
  } catch (err) {
    reportCronFailure("setup-health", err);
    const message = err instanceof Error ? err.message : "Setup check failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
