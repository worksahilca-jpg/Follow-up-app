import StatCard from "@/components/StatCard";
import AnalyticsCharts from "@/components/AnalyticsCharts";
import { getAnalytics } from "@/lib/analytics-data";
import { formatCurrency } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const data = await getAnalytics();

  if (!data) {
    return <p className="text-sm text-ink-soft">Sign in to view analytics.</p>;
  }

  return (
    <div>
      <h1 className="font-display text-3xl">Analytics</h1>
      <p className="text-ink-soft mt-1">How your pipeline is performing.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
        <StatCard label="Total leads" value={String(data.totalLeads)} />
        <StatCard label="Conversion rate" value={`${data.conversionRate}%`} accent="var(--slate)" />
        <StatCard label="Revenue won" value={formatCurrency(data.totalRevenue)} accent="var(--gold)" />
        <StatCard label="Avg. deal value" value={formatCurrency(data.avgDealValue)} accent="var(--rust)" />
      </div>

      <div className="mt-10">
        <AnalyticsCharts data={data} />
      </div>
    </div>
  );
}
