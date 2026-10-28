"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * "Booked" (A-242, part 2): a time the customer and the owner have agreed,
 * still to come. A calm white box, not a card that needs the owner: what and
 * where, the day and time, and two quiet choices for when the owner's side
 * changes. Change takes the time off and offers two others; Cancel asks
 * once, then takes it off and tells them. Both go through
 * POST /api/leads/[id]/booking.
 */
export default function BookedCard({
  leadId,
  first,
  what,
  where,
  day,
  time,
  label,
  dense = false,
}: {
  leadId: string;
  first: string;
  what: string;
  where: string | null;
  day: string;
  time: string;
  label: string;
  dense?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"change" | "cancel" | null>(null);
  const [asking, setAsking] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "change" | "cancel") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/booking`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; removed?: boolean; message?: string };
      if (!res.ok || !data.success) {
        if (data.removed) {
          // The time is off the calendar even though the message didn't go: say so, and let the page catch up.
          setDone(data.message || "The time is off your calendar. Write to them from the reply box.");
          router.refresh();
          return;
        }
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

  const pad = dense ? "p-4" : "p-5";
  const quiet = "h-11 px-1 text-[14px] text-ink-soft underline-offset-2 hover:underline disabled:opacity-60";
  if (done) {
    return (
      <div className={`rounded-[16px] border border-line bg-card ${pad}`}>
        <p className="text-[15px]">{done}</p>
      </div>
    );
  }
  return (
    <div className={`rounded-[16px] border border-line bg-card ${pad}`}>
      <p className="text-[14px] leading-snug text-ink-soft">Booked</p>
      <div className="mt-3 rounded-[12px] px-4 py-3" style={{ background: "var(--card-2)" }}>
        <p className="text-[15px] font-semibold">
          {what}
          {where ? ` · ${where}` : ""}
        </p>
        <p className="mt-0.5 text-[15px]">
          {day} · {time}
        </p>
        <p className="mt-0.5 text-[13px] text-ink-soft">✓ FollowUp told {first}</p>
      </div>
      {asking ? (
        <>
          <p className="mt-3 text-[15px]">
            Cancel {label}? FollowUp tells {first}.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => act("cancel")}
              disabled={busy !== null}
              className="h-11 rounded-full border px-5 text-[15px] font-medium disabled:opacity-60"
              style={{ borderColor: "var(--line)" }}
            >
              {busy === "cancel" ? "Cancelling…" : "Yes, cancel"}
            </button>
            <button type="button" onClick={() => setAsking(false)} disabled={busy !== null} className={quiet}>
              Keep it
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 text-[15px]">If it changes on your side, FollowUp tells {first}.</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4">
            <button type="button" onClick={() => act("change")} disabled={busy !== null} className={quiet}>
              {busy === "change" ? "Offering other times…" : "Change the time"}
            </button>
            <button type="button" onClick={() => setAsking(true)} disabled={busy !== null} className={quiet}>
              Cancel
            </button>
          </div>
        </>
      )}
      {error && (
        <p className="mt-2 text-[13px]" role="alert" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
