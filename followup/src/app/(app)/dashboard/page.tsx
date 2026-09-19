import Link from "next/link";
import StatCard from "@/components/StatCard";
import { PageHeader } from "@/components/PageHeader";
import ApprovalQueue, { type ApprovalItem } from "@/components/ApprovalQueue";
import SetupStrip from "@/components/SetupStrip";
import TestLeadButton from "@/components/TestLeadButton";
import { getLeads, getStats, getUpcomingBookings } from "@/lib/leads-data";
import { formatCurrency, getGreeting } from "@/lib/demo-data";
import { getAtRiskLeads } from "@/lib/rescue";
import { describeTrigger, getRescueReport } from "@/lib/rescued";
import { getSessionContext } from "@/lib/session";
import { getPendingApprovals } from "@/lib/pendingApprovals";
import { getIncompleteSetupSteps } from "@/lib/setupStatus";
import { getGmailStatus } from "@/lib/integrations/gmail";
import { getOutlookStatus } from "@/lib/integrations/outlook";
import { ArrowRight } from "lucide-react";
import { ItemBox, ItemBoxList, type ItemTone } from "@/components/ItemBox";
import FadeIn from "@/components/motion/FadeIn";
import { RevealGroup, RevealItem } from "@/components/motion/Reveal";
import CountUp from "@/components/motion/CountUp";

// "last checked 2 minutes ago" — deliberately coarse (minutes/hours/days,
// no seconds) since this is a status line, not a live clock.
function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.round(diffMs / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return `${Math.round(hours / 24)} day${Math.round(hours / 24) === 1 ? "" : "s"} ago`;
}

/**
 * The rail tone for an at-risk row, and the word it stands for.
 *
 * The rescue model already computes the two facts that matter — hours someone
 * has been waiting on an answer, days of silence after we wrote — so the
 * severity here is read off those rather than off the 0–100 score, which is a
 * blend the owner can't take apart. Waiting on a human beats going quiet:
 * somebody wrote in and nobody answered is the worse failure.
 */
function atRiskStatus(rescue: { waitingHours: number | null; silentDays: number | null }): {
  tone: ItemTone;
  label: string;
} {
  if (rescue.waitingHours !== null) {
    const h = Math.round(rescue.waitingHours);
    return { tone: h >= 4 ? "coral" : "gold", label: h < 1 ? "Waiting <1h" : `Waiting ${h}h` };
  }
  if (rescue.silentDays !== null) {
    const d = Math.round(rescue.silentDays);
    return { tone: d >= 7 ? "coral" : "gold", label: `Silent ${d} ${d === 1 ? "day" : "days"}` };
  }
  return { tone: "gold", label: "Needs a look" };
}

// This page reads live leads from the database on every request — never
// bake a stale snapshot into the build.
export const dynamic = "force-dynamic";

/**
 * research/product/2026-09-10-ux-simplification.md, implementation plan
 * items #1 and #3: this used to open on 13 stat tiles across three
 * separate rows and a ranked list of problems, with no screen anywhere
 * answering "what needs my OK right now" (§0.6 — the single biggest
 * structural gap in an approval-first product). Now: the approval queue
 * is pinned at the top, the tile count is cut to the 3 that actually
 * answer an owner's real questions (§2), and "Today's follow-ups", the
 * pipeline snapshot, and the 5-tile weekly AI report all move behind a
 * single "See all numbers" link to /analytics — same data, just not
 * shouting for attention on the one screen that should read as a queue
 * of decisions, not a wall of numbers.
 */
export default async function DashboardPage() {
  const leads = await getLeads();
  const stats = getStats(leads);
  const atRisk = getAtRiskLeads(leads).slice(0, 8);
  const upcomingBookings = await getUpcomingBookings();
  const ctx = await getSessionContext();
  const rescue = ctx ? await getRescueReport(ctx.businessId, 7) : null;
  const approvals = ctx ? await getPendingApprovals(ctx.businessId) : [];
  const approvalItems: ApprovalItem[] = approvals.map((a) => ({
    leadId: a.leadId,
    leadName: a.leadName,
    reason: a.reason,
    draftSubject: a.draftSubject,
    draftMessage: a.draftMessage,
    leadLastMessage: a.leadLastMessage,
    leadLastMessageChannel: a.leadLastMessageChannel,
  }));
  const setupSteps = ctx ? await getIncompleteSetupSteps(ctx.businessId) : [];
  const gmail = ctx ? await getGmailStatus(ctx.businessId) : { connected: false };
  const outlook = ctx ? await getOutlookStatus(ctx.businessId) : { connected: false };
  // An inbox is connected if EITHER provider is. Checking only Gmail is what
  // made the empty state claim "FollowUp is watching your inbox" to a business
  // that had connected Outlook and never got the confirmation line, and to a
  // business that had connected nothing at all. Normalised to one shape here
  // so the view doesn't have to know which provider it got — only Gmail
  // reports a last-sync time, so that field is optional.
  const inbox: { email?: string; lastSyncedAt?: string | null } | null = gmail.connected
    ? { email: gmail.email, lastSyncedAt: gmail.lastSyncedAt }
    : outlook.connected
      ? { email: outlook.email }
      : null;

  /**
   * The banner's one computed sentence, replacing the fixed string "Here's
   * what needs your attention today." — which was the same words whether the
   * owner had nine drafts waiting or a completely clear morning. A line that
   * never changes tells you nothing, and it sat at the top of the screen this
   * ICP opens twenty times a day (S-12).
   *
   * Order matters: the thing blocked on a human first, then the thing the
   * product exists to prevent. When neither is true the sentence says so
   * outright rather than leaving the owner to infer calm from an empty page.
   */
  function headline(): string {
    const parts: string[] = [];
    if (approvalItems.length > 0) {
      parts.push(`${approvalItems.length} draft${approvalItems.length === 1 ? "" : "s"} need${approvalItems.length === 1 ? "s" : ""} your OK`);
    }
    if (stats.atRisk > 0) {
      parts.push(`${stats.atRisk} lead${stats.atRisk === 1 ? "" : "s"} going quiet`);
    }
    if (parts.length > 0) return parts.join(" · ");

    const answered = rescue?.answeredForYou ?? 0;
    if (answered > 0) {
      return `Nothing needs your OK. FollowUp answered ${answered} for you this week.`;
    }
    return "Nothing needs your OK right now.";
  }

  return (
    <div>
      {/* The greeting and the one computed sentence under it, in the app's
          one page-header shape. This used to sit inside a bordered box with
          an animated colour wash behind it — the last coloured ornament in
          the app, retired with the move to the monochrome system
          (2026-09-19). A working tool people open twenty times a day does
          not need a hero. */}
      <PageHeader title={getGreeting()} subtitle={headline()} />

      <ApprovalQueue items={approvalItems} answeredForYou={rescue?.answeredForYou ?? 0} />

      {leads.length === 0 ? (
        <FadeIn className="mt-10">
          {/* research/product/2026-09-10-ux-simplification.md §3/§7.1: the
              old empty state was four zeroed stat tiles and a generic
              "No leads yet" box — a worse first impression than one
              honest sentence. This says what's actually true right now
              (watching, or not yet set up) and gives one real action:
              seeing the core promise work today rather than waiting for
              a real lead to arrive. */}
          {/* This sentence used to be printed unconditionally: an owner who
              tapped "I'll do this later" in onboarding was told, on their very
              first screen, that FollowUp was watching an inbox it had no access
              to. The comment above this block always said it should say
              "watching, OR not yet set up" — that branch was never written.
              Claiming a capability you don't have is the worst possible first
              impression for a product whose entire pitch is being trusted to
              act on its own. */}
          <div
            className="rounded-[var(--radius-box)] bg-card p-8 text-center"
            style={{ boxShadow: "var(--shadow-box)" }}
          >
            {inbox ? (
              <>
                <p className="text-lg leading-relaxed">
                  FollowUp is watching your inbox. The moment a lead writes, it replies within a minute and shows you
                  here.
                </p>
                <p className="text-sm text-ink-soft mt-3 flex items-center justify-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--sage)" }} />
                  Watching {inbox.email}
                  {inbox.lastSyncedAt && ` — last checked ${timeAgo(inbox.lastSyncedAt)}`}
                </p>
              </>
            ) : gmail.needsReconnect ? (
              /* Google revoked the token — the owner disconnected FollowUp in
                 their Google account, changed their password, or (while the
                 OAuth app is still in Testing mode) hit the seven-day test
                 token expiry. This is NOT the same as never having connected:
                 leads were being captured and have silently stopped, and only
                 the owner can fix it. It gets its own sentence. */
              <>
                <p className="text-lg leading-relaxed">
                  FollowUp has lost access to {gmail.email ?? "your inbox"}, so it isn&apos;t catching new leads
                  right now. This happens when access is removed in Google or a password changes.
                </p>
                <div className="mt-4">
                  <Link
                    href="/settings#integrations"
                    className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium"
                    style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
                  >
                    Reconnect Gmail
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="text-lg leading-relaxed">
                  No inbox is connected yet, so FollowUp isn&apos;t watching for leads. Connect one and it starts
                  replying within a minute of someone writing in.
                </p>
                <div className="mt-4">
                  <Link
                    href="/settings"
                    className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium"
                    style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
                  >
                    Connect an inbox
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </>
            )}
            <div className="mt-6">
              <TestLeadButton />
            </div>
          </div>
        </FadeIn>
      ) : (
        <>
          {/* Same on-mount stagger as the landing page's hero (RevealGroup
              on="mount"). 13 tiles cut to 3 — the ones that answer a real
              question an owner asks ("is anyone about to fall through the
              cracks," "is this thing earning its keep") rather than every
              number the app happens to be able to compute. */}
          {/* Three across at every width, not stacked below sm. These three
              values are single- or double-digit counts, and StatCard already
              reserves two lines for a wrapping label — so three-up fits at
              390px, where one-per-row spent ~370px of the first screen on
              three numbers and pushed "About to be lost", the thing the page
              is for, below the fold. */}
          <RevealGroup on="mount" className="grid grid-cols-3 gap-3 mt-6">
            <RevealItem>
              <StatCard
                label="At risk right now"
                value={<CountUp to={stats.atRisk} />}
                accent="var(--coral)"
              />
            </RevealItem>
            <RevealItem>
              <StatCard
                label="Answered for you"
                value={<CountUp to={rescue?.answeredForYou ?? 0} />}
                accent="var(--slate)"
              />
            </RevealItem>
            <RevealItem>
              <StatCard
                label="Came back"
                value={<CountUp to={rescue?.rescued ?? 0} />}
                accent="var(--sage)"
              />
            </RevealItem>
          </RevealGroup>

          {atRisk.length > 0 && (
            <FadeIn className="mt-10">
              <h2 className="font-display text-xl">About to be lost</h2>
              <p className="text-sm text-ink-soft mt-1">
                Automation is already working these — the ones at the top need you.
              </p>
              {/* Each row used to end in a coral 0–100 pill whose meaning lived
                  in a `title` tooltip ("Rescue score, 0–100"). A number nobody
                  can interpret without hovering — which a phone cannot do at
                  all — fails the design brain's own test: if it needed a
                  tooltip to be understood, redesign it rather than add the
                  tooltip. The concrete fact underneath the score ("wrote 26h
                  ago and is still waiting") is what the owner can actually act
                  on, and the rescue model already computes it. The score stays
                  on the lead page, where its full reasoning lives. */}
              <ItemBoxList className="mt-4">
                {atRisk.map((lead) => (
                  <ItemBox
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    title={lead.name}
                    figure={
                      lead.dealValue > 0 ? (
                        <span className="text-ink font-medium">{formatCurrency(lead.dealValue)}</span>
                      ) : undefined
                    }
                    status={atRiskStatus(lead.rescue)}
                    fact={lead.rescue.reason}
                  />
                ))}
              </ItemBoxList>
            </FadeIn>
          )}

          {/* Configuration sits below the two work sections, not between them.
              It used to interrupt the approval queue and the at-risk list —
              an incomplete-setup nag cutting the page's two actual jobs in
              half. */}
          <SetupStrip steps={setupSteps} />

          {rescue && rescue.leads.length > 0 && (
            <FadeIn className="mt-10">
              <h2 className="font-display text-xl">What FollowUp did for you this week</h2>
              {/* This sentence stays exactly as written. It is a trust claim —
                  it tells the owner the number below is not padded with their
                  own work — and it earns its space where the other section
                  intros didn't. */}
              <p className="text-sm text-ink-soft mt-1">
                Only replies to messages FollowUp sent on its own count here — your own replies are yours.
              </p>
              <ItemBoxList className="mt-4">
                {rescue.leads.slice(0, 6).map((l) => (
                  <ItemBox
                    key={l.id}
                    href={`/leads/${l.id}`}
                    title={l.name}
                    figure={
                      l.dealValue > 0 ? (
                        <span className="text-ink font-medium">{formatCurrency(l.dealValue)}</span>
                      ) : undefined
                    }
                    status={{ tone: "sage", label: "Came back" }}
                    fact={`${describeTrigger(l.trigger)}, replied ${l.repliedAfterHours}h later`}
                  />
                ))}
              </ItemBoxList>
            </FadeIn>
          )}

          {upcomingBookings.length > 0 && (
            <FadeIn className="mt-10">
              <h2 className="font-display text-xl">Upcoming calls</h2>
              <ItemBoxList className="mt-4">
                {upcomingBookings.map((b) => (
                  <ItemBox
                    key={b.id}
                    href={`/leads/${b.leadId}`}
                    title={b.leadName}
                    figure={new Date(b.scheduledAt).toLocaleString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  />
                ))}
              </ItemBoxList>
            </FadeIn>
          )}

          <FadeIn className="mt-10 mb-6">
            <Link href="/analytics" className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline">
              See all numbers
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </FadeIn>
        </>
      )}
    </div>
  );
}
