import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { keepFollowing } from "@/lib/keepFollowing";

// POST /api/leads/[id]/keep-following — "Keep following up anyway" on a
// customer who said they already have an agent (A-246). See
// src/lib/keepFollowing.ts.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  const { id } = await params;
  const result = await keepFollowing(id, ctx.businessId, ctx.userId);
  return NextResponse.json(result, { status: result.success ? 200 : 404 });
}
