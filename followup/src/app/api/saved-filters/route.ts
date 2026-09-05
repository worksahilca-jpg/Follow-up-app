import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { createSavedFilter, getSavedFilters, type SavedFilterCriteria } from "@/lib/savedFilters";

// GET /api/saved-filters — every Smart View the signed-in user can see
// (their own private ones + everything shared on the business).
// POST /api/saved-filters — save the current custom filter as a new one.
// No billing gate: unlike Gmail sync/AI drafting/SMS, this has no external
// API cost — it's just organizing how someone looks at their own leads.
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const filters = await getSavedFilters(ctx.businessId, ctx.userId);
  return NextResponse.json({ success: true, filters });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name : "";
  const shared = body.shared === true;
  const criteria: SavedFilterCriteria = body.criteria && typeof body.criteria === "object" ? body.criteria : {};

  const result = await createSavedFilter(ctx.businessId, ctx.userId, name, shared, criteria);
  if (!result.success) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result, { status: 201 });
}
