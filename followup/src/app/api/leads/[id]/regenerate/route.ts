import { NextRequest, NextResponse } from "next/server";
import { byTranscriptOrder } from "@/lib/transcript";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, billingLockedMessage, checkAiEligibility } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { generateFollowUpMessage } from "@/lib/integrations/openai";
import { composeFollowUpEmail, latestInboundText } from "@/lib/sender";
import { getVoiceSamples } from "@/lib/voice";
import { tooManyRecentActions } from "@/lib/rateLimit";
import type { Message } from "@/lib/types";
import { dmChannelOf } from "@/lib/dmDrafts";
import { draftDm } from "@/lib/dmDrafting";
import { Prisma } from "@prisma/client";

// POST /api/leads/[id]/regenerate — asks the AI for a fresh draft against
// this lead's real conversation, and saves it as the new suggested message.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (await tooManyRecentActions(ctx.businessId, "leads.regenerate", { windowMinutes: 10, max: 30 })) return NextResponse.json({ success: false, message: "Too many requests — try again in a few minutes." }, { status: 429 });
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: await billingLockedMessage(ctx.businessId) }, { status: 402 });
  }
  // 15 per 10 minutes — comfortably more than a person clicking "regenerate"
  // needs, tight enough to stop a runaway retry loop or a compromised
  // session from burning real OpenAI spend on the platform's own key.
  if (await tooManyRecentActions(ctx.businessId, "regenerate", { windowMinutes: 10, max: 15 })) {
    return NextResponse.json({ success: false, message: "Too many regenerations right now — try again in a few minutes." }, { status: 429 });
  }

  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      conversations: { include: { messages: { orderBy: { sentAt: "asc" } } } },
      business: { select: { tier: true } },
    },
  });
  if (!lead || lead.businessId !== ctx.businessId) {
    return NextResponse.json({ success: false, message: "Lead not found." }, { status: 404 });
  }

  // Free tier's AI processing pause applies to drafting on demand exactly
  // as it does to drafting automatically — same two conditions
  // scoreAndDraftForLead() (src/lib/scoring.ts), runAutomationForBusiness()
  // and runSequencesForBusiness() already apply. Without this, "regenerate"
  // was a way to walk straight past the cap: requireActiveBilling() admits
  // Free tier by design, so a $0 business could draft against lead #500 of
  // the month, on a channel Free doesn't cover, up to the rate limit above
  // (15 per 10 minutes, ~2,000 model calls a day) on the platform's shared
  // OpenAI key. The cap is only meaningful if every route that reaches the
  // model honours it.
  const tier = (lead.business.tier ?? "free") as "free" | "plus" | "pro";
  const eligible = await checkAiEligibility(lead.businessId, lead, tier);
  if (!eligible.ok) {
    return NextResponse.json(
      {
        success: false,
        // 402 ("payment required") is right for Free, where there is
        // genuinely something to buy. A paid account that trips its
        // circuit breaker has not run out of anything purchasable, so it
        // gets 429 and a message that doesn't try to sell it an upgrade.
        message:
          tier === "free"
            ? `AI drafting is paused for this lead — it is ${eligible.reason}. Upgrade under Billing in Settings.`
            : eligible.reason,
      },
      { status: tier === "free" ? 402 : 429 }
    );
  }

  const conversation: Message[] = lead.conversations.flatMap((c) =>
    c.messages.map((m) => ({
      id: m.id,
      direction: m.direction as Message["direction"],
      channel: c.channel as Message["channel"],
      body: m.body,
      date: m.sentAt.toISOString(),
      opened: m.opened,
      source: m.source ?? undefined,
      trigger: m.trigger ?? undefined,
      quickReplyPayload: m.quickReplyPayload ?? undefined,
    }))
  ).sort(byTranscriptOrder);

  try {
    const voiceSamples = await getVoiceSamples(lead.businessId);
    // Same shape rule as scoreAndDraftForLead (src/lib/scoring.ts): a lead
    // who last wrote on Instagram or Messenger gets a DM with reply
    // buttons, everyone else the framed email.
    const dmChannel = dmChannelOf(conversation);
    let newMessage: string;
    let newSubject: string | null;
    let newQuickReplies: Prisma.InputJsonValue | typeof Prisma.JsonNull;
    if (dmChannel) {
      const dm = await draftDm(lead.name, conversation, voiceSamples, undefined);
      newMessage = dm.body;
      newSubject = null;
      newQuickReplies = (dm.shapeFailed ? { question: dm.quickReplies.question, buttons: [] } : dm.quickReplies) as unknown as Prisma.InputJsonValue;
    } else {
      const draft = await generateFollowUpMessage({ name: lead.name, conversation }, voiceSamples);
      newMessage = await composeFollowUpEmail(lead.name.split(" ")[0], lead.businessId, draft.body, {
        languageSample: latestInboundText(conversation),
      });
      newSubject = draft.subject;
      newQuickReplies = Prisma.JsonNull;
    }
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        suggestedMessage: newMessage,
        suggestedSubject: newSubject,
        suggestedQuickReplies: newQuickReplies,
        // The old verdict judged the old words (audit 2026-09-25 F2).
        suggestedRiskLevel: null,
        suggestedRiskReason: null,
        // Stamp what this draft was written against, the same as every
        // other writer of suggestedMessage. Without it a hand-regenerated
        // draft reads as provenance-unknown, and the next automation pass
        // would pay to rebuild the draft the owner just asked for.
        suggestedDraftedFor: conversation.length
          ? new Date(conversation[conversation.length - 1].date)
          : null,
      },
    });
    return NextResponse.json({ success: true, message: newMessage, subject: newSubject ?? undefined });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Regeneration failed.";
    return NextResponse.json({ success: false, message: reason }, { status: 500 });
  }
}
