"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import type { AutomationTier } from "@/lib/types";

/**
 * How FollowUp treats this one customer, as one plain row (A-280; founder: "yes fix all", after R-127 turned down
 * two switches as too complex). "FollowUp and Raj · Ask me first": tap it and pick, with a tick on the current
 * choice. On a phone the choices open as a list under the row, like iPhone Settings; on a computer as a small
 * pop-up menu. Sending without asking appears only where the plan allows it (Free is "Ask me first" only; the API
 * refuses it too), and on an account that holds every reply its sentence says nothing goes out unread.
 *
 * It saves through the same route the old three-way control used (POST /api/leads/[id]/automation).
 */
export default function CustomerChoiceRow({
  leadId,
  name,
  initialTier,
  autonomousAllowed = true,
  holdAllForApproval = false,
}: {
  leadId: string;
  name: string;
  initialTier: AutomationTier;
  autonomousAllowed?: boolean;
  holdAllForApproval?: boolean;
}) {
  const first = name.trim().split(/\s+/)[0] || name;
  const [tier, setTier] = useState<AutomationTier>(initialTier);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);

  const choices: { value: AutomationTier; label: string; line: string }[] = [
    {
      value: "assisted",
      label: "Ask me first",
      line: holdAllForApproval
        ? `FollowUp writes to ${first} and waits for your OK on every reply.`
        : `FollowUp answers the easy things and asks you before a price, a date or anything tense.`,
    },
    { value: "off", label: `Don't write to ${first}`, line: `FollowUp stays quiet with ${first}. Every reply is yours.` },
  ];
  // The third choice only where the plan allows it, or when it is already chosen (so the row never lies).
  if (autonomousAllowed || tier === "autonomous") {
    choices.push({
      value: "autonomous",
      label: "Handle it all",
      line: holdAllForApproval
        ? `FollowUp writes every reply to ${first}, prices and dates included, and still waits for your OK.`
        : `FollowUp answers ${first} without asking, prices and dates included.`,
    });
  }
  const current = choices.find((c) => c.value === tier) ?? choices[0];

  // Close on Escape or a click outside, as a menu should.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (setOpen(false), setConfirming(false));
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  async function save(next: AutomationTier) {
    const previous = tier;
    setSaving(true);
    setError(null);
    setTier(next); // optimistic
    setConfirming(false);
    setOpen(false);
    try {
      const res = await fetch(`/api/leads/${leadId}/automation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't save. Try again.");
      router.refresh();
    } catch (err) {
      setTier(previous);
      setError(err instanceof Error ? err.message : "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function pick(next: AutomationTier) {
    if (next === tier) {
      setOpen(false);
      return;
    }
    // A reply going out unread is the one thing worth a second tap; on a holding account it cannot happen.
    if (next === "autonomous" && !holdAllForApproval) {
      setConfirming(true);
      return;
    }
    void save(next);
  }

  return (
    <div ref={box} className="relative mt-4">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setConfirming(false);
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={saving}
        className="ios-sep flex min-h-[52px] w-full items-center justify-between gap-3 rounded-[14px] px-3.5 text-left text-[15px]"
        style={{ border: "1px solid var(--line)", background: "var(--wash)" }}
      >
        <span className="min-w-0 truncate">FollowUp and {first}</span>
        <span className="flex shrink-0 items-center gap-1 text-ink-soft">
          {current.label}
          <ChevronDown className={"h-4 w-4 transition-transform" + (open ? " rotate-180" : "")} aria-hidden="true" />
        </span>
      </button>

      {open && (
        <div
          className="mt-1.5 overflow-hidden rounded-[14px] p-1 lg:absolute lg:right-0 lg:z-40 lg:mt-1 lg:w-[300px] lg:shadow-[0_0_0_1px_var(--line),0_12px_32px_rgba(0,0,0,0.14)]"
          style={{ background: "var(--card)", border: "1px solid var(--line)" }}
        >
          <ul role="listbox" aria-label={`FollowUp and ${first}`}>
            {choices.map((c) => (
              <li key={c.value} role="option" aria-selected={c.value === tier}>
                <button
                  type="button"
                  onClick={() => pick(c.value)}
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left text-[15px] hover:bg-[var(--nav-on)]"
                >
                  {c.label}
                  {c.value === tier && <Check className="h-4 w-4 shrink-0" strokeWidth={2.4} aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
          {confirming ? (
            <div className="px-3 pb-2 pt-1.5">
              <p className="text-[14px] leading-snug">Replies to {first} will go out without you checking them, prices and dates included. Sure?</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => void save("autonomous")} className="min-h-11 rounded-full px-4 text-[14px] font-medium" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
                  Yes, handle it all
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="min-h-11 rounded-full border border-line px-4 text-[14px] font-medium">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="px-3 pb-2 pt-1 text-[13.5px] leading-snug text-ink-soft">{current.line}</p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-1.5 text-[13.5px]" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
