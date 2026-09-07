import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getStripe, appUrl } from "@/lib/stripe";
import { requireAdmin } from "@/lib/session";
import { recordAudit } from "@/lib/audit";

// POST /api/billing/portal — hands back a URL to Stripe's hosted billing
// portal, where a business can update their card, view invoices, or
// cancel. Only meaningful once they've subscribed at least once (a Stripe
// customer exists).
export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  void recordAudit(ctx, "billing.portal");

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { stripeCustomerId: true },
  });
  if (!business?.stripeCustomerId) {
    return NextResponse.json(
      { success: false, message: "No billing account yet — subscribe first." },
      { status: 400 }
    );
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: business.stripeCustomerId,
      return_url: `${appUrl()}/settings`,
    });
    return NextResponse.json({ success: true, url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't open billing portal.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
