import Link from "next/link";
import { Building2, Inbox, Radio, MoonStar, DollarSign, ArrowRight } from "lucide-react";
import StatCard from "@/components/StatCard";
import AccessRequestList from "@/components/AccessRequestList";
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

// One definition of the signups table's column tracks. It was written out
// twice — once in the header row, once in the body row — and two copies of a
// layout contract diverge the first time a column is added.
// `_` (space), not a comma, between grid tracks — see the note on this same
// pattern in TeamPerformanceSection.tsx.
const SIGNUP_GRID = "grid-cols-[minmax(0,1.5fr)_auto_minmax(0,1.5fr)_auto]";

export default async function AdminPage() {
  const data = await getPlatformAdminData();

  return (
    <div>
      <h1 className="font-display text-3xl">Platform admin</h1>
      <p className="text-ink-soft mt-1">
        Cross-tenant view across every business on FollowUp — visible only to the founder, and to no one on any
        individual business&apos;s own team.
      </p>
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink transition-colors mt-3">
        &larr; Back to FollowUp
      </Link>
      <Link href="/admin/office" className="inline-flex items-center gap-1.5 text-sm mt-3 ml-4" style={{ color: "var(--rust)" }}>
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
        <h2 className="font-display text-xl">Beta testers</h2>
        <p className="text-sm text-ink-soft mt-1">
          The only way in. Add a Google email and that person can sign in on their next try — no settings change, no
          redeploy. Nobody can ask from the site.
        </p>
        {/* The goal as a funnel, not a count: ten added means nothing until
            ten have an inbox connected and a lead on the board. Four numbers
            in one box, the step that is lagging obvious by eye. */}
        <div className="mt-4 box p-5">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm font-medium">
              {data.testerFunnel.firstLead} of {data.testerFunnel.goal} testers are testing
            </p>
            <p className="text-xs text-ink-soft">a tester counts once they have a lead on the board</p>
          </div>
          <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--line)" }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, (data.testerFunnel.firstLead / data.testerFunnel.goal) * 100)}%`, backgroundColor: "var(--rust)" }}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(
              [
                ["Added", data.testerFunnel.added],
                ["Signed in", data.testerFunnel.signedIn],
                ["Inbox connected", data.testerFunnel.inboxConnected],
                ["First lead", data.testerFunnel.firstLead],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <p className="font-display text-2xl tabular-nums">{value}</p>
                <p className="text-xs text-ink-soft">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <AccessRequestList requests={data.accessRequests} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl">What testers changed this week</h2>
        <p className="text-sm text-ink-soft mt-1">
          Every draft a tester edited before sending, from businesses that turned on &quot;Help improve
          FollowUp&quot;. Names and contact details are removed before this page sees them. Read the
          difference, then fix the instructions.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          {data.draftChanges.length === 0 ? (
            <div className="box p-5 text-sm text-ink-soft">
              Nothing yet. This fills as testers with the switch on edit a draft and send it.
            </div>
          ) : (
            data.draftChanges.map((c) => (
              <div key={c.id} className="box p-5">
                <p className="text-xs text-ink-soft">
                  {c.businessName} · {channelLabel(c.channel)} · {formatFullDate(c.sentAt)}
                </p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-ink-soft mb-1">FollowUp wrote</p>
                    <p className="text-sm whitespace-pre-wrap">{c.draft}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-1">They sent</p>
                    <p className="text-sm whitespace-pre-wrap">{c.sent}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl">Recent signups</h2>
        <p className="text-sm text-ink-soft mt-1">The most recently created businesses, newest first.</p>
        <div className="mt-4 box overflow-hidden overflow-x-auto">
          {/* `_` (space), not a comma, between grid tracks — see the note
              on this same pattern in TeamPerformanceSection.tsx. */}
          <div className={`grid ${SIGNUP_GRID} gap-4 px-5 py-3 border-b border-line text-xs font-medium text-ink-soft`}>
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
                className={`grid ${SIGNUP_GRID} gap-4 px-5 py-3 border-b border-line last:border-0 items-center`}
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
