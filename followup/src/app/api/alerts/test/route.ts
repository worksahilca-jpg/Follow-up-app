import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { parseJsonBody } from "@/lib/validation";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { isAllowedPushEndpoint, isPushConfigured, sendPushToUser } from "@/lib/webPush";

const testSchema = z.object({ endpoint: z.string().max(2048).refine(isAllowedPushEndpoint, "Not a browser push address.") }).strict();

// POST /api/alerts/test — { endpoint }. "Did your phone buzz?": one real
// alert to the device that just turned alerts on (A-216), so the owner
// knows it works before a customer depends on it.
//
// Only to that one device, and only if it is the signed-in person's own:
// a test never reaches anyone else's phone, and a stranger's endpoint gets
// the same answer as one that isn't registered.
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!isPushConfigured()) {
    return NextResponse.json({ success: false, message: "FollowUp alerts aren't set up yet." }, { status: 503 });
  }
  if (await tooManyRecentActions(ctx.businessId, `alerts.test:${ctx.userId}`, { windowMinutes: 10, max: 6 })) {
    return NextResponse.json({ success: false, message: "That's a lot of tests. Try again in a few minutes." }, { status: 429 });
  }

  const parsed = await parseJsonBody(request, testSchema);
  if (!parsed.ok) return parsed.response;

  const mine = await prisma.pushSubscription.findFirst({
    where: { endpoint: parsed.data.endpoint, userId: ctx.userId },
    select: { id: true },
  });
  if (!mine) {
    return NextResponse.json({ success: false, message: "Alerts aren't on for this device yet." }, { status: 404 });
  }

  const result = await sendPushToUser(
    ctx.userId,
    { title: "Alerts are on", body: "This is how you’ll hear when a customer needs you.", url: "/dashboard", tag: "alerts-test" },
    { endpoint: parsed.data.endpoint }
  );
  if (result.delivered === 0) {
    return NextResponse.json({ success: false, message: "Couldn't reach this device. Try again." }, { status: 502 });
  }
  return NextResponse.json({ success: true });
}
