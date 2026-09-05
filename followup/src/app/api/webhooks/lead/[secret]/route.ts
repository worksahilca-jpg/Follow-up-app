import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireActiveBilling } from "@/lib/billing";
import { pickAssignee } from "@/lib/assignment";
import { scoreAndDraftForLead } from "@/lib/scoring";
import { notifyLeadEvent } from "@/lib/outboundWebhook";
import { applySourceRouting } from "@/lib/sourceRouting";
import { tooManyRecentLeads } from "@/lib/rateLimit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_TEXT = 200;
const MAX_MESSAGE = 4000;

function cleanText(value: unknown, max = MAX_TEXT): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

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
  let body: Record<string, unknown>;
  if (contentType.includes("application/json")) {
    body = await request.json().catch(() => ({}));
  } else {
    const form = await request.formData().catch(() => null);
    body = form ? Object.fromEntries(form.entries()) : {};
  }

  const name = cleanText(body.name);
  const email = cleanText(body.email).toLowerCase();
  const phone = cleanText(body.phone, 40);
  const message = cleanText(body.message, MAX_MESSAGE);

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

    return NextResponse.json({ success: true, leadId: lead.id });
  } catch (err) {
    // Duplicate email for this business — same lead re-sent (a retried
    // Zapier run, a re-submitted form) shouldn't error.
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return NextResponse.json({ success: true });
    }
    throw err;
  }
}
