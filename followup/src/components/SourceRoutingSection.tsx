"use client";

/**
 * Per-source lead routing — one row per source the app actually creates
 * leads from (see src/lib/sourceRouting.ts), each with a single dropdown:
 * do nothing special, enroll new leads from that source straight into a
 * workflow, or just start them on a given automation tier. Saves per row
 * on change — there's no separate "Save" button, same as the automation
 * toggle elsewhere in Settings.
 */

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

interface Rule {
  source: string;
  sequenceId: string | null;
  automationTierDefault: "OFF" | "ASSISTED" | "AUTONOMOUS" | null;
}
interface SequenceOption {
  id: string;
  name: string;
  active: boolean;
}

function encodeValue(rule: Rule): string {
  if (rule.sequenceId) return `seq:${rule.sequenceId}`;
  if (rule.automationTierDefault) return `tier:${rule.automationTierDefault}`;
  return "";
}

export default function SourceRoutingSection() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [sequences, setSequences] = useState<SequenceOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [savingSource, setSavingSource] = useState<string | null>(null);
  const [savedSource, setSavedSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/source-rules")
      .then((r) => r.json())
      .then((data: { success: boolean; rules?: Rule[]; sequences?: SequenceOption[] }) => {
        if (data.success) {
          setRules(data.rules ?? []);
          setSequences(data.sequences ?? []);
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  async function handleChange(source: string, value: string) {
    const sequenceId = value.startsWith("seq:") ? value.slice(4) : null;
    const automationTierDefault = value.startsWith("tier:") ? value.slice(5) : null;

    setRules((prev) => prev.map((r) => (r.source === source ? { ...r, sequenceId, automationTierDefault: automationTierDefault as Rule["automationTierDefault"] } : r)));
    setSavingSource(source);
    setError(null);
    try {
      const res = await fetch("/api/source-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, sequenceId, automationTierDefault }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't save — try again.");
      setSavedSource(source);
      setTimeout(() => setSavedSource((s) => (s === source ? null : s)), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save — try again.");
    } finally {
      setSavingSource(null);
    }
  }

  if (!loaded) return null;

  const activeSequences = sequences.filter((s) => s.active);

  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <p className="text-xs text-ink-soft mb-4">
        What happens automatically the moment a new lead comes in from each source — before anyone looks at it.
      </p>
      {error && (
        <p className="text-xs mb-3" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
      <div className="space-y-2">
        {rules.map((rule) => (
          <div key={rule.source} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5">
            <span className="text-sm font-medium">{rule.source}</span>
            <div className="flex items-center gap-2 shrink-0">
              {savedSource === rule.source && <Check className="h-3.5 w-3.5" style={{ color: "var(--sage)" }} />}
              <select
                value={encodeValue(rule)}
                onChange={(e) => handleChange(rule.source, e.target.value)}
                disabled={savingSource === rule.source}
                className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm disabled:opacity-60"
              >
                <option value="">No special handling</option>
                {activeSequences.length > 0 && (
                  <optgroup label="Enroll in a workflow">
                    {activeSequences.map((seq) => (
                      <option key={seq.id} value={`seq:${seq.id}`}>
                        {seq.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Or just start on">
                  <option value="tier:ASSISTED">Assisted</option>
                  <option value="tier:AUTONOMOUS">Autonomous</option>
                </optgroup>
              </select>
            </div>
          </div>
        ))}
      </div>
      {activeSequences.length === 0 && (
        <p className="text-xs text-ink-soft mt-3">
          Build a workflow on the Workflows page to also offer &quot;enroll automatically&quot; here.
        </p>
      )}
    </div>
  );
}
