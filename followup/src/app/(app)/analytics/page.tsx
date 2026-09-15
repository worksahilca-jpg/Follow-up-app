import Link from "next/link";
import { Inbox } from "lucide-react";
import StatCard from "@/components/StatCard";
import { FactList } from "@/components/FactList";
import { PageHeader } from "@/components/PageHeader";
import AnalyticsCharts from "@/components/AnalyticsCharts";
import TeamPerformanceSection from "@/components/TeamPerformanceSection";
import EmptyState from "@/components/EmptyState";
import { getAnalytics } from "@/lib/analytics-data";
import { formatCurrency } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const data = await getAnalytics();

  // No signed-out branch: (app)/layout.tsx redirects before this page is
  // reached, so the bare "Sign in to view analytics." paragraph that used to
  // live here was unreachable, unstyled dead code.
  if (!data) return null;

  return (
    <div>
      <PageHeader title="Analytics" subtitle="How your pipeline is performing." />

      {data.totalLeads === 0 ? (
        // Same "connect Gmail to get started" treatment as Leads and
        // Pipeline's empty states, instead of 12 silent zero-value tiles
        // and empty charts — there's nothing to analyze until leads exist.
        <div className="mt-6">
          <EmptyState
            icon={Inbox}
            title="No data yet"
            description="Connect Gmail in Settings to sync your inbox, or add a lead to get started — your stats will show up here once there's activity to measure."
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
        </div>
      ) : (
        <>
          {/* This was twelve StatCards in one flat 4-column grid. Twelve equal
              things is no hierarchy at all, and six of the twelve were
              reply-rate variants. Worse: median reply time — described in this
              file's own comment as "the core how-fast-do-we-get-leads-to-
              respond number behind the product's whole pitch" — was tile eight
              of twelve, rendered the same size as "Avg. deal value".

              Three tiers now. The headline the owner would repeat to someone
              else; then the money; then everything else as a reference table
              they glance at rather than read. */}
          <div
            className="relative mt-6 overflow-hidden rounded-[var(--radius-box)] bg-card p-5"
            style={{ boxShadow: "var(--shadow-box)" }}
          >
            {data.medianReplyHours !== null && (
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-[3px]"
                style={{ backgroundColor: "var(--sage)" }}
              />
            )}
            <p className="text-sm text-ink-soft">Median reply time</p>
            <p className="font-display text-5xl mt-1 tabular-nums">
              {data.medianReplyHours !== null ? `${data.medianReplyHours}h` : "—"}
            </p>
            {/* This sentence used to be a 12px grey line under the grid, and
                it was already the clearest writing on the page. */}
            <p className="mt-2 text-sm text-ink-soft">
              {data.followUpsSentTotal > 0
                ? `${data.repliedCount} of ${data.followUpsSentTotal} sent follow-ups have gotten a reply so far.`
                : "Nothing sent yet — this fills in once FollowUp has sent its first follow-ups."}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
            <StatCard label="Revenue won" value={formatCurrency(data.totalRevenue)} />
            <StatCard label="Avg. deal value" value={formatCurrency(data.avgDealValue)} />
            <StatCard label="Conversion rate" value={`${data.conversionRate}%`} />
          </div>

          <div className="mt-8">
            <p
              className="font-mono text-xs uppercase tracking-wider text-ink-soft mb-1"
              style={{ letterSpacing: "0.08em" }}
            >
              Everything else
            </p>
            <FactList
              facts={[
                { label: "Total leads", value: String(data.totalLeads) },
                { label: "Active", value: String(data.activeCount) },
                { label: "Won", value: String(data.wonCount) },
                { label: "Reply rate", value: data.followUpsSentTotal > 0 ? `${data.replyRate}%` : "—" },
                { label: "Reply rate — automated", value: data.automatedReplyRate !== null ? `${data.automatedReplyRate}%` : "—" },
                { label: "Reply rate — manual", value: data.manualReplyRate !== null ? `${data.manualReplyRate}%` : "—" },
                { label: "On a follow-up plan", value: String(data.sequenceHealth.enrolledCount) },
                { label: "Plans finished (30 days)", value: String(data.sequenceHealth.completedLast30Days) },
              ]}
            />
          </div>

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
        </>
      )}
    </div>
  );
}
