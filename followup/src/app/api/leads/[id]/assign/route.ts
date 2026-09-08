import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { assignLead } from "@/lib/assignment";
import { parseJsonBody } from "@/lib/validation";

const assignSchema = z.object({ assignedToId: z.string().nullable() });

// POST /api/leads/[id]/assign — reassigns a lead to a team member (body:
// { assignedToId }), or unassigns it (assignedToId: null). Anyone signed
// in can reassign, same as changing a lead's stage — this is everyday
// team coordination, not an admin-only action.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const parsed = await parseJsonBody(request, assignSchema);
  if (!parsed.ok) return parsed.response;

  const result = await assignLead(id, ctx.businessId, parsed.data.assignedToId);
  if (!result.success) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
