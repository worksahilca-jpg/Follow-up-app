import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { tooManyRecentLeads } from "@/lib/rateLimit";
import { processInboundEvent, recordInboundWebhookEvent } from "@/lib/inboundEvents";
import { cleanedPhone, cleanedText, EMAIL_RE, parseObject } from "@/lib/validation";
import { recordAuthFailure } from "@/lib/monitoring";

const MAX_TEXT = 200;
const MAX_MESSAGE = 4000;

// Same "clean to a bounded string or empty, never reject" shape as the
// embed widget's schema — this is machine-to-machine (Zapier/Make/a
// script), so a wrongly-typed field should degrade gracefully rather
// than bounce a webhook that's otherwise fine.
const webhookLeadSchema = z.object({
  name: cleanedText(MAX_TEXT),
  email: cleanedText(MAX_TEXT),
  phone: cleanedPhone(40),
  message: cleanedText(MAX_MESSAGE),
});

/**
 * POST /api/webhooks/lead/[secret] — the generic inbound lead-capture
 * webhook: Zapier, Make, a Google Forms bridge, a raw curl/script, or any
 * other tool a business already uses to collect leads can POST here and
 * have it become a real, scored, drafted lead — the same outcome as the
 * embed widget (see src/app/api/embed/[businessId]/lead/route.ts, which
 * this deliberately mirrors), just triggered from outside instead of from
 * a form on the business's own site.
 *
 * Authenticated by the secret itself rather than a businessId — this
 * endpoint has no public form in front of it advertising which URLs are
 * "real" the way the embed widget's businessId does, so a bare secret in
 * the URL path is the whole access control (same shape as an unguessable
 * booking/embed id, just serving as the credential instead of an
 * identifier). Regenerating it in Settings immediately invalidates the
 * old one — see /api/webhooks/config.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;

  const business = await prisma.business.findUnique({ where: { webhookSecret: secret }, select: { id: true } });
  if (!business) {
    recordAuthFailure("webhook_secret", { route: "webhooks/lead" });
    return NextResponse.json({ success: false, message: "Invalid or revoked webhook URL." }, { status: 404 });
  }
  const businessId = business.id;

  // Deliberately NOT billing-gated — see the embed widget's matching
  // comment. The old 503 here said out loud what the bug was ("leads sent
  // here won't be captured"): Zapier/Make treat a 503 as a failed task and
  // drop it (a free Zap doesn't auto-replay), a curl in someone's script
  // ignores the body entirely, and the lead existed nowhere else. Capture
  // now always happens; scoreAndDraftForLead and acknowledgeNewLead below
  // pause themselves via checkAiEligibility (@/lib/billing) while billing
  // is lapsed, so nothing here spends money for a locked account.

  // 100 per 10 minutes — this is machine-to-machine (Zapier/Make/a script),
  // so real usage can legitimately burst higher than a human-filled form
  // ever would, but a misconfigured Zap that loops on itself (a genuinely
  // common failure mode) still needs a ceiling before it turns into an
  // unbounded pile of duplicate leads and OpenAI calls.
  if (await tooManyRecentLeads(businessId, "Webhook", { windowMinutes: 10, max: 100 })) {
    return NextResponse.json(
      { success: false, message: "Too many requests right now — please try again in a few minutes." },
      { status: 429 }
    );
  }

  // Zapier/Make and most form bridges send JSON; a raw form-encoded POST
  // (e.g. straight from an <form> action, or some no-code tools) is
  // accepted too rather than rejected outright.
  const contentType = request.headers.get("content-type") ?? "";
  let raw: Record<string, unknown>;
  if (contentType.includes("application/json")) {
    raw = await request.json().catch(() => ({}));
  } else {
    const form = await request.formData().catch(() => null);
    raw = form ? Object.fromEntries(form.entries()) : {};
  }
  const parsed = parseObject(raw, webhookLeadSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const name = body.name;
  const email = body.email.toLowerCase();
  const phone = body.phone;
  const message = body.message;

  if (!name) {
    return NextResponse.json({ success: false, message: "`name` is required." }, { status: 400 });
  }
  if (!email && !phone) {
    return NextResponse.json({ success: false, message: "`email` or `phone` is required." }, { status: 400 });
  }
  if (email && !EMAIL_RE.test(email)) {
    return NextResponse.json({ success: false, message: "`email` doesn't look like a real address." }, { status: 400 });
  }

  // PERSIST FIRST, PROCESS AFTER. Everything above this line is a real
  // answer to the caller — an invalid secret, a rate-limit refusal, a
  // malformed body are all reported back to a sender that can see the
  // response and fix it, so there's nothing to lose yet. From here on the
  // submission is a lead, and the only copy of it is this request: the
  // lead-creating work below used to run inline, so a throw anywhere in it
  // (an OpenAI timeout inside scoreAndDraftForLead, a DB blip) returned a
  // 500 to a Zapier task that a free plan does not auto-replay, and the
  // lead existed nowhere. It is written down before any of that runs.
  const event = await recordInboundWebhookEvent({
    provider: "http",
    channel: "webhook_lead",
    businessId,
    payload: { name, email, phone, message },
  });

  // Never throws — a processing failure is recorded on the row above.
  const { ok, leadId } = await processInboundEvent({
    ...event,
    channel: "webhook_lead",
    businessId,
    payload: { name, email, phone, message },
  });

  // `queued: true` is the honest answer when the work didn't finish: the
  // submission IS durably stored and replayable, so reporting a failure
  // here would be the worse lie — it would make Zapier re-send (a
  // duplicate) or, on a free plan, simply drop the task. leadId is omitted
  // because there may not be one yet.
  if (!ok) return NextResponse.json({ success: true, queued: true });
  return NextResponse.json({ success: true, leadId });
}
