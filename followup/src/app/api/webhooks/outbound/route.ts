import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";
import { assertSafeWebhookUrl, UnsafeWebhookUrlError } from "@/lib/ssrf";

const outboundWebhookSchema = z.object({ url: z.string().max(2048).nullable().optional() });

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
  // Admin-only, and audited — 2026-09-15 bug hunt, finding 1
  // (`research/audit/2026-09-15-bug-hunt.md`). This endpoint decides where a
  // copy of every lead event goes, and that payload carries the lead's name,
  // email, phone and deal value (`src/lib/outboundWebhook.ts`). With only a
  // signed-in check, any teammate — and team invites default to SALES
  // (`prisma/schema.prisma`) — could point it at a server they control and
  // receive the whole book quietly. Every comparable setting (CRM config,
  // Twilio, Facebook, the inbound webhook secret, Gmail/Outlook connect,
  // business export) was already admin-gated and audited; this one was
  // missed. The earlier SSRF work hardened *where* the URL may point and
  // never revisited *who* may set it.
  if (!(await requireAdmin(ctx)))
    return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });

  const parsedBody = await parseJsonBody(request, outboundWebhookSchema);
  if (!parsedBody.ok) return parsedBody.response;
  const raw = (parsedBody.data.url ?? "").trim();

  if (!raw) {
    await prisma.business.update({ where: { id: ctx.businessId }, data: { outboundWebhookUrl: null } });
    void recordAudit(ctx, "integration.outbound_webhook.clear");
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
  // The host, not the full URL — a webhook URL routinely carries a secret in
  // its path or query (Zapier and Make both do this), and the audit log is
  // readable by the whole team.
  void recordAudit(ctx, "integration.outbound_webhook.update", { meta: { host: parsedUrl.host } });
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
  // Same gate as POST. Lower stakes now that only an admin can choose the
  // URL, but this handler fetches it immediately and reports reachability
  // back to the caller — the SSRF oracle the comment below describes — so
  // it stays with the setting it belongs to rather than being the one
  // ungated door on this resource.
  if (!(await requireAdmin(ctx)))
    return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });

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
