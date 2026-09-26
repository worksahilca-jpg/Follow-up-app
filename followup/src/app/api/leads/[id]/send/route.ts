import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, billingLockedMessage } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { sendFollowUpToLead } from "@/lib/sending";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";

const sendSchema = z.object({
  // 50,000 characters is a very long email; the bound is only against abuse.
  message: z.string().trim().min(1, "Message can't be empty.").max(50_000),
  // Optional: the composer only shows/requires a Subject field for leads
  // being emailed (see MessageComposer.tsx) — a text/WhatsApp/Instagram
  // send has no subject concept.
  subject: z.string().trim().min(1).max(1000).optional(),
  // When the newest message from the lead that was on screen arrived
  // (ISO). Optional: a caller that doesn't send it behaves as before.
  seenInboundAt: z.string().datetime().optional(),
});

// POST /api/leads/[id]/send — the one place a real email actually goes out.
// Always requires a person to have clicked "Send now" with the message
// visible in front of them first; automated sends go through
// src/lib/automation.ts instead, which calls sendFollowUpToLead directly.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (await tooManyRecentActions(ctx.businessId, "leads.send", { windowMinutes: 10, max: 60 })) return NextResponse.json({ success: false, message: "Too many requests — try again in a few minutes." }, { status: 429 });
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: await billingLockedMessage(ctx.businessId) }, { status: 402 });
  }

  const { id } = await params;
  const owned = await prisma.lead.findFirst({ where: { id, businessId: ctx.businessId }, select: { id: true } });
  if (!owned) return NextResponse.json({ success: false, message: "Lead not found." }, { status: 404 });

  const parsed = await parseJsonBody(request, sendSchema);
  if (!parsed.ok) return parsed.response;
  const { message, subject, seenInboundAt } = parsed.data;

  // The lead wrote again after the owner last looked (daily-path audit
  // 2026-09-25 F7). The words being sent answer a conversation that has
  // moved on — an old draft, or a reply typed before the new message
  // arrived — so it is refused and the owner reads first. Checked against
  // what was on THEIR screen, not against when the draft was written: an
  // owner who has seen the new message and still wants to send passes.
  if (seenInboundAt) {
    const newer = await prisma.message.findFirst({
      where: { direction: "inbound", sentAt: { gt: new Date(seenInboundAt) }, conversation: { leadId: id } },
      orderBy: { sentAt: "desc" },
      select: { sentAt: true },
    });
    if (newer) {
      const lead = await prisma.lead.findUnique({ where: { id }, select: { name: true } });
      const first = lead?.name.split(" ")[0] || "They";
      return NextResponse.json(
        { success: false, stale: true, message: `${first} wrote again since you opened this. Nothing was sent — read their new message first.` },
        { status: 409 }
      );
    }
  }

  // `humanSend` is what lets an Instagram/Messenger reply go out between
  // 24 hours and 7 days after the lead's last message, under Meta's
  // human-agent allowance: this route is the one place a signed-in person
  // has the whole message in front of them and tapped Send for it. The
  // acting user is recorded beside the tag below (api-facts §B5).
  const result = await sendFollowUpToLead(id, message, { trigger: "manual", subject, humanSend: { userId: ctx.userId } });
  if (result.success) {
    void recordAudit(ctx, "lead.send", {
      targetType: "lead",
      targetId: id,
      meta: {
        length: message.length,
        ...(result.messagingTag ? { messagingTag: result.messagingTag } : {}),
        // Recorded because the trail otherwise reads "this person sent
        // this message" about words the lead never received.
        ...(result.sentTemplate ? { sentTemplate: result.sentTemplate } : {}),
      },
    });
  }
  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
