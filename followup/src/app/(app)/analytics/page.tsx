import type { LucideIcon } from "lucide-react";
import { Users, Activity, Trophy, TrendingUp, DollarSign, Wallet, MessageCircle, Clock, Zap, Workflow, CheckCircle2 } from "lucide-react";
import StatCard from "@/components/StatCard";
import AnalyticsCharts from "@/components/AnalyticsCharts";
import TeamPerformanceSection from "@/components/TeamPerformanceSection";
import { getAnalytics } from "@/lib/analytics-data";
import { formatCurrency } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

interface StatDef {
  label: string;
  value: string;
  icon: LucideIcon;
  accent: string;
  accentSoft: string;
}

export default async function AnalyticsPage() {
  const data = await getAnalytics();

  if (!data) {
    return <p className="text-sm text-ink-soft">Sign in to view analytics.</p>;
  }

  const stats: StatDef[] = [
    { label: "Total leads", value: String(data.totalLeads), icon: Users, accent: "var(--slate)", accentSoft: "var(--slate-soft)" },
    { label: "Active", value: String(data.activeCount), icon: Activity, accent: "var(--slate)", accentSoft: "var(--slate-soft)" },
    { label: "Won", value: String(data.wonCount), icon: Trophy, accent: "var(--sage)", accentSoft: "var(--sage-soft)" },
    { label: "Conversion rate", value: `${data.conversionRate}%`, icon: TrendingUp, accent: "var(--sage)", accentSoft: "var(--sage-soft)" },
    { label: "Revenue won", value: formatCurrency(data.totalRevenue), icon: DollarSign, accent: "var(--gold)", accentSoft: "var(--gold-soft)" },
    { label: "Avg. deal value", value: formatCurrency(data.avgDealValue), icon: Wallet, accent: "var(--gold)", accentSoft: "var(--gold-soft)" },
    {
      label: "Reply rate",
      value: data.followUpsSentTotal > 0 ? `${data.replyRate}%` : "—",
      icon: MessageCircle,
      accent: "var(--sage)",
      accentSoft: "var(--sage-soft)",
    },
    // The core "how fast do we get leads to respond" number behind the
    // product's whole pitch — never shown anywhere in the app until now.
    {
      label: "Median reply time",
      value: data.medianReplyHours !== null ? `${data.medianReplyHours}h` : "—",
      icon: Clock,
      accent: "var(--sage)",
      accentSoft: "var(--sage-soft)",
    },
    {
      label: "Reply rate — automated",
      value: data.automatedReplyRate !== null ? `${data.automatedReplyRate}%` : "—",
      icon: Zap,
      accent: "var(--sage)",
      accentSoft: "var(--sage-soft)",
    },
    {
      label: "Reply rate — manual",
      value: data.manualReplyRate !== null ? `${data.manualReplyRate}%` : "—",
      icon: MessageCircle,
      accent: "var(--slate)",
      accentSoft: "var(--slate-soft)",
    },
    {
      label: "In a workflow",
      value: String(data.sequenceHealth.enrolledCount),
      icon: Workflow,
      accent: "var(--slate)",
      accentSoft: "var(--slate-soft)",
    },
    {
      label: "Workflows completed (30d)",
      value: String(data.sequenceHealth.completedLast30Days),
      icon: CheckCircle2,
      accent: "var(--sage)",
      accentSoft: "var(--sage-soft)",
    },
  ];

  return (
    <div>
      <h1 className="font-display text-3xl">Analytics</h1>
      <p className="text-ink-soft mt-1">How your pipeline is performing.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-6">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} accent={s.accent} accentSoft={s.accentSoft} />
        ))}
      </div>
      {data.followUpsSentTotal > 0 && (
        <p className="text-xs text-ink-soft mt-3">
          {data.repliedCount} of {data.followUpsSentTotal} sent follow-ups have gotten a reply so far.
        </p>
      )}

      <div className="mt-10">
        <AnalyticsCharts data={data} />
      </div>

      {data.teamBreakdown.length > 1 && (
        <section className="mt-10">
          <h2 className="font-display text-xl">Team performance</h2>
          <p className="text-sm text-ink-soft mt-1">Who&apos;s carrying what, and how much of it has gone quiet.</p>
          <div className="mt-4">
            <TeamPerformanceSection members={data.teamBreakdown} />
          </div>
        </section>
      )}
    </div>
  );
}
