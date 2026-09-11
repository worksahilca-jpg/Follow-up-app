import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireActiveBilling } from "@/lib/billing";
import { pickAssignee } from "@/lib/assignment";
import { scoreAndDraftForLead } from "@/lib/scoring";
import { notifyLeadEvent } from "@/lib/outboundWebhook";
import { applySourceRouting } from "@/lib/sourceRouting";
import { tooManyRecentLeads } from "@/lib/rateLimit";
import { acknowledgeNewLead } from "@/lib/acknowledge";
import { findOrCreateConversation } from "@/lib/conversations";
import { cleanedText, EMAIL_RE, parseObject } from "@/lib/validation";
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
  phone: cleanedText(40),
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

  if (!(await requireActiveBilling(businessId))) {
    return NextResponse.json(
      { success: false, message: "This account isn't on an active plan — leads sent here won't be captured." },
      { status: 503 }
    );
  }

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

  const now = new Date();

  try {
    const lead = await prisma.lead.create({
      data: {
        businessId,
        name,
        email: email || null,
        phone: phone || null,
        source: "Webhook",
        stage: "NEW",
        lastContacted: now,
        assignedToId: await pickAssignee(businessId),
      },
    });
    void notifyLeadEvent(businessId, "lead.created", lead);
    await applySourceRouting(businessId, lead.id, "Webhook");

    if (message) {
      const conversation = await prisma.conversation.create({
        data: { leadId: lead.id, channel: "web" },
      });
      await prisma.message.create({
        data: { conversationId: conversation.id, direction: "inbound", body: message, sentAt: now },
      });
      await scoreAndDraftForLead(lead.id);
    }

    // A form/webhook lead gave us an email on purpose — acknowledge by
    // email only (never text a number nobody texted from). See src/lib/acknowledge.ts.
    if (email) {
      await acknowledgeNewLead(lead.id, { channel: "email", inboundText: message, inboundAt: now });
    }
    return NextResponse.json({ success: true, leadId: lead.id });
  } catch (err) {
    // Duplicate email for this business — same lead re-sent (a retried
    // Zapier run, a re-submitted form) shouldn't error. This used to just
    // return success and drop the resend's content entirely — an
    // integration re-sending an updated payload for a lead it already
    // pushed once (a Google Form edit-response sync, a CRM export re-run)
    // was a total no-op beyond the row already existing. Find the
    // existing lead instead and treat this the same as any other new
    // inbound message on it: appended, re-scored, and (subject to its own
    // once-only guard) re-acknowledged — same "conflict -> find and
    // continue" shape findOrCreateLeadByPhone() already uses for the SMS
    // side of this same problem.
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      const existing = await prisma.lead.findUnique({ where: { businessId_email: { businessId, email } } });
      if (existing && message) {
        const conversation = await findOrCreateConversation(existing.id, "web");
        await prisma.message.create({
          data: { conversationId: conversation.id, direction: "inbound", body: message, sentAt: now },
        });
        await scoreAndDraftForLead(existing.id);
        if (email) await acknowledgeNewLead(existing.id, { channel: "email", inboundText: message, inboundAt: now });
      }
      return NextResponse.json({ success: true, leadId: existing?.id });
    }
    throw err;
  }
}
