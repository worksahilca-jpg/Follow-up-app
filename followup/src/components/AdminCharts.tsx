"use client";

/**
 * Charts for the platform admin dashboard (src/app/admin/page.tsx). Reuses
 * the exact chart primitives and colors the per-business Analytics page
 * already uses (Recharts + src/lib/chart-colors.ts) rather than inventing a
 * second visual language for a second data scope — this page should read
 * as "the same product, zoomed out to platform-wide," not a different tool.
 */
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { BarChart3 } from "lucide-react";
import type { WeekBucket, ChannelCount, TierCount } from "@/lib/admin-data";
import { useChartColors } from "@/lib/chart-colors";

export default function AdminCharts({
  signupsPerWeek,
  channelBreakdown,
  tierBreakdown,
}: {
  signupsPerWeek: WeekBucket[];
  channelBreakdown: ChannelCount[];
  tierBreakdown: TierCount[];
}) {
  const chart = useChartColors();
  const hasSignups = signupsPerWeek.some((w) => w.count > 0);
  const hasChannels = channelBreakdown.length > 0;
  const hasTiers = tierBreakdown.some((t) => t.count > 0);

  return (
    <div className="space-y-8">
      <ChartCard title="Businesses signed up" description="New businesses created, last 12 weeks." hasData={hasSignups}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={signupsPerWeek} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 12, fill: chart.axis }} />
            <YAxis tick={{ fontSize: 12, fill: chart.axis }} allowDecimals={false} />
            <Tooltip contentStyle={chart.tooltip} />
            <Bar dataKey="count" name="Businesses" fill={chart.primary} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid gap-8 lg:grid-cols-2">
        <ChartCard title="Leads by channel" description="Which capture channel brings in the most volume, across every business." hasData={hasChannels}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={channelBreakdown} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12, fill: chart.axis }} allowDecimals={false} />
              <YAxis dataKey="source" type="category" tick={{ fontSize: 12, fill: chart.axis }} width={110} />
              <Tooltip contentStyle={chart.tooltip} />
              <Bar dataKey="count" name="Leads" fill={chart.ink} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Businesses by tier" description="Free / Plus / Pro, across every signed-up business." hasData={hasTiers}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tierBreakdown} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: chart.axis }} />
              <YAxis tick={{ fontSize: 12, fill: chart.axis }} allowDecimals={false} />
              <Tooltip contentStyle={chart.tooltip} />
              <Bar dataKey="count" name="Businesses" fill={chart.primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  description,
  hasData,
  height = 288,
  children,
}: {
  title: string;
  description: string;
  hasData: boolean;
  height?: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-xl">{title}</h2>
      <p className="text-sm text-ink-soft mt-1">{description}</p>
      <div className="mt-4 rounded-[var(--radius-box)] bg-card p-4" style={{ height, boxShadow: "var(--shadow-box)" }}>
        {hasData ? children : <EmptyChart />}
      </div>
    </section>
  );
}

function EmptyChart() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-2 text-sm text-ink-soft">
      <BarChart3 className="h-5 w-5 opacity-40" />
      No data yet.
    </div>
  );
}
