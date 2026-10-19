import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { getSessionContext } from "@/lib/session";
import { parseJsonBody } from "@/lib/validation";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { MAX_PASTE, TRAINING_CHANNELS, type TrainingChannel } from "@/lib/trainingParse";
import { cleanedText } from "@/lib/validation";
import {
  clearVerdicts,
  deleteConversation,
  deleteExample,
  getExample,
  nextToScore,
  readConversation,
  saveConversation,
  saveFollowUpReply,
  saveTalkExample,
  setVerdict,
  VERDICTS,
} from "@/lib/training";
import { practiceReply, type PracticeChannel } from "@/lib/practiceReply";
import { writeCoachRule } from "@/lib/integrations/openai";
import { deleteTrainingRule, getTrainingRules, saveTrainingRule, updateTrainingRule } from "@/lib/trainingRules";
import { MAX_RULE_NOTE, MAX_RULE_TEXT } from "@/lib/trainingRuleLines";
import { INDUSTRIES } from "@/lib/industries";

// One FollowUp reply per call: a reply and its send check.
export const maxDuration = 60;

/** Each scorecard step is a few paid model calls; this keeps a stuck page from running up the bill. */
const SCORES_PER_DAY = 300;
const SAVES_PER_DAY = 100;
/** "Talk to it" (A-294): each customer message is a few paid model calls; teaching is a write only. */
const TALKS_PER_DAY = 300;
const TEACHES_PER_DAY = 300;
/** "Tell FollowUp what's wrong" (A-297): each one writes a rule and the reply again, a few paid model calls. */
const COACHES_PER_DAY = 100;
/** One "Talk to it" chat: long enough to reach a booking, short enough to stay cheap (as in "Try it yourself"). */
const MAX_TALK_TURNS = 24;

const talkTurns = z
  .array(z.object({ from: z.enum(["customer", "followup"]), text: cleanedText(1500) }))
  .max(MAX_TALK_TURNS);
const talkChannel = z.enum(["email", "instagram", "messenger"]);

/** Where the scorecard replays a moment: the shape FollowUp really uses there today. WhatsApp and text get the email shape. */
const REPLAY_AS: Record<TrainingChannel, PracticeChannel> = { email: "email", instagram: "instagram", messenger: "messenger", whatsapp: "email", text: "email" };

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("read"), raw: z.string().max(MAX_PASTE), agent: z.string().max(80).nullish() }),
  z.object({
    action: z.literal("save"),
    raw: z.string().max(MAX_PASTE),
    agent: z.string().min(1).max(80),
    trade: z.enum(INDUSTRIES),
    channel: z.enum(TRAINING_CHANNELS as [TrainingChannel, ...TrainingChannel[]]),
    permission: z.literal(true),
  }),
  z.object({ action: z.literal("score"), id: z.string().max(64).nullish() }),
  z.object({ action: z.literal("vote"), id: z.string().min(1).max(64), verdict: z.enum(VERDICTS as ["followup", "same", "agent"]) }),
  z.object({ action: z.literal("reset") }),
  z.object({
    action: z.literal("talk"),
    trade: z.enum(INDUSTRIES),
    channel: talkChannel,
    turns: talkTurns.min(1),
    qualification: z.unknown().optional(),
    contactAsked: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("teach"),
    conversationId: z.string().max(64).nullish(),
    trade: z.enum(INDUSTRIES),
    channel: talkChannel,
    // The turns before the customer's message, then what the customer said, what FollowUp answered, and (when the
    // founder wrote one) what it should have said. Null keeps FollowUp's own answer as a good one.
    context: talkTurns,
    customerSaid: cleanedText(1500),
    followUpReply: cleanedText(1500),
    taught: cleanedText(1500).nullish(),
  }),
  z.object({ action: z.literal("untrain"), id: z.string().min(1).max(64) }),
  z.object({
    action: z.literal("coach"),
    trade: z.enum(INDUSTRIES),
    channel: talkChannel,
    // The turns before the customer's message, the message FollowUp answered, its answer, and what the founder says
    // is wrong with it. The where-they-stand state from before that answer, so the rewrite picks up from the same point.
    context: talkTurns,
    customerSaid: cleanedText(1500),
    followUpReply: cleanedText(1500),
    note: cleanedText(MAX_RULE_NOTE),
    qualification: z.unknown().optional(),
    contactAsked: z.boolean().optional(),
  }),
  // "Claude on the Train page" (A-298): the Save button on a rule Claude proposed.
  z.object({ action: z.literal("rule-add"), trade: z.enum(INDUSTRIES), text: cleanedText(MAX_RULE_TEXT) }),
  z.object({ action: z.literal("rule-edit"), id: z.string().min(1).max(64), text: cleanedText(MAX_RULE_TEXT) }),
  z.object({ action: z.literal("rule-undo"), id: z.string().min(1).max(64) }),
]);

function fromAnotherSite(request: NextRequest): boolean {
  const site = request.headers.get("sec-fetch-site");
  return site === "cross-site" || site === "same-site";
}

/** The founder, signed in, from this site, with their own business (the scorecard drafts as it). Anyone else gets a 404. */
async function founder(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx || !isPlatformAdmin(ctx.email)) return { error: NextResponse.json({ success: false, message: "Not found." }, { status: 404 }) };
  if (fromAnotherSite(request)) {
    return { error: NextResponse.json({ success: false, message: "Refused: this request came from another site." }, { status: 403 }) };
  }
  return { ctx };
}

/**
 * POST /api/admin/train — "Train FollowUp" (A-292), founder only. One route:
 * read (split and scrub a paste, nothing saved), save (keep the scrubbed examples), score (FollowUp's reply for the
 * next moment), vote (which was better), reset (clear every verdict to score again), and "Talk to it" (A-294):
 * talk (FollowUp answers the founder playing a customer, as the chosen kind of business), teach (keep that answer, or
 * what it should have said, as an example), untrain (undo one); and "Tell FollowUp what's wrong" (A-297): coach (the
 * founder's words become a rule for that kind of business, and the answer is written again with it), rule-edit,
 * rule-undo; and rule-add, the Save button on a rule Claude proposed (A-298, src/lib/trainer.ts).
 */
export async function POST(request: NextRequest) {
  const { ctx, error } = await founder(request);
  if (error) return error;
  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  switch (body.action) {
    case "read": {
      const result = readConversation(body.raw, body.agent);
      if (result.speakers.length < 2) {
        return NextResponse.json(
          { success: false, message: "FollowUp couldn't find two people talking. Each message needs a name before it, like \"Maya: Hi\"." },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: true, ...result });
    }

    case "save": {
      if (await tooManyRecentActions(ctx.businessId, "admin.train.save", { windowMinutes: 24 * 60, max: SAVES_PER_DAY })) {
        return NextResponse.json({ success: false, message: "That's a lot for one day. Try again tomorrow." }, { status: 429 });
      }
      try {
        const saved = await saveConversation({ trade: body.trade, channel: body.channel, raw: body.raw, agent: body.agent }, ctx.userId);
        return NextResponse.json({ success: true, ...saved });
      } catch (e) {
        const message =
          e instanceof Error && e.message === "no-examples"
            ? "No reply from the business answers a customer here, so there's nothing to learn from."
            : "Pick who the business is, then save again.";
        return NextResponse.json({ success: false, message }, { status: 400 });
      }
    }

    case "score": {
      const example = body.id ? await getExample(body.id) : await nextToScore();
      if (!example) return NextResponse.json({ success: true, example: null });
      if (example.followUpReply) return NextResponse.json({ success: true, example });
      if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ success: false, message: "FollowUp can't write replies on this copy of the app." }, { status: 503 });
      }
      if (await tooManyRecentActions(ctx.businessId, "admin.train.score", { windowMinutes: 24 * 60, max: SCORES_PER_DAY })) {
        return NextResponse.json({ success: false, message: "That's a lot for one day. Try again tomorrow." }, { status: 429 });
      }
      const turns = [
        ...example.context.map((t) => ({ from: t.from === "agent" ? ("followup" as const) : ("customer" as const), text: t.text })),
        { from: "customer" as const, text: example.customerSaid },
      ];
      try {
        const written = await practiceReply(ctx.businessId, "there", turns, null, REPLAY_AS[example.channel], false, {
          excludeTrainingId: example.id,
          industry: example.trade,
        });
        await saveFollowUpReply(example.id, written.reply);
        return NextResponse.json({ success: true, example: { ...example, followUpReply: written.reply } });
      } catch {
        return NextResponse.json({ success: false, message: "FollowUp couldn't write this one. Try again." }, { status: 502 });
      }
    }

    case "vote": {
      const ok = await setVerdict(body.id, body.verdict);
      return NextResponse.json({ success: ok }, { status: ok ? 200 : 404 });
    }

    case "talk": {
      const last = body.turns[body.turns.length - 1];
      if (last.from !== "customer" || !last.text) {
        return NextResponse.json({ success: false, message: "Write something as the customer first." }, { status: 400 });
      }
      if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ success: false, message: "FollowUp can't write replies on this copy of the app." }, { status: 503 });
      }
      if (await tooManyRecentActions(ctx.businessId, "admin.train.talk", { windowMinutes: 24 * 60, max: TALKS_PER_DAY })) {
        return NextResponse.json({ success: false, message: "That's a lot for one day. Try again tomorrow." }, { status: 429 });
      }
      try {
        const result = await practiceReply(ctx.businessId, "there", body.turns, body.qualification, body.channel, body.contactAsked ?? false, {
          industry: body.trade,
        });
        return NextResponse.json({ success: true, ...result });
      } catch {
        return NextResponse.json({ success: false, message: "FollowUp couldn't answer just now. Try again." }, { status: 502 });
      }
    }

    case "teach": {
      const taught = body.taught?.trim() ? body.taught : null;
      if (!body.customerSaid || !body.followUpReply || (body.taught !== undefined && body.taught !== null && !taught)) {
        return NextResponse.json({ success: false, message: "Write what it should say first." }, { status: 400 });
      }
      if (await tooManyRecentActions(ctx.businessId, "admin.train.teach", { windowMinutes: 24 * 60, max: TEACHES_PER_DAY })) {
        return NextResponse.json({ success: false, message: "That's a lot for one day. Try again tomorrow." }, { status: 429 });
      }
      const saved = await saveTalkExample(
        {
          conversationId: body.conversationId,
          trade: body.trade,
          channel: body.channel,
          context: body.context.map((t) => ({ from: t.from === "followup" ? ("agent" as const) : ("customer" as const), text: t.text })),
          customerSaid: body.customerSaid,
          followUpReply: body.followUpReply,
          taught,
        },
        ctx.userId
      );
      return NextResponse.json({ success: true, ...saved });
    }

    case "untrain": {
      const ok = await deleteExample(body.id);
      return NextResponse.json({ success: ok }, { status: ok ? 200 : 404 });
    }

    case "coach": {
      if (!body.note.trim() || !body.customerSaid || !body.followUpReply) {
        return NextResponse.json({ success: false, message: "Say what's wrong with this reply first." }, { status: 400 });
      }
      if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ success: false, message: "FollowUp can't write replies on this copy of the app." }, { status: 503 });
      }
      if (await tooManyRecentActions(ctx.businessId, "admin.train.coach", { windowMinutes: 24 * 60, max: COACHES_PER_DAY })) {
        return NextResponse.json({ success: false, message: "That's a lot for one day. Try again tomorrow." }, { status: 429 });
      }
      let rule: { id: string; text: string };
      try {
        const text = await writeCoachRule({
          trade: body.trade,
          customerSaid: body.customerSaid,
          followUpReply: body.followUpReply,
          note: body.note,
          existing: await getTrainingRules(body.trade),
        });
        rule = await saveTrainingRule({ trade: body.trade, text, note: body.note }, ctx.userId);
      } catch {
        return NextResponse.json({ success: false, message: "FollowUp couldn't turn that into a rule. Try saying it another way." }, { status: 502 });
      }
      // The answer again, for the same moment, now that the rule is in place.
      try {
        const turns = [...body.context, { from: "customer" as const, text: body.customerSaid }];
        const result = await practiceReply(ctx.businessId, "there", turns, body.qualification ?? null, body.channel, body.contactAsked ?? false, {
          industry: body.trade,
        });
        return NextResponse.json({ success: true, rule, reply: result.reply, qualification: result.qualification, contactAsked: result.contactAsked });
      } catch {
        return NextResponse.json({ success: true, rule, reply: null, message: "The rule is saved. FollowUp couldn't write the reply again just now." });
      }
    }

    case "rule-add": {
      if (!body.text.trim()) return NextResponse.json({ success: false, message: "The rule is empty." }, { status: 400 });
      if (await tooManyRecentActions(ctx.businessId, "admin.train.rule", { windowMinutes: 24 * 60, max: TEACHES_PER_DAY })) {
        return NextResponse.json({ success: false, message: "That's a lot for one day. Try again tomorrow." }, { status: 429 });
      }
      const rule = await saveTrainingRule({ trade: body.trade, text: body.text, note: "Proposed by Claude on Train, saved by the founder." }, ctx.userId);
      return NextResponse.json({ success: true, rule });
    }

    case "rule-edit": {
      const ok = await updateTrainingRule(body.id, body.text);
      return NextResponse.json({ success: ok }, { status: ok ? 200 : 404 });
    }

    case "rule-undo": {
      const ok = await deleteTrainingRule(body.id);
      return NextResponse.json({ success: ok }, { status: ok ? 200 : 404 });
    }

    case "reset": {
      const count = await clearVerdicts();
      return NextResponse.json({ success: true, count });
    }
  }
}

/** DELETE ?id= — remove one conversation and every example taken from it. */
export async function DELETE(request: NextRequest) {
  const { error } = await founder(request);
  if (error) return error;
  const id = new URL(request.url).searchParams.get("id")?.slice(0, 64);
  if (!id) return NextResponse.json({ success: false, message: "Nothing to remove." }, { status: 400 });
  const ok = await deleteConversation(id);
  return NextResponse.json({ success: ok }, { status: ok ? 200 : 404 });
}
