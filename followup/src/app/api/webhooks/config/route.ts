import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/stripe";

function webhookUrl(secret: string): string {
  return `${appUrl()}/api/webhooks/lead/${secret}`;
}

/**
 * GET /api/webhooks/config — the signed-in business's own webhook URL for
 * the "Lead webhook" section in Settings, mirroring /api/embed/config for
 * the embed widget. Returns null until POST generates one — no secret
 * exists for a business until they actually ask for it.
 */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { webhookSecret: true },
  });

  return NextResponse.json({
    success: true,
    webhookUrl: business?.webhookSecret ? webhookUrl(business.webhookSecret) : null,
  });
}

/**
 * POST /api/webhooks/config — generate (or regenerate) this business's
 * webhook secret. Regenerating immediately invalidates the old URL —
 * anything still pointed at it (an old Zapier step, a leaked link) starts
 * getting 404s the moment this runs, which is the intended "revoke"
 * behavior, not a bug to guard against.
 */
export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const secret = randomBytes(24).toString("base64url");
  await prisma.business.update({ where: { id: ctx.businessId }, data: { webhookSecret: secret } });

  return NextResponse.json({ success: true, webhookUrl: webhookUrl(secret) });
}
