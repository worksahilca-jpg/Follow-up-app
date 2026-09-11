import Link from "next/link";
import StatCard from "@/components/StatCard";
import ApprovalQueue, { type ApprovalItem } from "@/components/ApprovalQueue";
import { getLeads, getStats, getUpcomingBookings } from "@/lib/leads-data";
import { formatCurrency, getGreeting } from "@/lib/demo-data";
import EmptyState from "@/components/EmptyState";
import { getAtRiskLeads } from "@/lib/rescue";
import { describeTrigger, getRescueReport } from "@/lib/rescued";
import { getSessionContext } from "@/lib/session";
import { getPendingApprovals } from "@/lib/pendingApprovals";
import { AlertTriangle, LifeBuoy, Send, MessageCircle, Inbox, CalendarClock, ArrowRight } from "lucide-react";
import FadeIn from "@/components/motion/FadeIn";
import { RevealGroup, RevealItem } from "@/components/motion/Reveal";
import AuroraBackground from "@/components/motion/AuroraBackground";
import CountUp from "@/components/motion/CountUp";

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
  }));

  return (
    <div>
      {/* A contained aurora wash behind just the greeting — the same
          living background the landing page uses, scaled down to a
          "welcome banner" rather than a full-bleed hero. This is a
          working tool people sit in all day, so the drama stays here at
          the top instead of following the cursor through dense list
          content below. */}
      <div className="relative overflow-hidden rounded-2xl border border-line px-6 py-8">
        <AuroraBackground className="opacity-30" />
        <FadeIn>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="font-display text-3xl">{getGreeting()}</h1>
              <p className="text-ink-soft mt-1">Here&apos;s what needs your attention today.</p>
            </div>
            {approvalItems.length > 0 && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium shrink-0"
                style={{ backgroundColor: "var(--gold-soft)", color: "var(--ink)" }}
              >
                {approvalItems.length} need{approvalItems.length === 1 ? "s" : ""} your OK
              </span>
            )}
          </div>
        </FadeIn>
      </div>

      <ApprovalQueue items={approvalItems} />

      {leads.length === 0 ? (
        <FadeIn className="mt-10">
          <EmptyState
            icon={Inbox}
            title="No leads yet"
            description="Connect Gmail in Settings and sync your inbox to pull in your real sales conversations."
            action={
              <Link
                href="/settings"
                className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium"
                style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
              >
                Go to Settings
              </Link>
            }
          />
        </FadeIn>
      ) : (
        <>
          {/* Same on-mount stagger as the landing page's hero (RevealGroup
              on="mount"). 13 tiles cut to 3 — the ones that answer a real
              question an owner asks ("is anyone about to fall through the
              cracks," "is this thing earning its keep") rather than every
              number the app happens to be able to compute. */}
          <RevealGroup on="mount" className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
            <RevealItem>
              <StatCard
                label="At risk right now"
                value={<CountUp to={stats.atRisk} />}
                icon={AlertTriangle}
                accent="var(--coral)"
                accentSoft="var(--coral-soft)"
              />
            </RevealItem>
            <RevealItem>
              <StatCard
                label="Answered for you"
                value={<CountUp to={rescue?.answeredForYou ?? 0} />}
                icon={Send}
                accent="var(--slate)"
                accentSoft="var(--slate-soft)"
              />
            </RevealItem>
            <RevealItem>
              <StatCard
                label="Came back"
                value={<CountUp to={rescue?.rescued ?? 0} />}
                icon={MessageCircle}
                accent="var(--sage)"
                accentSoft="var(--sage-soft)"
              />
            </RevealItem>
          </RevealGroup>

          {atRisk.length > 0 && (
            <FadeIn className="mt-10">
              <h2 className="font-display text-xl flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" style={{ color: "var(--coral)" }} />
                About to be lost
              </h2>
              <p className="text-sm text-ink-soft mt-1">
                Ranked by how long they&apos;ve waited, how interested they are, and how cold the trail is. Automation is
                already working these; the ones at the top need you.
              </p>
              <div className="mt-4 rounded-xl border border-line bg-card divide-y divide-line overflow-hidden">
                {atRisk.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-3 text-sm hover:bg-paper transition-all hover:-translate-y-px hover:shadow-sm relative"
                  >
                    <span className="min-w-0">
                      <span className="font-medium">{lead.name}</span>
                      <span className="text-ink-soft"> — {lead.rescue.reason}</span>
                    </span>
                    <span className="flex items-center gap-3 shrink-0">
                      {lead.dealValue > 0 && <span style={{ color: "var(--gold)" }}>{formatCurrency(lead.dealValue)}</span>}
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium tabular-nums"
                        style={{ backgroundColor: "var(--coral-soft)", color: "var(--coral)" }}
                        title="Rescue score, 0–100"
                      >
                        {lead.rescue.score}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </FadeIn>
          )}

          {rescue && rescue.leads.length > 0 && (
            <FadeIn className="mt-10">
              <h2 className="font-display text-xl flex items-center gap-2">
                <LifeBuoy className="h-4 w-4" style={{ color: "var(--sage)" }} />
                What FollowUp did for you this week
              </h2>
              <p className="text-sm text-ink-soft mt-1">
                Only replies to messages FollowUp sent on its own count here — your own replies are yours.
              </p>
              <div className="mt-4 rounded-xl border border-line bg-card divide-y divide-line overflow-hidden">
                {rescue.leads.slice(0, 6).map((l) => (
                  <Link
                    key={l.id}
                    href={`/leads/${l.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-3 text-sm hover:bg-paper transition-all hover:-translate-y-px hover:shadow-sm relative"
                  >
                    <span className="min-w-0">
                      <span className="font-medium">{l.name}</span>
                      <span className="text-ink-soft"> — {describeTrigger(l.trigger)}, replied {l.repliedAfterHours}h later</span>
                    </span>
                    {l.dealValue > 0 && <span style={{ color: "var(--gold)" }}>{formatCurrency(l.dealValue)}</span>}
                  </Link>
                ))}
              </div>
            </FadeIn>
          )}

          {upcomingBookings.length > 0 && (
            <FadeIn className="mt-10">
              <h2 className="font-display text-xl flex items-center gap-2">
                <CalendarClock className="h-4 w-4" style={{ color: "var(--sage)" }} />
                Upcoming calls
              </h2>
              <div className="mt-4 rounded-xl border border-line bg-card divide-y divide-line overflow-hidden">
                {upcomingBookings.map((b) => (
                  <Link
                    key={b.id}
                    href={`/leads/${b.leadId}`}
                    className="flex items-center justify-between px-5 py-3 text-sm hover:bg-paper transition-all hover:-translate-y-px hover:shadow-sm relative"
                  >
                    <span className="font-medium">{b.leadName}</span>
                    <span className="text-ink-soft">
                      {new Date(b.scheduledAt).toLocaleString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </Link>
                ))}
              </div>
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
