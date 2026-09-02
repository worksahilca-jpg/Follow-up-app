import Link from "next/link";
import { getLeads, getPipelineData } from "@/lib/leads-data";
import { formatCurrency } from "@/lib/demo-data";
import ScoreBadge from "@/components/ScoreBadge";
import StatCard from "@/components/StatCard";
import PipelineSnapshot from "@/components/PipelineSnapshot";
import EmptyState from "@/components/EmptyState";
import { DollarSign, TrendingUp, Users, Inbox } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const leads = await getLeads();
  const stages = getPipelineData(leads);
  const totalValue = stages
    .filter((s) => s.id !== "won" && s.id !== "lost")
    .reduce((sum, s) => sum + s.value, 0);
  const weightedValue = stages.reduce((sum, s) => {
    const weight: Record<string, number> = {
      new: 0.1,
      contacted: 0.25,
      qualified: 0.4,
      proposal: 0.6,
      negotiation: 0.8,
      won: 1,
      lost: 0,
    };
    return sum + s.value * (weight[s.id] ?? 0);
  }, 0);
  const valueSnapshot = stages.map((s) => ({ label: s.label, count: s.leads.length, value: s.value }));

  return (
    <div>
      <h1 className="font-display text-3xl">Pipeline</h1>
      <p className="text-ink-soft mt-1">Where every deal stands, and what it&apos;s worth.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
        <StatCard label="Active leads" value={String(leads.length)} icon={Users} accent="var(--slate)" accentSoft="var(--slate-soft)" />
        <StatCard label="Total pipeline value" value={formatCurrency(totalValue)} icon={DollarSign} accent="var(--gold)" accentSoft="var(--gold-soft)" />
        <StatCard label="Weighted value" value={formatCurrency(Math.round(weightedValue))} icon={TrendingUp} accent="var(--rust)" accentSoft="var(--rust-soft)" />
      </div>

      {leads.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No leads yet"
          description="Connect Gmail in Settings and sync your inbox to see your pipeline take shape."
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
      ) : (
        <section className="mt-8">
          <h2 className="font-display text-xl">Value by stage</h2>
          <div className="mt-4">
            <PipelineSnapshot stages={valueSnapshot} metric="value" height={200} />
          </div>
        </section>
      )}

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stages.map((stage) => (
          <div key={stage.id} className="rounded-xl border border-line bg-card p-4 min-h-[120px]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{stage.label}</h3>
              <span className="text-xs text-ink-soft">{stage.leads.length}</span>
            </div>
            <p className="text-sm font-medium mt-0.5" style={{ color: "var(--gold)" }}>
              {formatCurrency(stage.value)}
            </p>
            <div className="mt-3 space-y-2">
              {stage.leads.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-2 text-xs hover:bg-paper"
                >
                  <ScoreBadge score={lead.score} size="sm" />
                  <span className="truncate flex-1">{lead.name}</span>
                </Link>
              ))}
              {stage.leads.length === 0 && (
                <p className="text-xs text-ink-soft italic">No leads at this stage</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
