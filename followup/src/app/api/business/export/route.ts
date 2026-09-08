import { NextResponse } from "next/server";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { exportBusinessData } from "@/lib/businessData";
import { recordAudit } from "@/lib/audit";

// GET /api/business/export — hands back every row this business's data
// actually lives in (leads, conversations, deals, tasks, bookings,
// sequences, team, audit trail, ...), as one downloadable JSON file.
// Admin-only, since this is the whole business's data rather than just the
// caller's own, and deliberately not gated on billing — the right to get
// your own data back doesn't lapse just because a card on file did. See
// exportBusinessData() in src/lib/businessData.ts for exactly what's
// included and what's deliberately left out (credentials, never).
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) {
    return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  }

  const data = await exportBusinessData(ctx.businessId);
  if (!data) return NextResponse.json({ success: false, message: "Business not found." }, { status: 404 });

  void recordAudit(ctx, "business.export");

  const filename = `followup-export-${ctx.businessId}-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
