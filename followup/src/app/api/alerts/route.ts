import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { parseJsonBody } from "@/lib/validation";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { isAlertEmailConfigured } from "@/lib/alertEmail";
import { isPushConfigured, vapidPublicKey } from "@/lib/webPush";

// GET /api/alerts — the signed-in person's own alert settings, for the
// Alerts block in Settings (src/components/AlertsSection.tsx).
//
// `available` is whether the server has the channel's keys at all. The
// block hides a channel that is not set up rather than showing a switch
// that does nothing — an "on" that sends nothing is a promise FollowUp is
// not keeping. The VAPID public key rides along because the browser needs
// it to subscribe; it is public by design (it is inside every
// subscription the browser makes).
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { alertEmailEnabled: true } });
  if (!user) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  return NextResponse.json({
    success: true,
    email: { available: isAlertEmailConfigured(), enabled: user.alertEmailEnabled },
    push: { available: isPushConfigured(), publicKey: vapidPublicKey() },
  });
}

const prefsSchema = z.object({ emailEnabled: z.boolean() }).strict();

// PATCH /api/alerts — { emailEnabled }. Per person: one owner turning
// their emails off does not turn anyone else's off.
export async function PATCH(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  if (await tooManyRecentActions(ctx.businessId, `alerts.prefs:${ctx.userId}`, { windowMinutes: 10, max: 30 })) {
    return NextResponse.json({ success: false, message: "Too many requests — try again in a few minutes." }, { status: 429 });
  }

  const parsed = await parseJsonBody(request, prefsSchema);
  if (!parsed.ok) return parsed.response;

  await prisma.user.update({ where: { id: ctx.userId }, data: { alertEmailEnabled: parsed.data.emailEnabled } });
  return NextResponse.json({ success: true, emailEnabled: parsed.data.emailEnabled });
}
