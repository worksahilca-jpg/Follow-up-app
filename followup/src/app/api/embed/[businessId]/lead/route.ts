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
 * GET /api/embed/[businessId]/lead — what the embed page needs to render
 * itself: just the business name, and whether this businessId is real at
 * all. No billing check here — the form should still SHOW even while
 * locked; only submitting is gated, so a lapsed subscription doesn't turn
 * a business's own site into a broken-looking embed for their visitors.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { name: true } });
  if (!business) {
    return NextResponse.json({ success: false, message: "This form isn't set up correctly." }, { status: 404 });
  }
  return NextResponse.json({ success: true, businessName: business.name });
}

/**
 * POST /api/embed/[businessId]/lead — the public, unauthenticated endpoint
 * behind /embed/[businessId] (see that page). businessId in the URL is the
 * same kind of unguessable id already used for booking links — deliberate
 * design choice matching that existing precedent, not a new pattern.
 *
 * Every real submission becomes a real lead exactly the way an email or a
 * logged call would: assigned, and — if OpenAI is configured — scored and
 * drafted immediately via scoreAndDraftForLead(), so the business sees a
 * fully-worked lead the moment someone submits their site's contact form,
 * not a blank record waiting on the next sync.
 *
 * `hp` is a honeypot field the visible form leaves empty and hides from
 * real visitors with CSS — a bot that fills every field trips it. On top
 * of that, tooManyRecentLeads() caps how many "Website form" leads one
 * business can receive in a short window — this businessId isn't a
 * secret (it's meant to sit in a customer's public website HTML), so
 * anyone viewing page source can find this exact URL and hit it directly
 * with a script; without a cap, a flood of submissions with a message
 * would each trigger a real OpenAI call on the business's own dime. A
 * real CAPTCHA still isn't built — this is the free layer.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;

  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { id: true } });
  if (!business) {
    return NextResponse.json({ success: false, message: "This form isn't set up correctly." }, { status: 404 });
  }
  // Same "costs money to run" gate as every other way a lead gets created —
  // phrased for a stranger on the business's own site, not the business
  // owner, since they're the one who'll see this if it ever fires.
  if (!(await requireActiveBilling(businessId))) {
    return NextResponse.json(
      { success: false, message: "This form isn't currently accepting submissions — please reach out another way." },
      { status: 503 }
    );
  }

  // 20 per 10 minutes — generous for a real burst of interest (an ad
  // campaign, a busy open house), tight enough to blunt a script hammering
  // this URL directly. See the file comment above for why this needs a cap
  // at all.
  if (await tooManyRecentLeads(businessId, "Website form", { windowMinutes: 10, max: 20 })) {
    return NextResponse.json(
      { success: false, message: "Too many submissions right now — please try again in a few minutes." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));

  if (cleanText(body.hp)) {
    // Honeypot tripped — pretend it worked so whatever filled it doesn't learn anything.
    return NextResponse.json({ success: true });
  }

  const name = cleanText(body.name);
  const email = cleanText(body.email).toLowerCase();
  const phone = cleanText(body.phone, 40);
  const message = cleanText(body.message, MAX_MESSAGE);

  if (!name) {
    return NextResponse.json({ success: false, message: "Your name is required." }, { status: 400 });
  }
  if (!email && !phone) {
    return NextResponse.json({ success: false, message: "An email or phone number is required." }, { status: 400 });
  }
  if (email && !EMAIL_RE.test(email)) {
    return NextResponse.json({ success: false, message: "That email doesn't look right." }, { status: 400 });
  }

  const now = new Date();

  try {
    const lead = await prisma.lead.create({
      data: {
        businessId,
        name,
        email: email || null,
        phone: phone || null,
        source: "Website form",
        stage: "NEW",
        lastContacted: now,
        assignedToId: await pickAssignee(businessId),
      },
    });
    void notifyLeadEvent(businessId, "lead.created", lead);
    await applySourceRouting(businessId, lead.id, "Website form");

    if (message) {
      const conversation = await prisma.conversation.create({
        data: { leadId: lead.id, channel: "web" },
      });
      await prisma.message.create({
        data: { conversationId: conversation.id, direction: "inbound", body: message, sentAt: now },
      });
      // Awaited so the visitor's page (a short spinner, not a whole app
      // load) sees the real outcome — a single form submit can afford the
      // extra second or two this costs, and the business gets a fully
      // scored lead immediately instead of a blank one waiting on a sync.
      await scoreAndDraftForLead(lead.id);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    // Duplicate email for this business (Lead's businessId_email unique
    // constraint) — the same person submitting twice shouldn't 500.
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return NextResponse.json({ success: true });
    }
    throw err;
  }
}
