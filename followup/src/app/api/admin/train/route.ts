import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { getSessionContext } from "@/lib/session";
import { parseJsonBody } from "@/lib/validation";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { MAX_PASTE, TRAINING_CHANNELS, type TrainingChannel } from "@/lib/trainingParse";
import {
  clearVerdicts,
  deleteConversation,
  getExample,
  nextToScore,
  readConversation,
  saveConversation,
  saveFollowUpReply,
  setVerdict,
  VERDICTS,
} from "@/lib/training";
import { practiceReply, type PracticeChannel } from "@/lib/practiceReply";

// One FollowUp reply per call: a reply and its send check.
export const maxDuration = 60;

/** Each scorecard step is a few paid model calls; this keeps a stuck page from running up the bill. */
const SCORES_PER_DAY = 300;
const SAVES_PER_DAY = 100;

/** Where the scorecard replays a moment: the shape FollowUp really uses there today. WhatsApp and text get the email shape. */
const REPLAY_AS: Record<TrainingChannel, PracticeChannel> = { email: "email", instagram: "instagram", whatsapp: "email", text: "email" };

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("read"), raw: z.string().max(MAX_PASTE), agent: z.string().max(80).nullish() }),
  z.object({
    action: z.literal("save"),
    raw: z.string().max(MAX_PASTE),
    agent: z.string().min(1).max(80),
    channel: z.enum(TRAINING_CHANNELS as [TrainingChannel, ...TrainingChannel[]]),
    permission: z.literal(true),
  }),
  z.object({ action: z.literal("score"), id: z.string().max(64).nullish() }),
  z.object({ action: z.literal("vote"), id: z.string().min(1).max(64), verdict: z.enum(VERDICTS as ["followup", "same", "agent"]) }),
  z.object({ action: z.literal("reset") }),
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
 * POST /api/admin/train — "Train FollowUp" (A-292), founder only. One route, five steps:
 * read (split and scrub a paste, nothing saved), save (keep the scrubbed examples), score (FollowUp's reply for the
 * next moment), vote (which was better), reset (clear every verdict to score again).
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
        const saved = await saveConversation({ channel: body.channel, raw: body.raw, agent: body.agent }, ctx.userId);
        return NextResponse.json({ success: true, ...saved });
      } catch (e) {
        const message =
          e instanceof Error && e.message === "no-examples"
            ? "No realtor reply answers a customer here, so there's nothing to learn from."
            : "Pick who the realtor is, then save again.";
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
          industry: "Real estate",
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
