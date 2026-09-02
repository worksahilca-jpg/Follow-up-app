"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { CHART_AXIS_COLOR, CHART_GRID_COLOR, CHART_TOOLTIP_STYLE, CHART_PRIMARY, CHART_MONEY } from "@/lib/chart-colors";

export interface StageSnapshotDatum {
  label: string;
  count: number;
  value: number;
}

export default function PipelineSnapshot({
  stages,
  metric = "count",
  height = 220,
}: {
  stages: StageSnapshotDatum[];
  /** "count" = leads per stage (dashboard default), "value" = dollar value per stage. */
  metric?: "count" | "value";
  height?: number;
}) {
  const hasData = stages.some((s) => s[metric] > 0);
  const isValue = metric === "value";

  return (
    <div className="rounded-xl border border-line bg-card p-4" style={{ height }}>
      {hasData ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stages} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={45}
            />
            <YAxis
              tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }}
              allowDecimals={false}
              width={isValue ? 44 : 28}
              tickFormatter={isValue ? (v: number) => `$${Math.round(v / 1000)}k` : undefined}
            />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={isValue ? (v: unknown) => [`$${Number(v ?? 0).toLocaleString()}`, "Value"] as [string, string] : undefined}
            />
            <Bar dataKey={metric} name={isValue ? "Value" : "Leads"} fill={isValue ? CHART_MONEY : CHART_PRIMARY} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full flex items-center justify-center text-sm text-ink-soft">No leads yet.</div>
      )}
    </div>
  );
}
