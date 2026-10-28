"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WARM_CARD } from "@/components/app/ReplyCard";

/**
 * "<name> picked a time" (A-242, drawn 2026-10-28): in place of the reply
 * card once a customer has chosen one of the two times FollowUp offered.
 * One grey box with what, where, day and time; one sentence; one black
 * button (Confirm <day> <time>), one outlined (Another time), one quiet
 * line (I'll call <name> instead). Nothing is booked until Confirm.
 *
 * With a booked time still standing (`from`, part 2) the pick is a move:
 * "<name> wants to move the viewing", the old time struck through above the
 * new one, and the quiet line is Keep <old>, which tells them the old time
 * stands.
 */
export default function PickedTimeCard({
  leadId,
  first,
  what,
  where,
  day,
  time,
  label,
  from = null,
  dense = false,
}: {
  leadId: string;
  first: string;
  what: string;
  where: string | null;
  day: string;
  time: string;
  label: string;
  from?: { said: string; label: string } | null;
  dense?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"confirm" | "another" | "call" | "keep" | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "confirm" | "another" | "call" | "keep") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/picked-time`, {
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
      <p className="text-[14px] leading-snug text-ink-soft">{from ? `${first} wants to move the ${what.toLowerCase()}` : `${first} picked a time`}</p>
      <div className="mt-3 rounded-[12px] px-4 py-3" style={{ background: "var(--card-2)" }}>
        <p className="text-[15px] font-semibold">
          {what}
          {where ? ` · ${where}` : ""}
        </p>
        {from && (
          <p className="mt-0.5 text-[14px] text-ink-faint">
            <s>{from.said}</s>
          </p>
        )}
        <p className="mt-0.5 text-[15px]">
          {day} · {time}
        </p>
        <p className="mt-0.5 text-[13px] text-ink-soft">✓ Your calendar was free then</p>
      </div>
      <p className="mt-3 text-[15px]">
        {from ? (
          <>
            If the new time works, press <b>Confirm</b>. If not, pick another time, or keep {from.label} and FollowUp asks {first}.
          </>
        ) : (
          <>
            If you can make it, press <b>Confirm</b>. If not, pick another time and FollowUp tells {first}.
          </>
        )}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => act("confirm")}
          disabled={busy !== null}
          className="h-11 rounded-full px-6 text-[15px] font-semibold disabled:opacity-60"
          style={{ background: "var(--accent)", color: "var(--on-accent)" }}
        >
          {busy === "confirm" ? (from ? "Moving…" : "Booking…") : `Confirm ${label}`}
        </button>
        <button
          type="button"
          onClick={() => act("another")}
          disabled={busy !== null}
          className="h-11 rounded-full border px-5 text-[15px] font-medium disabled:opacity-60"
          style={{ borderColor: "var(--line)" }}
        >
          {busy === "another" ? "Offering…" : "Another time"}
        </button>
        {from ? (
          <button type="button" onClick={() => act("keep")} disabled={busy !== null} className="h-11 px-2 text-[14px] text-ink-soft underline-offset-2 hover:underline disabled:opacity-60">
            {busy === "keep" ? "Telling…" : `Keep ${from.label}`}
          </button>
        ) : (
          <button type="button" onClick={() => act("call")} disabled={busy !== null} className="h-11 px-2 text-[14px] text-ink-soft underline-offset-2 hover:underline disabled:opacity-60">
            I&rsquo;ll call {first} instead
          </button>
        )}
      </div>
      {error && (
        <p className="mt-2 text-[13px]" role="alert" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
