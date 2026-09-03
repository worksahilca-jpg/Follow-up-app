import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";

/**
 * GET/POST /api/webhooks/outbound — the signed-in business's own outbound
 * webhook URL (their CRM/Zapier/Make endpoint), the reverse direction of
 * /api/webhooks/config. See src/lib/outboundWebhook.ts for what actually
 * gets sent there.
 */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { outboundWebhookUrl: true },
  });

  return NextResponse.json({ success: true, url: business?.outboundWebhookUrl ?? null });
}

/**
 * POST { url } to save (or POST { url: null } / omitted to clear). A saved
 * URL is validated as a real http(s) URL before being stored — this field
 * is fetched from server code on every lead event, so it's worth rejecting
 * obvious garbage up front rather than failing silently later.
 */
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const raw = typeof body.url === "string" ? body.url.trim() : "";

  if (!raw) {
    await prisma.business.update({ where: { id: ctx.businessId }, data: { outboundWebhookUrl: null } });
    return NextResponse.json({ success: true, url: null });
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return NextResponse.json({ success: false, message: "That doesn't look like a valid URL." }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ success: false, message: "URL must start with http:// or https://." }, { status: 400 });
  }

  await prisma.business.update({ where: { id: ctx.businessId }, data: { outboundWebhookUrl: parsed.toString() } });
  return NextResponse.json({ success: true, url: parsed.toString() });
}

/**
 * PUT — sends one real test event to the currently-saved URL so someone can
 * confirm their Zapier step (or wherever) is actually catching it, without
 * needing to wait for (or fake) a real lead. Awaited here, unlike every
 * other call site in outboundWebhook.ts, because this IS the point of the
 * request — the caller needs to know whether it worked.
 */
export async function PUT() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { outboundWebhookUrl: true },
  });
  if (!business?.outboundWebhookUrl) {
    return NextResponse.json({ success: false, message: "No webhook URL saved yet." }, { status: 400 });
  }

  try {
    const res = await fetch(business.outboundWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "webhook.test",
        leadId: "test",
        name: "Test Lead",
        email: "test@example.com",
        phone: null,
        source: "FollowUp test event",
        stage: "NEW",
        dealValue: 0,
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { success: false, message: `Endpoint responded with ${res.status}.` },
        { status: 502 }
      );
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, message: "Couldn't reach that URL — check it's correct and reachable." },
      { status: 502 }
    );
  }
}
