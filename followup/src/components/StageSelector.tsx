"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PipelineStage } from "@/lib/types";
import { PIPELINE_STAGES } from "@/lib/demo-data";

// DB enum is uppercase (NEW, CONTACTED, ...), UI type is lowercase — same
// mapping leads-data.ts uses in the other direction.
const toDbStage = (s: PipelineStage) => s.toUpperCase();

export default function StageSelector({ leadId, stage }: { leadId: string; stage: PipelineStage }) {
  const router = useRouter();
  const [current, setCurrent] = useState(stage);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(next: PipelineStage) {
    const previous = current;
    setCurrent(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: toDbStage(next) }),
      });
      if (!res.ok) throw new Error();
      router.refresh(); // pipeline/dashboard totals depend on this lead's stage
    } catch {
      setCurrent(previous);
      setError("Couldn't save — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <select
        value={current}
        onChange={(e) => handleChange(e.target.value as PipelineStage)}
        disabled={saving}
        className="text-sm rounded-full border border-line px-2.5 py-1 bg-card disabled:opacity-60"
      >
        {PIPELINE_STAGES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      {error && (
        <span className="text-xs" style={{ color: "var(--coral)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
