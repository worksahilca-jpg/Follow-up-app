import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { cancelInvite } from "@/lib/team";

// DELETE /api/team/invites/[id] — admin-only, cancels a pending invite.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const result = await cancelInvite(id, ctx.businessId, ctx.userId);
  if (!result.success) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
