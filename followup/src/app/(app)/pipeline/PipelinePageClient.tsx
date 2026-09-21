"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Lead, PipelineStage } from "@/lib/types";
import { formatCurrency, daysSince } from "@/lib/demo-data";
import { getPipelineData } from "@/lib/pipeline";
import { PIPELINE_STAGES } from "@/lib/demo-data";
import { urgencyColor } from "@/lib/urgency";
import { PageHeader } from "@/components/PageHeader";
import ScoreBadge from "@/components/ScoreBadge";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import { Inbox } from "lucide-react";
import { RevealGroup, RevealItem } from "@/components/motion/Reveal";
import CountUp from "@/components/motion/CountUp";

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
      <PageHeader
        title="Pipeline"
        subtitle="Where every deal stands, and what it's worth. Drag a card to move its stage."
        actions={
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
        }
      />

      <RevealGroup on="mount" className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
        <RevealItem>
          <StatCard label="Active leads" value={<CountUp to={visible.length} />} accent="var(--slate)" />
        </RevealItem>
        <RevealItem>
          <StatCard label="Total pipeline value" value={formatCurrency(totalValue)} />
        </RevealItem>
        <RevealItem>
          {/* Was "Weighted value" — jargon, and a number computed from a
              hardcoded per-stage probability table (STAGE_WEIGHT above) that
              is never shown anywhere. An owner can neither derive it nor
              disagree with it. Renamed to what it's actually estimating, with
              the basis stated underneath rather than hidden in the source. */}
          <StatCard label="Likely to close" value={formatCurrency(Math.round(weightedValue))} />
        </RevealItem>
      </RevealGroup>

      <p className="mt-2 text-xs text-ink-soft">
        &ldquo;Likely to close&rdquo; weights each deal by how far along it is — 10% at New, rising to 80% at
        Negotiation. It&apos;s an estimate from stage alone, not a forecast.
      </p>

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
      ) : null}

      {/* The "Value by stage" bar chart that used to sit here showed exactly
          the numbers the board prints in each column header, immediately
          below it — the same data twice, with the chart going first. The
          board is the better of the two because you can act on it. Deleted;
          PipelineSnapshot still serves /analytics. */}

      {moveError && (
        <p className="mt-4 text-sm" style={{ color: "var(--coral)" }}>
          {moveError}
        </p>
      )}

      {/* A pipeline is read left to right, and this was a `lg:grid-cols-4`
          holding SEVEN stages — so the board wrapped 4 + 3 with a gap, which
          destroys the one thing the visual exists for. Below lg it was worse:
          two columns and four rows at sm, and at 390px seven stacked columns
          and an endless vertical scroll.

          It's a real horizontal scroller now — seven fixed columns in stage
          order at every width. On a phone that turns a seven-screen scroll
          into one sideways swipe, which is also how every kanban the owner
          has ever used behaves. The negative margins let the board bleed to
          the screen edge so the next column is visibly cut off, which is what
          tells someone it scrolls.

          One-time cascade on load, like the stat row above — a handful of
          columns is exactly the case a stagger reads as deliberate. */}
      <RevealGroup
        on="mount"
        className="mt-8 flex gap-4 overflow-x-auto -mx-4 px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        {stages.map((stage) => {
          const closed = stage.id === "won" || stage.id === "lost";
          return (
          <RevealItem key={stage.id} className="w-[260px] shrink-0">
          <div
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
            className="rounded-[var(--radius-box)] border p-4 min-h-[120px] transition-colors"
            style={{
              backgroundColor: "var(--card)",
              borderColor: dragOverStage === stage.id ? "var(--rust)" : "var(--line)",
              borderStyle: dragOverStage === stage.id ? "dashed" : "solid",
              borderWidth: dragOverStage === stage.id ? 2 : 1,
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{stage.label}</h3>
              {/* Won/Lost are a qualitatively different kind of column than
                  the in-progress stages — a closed outcome, not a step on
                  the way to one — so the count itself carries that via
                  color instead of every column reading identically. */}
              <span
                className="text-xs font-medium rounded-full px-1.5 py-0.5 tabular-nums"
                style={
                  stage.id === "won"
                    ? { color: "var(--sage)", backgroundColor: "var(--sage-soft)" }
                    : stage.id === "lost"
                      ? { color: "var(--coral)", backgroundColor: "var(--coral-soft)" }
                      : { color: "var(--ink-soft)" }
                }
              >
                {stage.leads.length}
              </span>
            </div>
            <p className="text-sm font-medium mt-0.5">
              {formatCurrency(stage.value)}
            </p>
            <div className="mt-3 space-y-2">
              {stage.leads.map((lead) => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/lead-id", lead.id);
                    e.dataTransfer.effectAllowed = "move";
                    setDraggingId(lead.id);
                  }}
                  onDragEnd={() => setDraggingId(null)}
                  className="rounded-lg border border-line pl-2 pr-2.5 py-2 text-xs hover:bg-paper cursor-grab active:cursor-grabbing border-l-[3px]"
                  style={{
                    opacity: draggingId === lead.id ? 0.4 : 1,
                    borderLeftColor: closed ? "var(--line)" : urgencyColor(daysSince(lead.lastContacted)),
                  }}
                >
                  {/* The name and the stage select used to share one row
                      inside a 260px column. The select is ~120px and was
                      shrink-0, the score badge 36px, so the name — the only
                      thing that identifies the card — got about 30px and
                      rendered as "Der…", "Kon…", "Sar…". Two rows instead:
                      the lead reads first, the control sits under it. */}
                  <div className="flex items-center gap-2">
                    <ScoreBadge score={lead.score} size="sm" />
                    <Link href={`/leads/${lead.id}`} className="min-w-0 truncate flex-1 font-medium hover:underline">
                      {lead.name}
                    </Link>
                  </div>
                  {/* The left rail's colour used to be the card's only
                      urgency signal, with its meaning in a `title` tooltip —
                      unreachable on a touch screen, and exactly the "colour
                      carrying the meaning alone" that A-006 rules out. The
                      same fact, in words, on the card. Closed columns say
                      nothing: "silent 40 days" is not a problem on a deal
                      that's already won or lost, which is why their rail is
                      neutral too. */}
                  {!closed && (
                    <p className="mt-1 pl-1" style={{ color: urgencyColor(daysSince(lead.lastContacted)) }}>
                      {daysSince(lead.lastContacted) === 0
                        ? "Touched today"
                        : `Silent ${daysSince(lead.lastContacted)} ${daysSince(lead.lastContacted) === 1 ? "day" : "days"}`}
                    </p>
                  )}
                  {/* Dragging a card between columns needs a mouse — HTML5
                      drag-and-drop has no touch support on any mobile
                      browser, so this select is the only way to move a
                      lead's stage on a phone. Kept visible on every screen
                      size rather than hidden until touch, since it's a
                      faster action than a drag even with a mouse. */}
                  <select
                    value={stage.id}
                    onChange={(e) => moveLead(lead.id, e.target.value as PipelineStage)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Move ${lead.name} to a different stage`}
                    className="mt-1.5 w-full text-xs rounded border border-line bg-paper px-1.5 py-1 text-ink-soft"
                  >
                    {PIPELINE_STAGES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              {/* Suppressed when the whole pipeline has zero leads — the
                  top-level EmptyState above ("No leads yet — connect
                  Gmail") already says this once; repeating it in all 7
                  columns is the same message eight times on one screen.
                  Once at least one real lead exists anywhere in the
                  pipeline, an individual empty column is a real, useful
                  fact again, so the per-column message comes back. */}
              {stage.leads.length === 0 && leads.length > 0 && (
                <p className="text-xs text-ink-soft italic">No leads at this stage</p>
              )}
            </div>
          </div>
          </RevealItem>
          );
        })}
      </RevealGroup>
    </div>
  );
}
