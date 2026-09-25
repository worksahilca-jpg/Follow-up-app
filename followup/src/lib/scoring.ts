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
import { detectLeadLanguage, leadLanguageOf } from "@/lib/leadLanguage";
import { SCORE_HIGH, SCORE_MEDIUM } from "@/lib/scoreThresholds";
import { escapeSlackText, notifySlack } from "@/lib/slack";
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
  const eligible = await checkAiEligibility(lead.businessId, lead, tier);
  if (!eligible.ok) {
    // The refusal used to end here, verdict kept and reasoning dropped.
    // What the owner then saw was a lead with no score, no reason, no
    // draft and a badge promising a follow-up that was never coming —
    // the exact shape of a broken product, produced by one that had
    // worked correctly and simply said nothing about it (2026-09-19,
    // the first real Instagram DM). Storing it costs one write on a
    // path that is already refusing to do the expensive thing.
    //
    // `updateMany` rather than `update` so a lead deleted between the
    // read above and here is a no-op instead of a thrown P2025 on what
    // is otherwise a clean, quiet refusal.
    await prisma.lead.updateMany({ where: { id: lead.id }, data: { aiPausedReason: eligible.ownerMessage } });
    return false;
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
      deliveryStatus: m.deliveryStatus ?? undefined,
    }))
  );
  if (conversation.length === 0) return false;

  // How this lead writes, read from their NEWEST message, every time.
  //
  // This was briefly built the other way — decided once from the first
  // message and held — and the founder corrected it the same day
  // (2026-09-19): "suppose I am using Hinglish first and then switched
  // to English, so the reply should be according to the message.
  // Whatever language the lead will approach, we will reply in the same
  // language." He is right, and locking it was the wrong inference: a
  // person who switches to English is telling you something, and
  // answering them in the language they have just moved away from is
  // the rudeness the feature was supposed to prevent, not avoid.
  //
  // What survives from the first attempt is the STORAGE, not the lock.
  // Recording what was detected still makes the question answerable
  // ("how often are we wrong in Spanish") and still gives the learning
  // loop its grouping key — it is now a record of what was true at this
  // message rather than a verdict binding the next one.
  //
  // Runs in the same Promise.all as the score, so it costs latency only
  // when it is the slowest of the three, and it sits AFTER the
  // eligibility gate above, so a paused lead never pays for it.
  const [scoreResult, voiceSamples, detected] = await Promise.all([
    scoreLead({
      conversation,
      dealValue: lead.dealValue,
      lastContacted: (lead.lastContacted ?? lead.createdAt).toISOString(),
    }),
    getVoiceSamples(lead.businessId),
    detectLeadLanguage(latestInboundText(conversation) ?? ""),
  ]);

  // The newest reading wins. Falling back to the stored one only covers
  // the case where THIS message was too short to judge ("ok", "thanks")
  // — there, the last thing they actually wrote at length is a better
  // guess than nothing, and it is the same language the thread has been
  // in. Both absent means say nothing about language at all, which is
  // how every draft behaved before any of this existed.
  const leadLanguage = detected ?? leadLanguageOf(lead);
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
    const dm = await draftDm(lead.name, conversation, voiceSamples, undefined, undefined, leadLanguage);
    suggestedMessage = dm.body;
    suggestedSubject = null;
    // Buttons only when the draft passed the shape check — an owner may
    // still send a draft that failed it (they can edit), but never with
    // chips under a message that had two questions.
    suggestedQuickReplies = (dm.shapeFailed ? { question: dm.quickReplies.question, buttons: [] } : dm.quickReplies) as unknown as Prisma.InputJsonValue;
  } else {
    const draft = await generateFollowUpMessage({ name: lead.name, conversation }, voiceSamples, undefined, undefined, leadLanguage);
    suggestedMessage = await composeFollowUpEmail(lead.name.split(" ")[0], lead.businessId, draft.body, {
      languageSample: latestInboundText(conversation),
      leadLanguage,
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
      // A new draft is an unjudged draft. The risk verdict belonged to the
      // PREVIOUS text; kept, it let this one into "Send all routine" and
      // let the automation send it without a check (audit 2026-09-25 F2).
      // Null is "not judged", which is both true and never "safe".
      suggestedRiskLevel: null,
      suggestedRiskReason: null,
      // Stamp what this draft was written against, so the automation pass
      // can tell a still-current draft from a stale one instead of
      // rebuilding it every 20 hours (see schema.prisma).
      suggestedDraftedFor: new Date(conversation[conversation.length - 1].date),
      // A reply, not a reminder or a welcome back: the automation must not
      // mistake it for one of its own purpose-written drafts
      // (Lead.suggestedDraftKind).
      suggestedDraftKind: null,
      // What their newest message was written in, refreshed every pass.
      // `languageSetAt` is therefore "when we last read it", not "when we
      // decided" — a lead who switches from Hinglish to English is a lead
      // whose stored row switches with them.
      //
      // A failed detection writes nothing at all rather than clearing the
      // columns: a one-word "ok" is not evidence the lead stopped
      // speaking Spanish, and blanking the row on it would throw away a
      // good reading for a useless one.
      ...(detected
        ? {
            language: detected.language,
            languageScript: detected.script,
            languageRegister: detected.register,
            languageSetAt: new Date(),
          }
        : {}),
      // Whatever was paused here isn't any more — this write IS the proof.
      // Clearing it anywhere else (a billing webhook, an upgrade handler)
      // would be a second place that has to stay right; clearing it at the
      // moment the work actually lands cannot go stale.
      aiPausedReason: null,
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
    // Every interpolated piece is stranger-typed text: escaped so it can
    // only ever be text in Slack, never a link or a channel ping.
    void notifySlack(
      `🔥 *${escapeSlackText(lead.name)}*${lead.company ? ` (${escapeSlackText(lead.company)})` : ""} just became a hot lead — ${escapeSlackText(scoreResult.reason)}`
    );
  }

  return true;
}
