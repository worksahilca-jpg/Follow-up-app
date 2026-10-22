"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GROUP } from "@/components/app/IosList";

/**
 * "Missed by your CRM" (A-315): on Results, the customers who wrote to the owner and never reached their CRM, with
 * one black Add all; and the "Not in {CRM}" list behind See who, one Add per person. The numbers and who is missing
 * come from the server (src/lib/missedByCrmData.ts); these only send the owner's taps to /api/crm/missed.
 */

const HEAD = "px-4 text-[12px] font-semibold uppercase tracking-[0.03em] text-ink-faint";
const BLACK = "inline-flex h-12 items-center rounded-full bg-ink px-7 text-[15px] font-medium text-paper disabled:opacity-60";
const QUIET = "inline-flex min-h-11 items-center text-[14px] text-ink-soft underline underline-offset-[3px] hover:text-ink";
const LIST_SHOWN = 8;

async function post(body: unknown): Promise<{ success: boolean; message?: string; added?: number; failed?: Array<{ id: string; message: string }> }> {
  try {
    const res = await fetch("/api/crm/missed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return await res.json();
  } catch {
    return { success: false, message: "Couldn't reach FollowUp. Check your connection and try again." };
  }
}

/** What a tap that added some but not all says: how many didn't go in, and the CRM's own reason for the first. */
function notAddedLine(failed: Array<{ message: string }> | undefined): string | null {
  if (!failed?.length) return null;
  return `${failed.length === 1 ? "1 customer wasn't" : `${failed.length} customers weren't`} added. ${failed[0].message}`;
}

export interface MissedCardProps {
  crmLabel: string;
  checked: string;
  kind: "missing" | "all_in";
  count: number;
  places: Array<{ label: string; count: number }>;
  autoAdd: boolean;
  paused: boolean;
  /** Only an admin can add to the CRM or change "by themselves" (the API says the same); others see the count. */
  canAdd: boolean;
}

export function MissedByCrmCard({ crmLabel, checked, kind, count, places, autoAdd, paused, canAdd }: MissedCardProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const customers = count === 1 ? "customer" : "customers";

  const addAll = async () => {
    setBusy(true);
    setError(null);
    const r = await post({ action: "add_all" });
    setBusy(false);
    if (!r.success) return setError(r.message ?? "Couldn't add them. Try again in a minute.");
    setError(notAddedLine(r.failed));
    router.refresh();
  };
  const setAuto = async (on: boolean) => {
    setBusy(true);
    setError(null);
    const r = await post({ action: "auto", on });
    setBusy(false);
    if (!r.success) return setError(r.message ?? "Couldn't change that. Try again in a minute.");
    router.refresh();
  };

  return (
    <section aria-labelledby="missed-crm">
      <h2 id="missed-crm" className={HEAD}>
        Missed by your CRM · last 30 days
      </h2>
      <div className={GROUP + " mt-1.5"}>
        <div className="px-[18px] pb-4 pt-3.5">
          <p className="flex items-baseline gap-2">
            <span className="text-[34px] font-semibold leading-tight tracking-[-0.02em] tabular-nums">{count}</span>
            <span className="text-[15px] font-medium text-ink-soft">{customers}</span>
          </p>
          <p className="mt-0.5 text-[15px] leading-snug">
            {kind === "missing" ? (count === 1 ? "isn't" : "aren't") : count === 1 ? "wasn't" : "weren't"} in {crmLabel}. They wrote to you by email or message, and FollowUp
            caught them.
          </p>
        </div>
        <ul>
          {places.map((p) => (
            <li key={p.label} className="flex items-center justify-between gap-4 border-t border-line-2 px-[18px] py-2.5">
              <span className="text-[15px]">{p.label}</span>
              <span className="text-[15px] font-semibold tabular-nums">{p.count}</span>
            </li>
          ))}
        </ul>
        <div className="border-t border-line-2 px-[18px] pb-4 pt-3.5">
          {kind === "all_in" ? (
            <>
              <p className="text-[15px] font-medium" style={{ color: "var(--sage)" }}>
                ✓ {count === 1 ? "They're" : `All ${count} are`} in {crmLabel} now, with their messages as a note.
              </p>
              <p className="mt-1 text-[14px] leading-snug text-ink-soft">
                {autoAdd ? "New customers FollowUp catches go in by themselves." : "New customers FollowUp catches wait here for you."}
              </p>
              {canAdd && (
                <button type="button" disabled={busy} onClick={() => setAuto(!autoAdd)} className={QUIET + " -mb-2 disabled:opacity-60"}>
                  {autoAdd ? "Turn off" : "Add them by themselves"}
                </button>
              )}
            </>
          ) : paused ? (
            <p className="text-[14px] leading-snug text-ink-soft">
              Writing to {crmLabel} is paused, so FollowUp can&apos;t add them.{" "}
              <Link href="/settings#connections" className="underline underline-offset-[3px] hover:text-ink">
                Turn it back on
              </Link>
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {canAdd ? (
                  <button type="button" disabled={busy} onClick={addAll} className={BLACK}>
                    {busy ? "Adding…" : count === 1 ? `Add them to ${crmLabel}` : `Add all ${count} to ${crmLabel}`}
                  </button>
                ) : (
                  <span className="text-[14px] text-ink-soft">Only an admin can add them to {crmLabel}.</span>
                )}
                <Link href="/analytics/missed" className={QUIET}>
                  See who
                </Link>
              </div>
              <p className="mt-2.5 text-[13px] leading-snug text-ink-faint">
                Checked against {crmLabel} by email and phone, {checked}. Friends, newsletters and pitches aren&apos;t counted.
              </p>
            </>
          )}
          {error && (
            <p role="alert" className="mt-2 text-[14px] leading-snug" style={{ color: "var(--coral)" }}>
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export interface MissedPerson {
  id: string;
  name: string;
  said: string | null;
  where: string;
}

export function MissedList({ crmLabel, people, paused, canAdd }: { crmLabel: string; people: MissedPerson[]; paused: boolean; canAdd: boolean }) {
  const router = useRouter();
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const left = people.filter((p) => !added.has(p.id));
  const shown = all ? people : people.slice(0, LIST_SHOWN);

  const addOne = async (id: string) => {
    setBusy(id);
    setRowError((e) => ({ ...e, [id]: "" }));
    const r = await post({ action: "add", ids: [id] });
    setBusy(null);
    if (r.success && r.added) setAdded((s) => new Set(s).add(id));
    else setRowError((e) => ({ ...e, [id]: r.failed?.[0]?.message ?? r.message ?? `${crmLabel} didn't take them. Try again in a minute.` }));
  };
  const addAll = async () => {
    setBusy("all");
    setError(null);
    const r = await post({ action: "add_all" });
    setBusy(null);
    if (!r.success) return setError(r.message ?? "Couldn't add them. Try again in a minute.");
    setError(notAddedLine(r.failed));
    router.refresh();
  };

  if (!people.length) {
    return (
      <p className="mt-5 text-[15px] leading-relaxed text-ink-soft">
        Everyone who wrote to you is in {crmLabel} now.{" "}
        <Link href="/analytics" className="underline underline-offset-[3px] hover:text-ink">
          Back to Results
        </Link>
      </p>
    );
  }

  return (
    <>
      <ul className={GROUP + " mt-5"}>
        {shown.map((p, i) => {
          const done = added.has(p.id);
          return (
            <li key={p.id} className={"px-[18px] py-3" + (i ? " border-t border-line-2" : "")}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-medium">{p.name}</p>
                  {p.said && <p className="mt-0.5 truncate text-[14px] text-ink-soft">&ldquo;{p.said}&rdquo;</p>}
                  <p className="mt-0.5 text-[13px] text-ink-faint">{p.where}</p>
                </div>
                {done ? (
                  <span className="shrink-0 text-[14px] font-medium" style={{ color: "var(--sage)" }}>
                    ✓ Added
                  </span>
                ) : (
                  !paused &&
                  canAdd && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => addOne(p.id)}
                      aria-label={`Add ${p.name} to ${crmLabel}`}
                      className="inline-flex min-h-11 shrink-0 items-center rounded-full border bg-card px-[18px] text-[15px] font-medium disabled:opacity-60"
                      style={{ borderColor: "var(--line-strong)" }}
                    >
                      {busy === p.id ? "Adding…" : "Add"}
                    </button>
                  )
                )}
              </div>
              {rowError[p.id] && (
                <p role="alert" className="mt-1.5 text-[13px]" style={{ color: "var(--coral)" }}>
                  {rowError[p.id]}
                </p>
              )}
            </li>
          );
        })}
        {!all && people.length > LIST_SHOWN && (
          <li className="border-t border-line-2">
            <button type="button" onClick={() => setAll(true)} className="flex min-h-11 w-full items-center px-[18px] text-[14px] text-ink-soft hover:text-ink">
              Show {people.length - LIST_SHOWN} more
            </button>
          </li>
        )}
      </ul>
      {!canAdd ? (
        <p className="mt-4 px-1 text-[14px] leading-snug text-ink-soft">Only an admin can add them to {crmLabel}.</p>
      ) : paused ? (
        <p className="mt-4 px-1 text-[14px] leading-snug text-ink-soft">
          Writing to {crmLabel} is paused, so FollowUp can&apos;t add them.{" "}
          <Link href="/settings#connections" className="underline underline-offset-[3px] hover:text-ink">
            Turn it back on
          </Link>
        </p>
      ) : (
        left.length > 1 && (
          <div className="mt-5">
            <button type="button" disabled={busy !== null} onClick={addAll} className={BLACK}>
              {busy === "all" ? "Adding…" : `Add all ${left.length} to ${crmLabel}`}
            </button>
          </div>
        )
      )}
      {error && (
        <p role="alert" className="mt-2 px-1 text-[14px] leading-snug" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
      <p className="mt-3 px-1 text-[13px] leading-normal text-ink-soft">
        FollowUp adds the name, email, phone and where they wrote, and puts their messages in a note. It never adds friends,
        newsletters or pitches.
      </p>
    </>
  );
}
