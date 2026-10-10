"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TeachQuestion } from "@/lib/teachQuestions";

/**
 * "Teach FollowUp your business" (A-100): one question per screen, each
 * skippable, then what FollowUp now knows. Drawn and approved 2026-10-07
 * ("yes build it"), including the small "2 of 7", which tells a busy owner
 * how short this is.
 *
 * Each answer is saved the moment Next is pressed (POST /api/business/facts,
 * as a fact the owner typed), so leaving halfway keeps what was answered.
 */
export default function TeachFlow({ questions, known }: { questions: TeachQuestion[]; known: { label: string; value: string }[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [saved, setSaved] = useState<{ label: string; value: string }[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finished = index >= questions.length;
  const q = questions[index];

  function leave() {
    router.push("/dashboard");
    router.refresh();
  }

  async function next() {
    const value = answer.trim();
    if (!value) return skip();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/business/facts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: q.label, value }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string };
      if (!res.ok || !data.success) throw new Error(data.message ?? "That didn't save. Try again.");
      setSaved((s) => [...s, { label: q.label, value }]);
      setAnswer("");
      setIndex((i) => i + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function skip() {
    setSkipped((n) => n + 1);
    setAnswer("");
    setError(null);
    setIndex((i) => i + 1);
  }

  const shell = "mx-auto flex min-h-[100dvh] w-full max-w-xl flex-col bg-paper px-5 pb-7 pt-5";

  if (questions.length === 0 || finished) {
    // Everything FollowUp now knows, newest answers last.
    const all = [...known, ...saved];
    const total = all.length;
    return (
      <main className={shell}>
        <p className="mt-14 text-[13px] text-ink-soft">Teach FollowUp your business</p>
        <h1 className="title-serif mt-2 text-[28px] leading-[1.15]">
          {total === 0
            ? "FollowUp will learn as you go."
            : `FollowUp knows ${total} ${total === 1 ? "thing" : "things"} about your business.`}
        </h1>
        {all.length > 0 && (
          <ul className="mt-6 border-t border-line">
            {all.map((f) => (
              <li key={f.label} className="border-b border-line py-3">
                <p className="text-[13px] text-ink-soft">{f.label}</p>
                <p className="mt-0.5 break-words text-[15px]">{f.value}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-[14.5px] leading-relaxed text-ink-soft">
          {skipped > 0
            ? `You skipped ${skipped}. When a customer asks about one of them, FollowUp will ask you on Today, once.`
            : "When a customer asks something FollowUp doesn't know yet, it will ask you on Today, once."}
        </p>
        <div className="flex-1" />
        <button type="button" onClick={leave} className="h-12 w-full rounded-full bg-ink text-[15px] font-medium text-paper">
          Done
        </button>
        <p className="mt-3 text-center text-[13px] text-ink-soft">Change any of these in Settings → Your business.</p>
      </main>
    );
  }

  return (
    <main className={shell}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-ink-soft">
          {index + 1} of {questions.length}
        </span>
        <button type="button" onClick={leave} className="h-11 px-1 text-[14px] text-ink-soft underline underline-offset-2">
          Finish later
        </button>
      </div>
      <p className="mt-8 text-[13px] text-ink-soft">Teach FollowUp your business</p>
      <h1 className="title-serif mt-2 text-[28px] leading-[1.15]">{q.question}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
        Customers ask this a lot. FollowUp will answer with your exact words, and never makes up the rest.
      </p>
      <label htmlFor="teach-answer" className="sr-only">
        Your answer
      </label>
      <textarea
        id="teach-answer"
        key={q.label}
        rows={3}
        maxLength={200}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder={q.example}
        autoFocus
        className="mt-6 w-full rounded-[14px] border border-line bg-card px-4 py-3 text-[16px] leading-relaxed"
      />
      {error && (
        <p className="mt-2 text-[13px]" role="alert" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
      <div className="flex-1" />
      <button
        type="button"
        onClick={() => void next()}
        disabled={busy}
        className="h-12 w-full rounded-full bg-ink text-[15px] font-medium text-paper disabled:opacity-60"
      >
        {busy ? "Saving…" : "Next"}
      </button>
      <button type="button" onClick={skip} disabled={busy} className="mt-3 h-11 w-full text-[14px] text-ink-soft underline underline-offset-2">
        Skip this one
      </button>
    </main>
  );
}
