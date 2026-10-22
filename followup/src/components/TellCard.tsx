"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TellCardProps } from "@/lib/tellFollowUpData";

/**
 * The card on Today for "Tell FollowUp about your business" (A-311, built as drawn: A-312). It sits where the one
 * question a day sits, with its parts: a small line, the title, one line of why, an outlined Start (Today's one black
 * button stays Send) and a quiet Not now. Offered once: either answer closes it, and Settings keeps the way in.
 */
export default function TellCard({ card }: { card: TellCardProps }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState(false);

  async function answer(action: "start" | "not_now") {
    setBusy(true);
    // The card is closed on the server; if that fails, starting still starts, and the card simply comes back.
    await fetch("/api/business/tell", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }).catch(() => null);
    if (action === "start") {
      router.push("/tell?from=today");
      return;
    }
    setGone(true);
    router.refresh();
  }

  if (gone) return null;
  return (
    <section className="mt-5 box p-4 sm:p-5 max-w-[640px]" aria-labelledby="tell-card">
      <p className="text-[12.5px] text-ink-soft">{card.knows}</p>
      <h2 id="tell-card" className="mt-1 text-[17px] font-semibold leading-snug tracking-[-0.01em]">
        Tell FollowUp about your business
      </h2>
      <p className="mt-1 text-[13.5px] leading-normal text-ink-soft">
        A 5-minute meeting so FollowUp gets to know your business. You answer in your own words; at the end it shows you what it understood.
      </p>
      <div className="mt-3 flex items-center gap-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => void answer("start")}
          className="inline-flex h-11 items-center rounded-full border bg-card px-6 text-[14.5px] font-medium disabled:opacity-60"
          style={{ borderColor: "var(--line-strong)" }}
        >
          Start
        </button>
        <button type="button" disabled={busy} onClick={() => void answer("not_now")} className="h-11 px-1 text-[14px] text-ink-soft underline underline-offset-2">
          Not now
        </button>
      </div>
    </section>
  );
}
