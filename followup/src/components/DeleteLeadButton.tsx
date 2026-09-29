"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The foot of the person page: "Not a customer" and "Delete".
 *
 * "Not a customer" is the owner correcting FollowUp (founder, 2026-09-29:
 * learn from corrections). It removes the person and remembers the sender
 * for this business, so their next email is set aside without asking the
 * model, and it stays reversible from Settings → Filtered out
 * (POST /api/leads/[id]/not-customer). Shown only when there is an email
 * address to remember.
 *
 * "Delete" stays the plain, permanent removal, for a duplicate or a test.
 */
export default function DeleteLeadButton({ leadId, leadName, leadEmail }: { leadId: string; leadName: string; leadEmail?: string | null }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<null | "not-customer" | "delete">(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "not-customer" | "delete") {
    setWorking(true);
    setError(null);
    try {
      const res =
        kind === "delete"
          ? await fetch(`/api/leads/${leadId}`, { method: "DELETE" })
          : await fetch(`/api/leads/${leadId}/not-customer`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message ?? "That didn't work. Try again.");
      router.push("/leads");
      router.refresh();
    } catch (err) {
      setWorking(false);
      setConfirming(null);
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
    }
  }

  if (confirming === "not-customer") {
    return (
      <div className="rounded-[var(--radius-box)] border border-line bg-card p-4">
        <p className="text-sm">
          Not a customer? FollowUp removes {leadName} and sets aside future emails from {leadEmail}.
        </p>
        <p className="mt-1 text-[13px] text-ink-soft">You can bring them back any time from Settings, under Filtered out.</p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => run("not-customer")}
            disabled={working}
            className="rounded-full px-3 py-1.5 text-sm font-medium disabled:opacity-60"
            style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
          >
            {working ? "Removing…" : "Yes, not a customer"}
          </button>
          <button onClick={() => setConfirming(null)} disabled={working} className="rounded-full border border-line px-3 py-1.5 text-sm font-medium">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (confirming === "delete") {
    return (
      <div className="rounded-[var(--radius-box)] border p-4" style={{ borderColor: "var(--coral)", backgroundColor: "var(--coral-soft)" }}>
        <p className="text-sm" style={{ color: "var(--coral)" }}>
          Delete {leadName}? This removes the lead and its whole conversation history. Can&apos;t be undone.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => run("delete")}
            disabled={working}
            className="rounded-full px-3 py-1.5 text-sm font-medium text-on-coral disabled:opacity-60"
            style={{ backgroundColor: "var(--coral-fill)" }}
          >
            {working ? "Deleting…" : "Yes, delete"}
          </button>
          <button onClick={() => setConfirming(null)} disabled={working} className="rounded-full border border-line px-3 py-1.5 text-sm font-medium">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {leadEmail && (
          <button
            type="button"
            onClick={() => setConfirming("not-customer")}
            className="text-[14px] text-ink-soft underline underline-offset-2 hover:text-ink"
          >
            Not a customer
          </button>
        )}
        <button
          type="button"
          onClick={() => setConfirming("delete")}
          className="text-[14px] text-ink-faint underline underline-offset-2 hover:text-ink-soft"
        >
          Delete this customer
        </button>
      </div>
      {error && (
        <p className="text-[13px] mt-2" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
