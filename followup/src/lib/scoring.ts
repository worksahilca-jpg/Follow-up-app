/**
 * Orchestration: loads a lead's real conversation from the DB, scores it
 * and drafts a follow-up via the AI integration, and writes the results
 * back. Kept separate from gmail.ts/openai.ts so each integration stays a
 * clean, independently-swappable abstraction — this is the glue, not part
 * of either provider's interface.
 */

import { prisma } from "@/lib/db";
import { scoreLead, generateFollowUpMessage } from "@/lib/integrations/openai";
import { composeFollowUpEmail } from "@/lib/sender";
import { getVoiceSamples } from "@/lib/voice";
import type { Message } from "@/lib/types";
import type { Priority as DbPriority, Prisma } from "@prisma/client";

function priorityFromScore(score: number): DbPriority {
  if (score >= 70) return "HIGH";
  if (score >= 40) return "MEDIUM";
  if (score > 0) return "LOW";
  return "NONE";
}

/** Scores one lead (by id) against its real conversation history and persists the result. Returns false if there's nothing to score yet (no messages) or AI isn't configured. */
export async function scoreAndDraftForLead(leadId: string): Promise<boolean> {
  if (!process.env.OPENAI_API_KEY) return false;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { conversations: { include: { messages: { orderBy: { sentAt: "asc" } } } } },
  });
  if (!lead) return false;

  const conversation: Message[] = lead.conversations.flatMap((c) =>
    c.messages.map((m) => ({
      id: m.id,
      direction: m.direction as Message["direction"],
      channel: c.channel as Message["channel"],
      body: m.body,
      date: m.sentAt.toISOString(),
      opened: m.opened,
    }))
  );
  if (conversation.length === 0) return false;

  const [scoreResult, voiceSamples] = await Promise.all([
    scoreLead({
      conversation,
      dealValue: lead.dealValue,
      lastContacted: (lead.lastContacted ?? lead.createdAt).toISOString(),
    }),
    getVoiceSamples(lead.businessId),
  ]);
  const draftBody = await generateFollowUpMessage({ name: lead.name, conversation }, voiceSamples);
  const suggestedMessage = await composeFollowUpEmail(lead.name.split(" ")[0], lead.businessId, draftBody);

  const newPriority = priorityFromScore(scoreResult.score);
  // "Handoff" — the explicit "this one's ready, go close it" moment the
  // product was missing (see PRODUCT_DIRECTION.md's mission: AI decides
  // qualified, business owner takes over). Fires only on a genuine
  // NOT-HIGH -> HIGH transition, comparing against the priority already
  // loaded above before this write — not on every re-score while a lead
  // stays hot, which would just be noise. No atomic dedup guard here the
  // way rapid-engagement/missed-call-text-back have one: this function
  // isn't called with anywhere near their concurrency (one sync/reply
  // cycle at a time per lead in practice), and the failure mode of an
  // occasional duplicate notification is cosmetic, not a data-integrity
  // problem like those two were.
  const becameHot = lead.priority !== "HIGH" && newPriority === "HIGH";

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      score: scoreResult.score,
      scoreReason: scoreResult.reason,
      scoreFactors: scoreResult.factors as unknown as Prisma.InputJsonValue,
      priority: newPriority,
      suggestedMessage,
    },
  });

  // Nobody assigned means nobody to hand this off to — same posture as
  // checkRapidEngagement() in src/lib/engagement.ts.
  if (becameHot && lead.assignedToId) {
    await prisma.notification.create({
      data: {
        userId: lead.assignedToId,
        leadId: lead.id,
        message: `${lead.name} just became a hot lead — ${scoreResult.reason}`,
      },
    });
  }

  return true;
}
