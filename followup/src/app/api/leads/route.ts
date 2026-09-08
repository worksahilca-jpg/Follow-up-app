import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, BILLING_LOCKED_MESSAGE } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { pickAssignee } from "@/lib/assignment";
import { notifyLeadEvent } from "@/lib/outboundWebhook";
import { applySourceRouting } from "@/lib/sourceRouting";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { cleanedText, EMAIL_RE, parseJsonBody } from "@/lib/validation";

const MAX_TEXT = 200;

// Signed-in, manually-typed input — still forgiving of a stray wrong type
// (cleanedText degrades to "" instead of rejecting), since the real
// validation that matters (name required, email shaped like an email) is
// business logic below, same as before this schema existed.
const manualLeadSchema = z.object({
  name: cleanedText(MAX_TEXT),
  company: cleanedText(MAX_TEXT),
  email: cleanedText(MAX_TEXT),
  phone: cleanedText(40),
  source: cleanedText(MAX_TEXT),
  notes: cleanedText(2000),
  dealValue: z.coerce.number().catch(0),
});

// POST /api/leads — manual lead entry. Businesses that haven't connected
// Gmail (or that get leads from a channel we don't sync yet) still need a
// way to get a lead into the system, so this is the same Lead row Gmail
// sync would have created, just typed in by hand instead of parsed from an
// inbox. Not AI-scored on creation — score/scoreReason stay at their
// defaults until a real sync or scoring pass touches this lead.
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (await tooManyRecentActions(ctx.businessId, "leads.create", { windowMinutes: 10, max: 100 })) return NextResponse.json({ success: false, message: "Too many requests — try again in a few minutes." }, { status: 429 });
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: BILLING_LOCKED_MESSAGE }, { status: 402 });
  }

  const parsed = await parseJsonBody(request, manualLeadSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const name = body.name;
  if (!name) {
    return NextResponse.json({ success: false, message: "Name is required." }, { status: 400 });
  }

  const company = body.company;
  const email = body.email.toLowerCase();
  const phone = body.phone;
  const source = body.source || "Manual entry";
  const notes = body.notes;
  const dealValue = Math.max(0, body.dealValue);

  if (email && !EMAIL_RE.test(email)) {
    return NextResponse.json({ success: false, message: "That email doesn't look right." }, { status: 400 });
  }

  try {
    const lead = await prisma.lead.create({
      data: {
        businessId: ctx.businessId,
        name,
        company: company || null,
        email: email || null,
        phone: phone || null,
        source,
        notes: notes || null,
        dealValue,
        // Auto-routed to whoever on the team currently has the fewest
        // leads — see src/lib/assignment.ts. Reassignable afterward from
        // the lead's own page.
        assignedToId: await pickAssignee(ctx.businessId),
      },
    });
    void notifyLeadEvent(ctx.businessId, "lead.created", lead);
    await applySourceRouting(ctx.businessId, lead.id, source);
    return NextResponse.json({ success: true, id: lead.id });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { success: false, message: "You already have a lead with this email." },
        { status: 409 }
      );
    }
    throw err;
  }
}
