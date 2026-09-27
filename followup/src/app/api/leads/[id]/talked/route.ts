import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { markTalked } from "@/lib/markTalked";
import { parseJsonBody } from "@/lib/validation";

const talkedSchema = z.object({ undo: z.boolean().optional() });

// POST /api/leads/[id]/talked — "We talked" (design brain A-039), and its
// Undo with { undo: true }. The owner spoke with this customer outside
// FollowUp; check-ins stop until the customer writes again. See
// src/lib/talked.ts.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const parsed = await parseJsonBody(request, talkedSchema);
  if (!parsed.ok) return parsed.response;

  const result = await markTalked(id, ctx.businessId, ctx.userId, parsed.data.undo ?? false);
  return NextResponse.json(result, { status: result.success ? 200 : 404 });
}
