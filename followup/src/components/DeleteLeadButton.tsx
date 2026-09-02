"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export default function DeleteLeadButton({ leadId, leadName }: { leadId: string; leadName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't delete — try again.");
      router.push("/leads");
      router.refresh();
    } catch (err) {
      setDeleting(false);
      setConfirming(false);
      setError(err instanceof Error ? err.message : "Couldn't delete — try again.");
    }
  }

  if (confirming) {
    return (
      <div className="rounded-xl border p-4" style={{ borderColor: "var(--rust)", backgroundColor: "var(--rust-soft)" }}>
        <p className="text-sm" style={{ color: "var(--rust)" }}>
          Delete {leadName}? This removes the lead and its whole conversation history. Can&apos;t be undone.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            style={{ backgroundColor: "var(--rust)" }}
          >
            {deleting ? "Deleting…" : "Yes, delete"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={deleting}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink-soft hover:text-ink"
      >
        <Trash2 className="h-3.5 w-3.5" /> Delete lead
      </button>
      {error && (
        <p className="text-xs mt-2" style={{ color: "var(--rust)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
