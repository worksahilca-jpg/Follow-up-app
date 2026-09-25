import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { parseJsonBody } from "@/lib/validation";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { isAllowedPushEndpoint, isPushConfigured } from "@/lib/webPush";

const TOO_MANY = { success: false, message: "Too many requests — try again in a few minutes." } as const;

// The shape PushSubscription.toJSON() produces in the browser. The
// endpoint is checked against the browser vendors' push services, not just
// "is a URL": FollowUp's server POSTs to it on every alert, so an arbitrary
// URL here would be a way to make our server call anything
// (src/lib/webPush.ts, isAllowedPushEndpoint).
const endpointSchema = z
  .string()
  .max(2048)
  .refine(isAllowedPushEndpoint, "Not a browser push address.");

const subscribeSchema = z
  .object({
    endpoint: endpointSchema,
    // Base64url keys: p256dh is a 65-byte point (87 chars), auth 16 bytes
    // (22 chars). Bounded generously, but bounded.
    keys: z.object({
      p256dh: z.string().regex(/^[A-Za-z0-9_-]+=*$/).min(20).max(200),
      auth: z.string().regex(/^[A-Za-z0-9_-]+=*$/).min(8).max(100),
    }),
    expirationTime: z.number().nullable().optional(),
  })
  .strict();

const unsubscribeSchema = z.object({ endpoint: endpointSchema }).strict();

// POST /api/alerts/push — "Turn on FollowUp notifications on this device".
//
// Keyed by endpoint (one row per browser install). If the same browser was
// last subscribed by someone else — two people sharing a laptop — it moves
// to whoever is signed in now, but only when the request also carries that
// browser's own keys: the endpoint alone is not proof of holding the
// device, and without the check anyone who learned an endpoint could
// quietly redirect another person's alerts.
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!isPushConfigured()) {
    return NextResponse.json({ success: false, message: "FollowUp notifications aren't set up yet." }, { status: 503 });
  }
  if (await tooManyRecentActions(ctx.businessId, `alerts.push:${ctx.userId}`, { windowMinutes: 10, max: 20 })) {
    return NextResponse.json(TOO_MANY, { status: 429 });
  }

  const parsed = await parseJsonBody(request, subscribeSchema);
  if (!parsed.ok) return parsed.response;
  const { endpoint, keys } = parsed.data;

  const existing = await prisma.pushSubscription.findUnique({
    where: { endpoint },
    select: { id: true, userId: true, p256dh: true, auth: true },
  });
  if (existing && existing.userId !== ctx.userId && (existing.p256dh !== keys.p256dh || existing.auth !== keys.auth)) {
    return NextResponse.json({ success: false, message: "Couldn't turn notifications on — try again." }, { status: 409 });
  }

  if (existing) {
    await prisma.pushSubscription.update({
      where: { id: existing.id },
      data: { userId: ctx.userId, p256dh: keys.p256dh, auth: keys.auth },
    });
  } else {
    await prisma.pushSubscription.create({
      data: { userId: ctx.userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    });
  }
  return NextResponse.json({ success: true });
}

// DELETE /api/alerts/push — "Turn off" on this device. Only ever removes the
// signed-in person's own row: an endpoint that belongs to someone else is
// left alone, and the answer is the same either way so this cannot be used
// to probe whose endpoints exist.
export async function DELETE(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (await tooManyRecentActions(ctx.businessId, `alerts.push:${ctx.userId}`, { windowMinutes: 10, max: 20 })) {
    return NextResponse.json(TOO_MANY, { status: 429 });
  }

  const parsed = await parseJsonBody(request, unsubscribeSchema);
  if (!parsed.ok) return parsed.response;

  await prisma.pushSubscription.deleteMany({ where: { endpoint: parsed.data.endpoint, userId: ctx.userId } });
  return NextResponse.json({ success: true });
}
