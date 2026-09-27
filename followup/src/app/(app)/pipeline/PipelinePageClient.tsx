"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Lead, PipelineStage } from "@/lib/types";
import { formatCurrency, daysSince } from "@/lib/demo-data";
import { getPipelineData } from "@/lib/pipeline";
import { OPEN_IN_PLACE } from "@/lib/motion";
import { Initials } from "@/components/app/canvasBits";

/**
 * Pipeline, as drawn on the canvas (A-066): the open stages as quiet
 * columns, each customer with their value, a total per stage, and one line
 * for won and lost. No score badges and no stage dropdown on every card:
 * on a computer a customer is dragged to another stage (or onto Won / Lost);
 * anywhere, the stage can be changed from their own page.
 *
 * On the phone the stages are one list with one stage open at a time
 * (R-015), because drag-and-drop doesn't exist on a touch screen.
 *
 * Out of the menu since A-027; reached from Settings › Everything else.
 */
const toDbStage = (s: PipelineStage) => s.toUpperCase();

function quietLine(lead: Lead): string {
  const d = daysSince(lead.lastContacted);
  if (d <= 0) return "Touched today";
  return `Quiet ${d} ${d === 1 ? "day" : "days"}`;
}

function money(n: number): string {
  return n > 0 ? formatCurrency(n) : "—";
}

export default function PipelinePageClient({ leads }: { leads: Lead[] }) {
  const { data: session } = useSession();
  const [mineOnly, setMineOnly] = useState(false);
  // Local, optimistically-updated copy: a move should feel instant, not wait
  // on a round trip. Re-seeded when the server hands down fresh leads,
  // adjusted during render (React's documented pattern) rather than in an
  // effect.
  const [localLeads, setLocalLeads] = useState(leads);
  const [prevLeadsProp, setPrevLeadsProp] = useState(leads);
  if (leads !== prevLeadsProp) {
    setPrevLeadsProp(leads);
    setLocalLeads(leads);
  }

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<PipelineStage | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  // null = the default (first stage with anyone in it); "none" = all closed.
  const [openStage, setOpenStage] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState<"won" | "lost" | null>(null);

  const visible = useMemo(
    () => (mineOnly ? localLeads.filter((l) => l.assignedToId === session?.user?.id) : localLeads),
    [localLeads, mineOnly, session?.user?.id]
  );

  const stages = useMemo(() => getPipelineData(visible), [visible]);
  const open = stages.filter((s) => s.id !== "won" && s.id !== "lost");
  const won = stages.find((s) => s.id === "won");
  const lost = stages.find((s) => s.id === "lost");
  const openValue = open.reduce((sum, s) => sum + s.value, 0);
  const openCount = open.reduce((sum, s) => sum + s.leads.length, 0);
  // On the phone the first stage with anyone in it starts open.
  const phoneOpen = openStage ?? open.find((s) => s.leads.length > 0)?.id ?? null;

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
      setMoveError(`Couldn't move ${lead.name}. Try again.`);
    }
  }

  function dropProps(stageId: PipelineStage) {
    return {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        setDragOverStage(stageId);
      },
      onDragLeave: () => setDragOverStage((s) => (s === stageId ? null : s)),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setDragOverStage(null);
        const leadId = e.dataTransfer.getData("text/lead-id");
        if (leadId) moveLead(leadId, stageId);
      },
    };
  }

  const closedList = showClosed === "won" ? won : showClosed === "lost" ? lost : null;

  return (
    <div>
      <Link href="/settings" className="text-[13px] text-ink-faint hover:text-ink">
        ← Settings
      </Link>
      <div className="mt-2 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[30px] leading-[1.12] lg:text-[34px]">Pipeline</h1>
          <p className="mt-2 max-w-[640px] text-[15px] leading-relaxed text-ink-soft">
            {openCount === 0
              ? "Nobody is in an open stage right now."
              : `${formatCurrency(openValue)} open across ${openCount} ${openCount === 1 ? "customer" : "customers"}.`}
            <span className="hidden lg:inline"> Drag someone to another stage, or move them from their page.</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMineOnly((v) => !v)}
          aria-pressed={mineOnly}
          className="h-9 shrink-0 rounded-full border px-3.5 text-[13.5px] font-medium"
          style={{
            background: mineOnly ? "var(--ink)" : "var(--card)",
            color: mineOnly ? "var(--on-accent)" : "var(--ink)",
            borderColor: mineOnly ? "var(--ink)" : "var(--line)",
          }}
        >
          Only mine
        </button>
      </div>

      {moveError && (
        <p className="mt-4 text-sm" role="alert" style={{ color: "var(--coral)" }}>
          {moveError}
        </p>
      )}

      {visible.length === 0 && (
        <p className="mt-6 text-[15px] text-ink-soft">
          {mineOnly ? (
            "No customers assigned to you right now."
          ) : (
            <>
              No customers yet. Connect where customers write to you in{" "}
              <Link href="/settings" className="underline underline-offset-[3px]">
                Settings
              </Link>
              : your inbox, website form, DMs or CRM. They arrive here.
            </>
          )}
        </p>
      )}

      {/* Desktop: the open stages side by side. */}
      <div className="mt-6 hidden gap-3 lg:grid lg:grid-cols-5 lg:items-start">
        {open.map((stage) => (
          <section key={stage.id} className="min-w-0" {...dropProps(stage.id)}>
            <div className="flex items-baseline justify-between px-1">
              <h2 className="text-sm font-medium">
                {stage.label} <span className="font-normal tabular-nums text-ink-faint">{stage.leads.length}</span>
              </h2>
              <span className="text-[13px] tabular-nums text-ink-faint">{money(stage.value)}</span>
            </div>
            <div
              className="mt-2 min-h-[64px] overflow-hidden rounded-[18px] border bg-card"
              style={{
                borderColor: dragOverStage === stage.id ? "var(--ink)" : "var(--line)",
                borderStyle: dragOverStage === stage.id ? "dashed" : "solid",
              }}
            >
              {stage.leads.length === 0 ? (
                <p className="px-3.5 py-5 text-[13px] text-ink-faint">Nobody here.</p>
              ) : (
                stage.leads.map((lead, i) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/lead-id", lead.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDraggingId(lead.id);
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    className={"flex cursor-grab items-start gap-2.5 px-3.5 py-3 active:cursor-grabbing " + (i ? "border-t border-line-2" : "")}
                    style={{ opacity: draggingId === lead.id ? 0.4 : 1 }}
                  >
                    <Initials name={lead.name} size={28} />
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2">
                        <Link href={`/leads/${lead.id}`} className="truncate text-sm font-medium hover:underline">
                          {lead.name}
                        </Link>
                        <span className="shrink-0 text-[13px] tabular-nums text-ink-soft">{money(lead.dealValue)}</span>
                      </div>
                      <div className="mt-0.5 text-[12.5px] text-ink-faint">{quietLine(lead)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        ))}
      </div>

      {/* Phone: one stage open at a time. */}
      <div className="mt-5 overflow-hidden rounded-[18px] border border-line bg-card lg:hidden">
        {open.map((stage, i) => {
          const isOpen = phoneOpen === stage.id;
          return (
            <div key={stage.id} className={i ? "border-t border-line-2" : ""}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpenStage(isOpen ? "none" : stage.id)}
                className="flex min-h-14 w-full items-center gap-2.5 px-4 text-left"
              >
                <span className="flex-1 text-base font-medium">{stage.label}</span>
                <span className="text-sm tabular-nums text-ink-faint">
                  {stage.leads.length} · {money(stage.value)}
                </span>
                {isOpen ? <ChevronDown className="h-[18px] w-[18px]" /> : <ChevronRight className="h-[18px] w-[18px] text-ink-faint" />}
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div key="open" {...OPEN_IN_PLACE}>
                    {stage.leads.length === 0 ? (
                      <p className="border-t border-line-2 px-4 py-4 text-sm text-ink-faint">Nobody here.</p>
                    ) : (
                      stage.leads.map((lead) => (
                        <Link
                          key={lead.id}
                          href={`/leads/${lead.id}`}
                          className="flex min-h-[60px] items-center gap-3 border-t border-line-2 bg-paper px-4"
                        >
                          <Initials name={lead.name} size={34} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15.5px] font-medium">{lead.name}</span>
                            <span className="block text-[13.5px] text-ink-faint">{quietLine(lead)}</span>
                          </span>
                          <span className="text-sm tabular-nums text-ink-soft">{money(lead.dealValue)}</span>
                        </Link>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Won and lost: one line. Each opens its list in place, and on a
          computer each is also somewhere to drop a customer. */}
      {(won || lost) && (
        <div className="mt-5 flex flex-wrap gap-2">
          {[won, lost].map((s) =>
            s ? (
              <button
                key={s.id}
                type="button"
                {...dropProps(s.id)}
                onClick={() => setShowClosed((v) => (v === s.id ? null : (s.id as "won" | "lost")))}
                aria-expanded={showClosed === s.id}
                className="rounded-full border px-3.5 py-1.5 text-sm text-ink-soft"
                style={{
                  borderColor: dragOverStage === s.id ? "var(--ink)" : "transparent",
                  borderStyle: dragOverStage === s.id ? "dashed" : "solid",
                  background: showClosed === s.id ? "var(--card)" : "transparent",
                }}
              >
                {s.label}{" "}
                <span className="font-semibold tabular-nums text-ink">
                  {s.leads.length}
                  {s.id === "won" && s.value > 0 ? ` · ${formatCurrency(s.value)}` : ""}
                </span>
              </button>
            ) : null
          )}
        </div>
      )}
      <AnimatePresence initial={false}>
        {closedList && closedList.leads.length > 0 && (
          <motion.div key={closedList.id} {...OPEN_IN_PLACE} className="mt-2 max-w-[560px] overflow-hidden rounded-[18px] border border-line bg-card">
            {closedList.leads.map((lead, i) => (
              <Link key={lead.id} href={`/leads/${lead.id}`} className={"flex items-center gap-3 px-4 py-3 " + (i ? "border-t border-line-2" : "")}>
                <Initials name={lead.name} size={28} />
                <span className="flex-1 truncate text-sm font-medium">{lead.name}</span>
                <span className="text-[13px] tabular-nums text-ink-soft">{money(lead.dealValue)}</span>
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
