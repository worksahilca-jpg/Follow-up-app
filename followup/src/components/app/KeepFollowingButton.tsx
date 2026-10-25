"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * "Keep following up anyway" (A-246): the one way back for a customer who
 * said they already have an agent. A quiet link, as drawn: FollowUp's
 * default is to stop, and overruling it is the owner's call. The same link
 * lifts any no (A-326), worded for it ("Not a no? Keep following up").
 */
export default function KeepFollowingButton({
  leadId,
  label = "Keep following up anyway",
  className = "mt-2",
}: {
  leadId: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function keep() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/keep-following`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(typeof data.message === "string" ? data.message : "Couldn't save that. Try again.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={keep}
        disabled={busy}
        className="-ml-1 min-h-11 px-1 text-[13.5px] text-ink-soft underline underline-offset-[3px] hover:text-ink disabled:opacity-60"
      >
        {busy ? "Saving…" : label}
      </button>
      {error && <p className="text-[13px] text-coral">{error}</p>}
    </div>
  );
}
