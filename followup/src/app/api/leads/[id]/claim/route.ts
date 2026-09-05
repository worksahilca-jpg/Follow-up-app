import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { claimLead } from "@/lib/assignment";

// POST /api/leads/[id]/claim — claims an unassigned pool lead for the
// signed-in user. Separate from POST /api/leads/[id]/assign (which can
// always reassign to anyone, overwriting the current value) because a
// claim is conditional on the lead still being unassigned right now — see
// claimLead()'s atomic updateMany.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const result = await claimLead(id, ctx.businessId, ctx.userId);
  if (!result.success) return NextResponse.json(result, { status: 409 });
  return NextResponse.json(result);
}
