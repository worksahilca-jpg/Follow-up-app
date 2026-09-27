import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";

/**
 * GET /api/customers/search?q=… — the sidebar's "Search customers" box
 * (canvas App board). Read-only, and only ever this business's own
 * customers: the business id comes from the session, never the request.
 * Matches name, email or phone, case-insensitively; at most 8 results.
 */
export async function GET(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 1) return NextResponse.json({ success: true, results: [] });

  const leads = await prisma.lead.findMany({
    where: {
      businessId: ctx.businessId,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    },
    select: { id: true, name: true, email: true, source: true },
    orderBy: { updatedAt: "desc" },
    take: 8,
  });

  return NextResponse.json({
    success: true,
    results: leads.map((l) => ({ id: l.id, name: l.name, detail: l.email ?? l.source ?? null })),
  });
}
