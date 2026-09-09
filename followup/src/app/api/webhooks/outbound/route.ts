import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { parseJsonBody } from "@/lib/validation";
import { assertSafeWebhookUrl, UnsafeWebhookUrlError } from "@/lib/ssrf";

const outboundWebhookSchema = z.object({ url: z.string().nullable().optional() });

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

  const parsedBody = await parseJsonBody(request, outboundWebhookSchema);
  if (!parsedBody.ok) return parsedBody.response;
  const raw = (parsedBody.data.url ?? "").trim();

  if (!raw) {
    await prisma.business.update({ where: { id: ctx.businessId }, data: { outboundWebhookUrl: null } });
    return NextResponse.json({ success: true, url: null });
  }

  // assertSafeWebhookUrl also rejects a hostname that resolves to a
  // private/loopback/link-local address (e.g. the cloud metadata IP) —
  // this field is fetched from server code on every lead event, so a
  // business (or an attacker who's compromised one business's session)
  // must not be able to point it at an internal service. See src/lib/ssrf.ts.
  let parsedUrl: URL;
  try {
    parsedUrl = await assertSafeWebhookUrl(raw);
  } catch (err) {
    const message = err instanceof UnsafeWebhookUrlError ? err.message : "That doesn't look like a valid URL.";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }

  await prisma.business.update({ where: { id: ctx.businessId }, data: { outboundWebhookUrl: parsedUrl.toString() } });
  return NextResponse.json({ success: true, url: parsedUrl.toString() });
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
    // Re-check the saved URL right before firing, not just at save time —
    // a hostname that resolved to a public address when it was saved can
    // be re-pointed at a private one later (DNS rebinding), and this
    // handler is otherwise a direct, low-latency SSRF oracle: it fetches
    // immediately and reports back reachability. See src/lib/ssrf.ts.
    await assertSafeWebhookUrl(business.outboundWebhookUrl);
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
      // Never follow a redirect — a public hostname that 30x's to an
      // internal address would otherwise bypass the check above entirely.
      redirect: "manual",
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
