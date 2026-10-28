"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WARM_CARD } from "@/components/app/ReplyCard";

/**
 * "<name> cancelled <time>" (A-242, part 2): the customer cancelled the time
 * they had booked. FollowUp has already freed the slot and told them it's no
 * problem; the owner decides the one thing left: offer two other free times
 * (the black button) or let it be (quiet). Both go through
 * POST /api/leads/[id]/booking.
 */
export default function CancelledCard({ leadId, first, said, dense = false }: { leadId: string; first: string; said: string; dense?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"offer" | "seen" | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "offer" | "seen") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/booking`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string };
      if (!res.ok || !data.success) {
        setError(data.message || "That didn't work. Try again.");
        return;
      }
      setDone(data.message || "Done.");
      router.refresh();
    } catch {
      setError("That didn't work. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  const pad = dense ? "p-4 lg:p-4" : "p-5";
  if (done) {
    return (
      <div className={`rounded-[16px] ${pad}`} style={WARM_CARD}>
        <p className="text-[15px]">{done}</p>
      </div>
    );
  }
  return (
    <div className={`rounded-[16px] ${pad}`} style={WARM_CARD}>
      <p className="text-[14px] leading-snug text-ink-soft">
        {first} cancelled {said}
      </p>
      <p className="mt-2 text-[15px]">The time is free again. FollowUp told {first} it&rsquo;s no problem.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => act("offer")}
          disabled={busy !== null}
          className="h-11 rounded-full px-6 text-[15px] font-semibold disabled:opacity-60"
          style={{ background: "var(--accent)", color: "var(--on-accent)" }}
        >
          {busy === "offer" ? "Offering…" : "Offer another time"}
        </button>
        <button type="button" onClick={() => act("seen")} disabled={busy !== null} className="h-11 px-2 text-[14px] text-ink-soft underline-offset-2 hover:underline disabled:opacity-60">
          {busy === "seen" ? "…" : "OK, leave it"}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-[13px]" role="alert" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
