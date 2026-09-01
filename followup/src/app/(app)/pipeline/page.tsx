import Link from "next/link";
import { getLeads, getPipelineData } from "@/lib/leads-data";
import { formatCurrency } from "@/lib/demo-data";
import ScoreBadge from "@/components/ScoreBadge";

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

  return (
    <div>
      <h1 className="font-display text-3xl">Pipeline</h1>
      <div className="flex gap-8 mt-2 text-sm text-ink-soft">
        <p>
          Total pipeline value: <span className="font-medium" style={{ color: "var(--gold)" }}>{formatCurrency(totalValue)}</span>
        </p>
        <p>
          Weighted value: <span className="font-medium" style={{ color: "var(--gold)" }}>{formatCurrency(Math.round(weightedValue))}</span>
        </p>
      </div>

      {leads.length === 0 && (
        <p className="text-sm text-ink-soft mt-4">
          No leads yet — head to{" "}
          <Link href="/settings" className="underline">
            Settings
          </Link>{" "}
          to connect Gmail and sync your inbox.
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
