"use client";

import { useEffect, useState } from "react";
import Switch from "@/components/Switch";

/**
 * "What FollowUp writes" on the Follow-up plans page (A-253): the four things
 * FollowUp writes on its own, one line each. They lived on Settings' "Replies
 * and check-ins" page with a number to type beside each; the numbers are gone
 * from the screen (R-115), and turning a switch keeps whatever was saved, so
 * an owner who never changed them stays on the defaults.
 */
export type Rules = {
  instantAck: boolean;
  unanswered: { enabled: boolean; hours: number };
  checkIn: { enabled: boolean; days: number };
  welcomeBack: { enabled: boolean; days: number };
};
export type Key = keyof Rules;

const ROWS: { key: Key; label: string }[] = [
  { key: "instantAck", label: "Thank new customers right away" },
  { key: "unanswered", label: "Reply when you haven't" },
  { key: "checkIn", label: "Check in when they go quiet" },
  { key: "welcomeBack", label: "Welcome back after a long silence" },
];

const on = (rules: Rules, key: Key): boolean => (key === "instantAck" ? rules.instantAck : rules[key].enabled);

/** What POST /api/automation/settings takes to turn one rule on or off, keeping its saved number. */
export function saveBody(rules: Rules, key: Key, next: boolean): Record<string, unknown> {
  switch (key) {
    case "instantAck":
      return { instantAck: next };
    case "unanswered":
      return { unansweredReply: { enabled: next, hours: rules.unanswered.hours } };
    case "checkIn":
      return { enabled: next, triggerDays: rules.checkIn.days };
    case "welcomeBack":
      return { deadLeadReactivation: { enabled: next, days: rules.welcomeBack.days } };
  }
}

export default function FollowUpSwitches() {
  const [rules, setRules] = useState<Rules | null>(null);
  const [saving, setSaving] = useState<Key | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/automation/settings")
      .then((r) => r.json())
      .then(
        (d: {
          enabled?: boolean;
          triggerDays?: number;
          instantAck?: boolean;
          unansweredReply?: { enabled: boolean; hours: number };
          deadLeadReactivation?: { enabled: boolean; days: number };
        }) => {
          if (typeof d?.enabled !== "boolean" || typeof d.triggerDays !== "number") return;
          setRules({
            instantAck: d.instantAck ?? true,
            unanswered: d.unansweredReply ?? { enabled: true, hours: 24 },
            checkIn: { enabled: d.enabled, days: d.triggerDays },
            welcomeBack: d.deadLeadReactivation ?? { enabled: true, days: 45 },
          });
        }
      )
      .catch(() => {});
  }, []);

  async function flip(key: Key) {
    if (!rules) return;
    const next = !on(rules, key);
    const before = rules;
    // The switch moves at once and comes back if the save didn't happen, so it never looks saved when it isn't.
    setRules(key === "instantAck" ? { ...rules, instantAck: next } : { ...rules, [key]: { ...rules[key], enabled: next } });
    setSaving(key);
    setError(null);
    try {
      const res = await fetch("/api/automation/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saveBody(before, key, next)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setRules(before);
        setError(data.message ?? "Couldn't save. Try again.");
      }
    } catch {
      setRules(before);
      setError("Couldn't reach FollowUp. Try again.");
    } finally {
      setSaving(null);
    }
  }

  if (!rules) return null;
  return (
    <div className="rounded-[16px] border border-line bg-card px-4 py-3 lg:max-w-[760px] lg:px-5">
      <p className="pt-0.5 text-[15px] font-semibold">What FollowUp writes</p>
      {ROWS.map((r, i) => (
        <div key={r.key} className={"flex min-h-[52px] items-center gap-3" + (i ? " border-t border-line-2" : " mt-1")}>
          <span className="flex-1 text-[15px]">{r.label}</span>
          <Switch checked={on(rules, r.key)} onChange={() => flip(r.key)} disabled={saving !== null} label={r.label} />
        </div>
      ))}
      {error && (
        <p role="alert" className="pb-1 text-[14px]" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
