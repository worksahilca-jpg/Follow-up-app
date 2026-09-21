import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";
import { DISMISSIBLE_SETUP_STEPS } from "@/lib/setupStatus";

/**
 * GET /api/business/setup-step — which setup steps this business has
 * skipped. Read by the Settings panels that offer to un-skip one, so a
 * skip made on Today is not a one-way door: SetupStepSkip's own comment
 * says it is reversible, and a claim in a comment the product does not
 * honour is the kind of quiet lie this codebase keeps having to undo.
 */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { dismissedSetupSteps: true },
  });
  if (!business) return NextResponse.json({ success: false, message: "Business not found." }, { status: 404 });

  return NextResponse.json({ success: true, dismissedSetupSteps: business.dismissedSetupSteps });
}

const bodySchema = z.object({
  // Only the optional-channel steps, enforced here as well as in the UI —
  // a step that must not be skippable must not become skippable by someone
  // posting its id. See DISMISSIBLE_SETUP_STEPS for why billing, business
  // details and the inbox are not on the list.
  id: z.enum(DISMISSIBLE_SETUP_STEPS as unknown as [string, ...string[]]),
  // false undoes it, so a step skipped by mistake is not skipped forever.
  dismissed: z.boolean().default(true),
});

/**
 * POST /api/business/setup-step — "this one doesn't apply to me".
 *
 * Every setup step but one clears by being done. "Add your website widget"
 * cleared only when a lead actually arrived through the widget, so a
 * business with no website could never finish setup: the strip on Today
 * asked them, forever, to do something they had no way to do.
 *
 * Deliberately not gated on billing: a business that cannot pay is still
 * allowed to tidy its own dashboard, and the billing step itself is not
 * dismissible, so this cannot be used to hide the thing that is actually
 * blocking them.
 *
 * Admin-only, like every other business-wide setting — this changes what
 * the whole team sees on Today, not just the caller's own view.
 */
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) {
    return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  }

  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const { id, dismissed } = parsed.data;

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { dismissedSetupSteps: true },
  });
  if (!business) return NextResponse.json({ success: false, message: "Business not found." }, { status: 404 });

  // Rebuilt from a Set rather than pushed, so dismissing twice cannot
  // leave the same id in the column twice.
  const next = new Set(business.dismissedSetupSteps);
  if (dismissed) next.add(id);
  else next.delete(id);

  await prisma.business.update({
    where: { id: ctx.businessId },
    data: { dismissedSetupSteps: [...next] },
  });

  void recordAudit(ctx, "business.setup_step.dismiss", {
    targetType: "business",
    targetId: ctx.businessId,
    meta: { step: id, dismissed },
  });

  return NextResponse.json({ success: true, dismissedSetupSteps: [...next] });
}
