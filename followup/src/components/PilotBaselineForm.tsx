"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OwnerBaseline } from "@/lib/pilotNumbers";

const FIELDS = [
  { key: "inquiriesPerMonth", label: "Inquiries a month", max: 100_000 },
  { key: "appointmentsPerMonth", label: "Appointments a month", max: 100_000 },
  { key: "hoursPerWeek", label: "Hours a week replying", max: 168 },
] as const;

type Key = (typeof FIELDS)[number]["key"];

/** The owner's own numbers from the setup call (the pilot's "before FollowUp"), typed in by the founder. */
export default function PilotBaselineForm({ businessId, baseline }: { businessId: string; baseline: OwnerBaseline | null }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<Key, string>>(() => ({
    inquiriesPerMonth: baseline?.inquiriesPerMonth?.toString() ?? "",
    appointmentsPerMonth: baseline?.appointmentsPerMonth?.toString() ?? "",
    hoursPerWeek: baseline?.hoursPerWeek?.toString() ?? "",
  }));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const number = (v: string) => (v.trim() === "" ? null : Number(v));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/admin/pilot-baseline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          inquiriesPerMonth: number(values.inquiriesPerMonth),
          appointmentsPerMonth: number(values.appointmentsPerMonth),
          hoursPerWeek: number(values.hoursPerWeek),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string };
      if (!res.ok || !data.success) throw new Error(data.message || "Couldn't save that. Check each number and try again.");
      setNote({ ok: true, text: "Saved." });
      router.refresh();
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : "Couldn't save that." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      {FIELDS.map((f) => (
        <label key={f.key} className="min-w-0 flex-1">
          <span className="mb-1 block text-xs font-medium text-ink-soft">{f.label}</span>
          <input
            id={`pilot-${businessId}-${f.key}`}
            type="number"
            inputMode="decimal"
            min={0}
            max={f.max}
            step="any"
            value={values[f.key]}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm tabular-nums"
          />
        </label>
      ))}
      <button
        type="submit"
        disabled={busy}
        className="min-h-[40px] rounded-full border border-line px-4 py-2 text-sm font-medium hover:bg-paper disabled:opacity-60 sm:shrink-0"
      >
        {busy ? "Saving…" : "Save"}
      </button>
      {note && (
        <p role="status" className="text-sm sm:self-center" style={note.ok ? undefined : { color: "var(--coral)" }}>
          {note.text}
        </p>
      )}
    </form>
  );
}
