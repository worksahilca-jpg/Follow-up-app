"use client";

import type { ReactNode } from "react";
import Switch from "@/components/Switch";
import RuleExample from "@/components/RuleExample";

export type RuleRecordCounts = { wrote: number; sent: number; waiting: number };

/**
 * One follow-up rule as a sentence (design brain A-044, the Zapier study):
 * "When …, FollowUp …", the one number that matters inside the sentence,
 * a line saying when it stops, one switch, and what it did this week.
 *
 * The owner never sees "trigger", "condition" or "action". The sentence is
 * the rule.
 */
export default function RuleCard({
  when,
  does,
  stops,
  checked,
  onToggle,
  disabled,
  label,
  record,
  error,
  children,
  exampleRule,
}: {
  when: ReactNode;
  does: ReactNode;
  stops: ReactNode;
  checked: boolean;
  onToggle: () => void;
  disabled: boolean;
  /** The switch's accessible name. */
  label: string;
  /** Null while loading or when the count failed: shows nothing rather than zeros. */
  record: RuleRecordCounts | null;
  error?: string | null;
  /** Anything this rule needs beyond its sentence (a second setting, a note). */
  children?: ReactNode;
  /** The rule's key, for "See an example" (A-044). Omitted: no button. */
  exampleRule?: string;
}) {
  const parts = record
    ? [
        record.wrote > 0 && `wrote ${record.wrote}`,
        record.sent > 0 && `sent ${record.sent}`,
        record.waiting > 0 && `${record.waiting} waiting`,
      ].filter(Boolean)
    : [];
  return (
    <div className="box p-5">
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="text-[15px] leading-relaxed" style={{ opacity: checked ? 1 : 0.6 }}>
            <span className="font-semibold">{when}</span> {does}
          </p>
          <p className="text-sm text-ink-soft mt-1 leading-relaxed">{stops}</p>
        </div>
        <Switch checked={checked} onChange={onToggle} disabled={disabled} label={label} />
      </div>
      {children}
      {exampleRule && checked && <RuleExample rule={exampleRule} />}
      {error && (
        <p className="mt-3 text-[13px]" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
      {parts.length > 0 && (
        <p className="mt-4 pt-3 border-t border-line text-[13px] text-ink-soft tabular-nums">This week: {parts.join(" · ")}</p>
      )}
    </div>
  );
}

/** A number inside a rule's sentence ("checks in on day [3]"). Saves when the owner leaves it. */
export function RuleNumber({
  value,
  min,
  max,
  onChange,
  onCommit,
  label,
  disabled,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  onCommit: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={value}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => onChange(Number(e.target.value))}
      onBlur={onCommit}
      className="mx-0.5 w-14 rounded-full border border-line bg-paper px-1.5 py-0.5 text-center font-semibold align-baseline disabled:opacity-60"
    />
  );
}
