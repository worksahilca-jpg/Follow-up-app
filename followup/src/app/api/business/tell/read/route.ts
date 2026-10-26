import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { proposeTellRead } from "@/lib/integrations/openai";
import { labelKey } from "@/lib/factLines";
import { answeredByRead, correctionRows, currentTopic, parseTellDraft, playbackRows } from "@/lib/tellFollowUp";
import { addToDraft, loadTellState, tellPlayback, wordedTopic } from "@/lib/tellFollowUpData";
import { businessValue, normalizeWebsite, readLine, setupReadLine, siteName, sourceOf, type ReadSource, type SiteNote } from "@/lib/siteRead";
import { readInstagramPosts, readWebsite } from "@/lib/siteReadData";

// Reading a few pages and a model's read of them can take longer than the default.
export const maxDuration = 60;

const fail = (message: string, status: number) => NextResponse.json({ success: false, message }, { status });

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("read"),
    url: z.string().trim().max(200).optional(),
    instagram: z.boolean().optional(),
    again: z.boolean().optional(),
    // From setup's waiting screen: no next question to word, the meeting comes later.
    setup: z.boolean().optional(),
  }),
  // "No website, skip this": asked once.
  z.object({ action: z.literal("skip") }),
]);

/**
 * POST /api/business/tell/read — FollowUp reads the owner's own website and Instagram posts (A-328;
 * src/lib/siteRead.ts), from "Tell FollowUp" before its questions, or from setup's waiting screen.
 *
 *  - read: reads the site (and the posts, when asked and connected), takes a value for each of the meeting's questions
 *    they answer, copied word for word, and adds them to the meeting's draft with where each came from. Nothing is
 *    quoted to a customer before "Looks right" (A-314). Replies with the meeting's state and its next question, worded
 *    for this business, or the play-back when nothing is left to ask.
 *  - skip: "No website, skip this". Not asked again.
 *
 * Admin only, like the meeting. Limited per hour and per day, and counted toward the business's daily AI ceiling.
 * Audited with counts only, never the site's words.
 */
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return fail("Not signed in.", 401);
  if (!(await requireAdmin(ctx))) return fail("Only an admin can teach FollowUp about the business.", 403);
  const parsed = await parseJsonBody(request, schema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const now = new Date();

  if (body.action === "skip") {
    await prisma.business.update({ where: { id: ctx.businessId }, data: { websiteAskedAt: now } });
    void recordAudit(ctx, "business.tell", { targetType: "business", targetId: ctx.businessId, meta: { decision: "no_website" } });
    return NextResponse.json({ success: true });
  }

  // Setup has no questions on screen: its way out is leaving the box empty.
  const orElse = body.setup ? "or leave it" : "or skip it and answer the questions";
  const url = body.url ? normalizeWebsite(body.url) : null;
  if (body.url && !url) return fail("That doesn't look like a website link. Try something like yourwebsite.ca.", 400);
  if (!url && !body.instagram) return fail("Add your website link first.", 400);

  if (await tooManyRecentActions(ctx.businessId, "business.tell.read", { windowMinutes: 60, max: 6 })) {
    return fail("That's a lot of reading for one hour. Try again a little later.", 429);
  }
  if (await tooManyRecentActions(ctx.businessId, "business.tell.read.day", { windowMinutes: 24 * 60, max: 12 })) {
    return fail("That's a lot of reading for one day. Try again tomorrow.", 429);
  }
  const { AI_RUNS_PER_BUSINESS_PER_DAY } = await import("@/lib/scoring");
  if (await tooManyRecentActions(ctx.businessId, "ai.run", AI_RUNS_PER_BUSINESS_PER_DAY)) {
    return fail("FollowUp has done a lot today. Try again tomorrow.", 429);
  }

  const state = await loadTellState(ctx.businessId, body.again);
  if (!state) return fail("Business not found.", 404);

  const [site, posts] = await Promise.all([url ? readWebsite(url) : Promise.resolve(null), body.instagram ? readInstagramPosts(ctx.businessId) : Promise.resolve(null)]);
  if (url && !site && !posts) {
    return fail(`FollowUp couldn't open that website. Check the link, ${orElse}.`, 422);
  }
  if (!site && !posts) return fail(`FollowUp couldn't read your Instagram posts just now. Try again, ${orElse}.`, 422);

  // Only the meeting's own questions, and only those nobody answered yet: what the owner said always wins.
  const known = playbackRows(state.facts, state.draft, state.topics.map((t) => t.label));
  const answered = new Set(known.map((r) => labelKey(r.label)));
  const labels = state.topics.map((t) => t.label).filter((l) => !answered.has(labelKey(l)));
  const proposed = labels.length
    ? await proposeTellRead(site?.text ?? "", posts?.text ?? "", known, labels).catch((err) => {
        console.error(`Could not read a website for business ${ctx.businessId}:`, err instanceof Error ? err.message : err);
        return null;
      })
    : [];
  // The reading itself failed: say so, rather than "it didn't answer any of the questions".
  if (proposed === null) return fail(`FollowUp couldn't read it just now. Try again, ${orElse}.`, 503);
  const everything = [site?.text ?? "", posts?.text ?? ""].join("\n");
  const rows = correctionRows(everything, proposed, labels, labels.length).filter(
    (r) => labels.some((l) => labelKey(l) === labelKey(r.label)) && businessValue(r.value)
  );

  const from: Record<string, ReadSource> = {};
  for (const r of rows) from[labelKey(r.label)] = sourceOf(r.value, site?.text ?? "");
  const note: SiteNote = { url: site ? url : null, pages: site?.pages ?? [], posts: posts?.posts ?? 0, from };
  await addToDraft(ctx.businessId, rows, undefined, note);
  await prisma.business.update({
    where: { id: ctx.businessId },
    data: { websiteAskedAt: now, ...(site && url ? { website: url } : {}) },
  });
  void recordAudit(ctx, "business.tell", {
    targetType: "business",
    targetId: ctx.businessId,
    meta: { decision: "read", pages: note.pages.length, posts: note.posts, facts: rows.length },
  });

  // The link didn't open but the posts were read: the line says so instead of acting as if the site were read.
  const missed = url && !site ? `FollowUp couldn't open ${siteName(url)}. ` : "";
  if (body.setup) return NextResponse.json({ success: true, found: rows.length, line: missed + setupReadLine(note, rows.length) });

  const after = await loadTellState(ctx.businessId, body.again);
  if (!after) return fail("Business not found.", 404);
  const stored = await prisma.business.findUnique({ where: { id: ctx.businessId }, select: { tellDraft: true } });
  const next = await wordedTopic(ctx.businessId, currentTopic(after), [...after.facts, ...after.draft]);
  return NextResponse.json({
    success: true,
    state: after,
    next,
    found: rows.length,
    // One plain line, not a bubble (A-313): what was read and how many questions are left.
    line: missed + readLine(note, rows.length, labels.length, Math.max(0, labels.length - rows.length)),
    // The meeting's "1 of N" counts only what's left to ask.
    readCount: answeredByRead(after.topics, parseTellDraft(stored?.tellDraft).site),
    playback: next ? null : await tellPlayback(ctx.businessId, after),
  });
}
