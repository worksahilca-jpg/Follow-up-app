import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, billingLockedMessage } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { sendFollowUpToLead } from "@/lib/sending";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";
import { sendRefusal } from "@/lib/sendingControl";
import { cancelBooking, offerTwoTimes, upcomingBookingFor } from "@/lib/booking";
import { offerButtons, ownerCancelText, ownerChangeText, reofferText, sayTime, sayTimes } from "@/lib/bookingTimes";
import { toQuickReplies } from "@/lib/quickReplies";

const schema = z.object({ action: z.enum(["change", "cancel", "offer", "seen"]) });

/** A fresh offer replaces whatever draft or pick was waiting. */
const CLEARED = {
  pickedTime: null,
  pickedTimeAt: null,
  suggestedMessage: null,
  suggestedSubject: null,
  suggestedQuickReplies: Prisma.JsonNull,
  suggestedResponseId: null,
  suggestedRiskLevel: null,
  suggestedRiskReason: null,
  suggestedRiskTopic: null,
} as const;

/**
 * POST /api/leads/[id]/booking — the owner's side of change and cancel in the
 * chat (A-242, part 2). On the Booked card: `change` cancels the booked time
 * and offers the customer two other free times; `cancel` cancels it and tells
 * them. On the cancelled card (they cancelled): `offer` sends two free times;
 * `seen` takes the line off Today and sends nothing. The ones that send a
 * message in the owner's name follow the rules of /api/leads/[id]/send: a
 * signed-in admin, billing active.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (await tooManyRecentActions(ctx.businessId, "leads.booking", { windowMinutes: 10, max: 30 })) {
    return NextResponse.json({ success: false, message: "Too many requests — try again in a few minutes." }, { status: 429 });
  }
  const { id } = await params;
  const lead = await prisma.lead.findFirst({
    where: { id, businessId: ctx.businessId },
    select: { id: true, name: true, business: { select: { timezone: true } } },
  });
  if (!lead) return NextResponse.json({ success: false, message: "Lead not found." }, { status: 404 });
  const parsed = await parseJsonBody(request, schema);
  if (!parsed.ok) return parsed.response;
  const { action } = parsed.data;
  const first = lead.name.trim().split(/\s+/)[0] || lead.name;
  const timeZone = lead.business.timezone ?? "America/New_York";
  const now = new Date();

  if (action === "seen") {
    const { count } = await prisma.booking.updateMany({
      where: { leadId: id, businessId: ctx.businessId, status: "canceled", canceledBy: "customer", cancelSeenAt: null },
      data: { cancelSeenAt: now },
    });
    return NextResponse.json({ success: true, message: count > 0 ? "OK. Nothing sent." : "Nothing waiting." });
  }

  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: await billingLockedMessage(ctx.businessId) }, { status: 402 });
  }
  const refused = await sendRefusal(ctx.businessId, ctx.userId);
  if (refused) return NextResponse.json({ success: false, adminOnly: true, message: refused }, { status: 403 });

  if (action === "offer") {
    const offered = await offerTwoTimes(id, now, timeZone, {});
    if (!offered) {
      return NextResponse.json({ success: false, message: `No free time in the next 10 days. Add free hours in Settings, or write to ${first} yourself.` }, { status: 409 });
    }
    const quickReplies = toQuickReplies({ question: "offer_times", buttons: offerButtons(offered, timeZone, now).map((title) => ({ title, exit: false })) }, "manual");
    const sent = await sendFollowUpToLead(id, reofferText(offered.said), { trigger: "manual", humanSend: { userId: ctx.userId }, quickReplies });
    if (!sent.success) return NextResponse.json({ success: false, message: sent.message ?? "The message didn't send." }, { status: 500 });
    await prisma.booking.updateMany({
      where: { leadId: id, businessId: ctx.businessId, status: "canceled", canceledBy: "customer", cancelSeenAt: null },
      data: { cancelSeenAt: now },
    });
    await prisma.lead.update({ where: { id }, data: { ...CLEARED, offeredTimes: { at: offered.at, said: offered.said, offeredAt: now.toISOString() } as Prisma.InputJsonValue } });
    void recordAudit(ctx, "booking.reoffer", { targetType: "lead", targetId: id, meta: { offered: offered.at } });
    return NextResponse.json({ success: true, message: `FollowUp offered ${first} ${sayTimes(offered.said)}.` });
  }

  // change | cancel: the booked time still to come.
  const booking = await upcomingBookingFor(id, ctx.businessId);
  if (!booking) return NextResponse.json({ success: false, message: `${first} has no booked time coming up.` }, { status: 409 });
  const oldSaid = sayTime(booking.scheduledAt.toISOString(), timeZone, now);

  if (action === "change") {
    const offered = await offerTwoTimes(id, now, timeZone, { avoid: [booking.scheduledAt.toISOString()] });
    if (!offered) {
      return NextResponse.json({ success: false, message: `No other free time in the next 10 days. Add free hours in Settings, or write to ${first} yourself.` }, { status: 409 });
    }
    // The old time goes first: once the customer is told, it must not stand.
    const cancelled = await cancelBooking(booking.id, ctx.businessId, "owner");
    if (!cancelled) return NextResponse.json({ success: false, message: `${first}'s booked time was already changed.` }, { status: 409 });
    const quickReplies = toQuickReplies({ question: "offer_times", buttons: offerButtons(offered, timeZone, now).map((title) => ({ title, exit: false })) }, "manual");
    const sent = await sendFollowUpToLead(id, ownerChangeText(oldSaid, offered.said), { trigger: "manual", humanSend: { userId: ctx.userId }, quickReplies });
    if (!sent.success) {
      // The time is already off: the card says so and goes, rather than offering the same buttons again.
      return NextResponse.json({ success: false, removed: true, message: `${oldSaid} is off your calendar, but the message to ${first} didn't send: ${sent.message ?? "write to them from the reply box."}` }, { status: 500 });
    }
    await prisma.lead.update({ where: { id }, data: { ...CLEARED, offeredTimes: { at: offered.at, said: offered.said, offeredAt: now.toISOString() } as Prisma.InputJsonValue } });
    void recordAudit(ctx, "booking.owner_change", { targetType: "lead", targetId: id, meta: { from: booking.scheduledAt.toISOString(), offered: offered.at } });
    return NextResponse.json({ success: true, message: `${oldSaid} is off. FollowUp offered ${first} ${sayTimes(offered.said)}.` });
  }

  const cancelled = await cancelBooking(booking.id, ctx.businessId, "owner");
  if (!cancelled) return NextResponse.json({ success: false, message: `${first}'s booked time was already changed.` }, { status: 409 });
  const sent = await sendFollowUpToLead(id, ownerCancelText(oldSaid), { trigger: "manual", humanSend: { userId: ctx.userId } });
  void recordAudit(ctx, "booking.owner_cancel", { targetType: "lead", targetId: id, meta: { scheduledAt: booking.scheduledAt.toISOString(), sent: sent.success } });
  return NextResponse.json({
    success: true,
    sent: sent.success,
    message: sent.success ? `Cancelled. FollowUp told ${first}.` : `Cancelled. The message to ${first} didn't send: ${sent.message ?? "write to them from the reply box."}`,
  });
}
