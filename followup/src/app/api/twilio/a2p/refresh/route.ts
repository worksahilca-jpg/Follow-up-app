import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { refreshA2pStatus } from "@/lib/integrations/twilioA2p";

/**
 * POST /api/twilio/a2p/refresh — polls Twilio for this business's current
 * Brand/Campaign vetting status (async, can take minutes to weeks — see
 * research/integrations/2026-09-08-twilio-a2p-self-serve-api-scoping.md)
 * and updates the stored rollup. No admin gate (unlike save/submit): this
 * only reads Twilio's own state and writes it back, nothing a non-admin
 * teammate could misuse.
 */
export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  try {
    const reg = await refreshA2pStatus(ctx.businessId);
    if (!reg) return NextResponse.json({ success: true, status: "not_started" });
    return NextResponse.json({
      success: true,
      status: reg.status,
      brandStatus: reg.brandStatus,
      campaignStatus: reg.campaignStatus,
      rejectionReason: reg.rejectionReason,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Twilio didn't respond." },
      { status: 502 }
    );
  }
}
