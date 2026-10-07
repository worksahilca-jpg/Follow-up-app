"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * One question a day on Today (A-101, src/lib/dailyQuestion.ts). Drawn and
 * approved 2026-10-07 ("yes build it"): a small label, the question, one
 * line of why, a box with a realistic example, a black Save and a quiet
 * Not now. After Save, one line says what the answer is for.
 *
 * Always mounted for an admin, with `question` null when there is nothing
 * to ask: the page refreshes after an answer, and staying mounted is what
 * keeps the confirmation on screen through that refresh (as HabitQuestion).
 */
export type DailyQuestionProps = { label: string; question: string; example: string; why: string };

export default function DailyQuestion({ question }: { question: DailyQuestionProps | null }) {
  const router = useRouter();
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"saved" | "later" | null>(null);

  async function send(label: string, value?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/business/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value ? { label, answer: value } : { label }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string };
      if (!res.ok || !data.success) {
        setError(data.message ?? "That didn't save. Try again.");
        return;
      }
      setDone(value ? "saved" : "later");
      setAnswer("");
      router.refresh();
    } catch {
      setError("That didn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done === "saved") {
    return (
      <section className="mt-8 box p-5 max-w-3xl" role="status">
        <p className="text-[17px] leading-snug">Saved. FollowUp will use your words when a customer asks.</p>
        <Link href="/settings#business" className="mt-3 inline-block text-[14px] text-ink-soft underline underline-offset-2">
          See what FollowUp knows
        </Link>
      </section>
    );
  }
  if (done === "later" || !question) return null;

  const value = answer.trim();
  return (
    <section className="mt-8 box p-5 max-w-3xl" aria-labelledby="daily-question">
      <p className="text-[13px] text-ink-soft">One quick question</p>
      <h2 id="daily-question" className="mt-1.5 text-[21px] leading-[1.25]">
        {question.question}
      </h2>
      <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">{question.why}</p>
      <label htmlFor="daily-answer" className="sr-only">
        Your answer
      </label>
      <textarea
        id="daily-answer"
        rows={2}
        maxLength={200}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder={question.example}
        className="mt-4 w-full rounded-[14px] border border-line bg-paper px-4 py-3 text-[16px] leading-relaxed"
      />
      {error && (
        <p className="mt-2 text-[13px]" role="alert" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          disabled={busy || !value}
          onClick={() => void send(question.label, value)}
          className="h-11 rounded-full bg-ink px-6 text-[15px] font-medium text-paper disabled:opacity-60"
        >
          {busy && value ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void send(question.label)}
          className="h-11 px-1 text-[14px] text-ink-soft underline underline-offset-2"
        >
          Not now
        </button>
      </div>
    </section>
  );
}
