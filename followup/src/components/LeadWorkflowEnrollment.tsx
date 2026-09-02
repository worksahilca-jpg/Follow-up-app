"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Workflow } from "lucide-react";

interface SequenceOption {
  id: string;
  name: string;
  active: boolean;
}

interface Enrollment {
  enrolled: boolean;
  sequenceId?: string;
  sequenceName?: string;
  stepIndex?: number;
  totalSteps?: number;
  dueAt?: string;
}

/** Shows this lead's current workflow enrollment, or a picker to enroll it in one — the counterpart to LeadAutomationToggle for multi-step sequences. */
export default function LeadWorkflowEnrollment({ leadId }: { leadId: string }) {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [sequences, setSequences] = useState<SequenceOption[]>([]);
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  function load() {
    Promise.all([
      fetch(`/api/leads/${leadId}/sequence`).then((r) => r.json()),
      fetch("/api/sequences").then((r) => r.json()),
    ])
      .then(([enr, seqs]) => {
        if (enr.success) setEnrollment(enr);
        if (seqs.success) setSequences(seqs.sequences.filter((s: SequenceOption) => s.active));
      })
      .finally(() => setLoaded(true));
  }

  useEffect(load, [leadId]);

  async function enroll() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/sequence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sequenceId: selected }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message ?? "Couldn't enroll — try again.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't enroll — try again.");
    } finally {
      setSaving(false);
    }
  }

  async function unenroll() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/sequence`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error("Couldn't remove — try again.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove — try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: "var(--slate-soft)" }}>
      <h3 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--slate)" }}>
        <Workflow className="h-3.5 w-3.5" /> Workflow
      </h3>

      {enrollment?.enrolled ? (
        <div className="mt-2">
          <p className="text-sm">{enrollment.sequenceName}</p>
          <p className="text-xs text-ink-soft mt-0.5">
            Step {(enrollment.stepIndex ?? 0) + 1} of {enrollment.totalSteps}
            {enrollment.dueAt && ` — next on ${new Date(enrollment.dueAt).toLocaleDateString()}`}
          </p>
          <button
            onClick={unenroll}
            disabled={saving}
            className="mt-2 text-xs font-medium disabled:opacity-60"
            style={{ color: "var(--rust)" }}
          >
            Remove from workflow
          </button>
        </div>
      ) : sequences.length === 0 ? (
        <p className="text-xs text-ink-soft mt-2">
          No active workflows yet —{" "}
          <Link href="/workflows" className="underline">
            build one
          </Link>
          .
        </p>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="flex-1 rounded-lg border border-line bg-paper px-2 py-1.5 text-xs"
          >
            <option value="">Enroll in…</option>
            {sequences.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            onClick={enroll}
            disabled={saving || !selected}
            className="text-xs font-medium rounded-lg px-2.5 py-1.5 text-white disabled:opacity-60"
            style={{ backgroundColor: "var(--rust)" }}
          >
            Enroll
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs mt-2" style={{ color: "var(--rust)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
