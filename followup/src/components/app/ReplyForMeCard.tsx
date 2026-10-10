"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import type { ReplyForMeProof } from "@/lib/replyForMeOffer";
import { Initials } from "@/components/app/canvasBits";

/**
 * "Let FollowUp reply for you?" (A-217, A-218, drawn in A-220): asked once,
 * on Today, of owners still on "ask me first".
 *
 * Words (R-106): never "easy replies". Every reply works toward a booking;
 * prices, dates and anything unsure still wait. No promise about timing.
 * The yes goes through the same switch as Settings and setup
 * (/api/automation/settings), so nothing already waiting is sent: only new
 * conversations go out by themselves. Either answer is recorded once
 * (/api/automation/offer), so it is never asked again.
 *
 * One decision at a time (A-080): while it asks, the reply card waits
 * behind it and the first customer shows as one row under it, as drawn.
 * Either answer brings Today back (`children`).
 */
export default function ReplyForMeCard({
  proof,
  first,
  children,
}: {
  proof: ReplyForMeProof;
  /** The first customer waiting, shown as one row while the question is open. */
  first: { leadId: string; name: string; words: string | null } | null;
  /** Today's work, shown once the question is answered (or under it when nobody is waiting). */
  children: React.ReactNode;
}) {
  const [state, setState] = useState<"ask" | "busy" | "yes" | "gone">("ask");
  const [error, setError] = useState<string | null>(null);

  async function markAsked() {
    await fetch("/api/automation/offer", { method: "POST" }).catch(() => {});
  }

  async function yes() {
    setState("busy");
    setError(null);
    try {
      const res = await fetch("/api/automation/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoSendPermission: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't turn it on. Try again.");
      await markAsked();
      setState("yes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't turn it on. Try again.");
      setState("ask");
    }
  }

  async function undo() {
    setState("busy");
    setError(null);
    try {
      const res = await fetch("/api/automation/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoSendPermission: false }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't undo it. Try again in Settings.");
      setState("gone");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't undo it. Try again in Settings.");
      setState("yes");
    }
  }

  function notNow() {
    void markAsked();
    setState("gone");
  }

  if (state === "gone") return <>{children}</>;

  if (state === "yes") {
    return (
      <>
      <section aria-label="FollowUp replies for you" className="rounded-[18px] border border-line bg-card p-3.5 sm:p-5" role="status">
        <p className="flex items-center gap-2 text-[15.5px] font-semibold">
          <Check className="h-[17px] w-[17px] shrink-0" style={{ color: "var(--sage)" }} strokeWidth={2.4} aria-hidden="true" />
          Done. FollowUp replies for you now.
        </p>
        <p className="mt-1 text-[13.5px] leading-[1.45] text-ink-soft">
          Prices, dates and anything unsure still wait for you here. You can change it any time in Settings.
        </p>
        {error && (
          <p role="alert" className="mt-2 text-[13px]" style={{ color: "var(--coral)" }}>
            {error}
          </p>
        )}
        <button type="button" onClick={undo} className="mt-1 min-h-11 text-[13.5px] text-ink-soft underline underline-offset-[3px] hover:text-ink">
          Undo
        </button>
      </section>
      <div className="mt-3">{children}</div>
      </>
    );
  }

  return (
    <>
    <section aria-label="Let FollowUp reply for you?" className="rounded-[18px] border border-ink bg-card p-3.5 sm:p-5">
      <p className="text-[15.5px] font-semibold">Let FollowUp reply for you?</p>
      <p className="mt-1 text-[13.5px] leading-[1.45] text-ink-soft">
        It answers new customers for you, and every reply works toward a booking. Prices, dates and anything unsure still
        wait for you.
      </p>
      <p className="mt-2.5 flex items-start gap-2 text-[13px] leading-[1.45]">
        <Check className="mt-px h-4 w-4 shrink-0" style={{ color: "var(--sage)" }} strokeWidth={2.4} aria-hidden="true" />
        <span>
          You sent {proof.asWritten} of your last {proof.total} replies just as FollowUp wrote them.
        </span>
      </p>
      {error && (
        <p role="alert" className="mt-2 text-[13px]" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
      <div className="mt-3 grid gap-0.5 sm:flex sm:items-center sm:gap-4">
        {/* Outlined, never black: Send stays the one black button on Today (A-006). */}
        <button
          type="button"
          onClick={yes}
          disabled={state === "busy"}
          className="h-11 rounded-full border border-ink bg-card px-5 text-[14.5px] font-semibold text-ink disabled:opacity-60"
        >
          {state === "busy" ? "Turning on…" : "Yes, reply for me"}
        </button>
        <button type="button" onClick={notNow} disabled={state === "busy"} className="h-11 text-[14px] text-ink-soft hover:text-ink disabled:opacity-60">
          Not now
        </button>
      </div>
      <p className="mt-1 text-center text-[12px] text-ink-faint sm:text-left">You can change this any time in Settings.</p>
    </section>
    {first ? (
      // The customer waiting, one row; their page answers them meanwhile.
      <Link href={`/leads/${first.leadId}`} className="mt-2.5 flex min-h-11 items-center gap-2.5 rounded-[16px] border border-line bg-card px-3 py-2.5">
        <Initials name={first.name} size={30} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold">{first.name}</span>
          {first.words && <span className="block truncate text-[13px] text-ink-faint">{first.words}</span>}
        </span>
        <ChevronRight className="h-[18px] w-[18px] shrink-0 text-ink-faint" aria-hidden="true" />
      </Link>
    ) : (
      <div className="mt-3">{children}</div>
    )}
    </>
  );
}
