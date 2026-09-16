import { prisma } from "@/lib/db";
import { pickAssignee } from "@/lib/assignment";
import { scoreAndDraftForLead } from "@/lib/scoring";
import { notifyLeadEvent } from "@/lib/outboundWebhook";
import { applySourceRouting } from "@/lib/sourceRouting";
import { acknowledgeNewLead } from "@/lib/acknowledge";
import { findOrCreateConversation } from "@/lib/conversations";
import { findConflictingLead } from "@/lib/leadConflict";
import { createInboundMessageIfNew } from "@/lib/instagram";

export type LeadFormSubmission = {
  name: string;
  /** Already lowercased by the caller; "" when absent. */
  email: string;
  phone: string;
  message: string;
};

/**
 * Everything the embed widget and the generic lead webhook do AFTER the
 * submission has been written to InboundWebhookEvent. The two routes were
 * near-identical copies of this (only the `source` string and the response
 * shape differed); they now share it so a replay runs the same code the
 * live submission ran.
 *
 * `eventId` is the InboundWebhookEvent row's id, and it doubles as the
 * idempotency key for the Message this creates. These two channels are the
 * only ones with no provider-supplied message id — without a key, replaying
 * a submission whose processing died halfway would append the visitor's
 * message to the conversation a second time. With it, replay is safe:
 * createInboundMessageIfNew reports the collision instead of duplicating,
 * exactly as it already does for Twilio's MessageSid and Meta's mid. A
 * genuinely new submission gets a new row, a new id, and is appended
 * normally.
 *
 * Deliberately NOT billing-gated — see both routes' comments. A submitted
 * form is the one copy of that lead in existence; scoreAndDraftForLead and
 * acknowledgeNewLead pause themselves via checkAiEligibility (@/lib/billing).
 */
export async function processLeadFormSubmission(
  businessId: string,
  source: "Webhook" | "Website form",
  submission: LeadFormSubmission,
  eventId: string,
  receivedAt: Date
): Promise<{ leadId?: string }> {
  const { name, email, phone, message } = submission;

  let leadId: string;
  try {
    const lead = await prisma.lead.create({
      data: {
        businessId,
        name,
        email: email || null,
        phone: phone || null,
        source,
        stage: "NEW",
        lastContacted: receivedAt,
        assignedToId: await pickAssignee(businessId),
      },
    });
    leadId = lead.id;
    void notifyLeadEvent(businessId, "lead.created", lead);
    // Only on the real creation branch — never on the conflict branch
    // below, where routing already ran for whichever request created the row.
    await applySourceRouting(businessId, lead.id, source);
  } catch (err) {
    // Duplicate email OR phone for this business (Lead carries both unique
    // constraints — see findConflictingLead) — the same lead re-sent (a
    // retried Zapier run, a re-submitted form, a replay of this very row)
    // shouldn't error. This used to just return success and drop the
    // resend's content entirely — an integration re-sending an updated
    // payload for a lead it already pushed once (a Google Form
    // edit-response sync, a CRM export re-run) was a total no-op beyond the
    // row already existing. Find the existing lead instead and treat this
    // the same as any other new inbound message on it: appended, re-scored,
    // and (subject to its own once-only guard) re-acknowledged — same
    // "conflict -> find and continue" shape findOrCreateLeadByPhone()
    // already uses for the SMS side of this same problem.
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      const existing = await findConflictingLead(businessId, email, phone);
      if (!existing) return { leadId: undefined };
      leadId = existing.id;
    } else {
      throw err;
    }
  }

  if (message) {
    const conversation = await findOrCreateConversation(leadId, "web");
    // Return value deliberately ignored: `false` means this exact
    // submission's Message is already on disk (a replay), which says
    // nothing about whether the scoring and acknowledgement below ever
    // ran — an OpenAI timeout right after the message was written is the
    // single likeliest reason this row is being replayed at all. Both
    // calls below are self-guarding (checkAiEligibility, and
    // acknowledgeNewLead's own once-per-lead acknowledgedAt check), so
    // re-running them is safe and is the point of the replay.
    await createInboundMessageIfNew(conversation.id, message, receivedAt, eventId);
    await scoreAndDraftForLead(leadId);
  }

  // A form/webhook lead gave us an email on purpose — acknowledge by email
  // only (never text a number nobody texted from). See src/lib/acknowledge.ts.
  if (email) {
    await acknowledgeNewLead(leadId, { channel: "email", inboundText: message, inboundAt: receivedAt });
  }

  return { leadId };
}
