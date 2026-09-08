import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { createSavedFilter, getSavedFilters } from "@/lib/savedFilters";
import { parseJsonBody } from "@/lib/validation";

// A malformed/unrecognized criteria shape quietly becomes "no criteria"
// (an empty filter) rather than rejecting the save outright — matches the
// pre-existing behavior of accepting whatever object shape was passed.
const criteriaSchema = z
  .object({
    source: z.string().optional(),
    stage: z.enum(["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"]).optional(),
    priority: z.enum(["high", "medium", "low", "none"]).optional(),
    minDealValue: z.coerce.number().optional(),
    minDaysSinceContact: z.coerce.number().optional(),
  })
  .catch({});

const savedFilterSchema = z.object({
  name: z.string(),
  shared: z.boolean().optional(),
  criteria: criteriaSchema.optional(),
});

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

  const parsed = await parseJsonBody(request, savedFilterSchema);
  if (!parsed.ok) return parsed.response;
  const { name, shared = false, criteria = {} } = parsed.data;

  const result = await createSavedFilter(ctx.businessId, ctx.userId, name, shared, criteria);
  if (!result.success) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result, { status: 201 });
}
