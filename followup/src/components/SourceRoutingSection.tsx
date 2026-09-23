"use client";

/**
 * Per-source lead routing — one row per source the app actually creates
 * leads from (see src/lib/sourceRouting.ts), each with a single dropdown:
 * do nothing special, enroll new leads from that source straight into a
 * workflow, start them on a given automation tier, or leave them
 * unclaimed in a shared pool ("Ponds" — see
 * research/market/2026-09-05-competitor-feature-gaps.md #1.1) instead of
 * auto-assigning to whoever's least loaded. Saves per row on change —
 * there's no separate "Save" button, same as the automation toggle
 * elsewhere in Settings.
 */

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

interface Rule {
  source: string;
  sequenceId: string | null;
  automationTierDefault: "OFF" | "ASSISTED" | "AUTONOMOUS" | null;
  routeToPool: boolean;
}
interface SequenceOption {
  id: string;
  name: string;
  active: boolean;
}

function encodeValue(rule: Rule): string {
  if (rule.routeToPool) return "pool";
  if (rule.sequenceId) return `seq:${rule.sequenceId}`;
  if (rule.automationTierDefault) return `tier:${rule.automationTierDefault}`;
  return "";
}

export default function SourceRoutingSection() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [sequences, setSequences] = useState<SequenceOption[]>([]);
  /**
   * Whether this account has permitted sending without review.
   *
   * This component had no idea, and that was the whole bug. The dropdown
   * offered "Autonomous", the API accepted it, and then
   * `applySourceRouting` started every lead the rule touched on Assisted
   * instead — while this row went on reading "Autonomous" indefinitely.
   * The owner picked a mode, was told nothing, and got a different one.
   *
   * Defaults to `true` so that a failed or slow load does not flash a
   * "not permitted" warning at an account that has in fact permitted it.
   * Claiming a restriction that is not there would send someone to
   * Settings to fix something already correct; the real refusal lives on
   * the server either way, so an optimistic default here costs nothing.
   */
  const [autonomousAllowed, setAutonomousAllowed] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [savingSource, setSavingSource] = useState<string | null>(null);
  const [savedSource, setSavedSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/source-rules")
      .then((r) => r.json())
      .then((data: { success: boolean; rules?: Rule[]; sequences?: SequenceOption[]; autonomousAllowed?: boolean }) => {
        if (data.success) {
          setRules(data.rules ?? []);
          setSequences(data.sequences ?? []);
          // `?? true` and not `?? false`: an older deploy that does not
          // send the field is not an account that has refused.
          setAutonomousAllowed(data.autonomousAllowed ?? true);
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  async function handleChange(source: string, value: string) {
    const routeToPool = value === "pool";
    const sequenceId = value.startsWith("seq:") ? value.slice(4) : null;
    const automationTierDefault = value.startsWith("tier:") ? value.slice(5) : null;

    setRules((prev) =>
      prev.map((r) =>
        r.source === source
          ? { ...r, routeToPool, sequenceId, automationTierDefault: automationTierDefault as Rule["automationTierDefault"] }
          : r
      )
    );
    setSavingSource(source);
    setError(null);
    try {
      const res = await fetch("/api/source-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, sequenceId, automationTierDefault, routeToPool }),
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
    <div className="box p-5">
      <p className="text-xs text-ink-soft mb-4">
        What happens automatically the moment a new lead comes in from each source — before anyone looks at it.
      </p>
      {error && (
        <p className="text-xs mb-3" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
      <div className="space-y-2">
        {rules.map((rule) => {
          // Saved while the permission was on, and the permission later
          // revoked. The rule still says Autonomous; every lead it makes
          // starts on Assisted. Until now the two never met on screen.
          const stranded = rule.automationTierDefault === "AUTONOMOUS" && !autonomousAllowed;
          return (
            <div key={rule.source} className="rounded-lg border border-line px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                {/* The source name holds its width; the dropdown gives way.
                    Reversed until now, and it put the control off the edge
                    of the card on a phone: the row pinned the select with
                    `shrink-0` while the select sizes itself to its longest
                    option ("Leave unclaimed — first to grab it gets it"),
                    so at 390px it simply overflowed. Found by rendering
                    this row at phone width; it predates the permission
                    work above and is fixed here because this is the row
                    being changed. */}
                <span className="text-sm font-medium shrink-0">{rule.source}</span>
                <div className="flex items-center gap-2 min-w-0">
                  {savedSource === rule.source && <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--sage)" }} />}
                  <select
                    value={encodeValue(rule)}
                    onChange={(e) => handleChange(rule.source, e.target.value)}
                    disabled={savingSource === rule.source}
                    className="min-w-0 max-w-full truncate rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm disabled:opacity-60"
                  >
                    <option value="">No special handling</option>
                    <option value="pool">Leave unclaimed — first to grab it gets it</option>
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
                      {/* Disabled rather than removed. An option that
                          vanishes teaches nothing — the owner wonders
                          where it went, or never knows it existed. One
                          that is visible and unavailable, with the
                          reason on the row below, says what to do about
                          it. Kept selectable when this rule is already
                          on it, so the dropdown can still show its own
                          current value rather than rendering blank. */}
                      <option value="tier:AUTONOMOUS" disabled={!autonomousAllowed && !stranded}>
                        Autonomous
                      </option>
                    </optgroup>
                  </select>
                </div>
              </div>
              {stranded && (
                <p className="mt-1.5 text-xs text-ink-soft leading-relaxed">
                  {/* What is true, in the order it is useful: what the
                      rule is doing right now, then why, then where to
                      change it. Not "invalid rule" — the rule is fine,
                      the permission is off, and those are different
                      problems with different fixes. */}
                  Sending without review is switched off for this account, so new {rule.source} leads start on{" "}
                  <span className="text-ink">Assisted</span> — they wait for your OK. Turn it on under Automation above,
                  or set this to Assisted to match.
                </p>
              )}
            </div>
          );
        })}
      </div>
      {activeSequences.length === 0 && (
        <p className="text-xs text-ink-soft mt-3">
          Build a workflow on the Workflows page to also offer &quot;enroll automatically&quot; here.
        </p>
      )}

      <ApplyToExistingLeads />
    </div>
  );
}

/**
 * The catch-up for leads a business already has.
 *
 * The rules above only decide what a NEW lead starts on — `applySourceRouting`
 * runs once, at creation, "never on a resync/update of an existing one". So a
 * business that sets "Gmail → Assisted" today changes nothing about the six
 * hundred Gmail leads already in FollowUp, and nothing on this screen said so.
 *
 * Founder, 2026-09-23: "if they have 60 or 600 leads, they can't do auto for
 * all the leads, right? We have to make something that, with just one click,
 * will be auto for all of them."
 *
 * Sits here rather than on the Leads page because this is the sentence that
 * makes the rules above honest — the limitation and its answer belong in the
 * same place. Collapsed by default: it is a one-off, not part of the daily
 * shape of this screen.
 */
function ApplyToExistingLeads() {
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState<"OFF" | "ASSISTED" | "AUTONOMOUS">("ASSISTED");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ updated: number; skippedInWorkflow: number } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  async function apply() {
    setSaving(true);
    setFailed(null);
    setResult(null);
    try {
      const res = await fetch("/api/leads/bulk-automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setFailed(data.message ?? "Couldn't change them — try again.");
        return;
      }
      setResult({ updated: data.updated ?? 0, skippedInWorkflow: data.skippedInWorkflow ?? 0 });
    } catch {
      setFailed("Couldn't reach the server — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--line)" }}>
      {/* States the limitation first. An owner who reads only this line
          has still learned the thing the rules above do not say. */}
      <p className="text-xs text-ink-soft">
        These rules apply to new leads only — leads already in FollowUp keep whatever they are on now.
      </p>

      {!open && (
        <button onClick={() => setOpen(true)} className="mt-2 text-xs font-medium underline underline-offset-2 text-ink-soft">
          Change the leads I already have
        </button>
      )}

      {open && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as typeof tier)}
            disabled={saving}
            className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm disabled:opacity-60"
          >
            <option value="OFF">Off</option>
            <option value="ASSISTED">Assisted</option>
            <option value="AUTONOMOUS">Autonomous</option>
          </select>
          <button
            onClick={apply}
            disabled={saving}
            className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60"
            style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
          >
            {saving ? "Changing…" : "Apply to every lead"}
          </button>
        </div>
      )}

      {result && (
        /* Says what happened to ALL of them, including the ones it left
           alone. A bulk action that quietly does less than asked is how
           this kind of control loses trust. */
        <p className="mt-3 text-xs" style={{ color: "var(--ink)" }}>
          {result.updated === 0
            ? "Nothing to change — they were all on that already."
            : `Changed ${result.updated} ${result.updated === 1 ? "lead" : "leads"}.`}
          {result.skippedInWorkflow > 0 &&
            ` ${result.skippedInWorkflow} ${result.skippedInWorkflow === 1 ? "lead is" : "leads are"} in a workflow and stayed as ${
              result.skippedInWorkflow === 1 ? "it was" : "they were"
            }, so nobody gets messaged twice.`}
        </p>
      )}

      {failed && (
        <p className="mt-3 text-xs" style={{ color: "var(--coral)" }}>
          {failed}
        </p>
      )}
    </div>
  );
}
