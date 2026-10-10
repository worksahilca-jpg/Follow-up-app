import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { isAlertEmailConfigured, sendAlertEmail } from "@/lib/alertEmail";
import { renderNoticeEmailHtml, noticeDate } from "@/lib/noticeEmailHtml";
import { inboundBaseUrl } from "@/lib/siteUrl";
import { ALERTS_SETUP_PATH } from "@/lib/alertsSetup";

// POST /api/alerts/phone-link — "Email me the link instead" (A-216).
// Setup on a computer hands alerts over to the phone. The code on screen
// is one way; this is the other: the link, emailed to the person's own
// sign-in address, to open on their phone.
//
// Only ever to the signed-in person's own address (no address is taken
// from the request), and a few times an hour at most.
export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!isAlertEmailConfigured()) {
    return NextResponse.json({ success: false, message: "FollowUp can't send email yet." }, { status: 503 });
  }
  if (await tooManyRecentActions(ctx.businessId, `alerts.phone-link:${ctx.userId}`, { windowMinutes: 60, max: 3 })) {
    return NextResponse.json({ success: false, message: "We've sent it a few times already. Check your inbox, or try again later." }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { email: true } });
  if (!user?.email) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const base = inboundBaseUrl();
  const link = `${base}${ALERTS_SETUP_PATH}`;
  const how = "Open this email on your phone and tap the button. If it asks, sign in with the same Google account.";
  const sent = await sendAlertEmail({
    to: user.email,
    subject: "Turn on FollowUp alerts on your phone",
    text: ["Get a buzz on your phone when a customer needs you.", "", how, "", link].join("\n"),
    html: renderNoticeEmailHtml({
      base,
      label: "Alerts",
      title: "Turn on alerts on your phone",
      date: noticeDate(new Date(), "America/New_York"),
      before: ["Get a buzz on your phone when a customer needs you."],
      after: [how],
      button: { text: "Turn on alerts", href: link },
      footnote: "You asked for this link in FollowUp.",
    }),
  });
  if (!sent.sent) {
    return NextResponse.json({ success: false, message: "Couldn't send the email. Try again." }, { status: 502 });
  }
  return NextResponse.json({ success: true, to: user.email });
}
