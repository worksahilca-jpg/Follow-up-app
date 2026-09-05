"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { BarChart3 } from "lucide-react";
import type { AnalyticsData } from "@/lib/analytics-data";
import {
  CHART_AXIS_COLOR as AXIS_COLOR,
  CHART_GRID_COLOR as GRID_COLOR,
  CHART_TOOLTIP_STYLE as tooltipStyle,
  CHART_PRIMARY,
  CHART_SECONDARY,
  CHART_MONEY,
  CHART_INK,
} from "@/lib/chart-colors";

export default function AnalyticsCharts({ data }: { data: AnalyticsData }) {
  const hasLeads = data.totalLeads > 0;

  return (
    <div className="space-y-8">
      <ChartCard
        title="Leads & follow-ups over time"
        description="New leads captured and follow-ups sent, last 8 weeks."
        hasData={hasLeads}
        height={300}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={mergeWeeks(data.leadsPerWeek, data.followUpsPerWeek)} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 12, fill: AXIS_COLOR }} />
            <YAxis tick={{ fontSize: 12, fill: AXIS_COLOR }} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            <Line type="monotone" dataKey="leads" name="New leads" stroke={CHART_SECONDARY} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="followUps" name="Follow-ups sent" stroke={CHART_MONEY} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/*
        Two-column row on wider screens — the funnel and lead sources are
        both compact categorical charts, so they read well side by side
        instead of each claiming the full page width. A future chart
        (e.g. a "sequence health" breakdown) can join this row — add
        `lg:grid-cols-3` below — or start its own full-width section,
        same shape as the trend chart above.
      */}
      <div className="grid gap-8 lg:grid-cols-2">
        <ChartCard title="Pipeline funnel" description="Where your leads are sitting right now." hasData={hasLeads}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.stageCounts} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: AXIS_COLOR }} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 12, fill: AXIS_COLOR }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" name="Leads" fill={CHART_PRIMARY} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Lead sources" description="Where your leads are coming from." hasData={hasLeads}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.sourceCounts} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12, fill: AXIS_COLOR }} allowDecimals={false} />
              <YAxis dataKey="source" type="category" tick={{ fontSize: 12, fill: AXIS_COLOR }} width={100} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" name="Leads" fill={CHART_INK} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/*
        Extension point: drop a new <ChartCard title="..." description="...">
        here (own row, or a third column above) for backend-agent's
        "sequence health" metric once it lands — no restructuring needed,
        ChartCard already handles the loading-state/empty-state shell.
      */}
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
  /** Pixel height of the chart surface. Defaults to the standard card size (288px / h-72); the trend chart above opts into a taller one. */
  height?: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-xl">{title}</h2>
      <p className="text-sm text-ink-soft mt-1">{description}</p>
      <div className="mt-4 rounded-xl border border-line bg-card p-4" style={{ height }}>
        {hasData ? children : <EmptyChart />}
      </div>
    </section>
  );
}

function mergeWeeks(
  leadsPerWeek: AnalyticsData["leadsPerWeek"],
  followUpsPerWeek: AnalyticsData["followUpsPerWeek"]
) {
  return leadsPerWeek.map((w, i) => ({
    week: w.week,
    leads: w.count,
    followUps: followUpsPerWeek[i]?.count ?? 0,
  }));
}

function EmptyChart() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-2 text-sm text-ink-soft">
      <BarChart3 className="h-5 w-5 opacity-40" />
      No leads yet — nothing to chart.
    </div>
  );
}
