import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

// POST /api/account/sign-out-everywhere (A-041). Ends every session of the
// signed-in person: the JWT callback drops any session whose Google sign-in
// came before this moment the next time it revalidates. No step-up and no
// confirm: this only ever takes access away, and the person reaching for it
// may be in a hurry.
export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  await prisma.user.update({ where: { id: ctx.userId }, data: { sessionsRevokedAt: new Date() } });
  void recordAudit(ctx, "account.signed_out_everywhere");
  return NextResponse.json({ success: true });
}
