"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { inboxSummaryWords, type InboxSummary } from "@/lib/inboxSummary";

/**
 * "Your last 90 days" (A-306): drawn and approved 2026-10-21 ("yes build it"). Once, after FollowUp first reads the
 * inbox, in place of the day's sentence: who wrote, who didn't get a reply, and what was set aside, with a link to
 * see those. "Got it" hides it for good, and the day's sentence comes back.
 */
export default function InboxSummaryCard({ summary, provider }: { summary: InboxSummary; provider: "gmail" | "outlook" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState(false);
  const words = inboxSummaryWords(summary);

  async function gotIt() {
    setBusy(true);
    try {
      const res = await fetch("/api/business/inbox-summary", { method: "POST" });
      if (res.ok) {
        setGone(true);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  if (gone) return null;
  return (
    <section className="-mx-2 mt-3.5 box p-4 sm:mx-0 sm:p-5 max-w-[760px]" aria-labelledby="inbox-summary">
      <p className="text-[12.5px] text-ink-soft">Your last 90 days</p>
      <h2 id="inbox-summary" className="mt-1 text-[19px] font-semibold leading-snug tracking-[-0.01em]">
        {words.heading}
      </h2>
      <p className="mt-1.5 text-[15px] leading-normal text-ink-soft">{words.line}</p>
      {words.setAside && (
        <p className="mt-3 text-[14px] leading-normal text-ink-faint">
          {words.setAside}{" "}
          <Link href={`/settings?skipped=${provider}#connections`} className="text-ink-soft underline underline-offset-2">
            See them
          </Link>
        </p>
      )}
      <div className="mt-3">
        <button type="button" disabled={busy} onClick={() => void gotIt()} className="h-11 px-1 text-[14px] text-ink-soft underline underline-offset-2">
          Got it
        </button>
      </div>
    </section>
  );
}
