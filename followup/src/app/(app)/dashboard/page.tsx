import Link from "next/link";
import StatCard from "@/components/StatCard";
import FollowUpCard from "@/components/FollowUpCard";
import PipelineSnapshot from "@/components/PipelineSnapshot";
import {
  getLeads,
  getStats,
  getTodaysFollowUps,
  getColdLeads,
  getWeeklyReport,
  getPipelineData,
  getUpcomingBookings,
} from "@/lib/leads-data";
import { formatCurrency, daysSince, getGreeting } from "@/lib/demo-data";
import EmptyState from "@/components/EmptyState";
import { AlertTriangle, Users, Flame, Clock, DollarSign, FileSearch, Send, MessageCircle, Trophy, Inbox, CalendarClock } from "lucide-react";

// This page reads live leads from the database on every request — never
// bake a stale snapshot into the build.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const leads = await getLeads();
  const stats = getStats(leads);
  const today = getTodaysFollowUps(leads);
  const cold = getColdLeads(leads);
  const weeklyReport = await getWeeklyReport(leads);
  const pipelineSnapshot = getPipelineData(leads).map((s) => ({ label: s.label, count: s.leads.length, value: s.value }));
  const upcomingBookings = await getUpcomingBookings();

  return (
    <div>
      <h1 className="font-display text-3xl">{getGreeting()}</h1>
      <p className="text-ink-soft mt-1">Here&apos;s what needs your attention today.</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
        <StatCard
          label="Total leads"
          value={String(stats.totalLeads)}
          icon={Users}
          accent="var(--slate)"
          accentSoft="var(--slate-soft)"
        />
        <StatCard
          label="Hot leads"
          value={String(stats.hotLeads)}
          icon={Flame}
          accent="var(--coral)"
          accentSoft="var(--coral-soft)"
        />
        <StatCard
          label="Follow-ups today"
          value={String(stats.followUpsToday)}
          icon={Clock}
          accent="var(--sage)"
          accentSoft="var(--sage-soft)"
        />
        <StatCard
          label="Potential revenue"
          value={formatCurrency(stats.potentialRevenue)}
          icon={DollarSign}
          accent="var(--gold)"
          accentSoft="var(--gold-soft)"
        />
      </div>

      <div className="grid lg:grid-cols-5 gap-6 mt-10">
        <section className="lg:col-span-3">
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
        </section>

        <section className="lg:col-span-2">
          <h2 className="font-display text-xl">Pipeline snapshot</h2>
          <p className="text-sm text-ink-soft mt-1">Leads by stage, right now.</p>
          <div className="mt-4">
            <PipelineSnapshot stages={pipelineSnapshot} />
          </div>
        </section>
      </div>

      {cold.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" style={{ color: "var(--coral)" }} />
            Leads going cold
          </h2>
          <div className="mt-4 rounded-xl border border-line bg-card divide-y divide-line">
            {cold.map((lead) => (
              <Link
                key={lead.id}
                href={`/leads/${lead.id}`}
                className="flex items-center justify-between px-5 py-3 text-sm hover:bg-paper"
              >
                <span>
                  <span className="font-medium">{lead.name}</span>
                  <span className="text-ink-soft"> — {daysSince(lead.lastContacted)} days inactive</span>
                </span>
                <span style={{ color: "var(--gold)" }}>{formatCurrency(lead.dealValue)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {upcomingBookings.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl flex items-center gap-2">
            <CalendarClock className="h-4 w-4" style={{ color: "var(--sage)" }} />
            Upcoming calls
          </h2>
          <div className="mt-4 rounded-xl border border-line bg-card divide-y divide-line">
            {upcomingBookings.map((b) => (
              <Link
                key={b.id}
                href={`/leads/${b.leadId}`}
                className="flex items-center justify-between px-5 py-3 text-sm hover:bg-paper"
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
        </section>
      )}

      <section className="mt-10 mb-6">
        <h2 className="font-display text-xl">This week&apos;s AI report</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
          <StatCard label="Analyzed" value={String(weeklyReport.conversationsAnalyzed)} icon={FileSearch} accent="var(--slate)" accentSoft="var(--slate-soft)" />
          <StatCard label="Sent" value={String(weeklyReport.followUpsSent)} icon={Send} accent="var(--sage)" accentSoft="var(--sage-soft)" />
          <StatCard label="Replies" value={String(weeklyReport.repliesReceived)} icon={MessageCircle} accent="var(--slate)" accentSoft="var(--slate-soft)" />
          <StatCard label="Closed" value={String(weeklyReport.dealsClosed)} icon={Trophy} accent="var(--sage)" accentSoft="var(--sage-soft)" />
          <StatCard label="Revenue" value={formatCurrency(weeklyReport.revenueGenerated)} icon={DollarSign} accent="var(--gold)" accentSoft="var(--gold-soft)" />
        </div>
        <p className="text-sm text-ink-soft mt-4 leading-relaxed">{weeklyReport.insight}</p>
      </section>
    </div>
  );
}
