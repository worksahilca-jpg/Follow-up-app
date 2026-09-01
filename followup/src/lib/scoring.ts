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

  const [scoreResult, draftBody] = await Promise.all([
    scoreLead({
      conversation,
      dealValue: lead.dealValue,
      lastContacted: (lead.lastContacted ?? lead.createdAt).toISOString(),
    }),
    generateFollowUpMessage({ name: lead.name, conversation }),
  ]);
  const suggestedMessage = await composeFollowUpEmail(lead.name.split(" ")[0], lead.businessId, draftBody);

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      score: scoreResult.score,
      scoreReason: scoreResult.reason,
      scoreFactors: scoreResult.factors as unknown as Prisma.InputJsonValue,
      priority: priorityFromScore(scoreResult.score),
      suggestedMessage,
    },
  });

  return true;
}
