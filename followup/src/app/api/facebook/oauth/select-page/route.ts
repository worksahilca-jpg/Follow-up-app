import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";
import { activateFacebookPageWebhooks, type ManagedPage } from "@/lib/facebook";

const selectPageSchema = z.object({ pageId: z.string() });

// POST { pageId } — finalizes the OAuth picker: reads the encrypted
// pending-pages cookie set by the callback, saves the chosen Page's own
// access token, and clears the cookie either way (one-time use).
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });

  const parsed = await parseJsonBody(request, selectPageSchema);
  if (!parsed.ok) return parsed.response;
  const { pageId } = parsed.data;
  const raw = request.cookies.get("fb_pending_pages")?.value;
  if (!pageId || !raw) {
    return NextResponse.json({ success: false, message: "That sign-in expired — connect Facebook again." }, { status: 400 });
  }

  let pages: ManagedPage[];
  try {
    pages = JSON.parse(decryptSecret(raw));
  } catch {
    return NextResponse.json({ success: false, message: "That sign-in expired — connect Facebook again." }, { status: 400 });
  }
  const page = pages.find((p) => p.id === pageId);
  if (!page) return NextResponse.json({ success: false, message: "Pick one of the Pages shown." }, { status: 400 });

  try {
    await prisma.business.update({
      where: { id: ctx.businessId },
      // Cleared here, set below only if Meta actually confirms — otherwise
      // a previously-connected Page's confirmation would carry over to
      // this one and Settings would claim a subscription nobody made.
      data: {
        facebookPageAccessToken: page.accessToken,
        facebookPageId: page.id,
        facebookPageName: page.name,
        facebookWebhookSubscribedAt: null,
      },
    });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return NextResponse.json({ success: false, message: "That Facebook Page is already connected to another FollowUp account." }, { status: 409 });
    }
    throw err;
  }
  // Without this Meta delivers nothing for the Page — no Messenger DM,
  // no Lead Ad (see subscribeFacebookPageWebhooks). The connection is
  // saved regardless; the outcome is persisted so Settings can say the
  // Page is connected but not yet receiving, and offer to try again.
  const subscribed = await activateFacebookPageWebhooks(ctx.businessId, page.id, page.accessToken);
  void recordAudit(ctx, "integration.facebook.connect", {
    meta: {
      via: "oauth",
      pageId: page.id,
      webhookSubscribed: subscribed.ok,
      ...(subscribed.ok ? {} : { webhookError: subscribed.message }),
    },
  });

  const res = NextResponse.json({
    success: true,
    pageId: page.id,
    pageName: page.name,
    webhookSubscribed: subscribed.ok,
  });
  res.cookies.delete("fb_pending_pages");
  return res;
}
