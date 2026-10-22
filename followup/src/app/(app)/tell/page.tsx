import { redirect } from "next/navigation";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { loadTellState, wordedTopic } from "@/lib/tellFollowUpData";
import { currentTopic } from "@/lib/tellFollowUp";
import TellFollowUp from "@/components/TellFollowUp";

export const dynamic = "force-dynamic";

/**
 * "Tell FollowUp about your business" (A-311, A-312), under Settings › Your business. Opened from its card on Today
 * (`?from=today`, so Done goes back there), from What FollowUp knows, and with `?again=1` for what was skipped. Admins
 * only, because an answer goes into replies sent in the business's name.
 */
export default async function TellPage({ searchParams }: { searchParams: Promise<{ again?: string; from?: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/signin");
  if (!(await requireAdmin(ctx))) redirect("/settings#business");
  const { again, from } = await searchParams;
  const state = await loadTellState(ctx.businessId, again === "1");
  if (!state) redirect("/dashboard");
  // The first question, worded for this business when FollowUp already knows something about it (A-313).
  const first = await wordedTopic(ctx.businessId, currentTopic(state), state.facts);
  // Keyed, so "Answer them now" (same page, new address) starts the conversation again instead of keeping the end.
  return (
    <TellFollowUp
      key={again === "1" ? "again" : "first"}
      initial={state}
      first={first}
      again={again === "1"}
      doneHref={from === "today" ? "/dashboard" : "/settings#business"}
    />
  );
}

// Its own tab title (WCAG 2.4.2); the root template adds " — FollowUp".
export const metadata = { title: "Tell FollowUp about your business" };
