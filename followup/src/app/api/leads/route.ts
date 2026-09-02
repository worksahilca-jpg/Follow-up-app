import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, BILLING_LOCKED_MESSAGE } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { pickAssignee } from "@/lib/assignment";

const MAX_TEXT = 200;

function cleanText(value: unknown, max = MAX_TEXT): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

// POST /api/leads — manual lead entry. Businesses that haven't connected
// Gmail (or that get leads from a channel we don't sync yet) still need a
// way to get a lead into the system, so this is the same Lead row Gmail
// sync would have created, just typed in by hand instead of parsed from an
// inbox. Not AI-scored on creation — score/scoreReason stay at their
// defaults until a real sync or scoring pass touches this lead.
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: BILLING_LOCKED_MESSAGE }, { status: 402 });
  }

  const body = await request.json().catch(() => ({}));

  const name = cleanText(body.name);
  if (!name) {
    return NextResponse.json({ success: false, message: "Name is required." }, { status: 400 });
  }

  const company = cleanText(body.company);
  const email = cleanText(body.email).toLowerCase();
  const phone = cleanText(body.phone, 40);
  const source = cleanText(body.source) || "Manual entry";
  const notes = cleanText(body.notes, 2000);
  const dealValue = Number.isFinite(body.dealValue) ? Math.max(0, Number(body.dealValue)) : 0;

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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
