import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseJsonBody } from "@/lib/validation";
import { requirePlatformAdmin } from "@/lib/platformAdmin";
import { setBetaPlanForEmail } from "@/lib/billing";

// PATCH /api/access-request/[id] — remove a tester or add them back, from
// /admin. "approved" lets that email sign in (src/lib/auth.ts); "declined"
// keeps the row and closes the door. Platform admin only.
const schema = z.object({ status: z.enum(["approved", "declined"]) });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const parsed = await parseJsonBody(request, schema);
  if (!parsed.ok) return parsed.response;

  const row = await prisma.accessRequest.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ success: false, message: "No such request." }, { status: 404 });

  await prisma.accessRequest.update({
    where: { id },
    data: { status: parsed.data.status, decidedAt: new Date() },
  });
  // Removing a tester takes their business off the beta plan (back to
  // Free); adding them back restores it. A real subscription is untouched.
  await setBetaPlanForEmail(row.email, parsed.data.status === "approved");
  return NextResponse.json({ success: true });
}
