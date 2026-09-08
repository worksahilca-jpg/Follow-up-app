import { NextResponse } from "next/server";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { disconnectOutlook } from "@/lib/integrations/outlook";
import { recordAudit } from "@/lib/audit";

// POST /api/integrations/outlook/disconnect — admin-only. Clears the
// stored tokens; see disconnectOutlook() for why there's no Google-style
// server-side revoke call here.
export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  await disconnectOutlook(ctx.businessId);
  void recordAudit(ctx, "integration.outlook.disconnect");
  return NextResponse.json({ success: true });
}
