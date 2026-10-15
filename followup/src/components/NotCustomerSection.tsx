"use client";

import { useEffect, useState } from "react";
import { REASON_GROUP, isSetAsideKind, type NotCustomerReason } from "@/lib/notCustomerReasons";

/**
 * Settings › Your business › Who isn't a customer (A-259): what FollowUp
 * learned from the owner's "Not a customer" answers, one row per answer,
 * each with Undo. Hidden until there is something to show.
 */

type Row = { reason: NotCustomerReason; count: number; latest: string | null; always: boolean };

function shortDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
}

function valueLine(r: Row): string {
  if (isSetAsideKind(r.reason)) return r.always ? "Set aside from now on" : `${r.count} set aside`;
  return `${r.count} ${r.count === 1 ? "person" : "people"}`;
}

function fromLine(r: Row): string {
  if (r.always) return r.latest ? `You said yes to this. Latest one ${shortDate(r.latest)}` : "You said yes to this";
  return `From your ${r.count === 1 ? "tap" : "taps"}, latest ${shortDate(r.latest)}`;
}

export default function NotCustomerSection() {
  const [rows, setRows] = useState<Row[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState<NotCustomerReason | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped after every change, which reads the list again.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    fetch("/api/not-customers")
      .then((r) => r.json())
      .then((data: { success?: boolean; rows?: Row[]; isAdmin?: boolean }) => {
        if (!data.success) return;
        setRows(data.rows ?? []);
        setIsAdmin(Boolean(data.isAdmin));
      })
      .catch(() => {});
  }, [version]);

  async function undo(reason: NotCustomerReason) {
    setBusy(reason);
    setError(null);
    try {
      const res = await fetch("/api/not-customers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
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

  if (rows.length === 0) return null;

  return (
    <div className="box p-5">
      <p className="text-sm font-medium">Who isn&apos;t a customer</p>
      <p className="mt-1 text-[13px] text-ink-soft">
        Learned from your &ldquo;Not a customer&rdquo; answers. FollowUp sets these aside without asking you.
      </p>
      <ul className="mt-4 border-t border-line">
        {rows.map((r) => (
          <li key={r.reason} className="border-b border-line">
            <div className="flex items-start gap-3 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-ink-soft">{REASON_GROUP[r.reason]}</p>
                <p className="mt-0.5 text-[15px] leading-snug">{valueLine(r)}</p>
                <p className="mt-0.5 text-[12.5px] text-ink-soft">{fromLine(r)}</p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => void undo(r.reason)}
                  disabled={busy !== null}
                  className="-mr-2 h-11 shrink-0 px-2 text-[13px] underline underline-offset-2 disabled:opacity-60"
                  aria-label={`Undo: ${REASON_GROUP[r.reason]}`}
                >
                  {busy === r.reason ? "Undoing…" : "Undo"}
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
        Undo makes FollowUp look at them again the next time they write. What&apos;s already set aside stays in
        Filtered out, one tap from coming back.
      </p>
    </div>
  );
}
