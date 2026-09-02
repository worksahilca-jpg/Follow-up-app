import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { assignLead } from "@/lib/assignment";

// POST /api/leads/[id]/assign — reassigns a lead to a team member (body:
// { assignedToId }), or unassigns it (assignedToId: null). Anyone signed
// in can reassign, same as changing a lead's stage — this is everyday
// team coordination, not an admin-only action.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const assignedToId = typeof body.assignedToId === "string" ? body.assignedToId : null;

  const result = await assignLead(id, ctx.businessId, assignedToId);
  if (!result.success) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
