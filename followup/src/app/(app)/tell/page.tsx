import { redirect } from "next/navigation";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { labelKey } from "@/lib/factLines";
import { loadTellState, wordedTopic } from "@/lib/tellFollowUpData";
import { answeredByRead, currentTopic, parseTellDraft } from "@/lib/tellFollowUp";
import { readLine } from "@/lib/siteRead";
import TellFollowUp from "@/components/TellFollowUp";

export const dynamic = "force-dynamic";

/**
 * "Tell FollowUp about your business", a 5-minute meeting (A-311, A-314), under Settings › Your business. Opened from its card on Today
 * (`?from=today`, so Done goes back there), from What FollowUp knows, and with `?again=1` for what was skipped. Admins
 * only, because an answer goes into replies sent in the business's name.
 */
export default async function TellPage({ searchParams }: { searchParams: Promise<{ again?: string; from?: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/signin");
  if (!(await requireAdmin(ctx))) redirect("/settings#business");
  const { again, from } = await searchParams;
  const [state, business, instagram] = await Promise.all([
    loadTellState(ctx.businessId, again === "1"),
    prisma.business.findUnique({ where: { id: ctx.businessId }, select: { websiteAskedAt: true, instagramUsername: true, tellDraft: true } }),
    // Connected means what the send path means (sendChannels.ts): an id and a token. Counted, never selected.
    prisma.business.count({ where: { id: ctx.businessId, instagramUserId: { not: null }, instagramAccessToken: { not: null } } }),
  ]);
  if (!state || !business) redirect("/dashboard");
  // The first question, worded for this business when FollowUp already knows something about it (A-313), what this
  // meeting already took included (A-314). None left with a draft: the page asks for the play-back itself.
  const first = await wordedTopic(ctx.businessId, currentTopic(state), [...state.facts, ...state.draft]);
  // What FollowUp read on the website and Instagram (A-328), from setup's line or this meeting. Before anything the
  // owner said, the meeting opens with the line saying what was read and how many questions are left.
  const site = parseTellDraft(business.tellDraft).site ?? null;
  const readCount = answeredByRead(state.topics, site);
  const onlyRead = site && state.draft.every((r) => site.from[labelKey(r.label)]);
  const readSaid = site && onlyRead && first ? readLine(site, readCount, readCount + state.open.length, state.open.length) : null;
  // Keyed, so "Answer them now" (same page, new address) starts the conversation again instead of keeping the end.
  return (
    <TellFollowUp
      key={again === "1" ? "again" : "first"}
      initial={state}
      first={first}
      again={again === "1"}
      doneHref={from === "today" ? "/dashboard" : "/settings#business"}
      site={{
        // Asked once, before the first question, never on "Answer them now".
        ask: again !== "1" && !business.websiteAskedAt && Boolean(first),
        instagram: instagram > 0 ? (business.instagramUsername ?? "") : null,
        readCount,
        readSaid,
      }}
    />
  );
}

// Its own tab title (WCAG 2.4.2); the root template adds " — FollowUp".
export const metadata = { title: "Tell FollowUp about your business" };
