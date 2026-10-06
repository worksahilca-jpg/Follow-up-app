"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * "FollowUp learns what you do" (A-099, src/lib/habits.ts): the one question
 * Today asks once the owner has done the same thing by hand often enough.
 * Admin only (the page decides). A yes changes what FollowUp does; a no is
 * remembered and never asked again; both can be changed in Settings.
 */
export type HabitSuggestionProps = {
  kind: "skip_thanks" | "weekend_wait";
  count: number;
  example: string | null;
};

const COPY = {
  skip_thanks: {
    question: "Stop writing replies to messages like that?",
    yes: "Yes, stop",
    no: "Keep writing them",
  },
  weekend_wait: {
    question: "Let weekend messages wait until Monday 9 am?",
    yes: "Yes, let them wait",
    no: "Keep showing them",
  },
} as const;

export default function HabitQuestion({ kind, count, example }: HabitSuggestionProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answered, setAnswered] = useState<"on" | "declined" | null>(null);
  const copy = COPY[kind];

  async function answer(decision: "on" | "declined") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/business/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, decision }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string };
      if (!res.ok || !data.success) {
        setError(data.message ?? "That didn't save. Try again.");
        return;
      }
      setAnswered(decision);
      router.refresh();
    } catch {
      setError("That didn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (answered) {
    return (
      <p className="mt-6 text-sm text-ink-soft" role="status">
        {answered === "on" ? "Done. FollowUp will do this for you from now on." : "Got it. FollowUp won't ask about this again."}{" "}
        You can change it in Settings → Your business.
      </p>
    );
  }

  return (
    <section className="mt-6 box p-5 max-w-3xl" aria-labelledby="habit-question-title">
      <p id="habit-question-title" className="text-sm font-medium">
        FollowUp noticed something
      </p>
      <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink">
        {kind === "skip_thanks" ? (
          <>
            You pressed <b className="font-semibold">Don&apos;t send</b> on {count} replies to messages that only said thanks
            {example ? (
              <>
                , like <span className="text-ink-soft">&ldquo;{example}&rdquo;</span>
              </>
            ) : null}
            .
          </>
        ) : (
          <>
            You moved {count} weekend messages to Monday with <b className="font-semibold">Later</b>.
          </>
        )}
      </p>
      <p className="mt-2 text-[14.5px] leading-relaxed text-ink">{copy.question}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => answer("on")}
          className="h-11 rounded-full bg-ink px-4 text-sm font-medium text-paper disabled:opacity-60"
        >
          {copy.yes}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => answer("declined")}
          className="h-11 rounded-full border border-line px-4 text-sm font-medium disabled:opacity-60"
        >
          {copy.no}
        </button>
      </div>
      {error && (
        <p className="mt-3 text-sm" role="alert" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
      <p className="mt-3 text-[12.5px] text-ink-soft">Change it any time in Settings → Your business.</p>
    </section>
  );
}
