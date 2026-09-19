import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseJsonBody } from "@/lib/validation";
import { requirePlatformAdmin } from "@/lib/platformAdmin";

// PATCH /api/access-request/[id] — the founder's one click on /admin.
// "approved" lets that email sign in (src/lib/auth.ts); "declined" keeps
// the row for the record and changes nothing else. Platform admin only.
const schema = z.object({ status: z.enum(["approved", "declined", "new"]) });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const parsed = await parseJsonBody(request, schema);
  if (!parsed.ok) return parsed.response;

  const row = await prisma.accessRequest.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ success: false, message: "No such request." }, { status: 404 });

  await prisma.accessRequest.update({
    where: { id },
    data: { status: parsed.data.status, decidedAt: parsed.data.status === "new" ? null : new Date() },
  });
  return NextResponse.json({ success: true });
}
