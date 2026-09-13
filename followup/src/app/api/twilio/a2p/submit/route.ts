import { NextResponse } from "next/server";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { requireActiveBilling, BILLING_LOCKED_MESSAGE } from "@/lib/billing";
import { recordAudit } from "@/lib/audit";
import { isA2pAvailable, submitA2pRegistration } from "@/lib/integrations/twilioA2p";

/**
 * POST /api/twilio/a2p/submit — submits the already-saved business/campaign
 * data (see /api/twilio/a2p) to Twilio: Secondary Customer Profile -> Brand.
 * Billing-gated like every other route that triggers a real third-party
 * API call on the business's behalf, even though Starter Brand itself is
 * free to the business at Twilio's end — the gate is about FollowUp's own
 * access rule (no trial-expired business gets to trigger outbound calls to
 * anything), not about who eventually pays Twilio.
 */
export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: BILLING_LOCKED_MESSAGE }, { status: 402 });
  }

  if (!isA2pAvailable()) {
    return NextResponse.json({
      success: false,
      message:
        "A2P registration isn't available yet — FollowUp's own Twilio ISV approval is still pending. Your details are saved; this will unlock automatically once that lands.",
    });
  }

  void recordAudit(ctx, "integration.twilio_a2p.submit");
  try {
    const reg = await submitA2pRegistration(ctx.businessId);
    return NextResponse.json({ success: true, status: reg.status, brandStatus: reg.brandStatus });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Twilio rejected the submission." },
      { status: 502 }
    );
  }
}
