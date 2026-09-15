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
import { PageHeader } from "@/components/PageHeader";
import { Plus, Trash2, ChevronUp, ChevronDown, Mail, ArrowRightLeft, Workflow as WorkflowIcon } from "lucide-react";

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
// — cumulative days 3 / 7 / 14 / 30 from enrollment (stored below as the
// gap-from-previous-step delayDays sequences.ts actually runs on: 3, 4,
// 7, 16), matching research/product/2026-09-09-followup-cadence-best-
// practices.md's escalating-then-widening shape — the same pattern every
// competitor surveyed there (Follow Up Boss, kvCORE, BoomTown) already
// uses instead of one flat repeating interval. Loaded into the editor
// for review/editing, never saved automatically — a business should see
// exactly what it's agreeing to send before it goes near a real lead.
const RECOMMENDED_CADENCE: { name: string; steps: StepDraft[] } = {
  name: "Recommended follow-up plan",
  steps: [
    {
      delayDays: 3,
      action: "EMAIL",
      stageTo: null,
      messageHint: "A light, low-pressure check-in — just making sure this didn't get buried, nothing pushy.",
    },
    {
      delayDays: 4, // day 7 cumulative
      action: "EMAIL",
      stageTo: null,
      messageHint: "More direct — ask plainly if they're still interested and what would help them decide.",
    },
    {
      delayDays: 7, // day 14 cumulative
      action: "EMAIL",
      stageTo: null,
      messageHint: "Offer something of real value — answer a likely objection or suggest a concrete next step, not another check-in.",
    },
    {
      delayDays: 16, // day 30 cumulative
      action: "EMAIL",
      stageTo: null,
      messageHint:
        "A final message for a lead that's gone genuinely quiet for a month — name the actual elapsed time " +
        "(e.g. \"it's been about a month since...\") rather than a vague \"just checking in,\" and lead with " +
        "something concrete and useful (a real update, a real reason this is still worth their time) instead " +
        "of only asking again. No pressure either way.",
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
      {/* The third paragraph that used to sit here was the stop-on-reply
          guarantee — the single most trust-bearing sentence in the product,
          and PRODUCT_DIRECTION.md's Rule 3 — set as body copy in --ink-soft,
          third in a stack of three paragraphs nobody reads to the end. It has
          its own box below now.

          "Use recommended cadence" lost both its Sparkles icon (S-13 names
          sparkle icons specifically; it sat on a button whose action is
          "load a template", so it was pure decoration) and the word
          "cadence" — which is jargon this page's own h1, button and empty
          state all avoid by saying "plan". */}
      <PageHeader
        title="Follow-up plans"
        subtitle="Build a multi-step follow-up plan once, then put leads on it from their own page."
        actions={
          !creating && (
            <button
              onClick={() => {
                setTemplate(RECOMMENDED_CADENCE);
                setCreating(true);
              }}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium border border-line sm:w-auto"
            >
              Use our recommended plan
            </button>
          )
        }
        primary={
          !creating && (
            <button
              onClick={() => {
                setTemplate(null);
                setCreating(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium"
              style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
            >
              <Plus className="h-4 w-4" /> New plan
            </button>
          )
        }
      />

      {/* The guarantee, stated once, where it's relevant, as its own object
          rather than as the tail of a paragraph. */}
      <div
        className="relative mt-6 rounded-[var(--radius-box)] bg-card py-3 pl-4 pr-3"
        style={{ boxShadow: "var(--shadow-box)" }}
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-[3px] rounded-l-[var(--radius-box)]"
          style={{ backgroundColor: "var(--sage)" }}
        />
        <p className="text-sm font-medium">A plan stops the moment the lead replies.</p>
        <p className="mt-1 text-xs text-ink-soft">
          You get notified, and nothing scheduled sends after that. FollowUp never talks past a conversation
          that&apos;s actually happening.
        </p>
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
              Starting from our recommended 4-step plan (days 3, 7, 14 and 30) — edit anything below before saving.
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
          <div className="rounded-xl border border-line bg-card p-8 text-center">
            <WorkflowIcon className="h-6 w-6 mx-auto text-ink-soft" />
            <p className="text-sm text-ink-soft mt-3">
              No follow-up plans yet — try &quot;Use our recommended plan&quot; above, or build your own from scratch.
            </p>
          </div>
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
      {/* Stacks below sm, and the title column gets min-w-0.
          Side by side at 390px, three shrink-0 buttons left the title about
          110px: "Cold reactivation — winter maintenance contracts" wrapped to
          one word per line, the Active/Paused pill floated into the middle of
          it, and the delete button sat 6px past the right edge of the screen.
          A destructive control you cannot fully see is the part that made
          this a fix rather than a nicety. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
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
        <div className="flex items-center gap-2 sm:shrink-0">
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
          {/* Icon-only, so it needs a name a screen reader can read out —
              and it is the one destructive control on the card. */}
          <button
            onClick={remove}
            disabled={busy}
            aria-label={`Delete ${sequence.name}`}
            className="text-xs font-medium rounded-lg px-2.5 py-1.5 disabled:opacity-60"
            style={{ color: "var(--coral)" }}
          >
            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Two changes here, both about the same confusion.

          One: the step line used to read "3d after enrollment" / "4d later" —
          gaps between steps — while the template hint above the editor said
          "(day 3, 7, 14, 30)", which is cumulative. Two mental models for the
          same plan, on the same screen. People think about a plan in
          cumulative days ("what happens on day 7"), so that is what shows;
          the stored delayDays stay gaps because that is what the scheduler
          runs on.

          Two: the channel-fallback rule was repeated inside every step, so
          four steps meant that same clause four times, three lines each. It
          is stated once, below the list. */}
      <ol className="mt-4 space-y-1.5">
        {sequence.steps.map((step, i) => {
          const dayOf = sequence.steps.slice(0, i + 1).reduce((sum, s) => sum + s.delayDays, 0);
          return (
            <li key={step.id} className="flex items-start gap-2.5 text-sm">
              <span
                className="mt-0.5 shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-xs font-semibold"
                style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}
              >
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="font-medium">
                  Day {dayOf} ·{" "}
                  {step.action === "EMAIL"
                    ? "Email"
                    : `Move to ${STAGE_OPTIONS.find((s) => s.value === step.stageTo)?.label ?? step.stageTo}`}
                </span>
                {step.action === "EMAIL" && step.messageHint && (
                  <span className="block text-ink-soft">{step.messageHint}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>

      {sequence.steps.some((s) => s.action === "EMAIL") && (
        <p className="mt-3 text-xs text-ink-soft">
          Email steps send a text instead if the lead has no email address, or hasn&apos;t replied to an earlier
          email step and has a phone number on file.
        </p>
      )}
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
              <>
                <input
                  value={step.messageHint}
                  onChange={(e) => updateStep(i, { messageHint: e.target.value })}
                  placeholder={'Optional — steer what this draft focuses on, e.g. "mention our case studies"'}
                  className="mt-2.5 w-full rounded-lg border border-line bg-paper px-3 py-1.5 text-xs"
                />
                <p className="mt-1.5 text-[11px] text-ink-soft">
                  Falls back to a text message if this lead has no email on file, or hasn&apos;t replied by this step
                  and has a phone number to try instead.
                </p>
              </>
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
