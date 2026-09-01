import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// POST /api/leads/[id]/automation — flips the per-lead auto-send opt-in.
// Off by default (Lead.automationOn defaults to false in the schema);
// this is the only way it turns on for a given lead, one at a time.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ success: false, message: "Missing 'enabled' boolean." }, { status: 400 });
  }

  const lead = await prisma.lead.update({
    where: { id },
    data: { automationOn: body.enabled },
  });

  return NextResponse.json({ success: true, automationOn: lead.automationOn });
}
