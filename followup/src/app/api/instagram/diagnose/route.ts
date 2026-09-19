import { NextResponse } from "next/server";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { instagramDiagnostics } from "@/lib/instagram";

/**
 * GET /api/instagram/diagnose — asks Meta three questions about this
 * business's connected Instagram account and reports the answers, so
 * "Instagram is quiet" can be split into its causes without a Graph API
 * console: which account is connected (username, account type), whether
 * Meta lists this app as subscribed to its message events, and whether
 * the token can read the account's conversations at all.
 *
 * Built on 2026-09-19 after a full afternoon of a connected account
 * producing no webhook for real DMs while Meta's own test payload arrived
 * fine. Admin-only, read-only, never returns the token.
 */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { instagramUserId: true, instagramAccessToken: true },
  });
  if (!business?.instagramAccessToken || !business.instagramUserId) {
    return NextResponse.json({ success: false, message: "Instagram isn't connected for this business." }, { status: 400 });
  }

  const report = await instagramDiagnostics(business.instagramUserId, business.instagramAccessToken);
  return NextResponse.json({ success: true, ...report });
}
