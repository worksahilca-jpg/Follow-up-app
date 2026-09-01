import Link from "next/link";
import StatCard from "@/components/StatCard";
import FollowUpCard from "@/components/FollowUpCard";
import {
  getStats,
  getTodaysFollowUps,
  getColdLeads,
  formatCurrency,
  daysSince,
  weeklyReport,
} from "@/lib/demo-data";
import { AlertTriangle } from "lucide-react";

export default function DashboardPage() {
  const stats = getStats();
  const today = getTodaysFollowUps();
  const cold = getColdLeads();

  return (
    <div>
      <h1 className="font-display text-3xl">Good morning, Sahil</h1>
      <p className="text-ink-soft mt-1">Here&apos;s what needs your attention today.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
        <StatCard label="Total leads" value={String(stats.totalLeads)} />
        <StatCard label="Hot leads" value={String(stats.hotLeads)} accent="var(--rust)" />
        <StatCard label="Follow-ups today" value={String(stats.followUpsToday)} accent="var(--slate)" />
        <StatCard label="Potential revenue" value={formatCurrency(stats.potentialRevenue)} accent="var(--gold)" />
      </div>

      <section className="mt-10">
        <h2 className="font-display text-xl">Today&apos;s follow-ups</h2>
        <div className="mt-4 space-y-3">
          {today.length === 0 && (
            <p className="text-sm text-ink-soft">Nothing due today — take a look at your pipeline instead.</p>
          )}
          {today.map((lead) => (
            <FollowUpCard key={lead.id} lead={lead} />
          ))}
        </div>
      </section>

      {cold.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" style={{ color: "var(--rust)" }} />
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

      <section className="mt-10 mb-6">
        <h2 className="font-display text-xl">This week&apos;s AI report</h2>
        <div className="mt-4 rounded-xl border border-line bg-card p-5 grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
          <div>
            <p className="text-ink-soft">Analyzed</p>
            <p className="font-display text-xl mt-0.5">{weeklyReport.conversationsAnalyzed}</p>
          </div>
          <div>
            <p className="text-ink-soft">Sent</p>
            <p className="font-display text-xl mt-0.5">{weeklyReport.followUpsSent}</p>
          </div>
          <div>
            <p className="text-ink-soft">Replies</p>
            <p className="font-display text-xl mt-0.5">{weeklyReport.repliesReceived}</p>
          </div>
          <div>
            <p className="text-ink-soft">Closed</p>
            <p className="font-display text-xl mt-0.5">{weeklyReport.dealsClosed}</p>
          </div>
          <div>
            <p className="text-ink-soft">Revenue</p>
            <p className="font-display text-xl mt-0.5" style={{ color: "var(--gold)" }}>
              {formatCurrency(weeklyReport.revenueGenerated)}
            </p>
          </div>
        </div>
        <p className="text-sm text-ink-soft mt-3 leading-relaxed">{weeklyReport.insight}</p>
      </section>
    </div>
  );
}
