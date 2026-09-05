"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Lead } from "@/lib/types";
import { PIPELINE_STAGES } from "@/lib/demo-data";
import type { SavedFilterCriteria, SavedFilterSummary } from "@/lib/savedFilters";

const inputClass = "w-full rounded-lg border border-line bg-card px-3 py-2 text-sm";

const PRIORITIES: { id: Lead["priority"]; label: string }[] = [
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
  { id: "none", label: "None" },
];

/**
 * Custom filter builder ("Smart View" — see research/market/2026-09-05-
 * competitor-feature-gaps.md #2.1, modeled on Close). The eight hardcoded
 * quick-filter chips in LeadsPageClient.tsx each pick one dimension; this
 * combines several (source + stage + priority + deal value + days since
 * contact) and can optionally be saved as a named, one-click view —
 * private, or shared with the whole team.
 */
export default function SmartViewForm({
  leads,
  onClose,
  onApply,
  onSaved,
}: {
  leads: Lead[];
  onClose: () => void;
  onApply: (criteria: SavedFilterCriteria) => void;
  onSaved: (filter: SavedFilterSummary) => void;
}) {
  // Sources are freeform strings (Gmail, Twilio SMS, Instagram DM, CSV
  // import, manual entry, ...) with no fixed enum anywhere in the schema —
  // so the dropdown is built from whatever this business's own leads
  // actually have, not a hardcoded guess at every channel name.
  const sources = Array.from(new Set(leads.map((l) => l.source).filter(Boolean))).sort();

  const [source, setSource] = useState("");
  const [stage, setStage] = useState<Lead["stage"] | "">("");
  const [priority, setPriority] = useState<Lead["priority"] | "">("");
  const [minDealValue, setMinDealValue] = useState("");
  const [minDaysSinceContact, setMinDaysSinceContact] = useState("");

  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function buildCriteria(): SavedFilterCriteria {
    const criteria: SavedFilterCriteria = {};
    if (source) criteria.source = source;
    if (stage) criteria.stage = stage;
    if (priority) criteria.priority = priority;
    if (minDealValue.trim()) criteria.minDealValue = Number(minDealValue);
    if (minDaysSinceContact.trim()) criteria.minDaysSinceContact = Number(minDaysSinceContact);
    return criteria;
  }

  const hasCriteria = Object.keys(buildCriteria()).length > 0;

  function handleApply() {
    onApply(buildCriteria());
    onClose();
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Give this view a name to save it.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/saved-filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, shared, criteria: buildCriteria() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't save — try again.");
      onSaved(data.filter);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save — try again.");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div className="w-full max-w-md rounded-xl border border-line bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl">Custom filter</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-xs text-ink-soft -mt-2 mb-4">
          Combine as many of these as you need — e.g. Instagram leads over $2,000 with no contact in 10 days.
        </p>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-ink-soft">Source</label>
              <select value={source} onChange={(e) => setSource(e.target.value)} className={inputClass}>
                <option value="">Any source</option>
                {sources.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-ink-soft">Stage</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as Lead["stage"] | "")}
                className={inputClass}
              >
                <option value="">Any stage</option>
                {PIPELINE_STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-ink-soft">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Lead["priority"] | "")}
                className={inputClass}
              >
                <option value="">Any priority</option>
                {PRIORITIES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-ink-soft">Min. deal value</label>
              <input
                type="number"
                min="0"
                value={minDealValue}
                onChange={(e) => setMinDealValue(e.target.value)}
                placeholder="$0"
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-ink-soft">No contact in at least (days)</label>
            <input
              type="number"
              min="0"
              value={minDaysSinceContact}
              onChange={(e) => setMinDaysSinceContact(e.target.value)}
              placeholder="0"
              className={inputClass}
            />
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-line space-y-3">
          <div>
            <label className="text-xs text-ink-soft">Save as a Smart View (optional)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hot Instagram leads"
              className={inputClass}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
            Share with the whole team
          </label>
        </div>

        {error && (
          <p className="text-sm mt-3" style={{ color: "var(--coral)" }}>
            {error}
          </p>
        )}

        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={handleApply}
            disabled={!hasCriteria}
            className="flex-1 rounded-lg px-4 py-2 text-sm font-medium border border-line disabled:opacity-50"
          >
            Apply without saving
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasCriteria || saving}
            className="flex-1 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
          >
            {saving ? "Saving…" : "Save & apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
