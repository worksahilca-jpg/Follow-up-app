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
import type { AnalyticsData } from "@/lib/analytics-data";

const AXIS_COLOR = "#4b4f58"; // --ink-soft
const GRID_COLOR = "#dedad0"; // --line

const tooltipStyle = {
  backgroundColor: "#fdfdfb",
  border: "1px solid #dedad0",
  borderRadius: 8,
  fontSize: 13,
};

export default function AnalyticsCharts({ data }: { data: AnalyticsData }) {
  const hasLeads = data.totalLeads > 0;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-display text-xl">Pipeline funnel</h2>
        <p className="text-sm text-ink-soft mt-1">Where your leads are sitting right now.</p>
        <div className="mt-4 rounded-xl border border-line bg-card p-4 h-72">
          {hasLeads ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.stageCounts} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: AXIS_COLOR }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 12, fill: AXIS_COLOR }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Leads" fill="#b8471f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl">Leads &amp; follow-ups over time</h2>
        <p className="text-sm text-ink-soft mt-1">New leads captured and follow-ups sent, last 8 weeks.</p>
        <div className="mt-4 rounded-xl border border-line bg-card p-4 h-72">
          {hasLeads ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mergeWeeks(data.leadsPerWeek, data.followUpsPerWeek)} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 12, fill: AXIS_COLOR }} />
                <YAxis tick={{ fontSize: 12, fill: AXIS_COLOR }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Line type="monotone" dataKey="leads" name="New leads" stroke="#45607e" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="followUps" name="Follow-ups sent" stroke="#a9791f" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl">Lead sources</h2>
        <p className="text-sm text-ink-soft mt-1">Where your leads are coming from.</p>
        <div className="mt-4 rounded-xl border border-line bg-card p-4 h-72">
          {hasLeads ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.sourceCounts} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: AXIS_COLOR }} allowDecimals={false} />
                <YAxis dataKey="source" type="category" tick={{ fontSize: 12, fill: AXIS_COLOR }} width={110} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Leads" fill="#191c22" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </div>
      </section>
    </div>
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
    <div className="h-full flex items-center justify-center text-sm text-ink-soft">
      No leads yet — nothing to chart.
    </div>
  );
}
