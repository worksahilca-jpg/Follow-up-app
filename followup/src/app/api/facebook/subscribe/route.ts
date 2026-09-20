import { NextResponse } from "next/server";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { activateFacebookPageWebhooks } from "@/lib/facebook";
import { recordAudit } from "@/lib/audit";

/**
 * Retry the per-Page webhook subscription for an already-connected Page.
 *
 * The subscription can fail for reasons that pass on their own — the
 * permission is still in App Review, the person lost and regained their
 * role on the Page, Meta had a bad minute. Without this the only way out
 * is to disconnect and reconnect, which is a strange thing to ask of
 * someone whose Page is connected and whose token is fine. It takes no
 * body: the Page and its token are already stored.
 */
export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) {
    return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  }

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { facebookPageId: true, facebookPageAccessToken: true },
  });
  if (!business?.facebookPageId || !business.facebookPageAccessToken) {
    return NextResponse.json({ success: false, message: "Connect a Facebook Page first." }, { status: 400 });
  }

  const subscribed = await activateFacebookPageWebhooks(
    ctx.businessId,
    business.facebookPageId,
    business.facebookPageAccessToken
  );
  void recordAudit(ctx, "integration.facebook.subscribe", {
    meta: {
      pageId: business.facebookPageId,
      webhookSubscribed: subscribed.ok,
      ...(subscribed.ok ? {} : { webhookError: subscribed.message }),
    },
  });

  // Meta's own sentence, not a rewrite of it: it names the missing
  // permission or the lost Page role, which is the thing to act on.
  return NextResponse.json(
    subscribed.ok ? { success: true, receiving: true } : { success: false, receiving: false, message: subscribed.message }
  );
}
