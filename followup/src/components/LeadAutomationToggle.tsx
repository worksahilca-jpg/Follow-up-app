"use client";

import { useState } from "react";

export default function LeadAutomationToggle({
  leadId,
  initialEnabled,
}: {
  leadId: string;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = !enabled;
    setSaving(true);
    setEnabled(next); // optimistic — this is a low-stakes toggle
    try {
      const res = await fetch(`/api/leads/${leadId}/automation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setEnabled(!next); // revert on failure
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: "var(--slate-soft)" }}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold" style={{ color: "var(--slate)" }}>
          Automation
        </h3>
        <button
          onClick={toggle}
          disabled={saving}
          className="relative w-10 h-5.5 rounded-full transition-colors shrink-0 disabled:opacity-60"
          style={{ backgroundColor: enabled ? "var(--rust)" : "var(--line)" }}
        >
          <span
            className="absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white transition-transform"
            style={{ transform: enabled ? "translateX(19px)" : "translateX(2px)" }}
          />
        </button>
      </div>
      <p className="text-xs mt-1 text-ink-soft">
        {enabled
          ? "On — FollowUp will auto-send an AI-drafted check-in if this lead goes quiet, using your business's automation delay from Settings."
          : "Off — every follow-up for this lead needs your approval first."}
      </p>
    </div>
  );
}
