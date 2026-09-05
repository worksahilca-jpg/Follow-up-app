import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { deleteSavedFilter } from "@/lib/savedFilters";

// DELETE /api/saved-filters/[id] — only the person who saved a view can
// delete it, even if it's shared with the business (see deleteSavedFilter).
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const result = await deleteSavedFilter(ctx.businessId, ctx.userId, id);
  if (!result.success) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
