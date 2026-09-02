"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Lead, PipelineStage } from "@/lib/types";
import { formatCurrency, daysSince } from "@/lib/demo-data";
import { getPipelineData } from "@/lib/leads-data";
import { urgencyColor } from "@/lib/urgency";
import ScoreBadge from "@/components/ScoreBadge";
import StatCard from "@/components/StatCard";
import PipelineSnapshot from "@/components/PipelineSnapshot";
import EmptyState from "@/components/EmptyState";
import { DollarSign, TrendingUp, Users, Inbox } from "lucide-react";

const STAGE_WEIGHT: Record<string, number> = {
  new: 0.1,
  contacted: 0.25,
  qualified: 0.4,
  proposal: 0.6,
  negotiation: 0.8,
  won: 1,
  lost: 0,
};

const toDbStage = (s: PipelineStage) => s.toUpperCase();

export default function PipelinePageClient({ leads }: { leads: Lead[] }) {
  const { data: session } = useSession();
  const [mineOnly, setMineOnly] = useState(false);
  // Local, optimistically-updated copy — a drag-and-drop move should feel
  // instant, not wait on a round trip. Re-seeded whenever the server hands
  // down fresh leads (e.g. after a real navigation) — adjusted during
  // render (React's documented pattern for this) rather than an effect,
  // so it doesn't cost an extra render pass.
  const [localLeads, setLocalLeads] = useState(leads);
  const [prevLeadsProp, setPrevLeadsProp] = useState(leads);
  if (leads !== prevLeadsProp) {
    setPrevLeadsProp(leads);
    setLocalLeads(leads);
  }

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<PipelineStage | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  const visible = useMemo(
    () => (mineOnly ? localLeads.filter((l) => l.assignedToId === session?.user?.id) : localLeads),
    [localLeads, mineOnly, session?.user?.id]
  );

  const stages = useMemo(() => getPipelineData(visible), [visible]);
  const totalValue = stages.filter((s) => s.id !== "won" && s.id !== "lost").reduce((sum, s) => sum + s.value, 0);
  const weightedValue = stages.reduce((sum, s) => sum + s.value * (STAGE_WEIGHT[s.id] ?? 0), 0);
  const valueSnapshot = stages.map((s) => ({ label: s.label, count: s.leads.length, value: s.value }));

  async function moveLead(leadId: string, toStage: PipelineStage) {
    const lead = localLeads.find((l) => l.id === leadId);
    if (!lead || lead.stage === toStage) return;

    const previousStage = lead.stage;
    setLocalLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage: toStage } : l)));
    setMoveError(null);

    try {
      const res = await fetch(`/api/leads/${leadId}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: toDbStage(toStage) }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setLocalLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage: previousStage } : l)));
      setMoveError(`Couldn't move ${lead.name} — try again.`);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl">Pipeline</h1>
          <p className="text-ink-soft mt-1">
            Where every deal stands, and what it&apos;s worth. Drag a card to move its stage.
          </p>
        </div>
        <button
          onClick={() => setMineOnly((v) => !v)}
          className="rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors shrink-0"
          style={{
            backgroundColor: mineOnly ? "var(--ink)" : "var(--card)",
            color: mineOnly ? "var(--paper)" : "var(--ink-soft)",
            border: mineOnly ? "none" : "1px solid var(--line)",
          }}
        >
          My leads only
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
        <StatCard label="Active leads" value={String(visible.length)} icon={Users} accent="var(--slate)" accentSoft="var(--slate-soft)" />
        <StatCard label="Total pipeline value" value={formatCurrency(totalValue)} icon={DollarSign} accent="var(--gold)" accentSoft="var(--gold-soft)" />
        <StatCard label="Weighted value" value={formatCurrency(Math.round(weightedValue))} icon={TrendingUp} accent="var(--rust)" accentSoft="var(--rust-soft)" />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={mineOnly ? "No leads assigned to you" : "No leads yet"}
          description={
            mineOnly
              ? "Nothing's assigned to you right now — check back once new leads come in."
              : "Connect Gmail in Settings and sync your inbox to see your pipeline take shape."
          }
          action={
            mineOnly ? undefined : (
              <Link
                href="/settings"
                className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium"
                style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
              >
                Go to Settings
              </Link>
            )
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

      {moveError && (
        <p className="mt-4 text-sm" style={{ color: "var(--rust)" }}>
          {moveError}
        </p>
      )}

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stages.map((stage) => (
          <div
            key={stage.id}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverStage(stage.id);
            }}
            onDragLeave={() => setDragOverStage((s) => (s === stage.id ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverStage(null);
              const leadId = e.dataTransfer.getData("text/lead-id");
              if (leadId) moveLead(leadId, stage.id);
            }}
            className="rounded-xl border p-4 min-h-[120px] transition-colors"
            style={{
              backgroundColor: "var(--card)",
              borderColor: dragOverStage === stage.id ? "var(--rust)" : "var(--line)",
              borderStyle: dragOverStage === stage.id ? "dashed" : "solid",
              borderWidth: dragOverStage === stage.id ? 2 : 1,
            }}
          >
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
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/lead-id", lead.id);
                    e.dataTransfer.effectAllowed = "move";
                    setDraggingId(lead.id);
                  }}
                  onDragEnd={() => setDraggingId(null)}
                  className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-2 text-xs hover:bg-paper cursor-grab active:cursor-grabbing"
                  style={{ opacity: draggingId === lead.id ? 0.4 : 1 }}
                >
                  <ScoreBadge score={lead.score} size="sm" />
                  <span className="truncate flex-1">{lead.name}</span>
                  {stage.id !== "won" && stage.id !== "lost" && (
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: urgencyColor(daysSince(lead.lastContacted)) }}
                      title={`${daysSince(lead.lastContacted)} days since last contact`}
                    />
                  )}
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
