import Link from "next/link";
import StatCard from "@/components/StatCard";
import FollowUpCard from "@/components/FollowUpCard";
import PipelineSnapshot from "@/components/PipelineSnapshot";
import {
  getLeads,
  getStats,
  getTodaysFollowUps,
  getWeeklyReport,
  getPipelineData,
  getUpcomingBookings,
} from "@/lib/leads-data";
import { formatCurrency, getGreeting } from "@/lib/demo-data";
import EmptyState from "@/components/EmptyState";
import { getAtRiskLeads } from "@/lib/rescue";
import { describeTrigger, getRescueReport } from "@/lib/rescued";
import { getSessionContext } from "@/lib/session";
import { AlertTriangle, Flame, LifeBuoy, Clock, DollarSign, FileSearch, Send, MessageCircle, Trophy, Inbox, CalendarClock } from "lucide-react";
import FadeIn from "@/components/motion/FadeIn";
import { RevealGroup, RevealItem } from "@/components/motion/Reveal";
import AuroraBackground from "@/components/motion/AuroraBackground";
import CountUp from "@/components/motion/CountUp";

// This page reads live leads from the database on every request — never
// bake a stale snapshot into the build.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const leads = await getLeads();
  const stats = getStats(leads);
  const today = getTodaysFollowUps(leads);
  const atRisk = getAtRiskLeads(leads).slice(0, 8);
  const weeklyReport = await getWeeklyReport(leads);
  const pipelineSnapshot = getPipelineData(leads).map((s) => ({ label: s.label, count: s.leads.length, value: s.value }));
  const upcomingBookings = await getUpcomingBookings();
  const ctx = await getSessionContext();
  const rescue = ctx ? await getRescueReport(ctx.businessId, 7) : null;

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
          <h1 className="font-display text-3xl">{getGreeting()}</h1>
          <p className="text-ink-soft mt-1">Here&apos;s what needs your attention today.</p>
        </FadeIn>
      </div>

      {/* Same on-mount stagger as the landing page's hero (RevealGroup
          on="mount") — the first thing anyone sees after signing in reads
          as one orchestrated beat instead of four cards popping in at
          once. Every list row below gets a plain CSS hover lift (a
          transform + shadow, no separate motion component needed for
          rows that repeat) so this page finally has something to point a
          cursor at that responds, the way the landing page already did.
          The counts themselves tick up on load (CountUp) rather than
          sitting there static — currency stays a plain formatted string,
          since CountUp has no formatter of its own. */}
      <RevealGroup on="mount" className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
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
            label="Hot leads"
            value={<CountUp to={stats.hotLeads} />}
            icon={Flame}
            accent="var(--coral)"
            accentSoft="var(--coral-soft)"
          />
        </RevealItem>
        <RevealItem>
          <StatCard
            label="Follow-ups today"
            value={<CountUp to={stats.followUpsToday} />}
            icon={Clock}
            accent="var(--sage)"
            accentSoft="var(--sage-soft)"
          />
        </RevealItem>
        <RevealItem>
          <StatCard
            label="Potential revenue"
            value={formatCurrency(stats.potentialRevenue)}
            icon={DollarSign}
            accent="var(--gold)"
            accentSoft="var(--gold-soft)"
          />
        </RevealItem>
      </RevealGroup>

      <div className="grid lg:grid-cols-5 gap-6 mt-10">
        <FadeIn delay={0.05} className="lg:col-span-3">
          <h2 className="font-display text-xl">Today&apos;s follow-ups</h2>
          <div className="mt-4 space-y-3">
            {leads.length === 0 && (
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
            )}
            {leads.length > 0 && today.length === 0 && (
              <p className="text-sm text-ink-soft">Nothing due today — take a look at your pipeline instead.</p>
            )}
            {today.map((lead) => (
              <FollowUpCard key={lead.id} lead={lead} />
            ))}
          </div>
        </FadeIn>

        <FadeIn delay={0.1} className="lg:col-span-2">
          <h2 className="font-display text-xl">Pipeline snapshot</h2>
          <p className="text-sm text-ink-soft mt-1">Leads by stage, right now.</p>
          <div className="mt-4">
            <PipelineSnapshot stages={pipelineSnapshot} />
          </div>
        </FadeIn>
      </div>

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

      {rescue && (
        <FadeIn className="mt-10">
          <h2 className="font-display text-xl flex items-center gap-2">
            <LifeBuoy className="h-4 w-4" style={{ color: "var(--sage)" }} />
            What FollowUp saved you this week
          </h2>
          <p className="text-sm text-ink-soft mt-1">
            Only replies to messages FollowUp sent on its own count here — your own replies are yours.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <StatCard label="Answered for you" value={<CountUp to={rescue.answeredForYou} />} icon={Send} accent="var(--slate)" accentSoft="var(--slate-soft)" />
            <StatCard label="Came back" value={<CountUp to={rescue.rescued} />} icon={MessageCircle} accent="var(--sage)" accentSoft="var(--sage-soft)" />
            <StatCard label="Booked" value={<CountUp to={rescue.booked} />} icon={CalendarClock} accent="var(--sage)" accentSoft="var(--sage-soft)" />
            <StatCard label="In play" value={formatCurrency(rescue.valueInPlay)} icon={DollarSign} accent="var(--gold)" accentSoft="var(--gold-soft)" />
          </div>
          {rescue.leads.length > 0 && (
            <div className="mt-4 rounded-xl border border-line bg-card divide-y divide-line overflow-hidden">
              {rescue.leads.slice(0, 6).map((l) => (
                <Link key={l.id} href={`/leads/${l.id}`} className="flex items-center justify-between gap-4 px-5 py-3 text-sm hover:bg-paper transition-all hover:-translate-y-px hover:shadow-sm relative">
                  <span className="min-w-0">
                    <span className="font-medium">{l.name}</span>
                    <span className="text-ink-soft"> — {describeTrigger(l.trigger)}, replied {l.repliedAfterHours}h later</span>
                  </span>
                  {l.dealValue > 0 && <span style={{ color: "var(--gold)" }}>{formatCurrency(l.dealValue)}</span>}
                </Link>
              ))}
            </div>
          )}
        </FadeIn>
      )}

      <FadeIn className="mt-10 mb-6">
        <h2 className="font-display text-xl">This week&apos;s AI report</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
          <StatCard label="Analyzed" value={<CountUp to={weeklyReport.conversationsAnalyzed} />} icon={FileSearch} accent="var(--slate)" accentSoft="var(--slate-soft)" />
          <StatCard label="Sent" value={<CountUp to={weeklyReport.followUpsSent} />} icon={Send} accent="var(--sage)" accentSoft="var(--sage-soft)" />
          <StatCard label="Replies" value={<CountUp to={weeklyReport.repliesReceived} />} icon={MessageCircle} accent="var(--slate)" accentSoft="var(--slate-soft)" />
          <StatCard label="Closed" value={<CountUp to={weeklyReport.dealsClosed} />} icon={Trophy} accent="var(--sage)" accentSoft="var(--sage-soft)" />
          <StatCard label="Revenue" value={formatCurrency(weeklyReport.revenueGenerated)} icon={DollarSign} accent="var(--gold)" accentSoft="var(--gold-soft)" />
        </div>
        <p className="text-sm text-ink-soft mt-4 leading-relaxed">{weeklyReport.insight}</p>
      </FadeIn>
    </div>
  );
}
