/**
 * Orchestration: loads a lead's real conversation from the DB, scores it
 * and drafts a follow-up via the AI integration, and writes the results
 * back. Kept separate from gmail.ts/openai.ts so each integration stays a
 * clean, independently-swappable abstraction — this is the glue, not part
 * of either provider's interface.
 */

import { prisma } from "@/lib/db";
import { scoreLead, generateFollowUpMessage } from "@/lib/integrations/openai";
import { composeFollowUpEmail, latestInboundText } from "@/lib/sender";
import { dmChannelOf } from "@/lib/dmDrafts";
import { draftDm } from "@/lib/dmDrafting";
import { getVoiceSamples } from "@/lib/voice";
import { checkAiEligibility } from "@/lib/billing";
import { SCORE_HIGH, SCORE_MEDIUM } from "@/lib/scoreThresholds";
import { notifySlack } from "@/lib/slack";
import type { Message } from "@/lib/types";
import { Prisma, type Priority as DbPriority } from "@prisma/client";

// Cut-points come from @/lib/scoreThresholds, shared with ScoreBadge —
// the two used to carry their own copies (70/40 here, 75/45 there) and
// both render on the same card, so a lead at 72 read "high priority"
// beside a badge coloured medium.
function priorityFromScore(score: number): DbPriority {
  if (score >= SCORE_HIGH) return "HIGH";
  if (score >= SCORE_MEDIUM) return "MEDIUM";
  if (score > 0) return "LOW";
  return "NONE";
}

/** Scores one lead (by id) against its real conversation history and persists the result. Returns false if there's nothing to score yet (no messages), AI isn't configured, or the lead's Free-tier business has paused AI processing for it (over the monthly cap, or captured on a channel Free doesn't cover — see @/lib/billing). */
export async function scoreAndDraftForLead(leadId: string): Promise<boolean> {
  if (!process.env.OPENAI_API_KEY) return false;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      conversations: { include: { messages: { orderBy: { sentAt: "asc" } } } },
      business: { select: { tier: true } },
    },
  });
  if (!lead) return false;

  // "AI processing pauses past lead #20, and for channels Free doesn't
  // cover" (research/market/2026-09-11-tier-pricing-recommendation.md
  // §2.2) — capture already happened by the time this runs (every capture
  // path creates the Lead row first, then calls this), so nothing here
  // ever drops a real inquiry; it only skips the scoring/drafting/
  // translation this function does.
  //
  // Every tier is checked now, not just Free. Plus's 1,500/mo and Pro's
  // 10,000/mo were published policy with nothing enforcing them, which
  // left the paid tiers with no upper bound on AI processing at all — see
  // TIER_AI_LEAD_CAP for why those two are circuit breakers rather than
  // caps a customer is expected to reach.
  const tier = (lead.business.tier ?? "free") as "free" | "plus" | "pro";
  if (!(await checkAiEligibility(lead.businessId, lead, tier)).ok) return false;

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
      deliveryStatus: m.deliveryStatus ?? undefined,
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
  // The draft takes the shape of the channel the lead last wrote on. An
  // Instagram or Messenger lead gets a DM — short, no subject, one
  // question, reply buttons (src/lib/dmDrafts.ts) — stored bare, with the
  // buttons beside it; everyone else gets the framed email this always
  // wrote. Before this, a DM lead's suggested reply was an email with
  // "Hi <name>," and a sign-off, and that is what the automation pass sent
  // into their Instagram inbox (research 2026-09-16, verified).
  const dmChannel = dmChannelOf(conversation);
  let suggestedMessage: string;
  let suggestedSubject: string | null;
  let suggestedQuickReplies: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  if (dmChannel) {
    const dm = await draftDm(lead.name, conversation, voiceSamples, undefined);
    suggestedMessage = dm.body;
    suggestedSubject = null;
    // Buttons only when the draft passed the shape check — an owner may
    // still send a draft that failed it (they can edit), but never with
    // chips under a message that had two questions.
    suggestedQuickReplies = (dm.shapeFailed ? { question: dm.quickReplies.question, buttons: [] } : dm.quickReplies) as unknown as Prisma.InputJsonValue;
  } else {
    const draft = await generateFollowUpMessage({ name: lead.name, conversation }, voiceSamples);
    suggestedMessage = await composeFollowUpEmail(lead.name.split(" ")[0], lead.businessId, draft.body, {
      languageSample: latestInboundText(conversation),
    });
    suggestedSubject = draft.subject;
    suggestedQuickReplies = Prisma.JsonNull;
  }

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
      suggestedSubject,
      suggestedQuickReplies,
      // Stamp what this draft was written against, so the automation pass
      // can tell a still-current draft from a stale one instead of
      // rebuilding it every 20 hours (see schema.prisma).
      suggestedDraftedFor: new Date(conversation[conversation.length - 1].date),
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
  // Team-wide Slack echo of the same handoff moment — see slack.ts for
  // the "one shared webhook, not per-business" scoping note. Fires
  // whenever a lead goes hot, independent of whether it also got an
  // in-app Notification row above (that one needs an assignee; this one
  // doesn't, so the team never misses a hot lead just because nobody's
  // been assigned to it yet).
  if (becameHot) {
    void notifySlack(`🔥 *${lead.name}*${lead.company ? ` (${lead.company})` : ""} just became a hot lead — ${scoreResult.reason}`);
  }

  return true;
}
