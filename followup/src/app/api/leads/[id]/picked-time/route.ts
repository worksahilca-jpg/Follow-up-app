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
import { createBooking, offerTwoTimes, upcomingBookingFor } from "@/lib/booking";
import { anotherTimeText, bookedText, keepText, movedText, offerButtons, readOfferedTimes, sayTime, sayTimes } from "@/lib/bookingTimes";
import { homeOf, readQualification } from "@/lib/qualification";
import { toQuickReplies } from "@/lib/quickReplies";

const schema = z.object({ action: z.enum(["confirm", "another", "call", "keep"]) });

/** Everything the pick and its acknowledgement draft left on the row, gone: the owner has decided. */
const CLEARED = {
  pickedTime: null,
  pickedTimeAt: null,
  offeredTimes: Prisma.JsonNull,
  suggestedMessage: null,
  suggestedSubject: null,
  suggestedQuickReplies: Prisma.JsonNull,
  suggestedResponseId: null,
  suggestedRiskLevel: null,
  suggestedRiskReason: null,
  suggestedRiskTopic: null,
} as const;

/**
 * POST /api/leads/[id]/picked-time — the owner's answer to "<name> picked a
 * time" (A-242, src/lib/bookingTimes.ts). `confirm` books it (the same
 * createBooking the booking page uses, which checks the calendar again) and
 * tells the customer "Booked: …"; `another` offers two other free times and
 * tells them; `call` clears the pick and sends nothing. With a booked time
 * still standing the pick is a move (part 2): `confirm` replaces the old
 * booking in one transaction and says "Moved: …"; `keep` clears the pick
 * and tells them the old time stands. Confirm, Another and Keep send a
 * message in the owner's name, so they follow the one-person-tapped rules
 * of /api/leads/[id]/send: a signed-in admin, billing active.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (await tooManyRecentActions(ctx.businessId, "leads.pickedTime", { windowMinutes: 10, max: 30 })) {
    return NextResponse.json({ success: false, message: "Too many requests — try again in a few minutes." }, { status: 429 });
  }
  const { id } = await params;
  const lead = await prisma.lead.findFirst({
    where: { id, businessId: ctx.businessId },
    select: { id: true, name: true, pickedTime: true, offeredTimes: true, qualification: true, business: { select: { timezone: true } } },
  });
  if (!lead) return NextResponse.json({ success: false, message: "Lead not found." }, { status: 404 });
  const parsed = await parseJsonBody(request, schema);
  if (!parsed.ok) return parsed.response;
  const { action } = parsed.data;
  const first = lead.name.trim().split(/\s+/)[0] || lead.name;
  if (!lead.pickedTime) {
    return NextResponse.json({ success: false, message: `${first} hasn't picked a time, or it was already handled.` }, { status: 409 });
  }

  if (action === "call") {
    await prisma.lead.update({ where: { id }, data: CLEARED });
    void recordAudit(ctx, "booking.call_instead", { targetType: "lead", targetId: id });
    return NextResponse.json({ success: true, message: `Nothing sent. Give ${first} a call.` });
  }

  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: await billingLockedMessage(ctx.businessId) }, { status: 402 });
  }
  const refused = await sendRefusal(ctx.businessId, ctx.userId);
  if (refused) return NextResponse.json({ success: false, adminOnly: true, message: refused }, { status: 403 });
  const timeZone = lead.business.timezone ?? "America/New_York";
  const now = new Date();
  // A booked time still to come makes this pick a move (A-242, part 2).
  const old = await upcomingBookingFor(id, ctx.businessId);
  const oldSaid = old ? sayTime(old.scheduledAt.toISOString(), timeZone, now) : null;

  if (action === "keep") {
    if (!old || !oldSaid) return NextResponse.json({ success: false, message: `There is no booked time to keep for ${first}.` }, { status: 409 });
    const text = keepText(oldSaid, sayTime(lead.pickedTime.toISOString(), timeZone, now));
    const sent = await sendFollowUpToLead(id, text, { trigger: "manual", humanSend: { userId: ctx.userId } });
    if (!sent.success) return NextResponse.json({ success: false, message: sent.message ?? "The message didn't send." }, { status: 500 });
    await prisma.lead.update({ where: { id }, data: CLEARED });
    void recordAudit(ctx, "booking.keep", { targetType: "lead", targetId: id, meta: { kept: old.scheduledAt.toISOString() } });
    return NextResponse.json({ success: true, message: `Kept. FollowUp asked ${first} if ${oldSaid} still works.` });
  }

  if (action === "confirm") {
    const booked = await createBooking(id, lead.pickedTime.toISOString(), old ? { replace: { id: old.id, by: "customer" } } : {});
    if (!booked.success) return NextResponse.json({ success: false, message: booked.message }, { status: 409 });
    const where = homeOf(readQualification(lead.qualification));
    const text = old ? movedText(booked.scheduledAt, timeZone, where) : bookedText(booked.scheduledAt, timeZone, where);
    const sent = await sendFollowUpToLead(id, text, { trigger: "manual", humanSend: { userId: ctx.userId } });
    await prisma.lead.update({ where: { id }, data: CLEARED });
    void recordAudit(ctx, old ? "booking.move" : "booking.confirm", { targetType: "lead", targetId: id, meta: { scheduledAt: booked.scheduledAt, sent: sent.success, ...(old ? { from: old.scheduledAt.toISOString() } : {}) } });
    const did = old ? "Moved" : "Booked";
    return NextResponse.json({
      success: true,
      sent: sent.success,
      message: sent.success ? `${did}. FollowUp told ${first}.` : `${did}. The message to ${first} didn't send: ${sent.message ?? "write to them from the reply box."}`,
    });
  }

  // "Another time": two other free times, told to them now.
  const avoid = [lead.pickedTime.toISOString(), ...(readOfferedTimes(lead.offeredTimes)?.at ?? []), ...(old ? [old.scheduledAt.toISOString()] : [])];
  const offered = await offerTwoTimes(id, now, timeZone, { avoid });
  if (!offered) {
    return NextResponse.json(
      { success: false, message: `No other free time in the next 10 days. Add free hours in Settings, or write to ${first} yourself.` },
      { status: 409 }
    );
  }
  const text = anotherTimeText(offered.said);
  const quickReplies = toQuickReplies({ question: "offer_times", buttons: offerButtons(offered, timeZone, now).map((title) => ({ title, exit: false })) }, "manual");
  const sent = await sendFollowUpToLead(id, text, { trigger: "manual", humanSend: { userId: ctx.userId }, quickReplies });
  if (!sent.success) return NextResponse.json({ success: false, message: sent.message ?? "The message didn't send." }, { status: 500 });
  await prisma.lead.update({
    where: { id },
    data: { ...CLEARED, offeredTimes: { at: offered.at, said: offered.said, offeredAt: now.toISOString() } as Prisma.InputJsonValue },
  });
  void recordAudit(ctx, "booking.another_time", { targetType: "lead", targetId: id, meta: { offered: offered.at } });
  return NextResponse.json({ success: true, message: `FollowUp offered ${first} ${sayTimes(offered.said)}.` });
}
