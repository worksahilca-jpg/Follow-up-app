/**
 * "How did it go?" (A-263), the database side: what one tap does, and its
 * Undo. The words and the rules are in src/lib/meetingOutcome.ts.
 *
 *   Working with me  → Won. FollowUp stays out of the chat.
 *   Still deciding   → the plan carries on from the call (a thank-you tomorrow).
 *   Not going ahead  → Lost. FollowUp sends nothing more.
 *   Didn't happen    → one note offering a new time, with the booking link,
 *                      held for the owner's OK; then FollowUp waits.
 *
 * Nothing is sent from here.
 */
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { canSendOn } from "@/lib/sendChannels";
import { heldSince } from "@/lib/pendingApprovals";
import { moveLeadStage, type PipelineStageName } from "@/lib/leadStage";
import { isCallablePhone } from "@/lib/callPlan";
import { appUrl } from "@/lib/stripe";
import { MEETING_MISSED_REASON } from "@/lib/holdReasons";
import { MEETING_MISSED_KIND, missedNote, missedSubject, type MeetingOutcome } from "@/lib/meetingOutcome";

export type MeetingOutcomeResult = { success: true; note: string | null } | { success: false; message: string };

const firstOf = (name: string) => name.trim().split(/\s+/)[0] || name;

export async function recordMeetingOutcome(
  leadId: string,
  businessId: string,
  userId: string | null,
  bookingId: string,
  outcome: MeetingOutcome,
  now = new Date()
): Promise<MeetingOutcomeResult> {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, leadId, businessId, status: "confirmed" },
    select: { id: true, outcome: true, scheduledAt: true },
  });
  if (!booking) return { success: false, message: "Lead not found." };
  if (booking.outcome) return { success: false, message: "Already answered. Undo first to change it." };
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, businessId },
    select: { id: true, name: true, stage: true, email: true, phone: true, optedOutAt: true, suggestedDraftKind: true },
  });
  if (!lead) return { success: false, message: "Lead not found." };

  await prisma.booking.update({ where: { id: booking.id }, data: { outcome, outcomeAt: now, outcomeFromStage: lead.stage } });
  // Recorded before the note below: Today reads a customer's LATEST decision
  // event, so the held note has to be the newest thing about them.
  await recordAudit({ businessId, userId }, "lead.meeting.outcome", { targetType: "lead", targetId: leadId, meta: { bookingId: booking.id, outcome } });

  const first = firstOf(lead.name);
  let note: string | null = null;
  if (outcome === "working") await moveLeadStage(businessId, leadId, "WON");
  if (outcome === "not_going") await moveLeadStage(businessId, leadId, "LOST");
  if (outcome === "didnt_happen") note = await offerNewTime(lead, businessId, userId, first, now);
  return { success: true, note };
}

/**
 * The one note after a call that didn't happen: held, never sent from
 * here. A reply already waiting for an OK is the next message to this
 * customer, so no second one is written beside it (as "No answer" does).
 */
async function offerNewTime(
  lead: { id: string; name: string; email: string | null; phone: string | null; optedOutAt: Date | null; suggestedDraftKind: string | null },
  businessId: string,
  userId: string | null,
  first: string,
  now: Date
): Promise<string | null> {
  if (lead.optedOutAt) return `${first} asked not to be written to, so FollowUp writes nothing.`;
  const otherHeld = lead.suggestedDraftKind !== MEETING_MISSED_KIND && (await heldSince(businessId, lead.id, new Date(0)).catch(() => true));
  if (otherHeld) return `A reply to ${first} is already waiting for your OK, so FollowUp didn't write another.`;
  const canText = isCallablePhone(lead.phone) && (await canSendOn(businessId, "text"));
  const canEmail = !canText && !!lead.email && (await canSendOn(businessId, "email"));
  if (!canText && !canEmail) return `FollowUp can't write to ${first}: no text number or inbox is connected.`;
  const caller = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { name: true } }) : null;
  const callerFirst = caller?.name?.trim().split(/\s+/)[0] || null;
  const body = missedNote(first, `${appUrl()}/book/${lead.id}`, callerFirst);
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      suggestedMessage: body,
      suggestedSubject: canText ? null : missedSubject(),
      suggestedQuickReplies: undefined,
      suggestedDraftKind: MEETING_MISSED_KIND,
      suggestedDraftedFor: now,
      suggestedRiskLevel: null,
      suggestedRiskReason: null,
      suggestedRiskTopic: null,
    },
  });
  const held = await recordAudit({ businessId, userId }, "ai.hold", {
    targetType: "lead",
    targetId: lead.id,
    meta: { riskLevel: "owner", reason: MEETING_MISSED_REASON, trigger: MEETING_MISSED_KIND },
  });
  if (held === false) return `FollowUp couldn't put the note for ${first} on Today. Try again in a minute.`;
  return canText ? `A text offering ${first} a new time is waiting for your OK.` : `An email offering ${first} a new time is waiting for your OK.`;
}

/**
 * Undo within the day: the answer is cleared, a Won or Lost goes back to
 * the stage before it, and the "new time" note is withdrawn unless it has
 * already gone (a sent message is a real message).
 */
export async function undoMeetingOutcome(leadId: string, businessId: string, userId: string | null, bookingId: string): Promise<{ success: boolean; message?: string }> {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, leadId, businessId },
    select: { id: true, outcome: true, outcomeAt: true, outcomeFromStage: true },
  });
  if (!booking) return { success: false, message: "Lead not found." };
  if (!booking.outcome || !booking.outcomeAt) return { success: false, message: "There's nothing to undo." };
  const lead = await prisma.lead.findFirst({ where: { id: leadId, businessId }, select: { id: true, stage: true, suggestedDraftKind: true, suggestedDraftedFor: true } });
  if (!lead) return { success: false, message: "Lead not found." };

  if ((booking.outcome === "working" || booking.outcome === "not_going") && (lead.stage === "WON" || lead.stage === "LOST") && booking.outcomeFromStage) {
    await moveLeadStage(businessId, leadId, booking.outcomeFromStage as PipelineStageName);
  }
  if (
    booking.outcome === "didnt_happen" &&
    lead.suggestedDraftKind === MEETING_MISSED_KIND &&
    lead.suggestedDraftedFor &&
    lead.suggestedDraftedFor >= booking.outcomeAt &&
    (await heldSince(businessId, leadId, booking.outcomeAt).catch(() => false))
  ) {
    await prisma.lead.update({ where: { id: leadId }, data: { suggestedMessage: null, suggestedSubject: null, suggestedDraftKind: null, suggestedRiskLevel: null } });
    // Today reads the customer's latest decision event, so the withdrawn
    // hold is closed the way "Skip for now" closes one; otherwise the next
    // note would think a reply was still waiting.
    await recordAudit({ businessId, userId }, "ai.hold_dismissed", { targetType: "lead", targetId: leadId, meta: { trigger: MEETING_MISSED_KIND, undone: true } });
  }
  await prisma.booking.update({ where: { id: booking.id }, data: { outcome: null, outcomeAt: null, outcomeFromStage: null } });
  await recordAudit({ businessId, userId }, "lead.meeting.outcome_undone", { targetType: "lead", targetId: leadId, meta: { bookingId: booking.id } });
  return { success: true };
}
