import { NextResponse } from "next/server";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { disconnectGmail } from "@/lib/integrations/gmail";
import { recordAudit } from "@/lib/audit";

// POST /api/integrations/gmail/disconnect — admin-only. Revokes the
// tokens at Google and clears them here; see disconnectGmail().
export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  await disconnectGmail(ctx.businessId);
  void recordAudit(ctx, "integration.gmail.disconnect");
  return NextResponse.json({ success: true });
}
