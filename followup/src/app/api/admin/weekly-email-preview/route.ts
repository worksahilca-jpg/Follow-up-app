import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/integrations/gmail";
import { gatherWeeklyDigest, renderWeeklyDigest } from "@/lib/weeklyDigest";
import { appUrl } from "@/lib/stripe";
import { tooManyRecentActions } from "@/lib/rateLimit";

/**
 * GET /api/admin/weekly-email-preview — sends the signed-in founder this
 * week's Monday email for their own business, now, through the real send
 * path (the same render, the same Gmail call, the logo carried inside the
 * message).
 *
 * Why it exists: three hand-made samples of the email were sent through a
 * different mail tool on 2026-09-28 to check dark mode, and that tool could
 * not attach the logo the way FollowUp does. The only honest check of the
 * email is the email FollowUp itself sends, and the cron sends it once a
 * week. A GET so it can be opened from a phone.
 *
 * Platform admins only (PLATFORM_ADMIN_EMAILS, fails closed), and only ever
 * to the signed-in address: it cannot send anything to anyone else. Once
 * every two minutes, so a reloaded tab is not a second email. Independent
 * of the cron's weekly claim: it neither takes nor reads it.
 */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx || !isPlatformAdmin(ctx.email)) return NextResponse.json({ success: false, message: "Not found." }, { status: 404 });

  if (await tooManyRecentActions(ctx.businessId, "weekly_email_preview", { windowMinutes: 2, max: 1 })) {
    return NextResponse.json({ success: false, message: "One was just sent. Wait two minutes before sending another." }, { status: 429 });
  }

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { id: true, name: true, timezone: true },
  });
  if (!business) return NextResponse.json({ success: false, message: "Not found." }, { status: 404 });

  const { subject, text, html, inlineImages } = renderWeeklyDigest(await gatherWeeklyDigest(business, appUrl()));
  const result = await sendEmail(business.id, { to: ctx.email, subject: `Preview: ${subject}`, body: text, html, inlineImages });
  if (!result.success) {
    return NextResponse.json({ success: false, message: result.message ?? "Gmail didn't confirm the send." }, { status: 502 });
  }
  return NextResponse.json({ success: true, message: `Sent to ${ctx.email}. Check your inbox.` });
}
