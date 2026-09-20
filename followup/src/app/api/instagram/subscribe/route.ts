import { NextResponse } from "next/server";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { activateInstagramWebhooks } from "@/lib/instagram";
import { recordAudit } from "@/lib/audit";
import { tooManyRecentActions } from "@/lib/rateLimit";

/**
 * Retry the per-account webhook subscription for an already-connected
 * Instagram account. Same shape and same reasoning as
 * /api/facebook/subscribe: the subscription can fail for reasons that
 * pass on their own — the permission is still in App Review, the account
 * briefly lost its Business status, Meta had a bad minute — and without
 * this the only way out is to disconnect and reconnect, which is a
 * strange thing to ask of someone whose token is fine. It takes no body:
 * the account and its token are already stored.
 */
export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) {
    return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  }
  // One Graph write per request, behind a button anyone can hold down.
  // Generous enough that a person retrying a genuinely failing
  // subscription never meets it, tight enough that the button is not a
  // free way to hammer Meta on the app's behalf.
  if (await tooManyRecentActions(ctx.businessId, "instagram.subscribe", { windowMinutes: 10, max: 10 })) {
    return NextResponse.json({ success: false, message: "Give it a minute before trying again." }, { status: 429 });
  }

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { instagramUserId: true, instagramAccessToken: true },
  });
  if (!business?.instagramUserId || !business.instagramAccessToken) {
    return NextResponse.json({ success: false, message: "Connect an Instagram account first." }, { status: 400 });
  }

  const subscribed = await activateInstagramWebhooks(
    ctx.businessId,
    business.instagramUserId,
    business.instagramAccessToken
  );
  void recordAudit(ctx, "integration.instagram.subscribe", {
    meta: {
      webhookSubscribed: subscribed.ok,
      ...(subscribed.ok ? {} : { webhookError: subscribed.message }),
    },
  });

  // Meta's own sentence, not a rewrite of it: it names the missing
  // permission or the account's status, which is the thing to act on.
  return NextResponse.json(
    subscribed.ok ? { success: true, receiving: true } : { success: false, receiving: false, message: subscribed.message }
  );
}
