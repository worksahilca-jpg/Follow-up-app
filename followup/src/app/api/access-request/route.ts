import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseJsonBody } from "@/lib/validation";
import { requirePlatformAdmin } from "@/lib/platformAdmin";

// POST /api/access-request — the founder adds a tester by email, from
// /admin. Platform admin only. There is no public way to ask for access:
// the founder's decision, 2026-09-19 ("I don't want any unknown users to
// try my beta app and request access. I will personally be adding all the
// emails"). An added email may sign in on its next try (src/lib/auth.ts
// reads AccessRequest.status), without touching ALLOWED_EMAILS or paying
// for a redeploy. Sign-up stays invite-only (PRODUCT_DIRECTION, 2026-09-18).
const schema = z.object({
  email: z.string().trim().toLowerCase().email("That email doesn't look right."),
  name: z.string().trim().max(120).optional(),
  business: z.string().trim().max(200).optional(),
});

export async function POST(request: NextRequest) {
  await requirePlatformAdmin();
  const parsed = await parseJsonBody(request, schema);
  if (!parsed.ok) return parsed.response;
  const { email, name, business } = parsed.data;

  const row = await prisma.accessRequest.upsert({
    where: { email },
    create: { email, name: name || email.split("@")[0], business: business || null, status: "approved", decidedAt: new Date() },
    update: { status: "approved", decidedAt: new Date(), ...(name ? { name } : {}), ...(business ? { business } : {}) },
  });
  return NextResponse.json({ success: true, id: row.id });
}
