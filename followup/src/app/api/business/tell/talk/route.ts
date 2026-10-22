import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { proposeTellTalk, transcribeAudio } from "@/lib/integrations/openai";
import { squash } from "@/lib/factLines";
import { NEXT_QUESTION_GAP_MS } from "@/lib/dailyQuestion";
import { correctionRows, playbackRows } from "@/lib/tellFollowUp";
import { addToDraft, loadTellState, tellPlayback } from "@/lib/tellFollowUpData";
import { MAX_TALK_BYTES, MAX_TALK_CHARS, MAX_TALK_ROWS, MAX_TALK_SECONDS, MIN_TALK_SECONDS, talkFileName } from "@/lib/tellTalk";

// Writing down a few minutes of talk, then reading it, can take longer than the default.
export const maxDuration = 60;

const fail = (message: string, status: number) => NextResponse.json({ success: false, message }, { status });

/**
 * POST /api/business/tell/talk — "Talk to FollowUp about your business" (A-318; src/lib/tellTalk.ts). Takes one
 * recording (form fields `audio`, `seconds`, and `again` as "1" when the skipped questions are back), writes it down
 * with the transcription voicemails use, reads the words against the meeting's questions, and adds what it took to the
 * meeting's draft with the words themselves. Replies with the play-back, the same as the typed meeting's end (A-314):
 * nothing is used before "Looks right".
 *
 * The recording is never stored: it lives in this request's memory, goes to the transcription, and is gone. Admin only,
 * like the typed meeting. Limited per hour and per day, and counted toward the business's daily AI ceiling. Audited
 * with its length and how many things it took, never the words.
 */
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return fail("Not signed in.", 401);
  if (!(await requireAdmin(ctx))) return fail("Only an admin can teach FollowUp about the business.", 403);
  // A form post is a request another site could make; only this app's own page sends a recording here.
  if (request.headers.get("sec-fetch-site") === "cross-site") return fail("Not allowed.", 403);
  // A recording too big to be a five-minute talk is turned away before it is read.
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_TALK_BYTES + 64 * 1024) return fail("That recording is too long. Keep it under 5 minutes.", 413);
  if (await tooManyRecentActions(ctx.businessId, "business.tell.talk", { windowMinutes: 60, max: 10 })) {
    return fail("That's a lot of talking for one hour. Try again a little later, or type instead.", 429);
  }
  if (await tooManyRecentActions(ctx.businessId, "business.tell.talk.day", { windowMinutes: 24 * 60, max: 20 })) {
    return fail("That's a lot of talking for one day. Try again tomorrow, or type instead.", 429);
  }
  const { AI_RUNS_PER_BUSINESS_PER_DAY } = await import("@/lib/scoring");
  if (await tooManyRecentActions(ctx.businessId, "ai.run", AI_RUNS_PER_BUSINESS_PER_DAY)) {
    return fail("FollowUp has done a lot today. Try again tomorrow.", 429);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("That recording didn't come through. Try again.", 400);
  }
  const audio = form.get("audio");
  const seconds = Number(form.get("seconds"));
  const again = form.get("again") === "1";
  if (!(audio instanceof Blob) || audio.size === 0) return fail("That recording didn't come through. Try again.", 400);
  if (audio.size > MAX_TALK_BYTES) return fail("That recording is too long. Keep it under 5 minutes.", 413);
  const name = talkFileName(audio.type);
  if (!name) return fail("FollowUp can't read that kind of recording. Try again, or type instead.", 415);
  if (!Number.isFinite(seconds) || seconds < MIN_TALK_SECONDS) return fail("That was too short. Try again and talk a little longer.", 400);
  if (seconds > MAX_TALK_SECONDS + 5) return fail("That recording is too long. Keep it under 5 minutes.", 413);

  const state = await loadTellState(ctx.businessId, again);
  if (!state) return fail("Business not found.", 404);

  let said: string;
  try {
    said = squash(await transcribeAudio(Buffer.from(await audio.arrayBuffer()), name)).slice(0, MAX_TALK_CHARS);
  } catch (err) {
    console.error(`Could not write down a "Talk to FollowUp" recording for business ${ctx.businessId}:`, err instanceof Error ? err.message : err);
    return fail("FollowUp couldn't write that down. Try again, or type instead.", 502);
  }
  if (said.length < 10) return fail("FollowUp couldn't hear any words in that. Try again a little closer to the phone, or type instead.", 422);

  const known = playbackRows(state.facts, state.draft, state.topics.map((t) => t.label));
  const labels = [...new Set([...state.topics.map((t) => t.label), ...known.map((r) => r.label)])];
  // A hiccup reading the words keeps nothing: the owner can say it again, and no line is ever invented.
  const proposed = await proposeTellTalk(said, known, labels).catch((err) => {
    console.error(`Could not read a "Talk to FollowUp" talk for business ${ctx.businessId}:`, err instanceof Error ? err.message : err);
    return null;
  });
  const rows = correctionRows(said, proposed, labels, MAX_TALK_ROWS);
  if (rows.length === 0) {
    return fail("FollowUp couldn't find anything a customer could use in that. Try again, or type instead.", 422);
  }

  const talk = { text: said, seconds: Math.round(Math.min(seconds, MAX_TALK_SECONDS)) };
  await addToDraft(ctx.businessId, rows, talk);
  // The daily question rests after the meeting, as after a typed answer (A-101); the card on Today stays answered.
  const now = new Date();
  const business = await prisma.business.findUnique({ where: { id: ctx.businessId }, select: { tellCardClosedAt: true } });
  await prisma.business.update({
    where: { id: ctx.businessId },
    data: { tellCardClosedAt: business?.tellCardClosedAt ?? now, questionAfter: new Date(now.getTime() + NEXT_QUESTION_GAP_MS) },
  });
  void recordAudit(ctx, "business.tell", { targetType: "business", targetId: ctx.businessId, meta: { decision: "talked", facts: rows.length, seconds: talk.seconds } });
  const after = await loadTellState(ctx.businessId, again);
  return NextResponse.json({ success: true, state: after, playback: after ? await tellPlayback(ctx.businessId, after) : null });
}
