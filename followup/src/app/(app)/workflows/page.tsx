"use client";

/**
 * Workflow builder — create/edit/delete multi-step automated sequences
 * (see src/lib/sequences.ts for what a step actually does when it runs).
 * Enrolling a specific lead into one happens on that lead's own page, not
 * here — this page is only about defining the sequences themselves.
 *
 * Client-rendered like Settings: state lives in React, persisted via
 * fetch() to /api/sequences rather than server-rendered from a DB read,
 * since almost everything on this page is an edit in progress.
 */

import { useEffect, useState } from "react";
import { Plus, Sparkles, Trash2, ChevronUp, ChevronDown, Mail, ArrowRightLeft, Workflow as WorkflowIcon } from "lucide-react";
import EmptyState from "@/components/EmptyState";

type SequenceAction = "EMAIL" | "CHANGE_STAGE";

interface StepDraft {
  delayDays: number;
  action: SequenceAction;
  stageTo: string | null;
  messageHint: string;
}

interface SequenceSummary {
  id: string;
  name: string;
  active: boolean;
  enrolledCount: number;
  steps: { id: string; order: number; delayDays: number; action: SequenceAction; stageTo: string | null; messageHint: string | null }[];
}

const STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "PROPOSAL", label: "Proposal Sent" },
  { value: "NEGOTIATION", label: "Negotiation" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
];

function blankStep(): StepDraft {
  return { delayDays: 3, action: "EMAIL", stageTo: null, messageHint: "" };
}

// A real bounded, escalating cadence rather than a blank sheet to fill in
// — cumulative days 2 / 5 / 10 / 18, matching the "most conversions happen
// 5-8 touches over 2-4 weeks" data (see the competitive research this was
// built from). Loaded into the editor for review/editing, never saved
// automatically — a business should see exactly what it's agreeing to
// send before it goes near a real lead.
const RECOMMENDED_CADENCE: { name: string; steps: StepDraft[] } = {
  name: "Recommended follow-up cadence",
  steps: [
    {
      delayDays: 2,
      action: "EMAIL",
      stageTo: null,
      messageHint: "A light, low-pressure check-in — just making sure this didn't get buried, nothing pushy.",
    },
    {
      delayDays: 3,
      action: "EMAIL",
      stageTo: null,
      messageHint: "More direct — ask plainly if they're still interested and what would help them decide.",
    },
    {
      delayDays: 5,
      action: "EMAIL",
      stageTo: null,
      messageHint: "Offer something of real value — answer a likely objection or suggest a concrete next step, not another check-in.",
    },
    {
      delayDays: 8,
      action: "EMAIL",
      stageTo: null,
      messageHint: "A final, honest message — acknowledge the silence, ask once more, no pressure either way.",
    },
  ],
};

export default function WorkflowsPage() {
  const [sequences, setSequences] = useState<SequenceSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  // Set only when "Use recommended cadence" started the editor — a plain
  // "New workflow" click leaves this null and the editor opens blank.
  const [template, setTemplate] = useState<{ name: string; steps: StepDraft[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/sequences")
      .then((r) => r.json())
      .then((data: { success: boolean; sequences?: SequenceSummary[] }) => {
        if (data.success && data.sequences) setSequences(data.sequences);
      })
      .finally(() => setLoaded(true));
  }

  useEffect(load, []);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Workflows</h1>
          <p className="text-ink-soft mt-1">
            Build a multi-step follow-up sequence once, then enroll leads into it from their own page.
          </p>
          <p className="text-sm text-ink-soft mt-1">
            The moment a lead replies, its workflow stops automatically — you get notified, and nothing scheduled
            sends after that. It never talks past a conversation that&apos;s actually happening.
          </p>
        </div>
        {!creating && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setTemplate(RECOMMENDED_CADENCE);
                setCreating(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium border border-line"
            >
              <Sparkles className="h-4 w-4" style={{ color: "var(--rust)" }} /> Use recommended cadence
            </button>
            <button
              onClick={() => {
                setTemplate(null);
                setCreating(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium"
              style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
            >
              <Plus className="h-4 w-4" /> New workflow
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-4 text-sm" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}

      {creating && (
        <div className="mt-6">
          {template && (
            <p className="text-xs text-ink-soft mb-2">
              Starting from our recommended 4-step cadence (day 2, 5, 10, 18) — edit anything below before saving.
            </p>
          )}
          <WorkflowEditor
            template={template ?? undefined}
            onCancel={() => {
              setCreating(false);
              setTemplate(null);
            }}
            onSaved={(seq) => {
              setSequences((prev) => [...prev, seq]);
              setCreating(false);
              setTemplate(null);
            }}
            onError={setError}
          />
        </div>
      )}

      <div className="mt-6 space-y-4">
        {loaded && sequences.length === 0 && !creating && (
          <EmptyState
            icon={WorkflowIcon}
            title="No workflows yet"
            description={<>Try &quot;Use recommended cadence&quot; above, or build your own from scratch.</>}
          />
        )}
        {sequences.map((seq) => (
          <WorkflowCard
            key={seq.id}
            sequence={seq}
            onUpdated={(updated) => setSequences((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))}
            onDeleted={(id) => setSequences((prev) => prev.filter((s) => s.id !== id))}
            onError={setError}
          />
        ))}
      </div>
    </div>
  );
}

function WorkflowCard({
  sequence,
  onUpdated,
  onDeleted,
  onError,
}: {
  sequence: SequenceSummary;
  onUpdated: (s: SequenceSummary) => void;
  onDeleted: (id: string) => void;
  onError: (msg: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggleActive() {
    setBusy(true);
    try {
      const res = await fetch(`/api/sequences/${sequence.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !sequence.active }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      onUpdated(data.sequence);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't update — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${sequence.name}"? Enrolled leads will be unenrolled.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/sequences/${sequence.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error("Couldn't delete — try again.");
      onDeleted(sequence.id);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't delete — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <WorkflowEditor
        sequence={sequence}
        onCancel={() => setEditing(false)}
        onSaved={(updated) => {
          onUpdated(updated);
          setEditing(false);
        }}
        onError={onError}
      />
    );
  }

  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg">{sequence.name}</h3>
            <span
              className="text-xs font-medium rounded-full px-2 py-0.5"
              style={{
                backgroundColor: sequence.active ? "var(--sage-soft)" : "var(--line)",
                color: sequence.active ? "var(--sage)" : "var(--ink-soft)",
              }}
            >
              {sequence.active ? "Active" : "Paused"}
            </span>
          </div>
          <p className="text-xs text-ink-soft mt-1">
            {sequence.steps.length} step{sequence.steps.length === 1 ? "" : "s"} · {sequence.enrolledCount} lead
            {sequence.enrolledCount === 1 ? "" : "s"} enrolled
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleActive}
            disabled={busy}
            className="text-xs font-medium rounded-lg px-2.5 py-1.5 border border-line disabled:opacity-60"
          >
            {sequence.active ? "Pause" : "Activate"}
          </button>
          <button
            onClick={() => setEditing(true)}
            disabled={busy}
            className="text-xs font-medium rounded-lg px-2.5 py-1.5 border border-line disabled:opacity-60"
          >
            Edit
          </button>
          <button
            onClick={remove}
            disabled={busy}
            className="text-xs font-medium rounded-lg px-2.5 py-1.5 disabled:opacity-60"
            style={{ color: "var(--coral)" }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <ol className="mt-4 space-y-2">
        {sequence.steps.map((step, i) => (
          <li key={step.id} className="flex items-start gap-2.5 text-sm">
            <span
              className="mt-0.5 shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-[11px] font-semibold"
              style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}
            >
              {i + 1}
            </span>
            <span className="text-ink-soft">
              {i === 0 ? `${step.delayDays}d after enrollment` : `${step.delayDays}d later`} —{" "}
              {step.action === "EMAIL" ? (
                <>
                  send an AI-drafted follow-up{step.messageHint ? ` (focused on: ${step.messageHint})` : ""}
                </>
              ) : (
                <>move to {STAGE_OPTIONS.find((s) => s.value === step.stageTo)?.label ?? step.stageTo}</>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function WorkflowEditor({
  sequence,
  template,
  onCancel,
  onSaved,
  onError,
}: {
  sequence?: SequenceSummary;
  // Seeds a brand-new (unsaved) workflow's fields — distinct from
  // `sequence`, which means "editing an existing one" and PATCHes instead
  // of POSTing. Only one of the two is ever passed at once.
  template?: { name: string; steps: StepDraft[] };
  onCancel: () => void;
  onSaved: (s: SequenceSummary) => void;
  onError: (msg: string | null) => void;
}) {
  const [name, setName] = useState(sequence?.name ?? template?.name ?? "");
  const [steps, setSteps] = useState<StepDraft[]>(
    sequence
      ? sequence.steps.map((s) => ({ delayDays: s.delayDays, action: s.action, stageTo: s.stageTo, messageHint: s.messageHint ?? "" }))
      : (template?.steps ?? [blankStep()])
  );
  const [saving, setSaving] = useState(false);

  function updateStep(i: number, patch: Partial<StepDraft>) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function move(i: number, dir: -1 | 1) {
    setSteps((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function save() {
    onError(null);
    setSaving(true);
    try {
      const payload = {
        name,
        steps: steps.map((s) => ({
          delayDays: s.delayDays,
          action: s.action,
          stageTo: s.action === "CHANGE_STAGE" ? s.stageTo : null,
          messageHint: s.action === "EMAIL" && s.messageHint.trim() ? s.messageHint.trim() : null,
        })),
      };
      const res = await fetch(sequence ? `/api/sequences/${sequence.id}` : "/api/sequences", {
        method: sequence ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message ?? "Couldn't save — try again.");
      onSaved(data.sequence);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't save — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={'Workflow name, e.g. "New lead nurture"'}
        className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-medium"
      />

      <div className="mt-4 space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="rounded-lg border border-line p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-ink-soft">
                <span
                  className="h-5 w-5 rounded-full flex items-center justify-center text-[11px] font-semibold"
                  style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}
                >
                  {i + 1}
                </span>
                <span>{i === 0 ? "days after enrollment" : "days after the previous step"}</span>
                <input
                  type="number"
                  min={0}
                  max={90}
                  value={step.delayDays}
                  onChange={(e) => updateStep(i, { delayDays: Number(e.target.value) })}
                  className="w-14 rounded-lg border border-line bg-paper px-2 py-1 text-center"
                />
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="p-1 rounded disabled:opacity-30"
                  aria-label="Move step up"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === steps.length - 1}
                  className="p-1 rounded disabled:opacity-30"
                  aria-label="Move step down"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setSteps((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={steps.length === 1}
                  className="p-1 rounded disabled:opacity-30"
                  style={{ color: "var(--coral)" }}
                  aria-label="Remove step"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="mt-2.5 flex rounded-lg border border-line overflow-hidden w-fit">
              <button
                onClick={() => updateStep(i, { action: "EMAIL" })}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
                style={{
                  backgroundColor: step.action === "EMAIL" ? "var(--rust)" : "transparent",
                  color: step.action === "EMAIL" ? "white" : "var(--ink-soft)",
                }}
              >
                <Mail className="h-3.5 w-3.5" /> Send email
              </button>
              <button
                onClick={() => updateStep(i, { action: "CHANGE_STAGE", stageTo: step.stageTo ?? "CONTACTED" })}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
                style={{
                  backgroundColor: step.action === "CHANGE_STAGE" ? "var(--rust)" : "transparent",
                  color: step.action === "CHANGE_STAGE" ? "white" : "var(--ink-soft)",
                }}
              >
                <ArrowRightLeft className="h-3.5 w-3.5" /> Change stage
              </button>
            </div>

            {step.action === "EMAIL" ? (
              <input
                value={step.messageHint}
                onChange={(e) => updateStep(i, { messageHint: e.target.value })}
                placeholder={'Optional — steer what this draft focuses on, e.g. "mention our case studies"'}
                className="mt-2.5 w-full rounded-lg border border-line bg-paper px-3 py-1.5 text-xs"
              />
            ) : (
              <select
                value={step.stageTo ?? ""}
                onChange={(e) => updateStep(i, { stageTo: e.target.value })}
                className="mt-2.5 rounded-lg border border-line bg-paper px-2 py-1.5 text-xs"
              >
                {STAGE_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={() => setSteps((prev) => [...prev, blankStep()])}
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium"
        style={{ color: "var(--rust)" }}
      >
        <Plus className="h-3.5 w-3.5" /> Add step
      </button>

      <div className="mt-4 pt-4 border-t border-line flex items-center gap-2">
        <button
          onClick={save}
          disabled={saving || !name.trim()}
          className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
          style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
        >
          {saving ? "Saving…" : "Save workflow"}
        </button>
        <button onClick={onCancel} disabled={saving} className="rounded-lg border border-line px-4 py-2 text-sm font-medium disabled:opacity-60">
          Cancel
        </button>
      </div>
    </div>
  );
}
