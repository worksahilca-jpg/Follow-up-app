"use client";

import { useEffect, useState } from "react";

/**
 * "How you work" (A-099, src/lib/habits.ts), under "What FollowUp knows" in
 * Settings → Your business. Every habit the owner said yes to on Today, each
 * with when and why, and one Undo. Hidden while there are none: nothing is
 * ever added here without asking first.
 */

type Habit = { kind: "skip_thanks" | "weekend_wait"; evidence: number; decidedAt: string };

const LINES: Record<Habit["kind"], { rule: string; why: (n: number) => string }> = {
  skip_thanks: {
    rule: "Messages that only say thanks or ok get no reply",
    why: (n) => `after skipping ${n} of them`,
  },
  weekend_wait: {
    rule: "Replies to weekend messages wait until Monday 9 am",
    why: (n) => `after moving ${n} to Monday with Later`,
  },
};

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function HowYouWorkSection() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped after every change, which reads the list again.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    fetch("/api/business/habits")
      .then((r) => r.json())
      .then((data: { success?: boolean; habits?: Habit[]; isAdmin?: boolean }) => {
        if (!data.success) return;
        setHabits(data.habits ?? []);
        setIsAdmin(Boolean(data.isAdmin));
      })
      .catch(() => {});
  }, [version]);

  async function undo(kind: Habit["kind"]) {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch("/api/business/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, decision: "off" }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string };
      if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't undo. Try again.");
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't undo. Try again.");
    } finally {
      setBusy(null);
    }
  }

  if (habits.length === 0) return null;

  return (
    <div className="box p-5">
      <p className="text-sm font-medium">How you work</p>
      <p className="mt-1 text-[13px] text-ink-soft">
        Things FollowUp noticed you always do, and now does for you. Each one was your choice.
      </p>
      <ul className="mt-4 border-t border-line">
        {habits.map((h) => (
          <li key={h.kind} className="border-b border-line">
            <div className="flex items-start gap-3 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-snug">{LINES[h.kind].rule}</p>
                <p className="mt-1 text-[12.5px] text-ink-soft">
                  You chose this {shortDate(h.decidedAt)}, {LINES[h.kind].why(h.evidence)}
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => void undo(h.kind)}
                  disabled={busy !== null}
                  className="-mr-2 h-11 shrink-0 px-2 text-[13px] underline underline-offset-2 disabled:opacity-60"
                  aria-label={`Undo: ${LINES[h.kind].rule}`}
                >
                  {busy === h.kind ? "Undoing…" : "Undo"}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {error && (
        <p className="mt-3 text-[13px]" role="alert" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
      <p className="mt-3 text-[12.5px] leading-relaxed text-ink-soft">
        FollowUp only adds something here after asking you on Today. It never changes what it does on its own.
      </p>
    </div>
  );
}
