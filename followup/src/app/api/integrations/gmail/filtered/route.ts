import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";

// GET /api/integrations/gmail/filtered — the inbox threads the AI prospect
// classifier decided were not leads, newest first, with its reason for
// each. See FilteredEmail in schema.prisma for why this list exists.
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const filtered = await prisma.filteredEmail.findMany({
    where: { businessId: ctx.businessId },
    orderBy: { lastMessageAt: "desc" },
    take: 50,
    select: { id: true, senderName: true, senderEmail: true, subject: true, reason: true, lastMessageAt: true },
  });
  return NextResponse.json({ success: true, filtered });
}
