import Link from "next/link";
import { Building2, Inbox, Radio, MoonStar, DollarSign, ArrowRight } from "lucide-react";
import StatCard from "@/components/StatCard";
import AdminCharts from "@/components/AdminCharts";
import { getPlatformAdminData } from "@/lib/admin-data";
import { formatCurrency } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

function formatFullDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function channelLabel(provider: string): string {
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

export default async function AdminPage() {
  const data = await getPlatformAdminData();

  return (
    <div>
      <h1 className="font-display text-3xl">Platform admin</h1>
      <p className="text-ink-soft mt-1">
        Cross-tenant view across every business on FollowUp — visible only to the founder, and to no one on any
        individual business&apos;s own team.
      </p>
      <Link href="/admin/office" className="inline-flex items-center gap-1.5 text-sm mt-3" style={{ color: "var(--rust)" }}>
        The office — what the agents did while you weren&apos;t watching
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6">
        <StatCard label="Businesses signed up" value={String(data.totalBusinesses)} icon={Building2} accent="var(--slate)" accentSoft="var(--slate-soft)" />
        <StatCard label="Leads captured (all businesses)" value={String(data.totalLeadsPlatformWide)} icon={Inbox} accent="var(--slate)" accentSoft="var(--slate-soft)" />
        <StatCard label="Active businesses" value={String(data.activeBusinessCount)} icon={Radio} accent="var(--sage)" accentSoft="var(--sage-soft)" />
        <StatCard label="Dormant businesses" value={String(data.dormantBusinessCount)} icon={MoonStar} accent="var(--slate)" accentSoft="var(--slate-soft)" />
        <StatCard label="Estimated MRR" value={formatCurrency(data.estimatedMonthlyRevenueUsd)} icon={DollarSign} />
      </div>
      <p className="text-xs text-ink-soft mt-3">
        {data.activeBusinessCount} of {data.totalBusinesses} businesses have captured at least one lead or connected
        an integration (Gmail, Outlook, Instagram, or Facebook); the rest are dormant. MRR is a rough estimate —
        paid-tier businesses with a currently active or trialing subscription, times that tier&apos;s list price.
      </p>

      <div className="mt-10">
        <AdminCharts
          signupsPerWeek={data.signupsPerWeek}
          channelBreakdown={data.channelBreakdown}
          tierBreakdown={data.tierBreakdown}
        />
      </div>

      <section className="mt-10">
        <h2 className="font-display text-xl">Recent signups</h2>
        <p className="text-sm text-ink-soft mt-1">The most recently created businesses, newest first.</p>
        <div className="mt-4 rounded-xl border border-line bg-card overflow-hidden overflow-x-auto">
          {/* `_` (space), not a comma, between grid tracks — see the note
              on this same pattern in TeamPerformanceSection.tsx. */}
          <div className="grid grid-cols-[minmax(0,1.5fr)_auto_minmax(0,1.5fr)_auto] gap-4 px-5 py-3 border-b border-line text-xs font-medium text-ink-soft">
            <span>Business</span>
            <span>Signed up</span>
            <span>Connected channels</span>
            <span className="text-right">Leads</span>
          </div>
          {data.recentSignups.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-soft">No businesses have signed up yet.</p>
          ) : (
            data.recentSignups.map((b) => (
              <div
                key={b.id}
                className="grid grid-cols-[minmax(0,1.5fr)_auto_minmax(0,1.5fr)_auto] gap-4 px-5 py-3 border-b border-line last:border-0 items-center"
              >
                <span className="text-sm font-medium truncate">{b.name}</span>
                <span className="text-sm text-ink-soft whitespace-nowrap">{formatFullDate(b.createdAt)}</span>
                <span className="flex flex-wrap gap-1.5">
                  {b.connectedChannels.length === 0 ? (
                    <span className="text-sm text-ink-soft">—</span>
                  ) : (
                    b.connectedChannels.map((c) => (
                      <span
                        key={c}
                        className="text-xs rounded-full border border-line px-2 py-0.5 text-ink-soft whitespace-nowrap"
                      >
                        {channelLabel(c)}
                      </span>
                    ))
                  )}
                </span>
                <span className="text-sm text-right tabular-nums">{b.leadCount}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
