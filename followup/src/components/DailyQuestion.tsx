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
export type DailyQuestionProps = {
  label: string;
  question: string;
  example: string;
  why: string;
  /**
   * "stay": news for the customers staying in touch (A-260), answered at /api/stay-in-touch/news.
   * "plan": what the owner asks a new buyer, in their order (A-302), answered at /api/business/ask-plan.
   */
  kind?: "stay" | "plan";
  maxLength?: number;
};

export default function DailyQuestion({ question }: { question: DailyQuestionProps | null }) {
  const router = useRouter();
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"saved" | "planned" | "later" | null>(null);
  // What FollowUp did with the news (A-260): who it wrote for, and who it didn't and why.
  const [lines, setLines] = useState<string[]>([]);

  async function send(label: string, value?: string) {
    setBusy(true);
    setError(null);
    try {
      const kind = question?.kind;
      const res = await fetch(kind === "stay" ? "/api/stay-in-touch/news" : kind === "plan" ? "/api/business/ask-plan" : "/api/business/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          kind === "stay"
            ? value
              ? { text: value }
              : { notNow: true }
            : kind === "plan"
              ? value
                ? { words: value }
                : { notNow: true }
              : value
                ? { label, answer: value }
                : { label }
        ),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string; lines?: string[] };
      if (!res.ok || !data.success) {
        setError(data.message ?? "That didn't save. Try again.");
        return;
      }
      setLines(Array.isArray(data.lines) ? data.lines : []);
      setDone(value ? (kind === "plan" ? "planned" : "saved") : "later");
      setAnswer("");
      router.refresh();
    } catch {
      setError("That didn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done === "saved" && lines.length > 0) {
    return (
      <section className="mt-5 box p-4 sm:p-5 max-w-[640px]" role="status">
        <p className="text-[15px] leading-snug">{lines[0]}</p>
        {lines.slice(1).map((l) => (
          <p key={l} className="mt-2 text-[14px] leading-snug text-ink-soft">
            {l}
          </p>
        ))}
        <Link href="/workflows" className="mt-3 inline-block text-[14px] text-ink-soft underline underline-offset-2">
          See Stay in touch
        </Link>
      </section>
    );
  }
  if (done === "planned") {
    return (
      <section className="mt-5 box p-4 sm:p-5 max-w-[640px]" role="status">
        <p className="text-[15px] leading-snug">Saved. FollowUp turned your words into questions and will ask them in your order.</p>
        <Link href="/asks" className="mt-3 inline-block text-[14px] text-ink-soft underline underline-offset-2">
          See your questions
        </Link>
      </section>
    );
  }
  if (done === "saved") {
    return (
      <section className="mt-5 box p-4 sm:p-5 max-w-[640px]" role="status">
        <p className="text-[15px] leading-snug">Saved. FollowUp will use your words when a customer asks.</p>
        <Link href="/settings#business" className="mt-3 inline-block text-[14px] text-ink-soft underline underline-offset-2">
          See what FollowUp knows
        </Link>
      </section>
    );
  }
  if (done === "later" || !question) return null;

  const value = answer.trim();
  return (
    <section className="mt-5 box p-4 sm:p-5 max-w-[640px]" aria-labelledby="daily-question">
      <p className="text-[12.5px] text-ink-soft">One quick question</p>
      <h2 id="daily-question" className="mt-1 text-[17px] font-semibold leading-snug tracking-[-0.01em]">
        {question.question}
      </h2>
      <p className="mt-1 text-[13.5px] leading-normal text-ink-soft">{question.why}</p>
      <label htmlFor="daily-answer" className="sr-only">
        Your answer
      </label>
      <textarea
        id="daily-answer"
        rows={question.kind === "plan" ? 5 : question.kind === "stay" ? 3 : 2}
        maxLength={question.maxLength ?? 200}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder={question.example}
        className="mt-3 w-full rounded-[14px] border border-line bg-paper px-3.5 py-2.5 text-[16px] leading-normal"
      />
      {error && (
        <p className="mt-2 text-[13px]" role="alert" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
      <div className="mt-3 flex items-center gap-4">
        <button
          type="button"
          disabled={busy || !value}
          onClick={() => void send(question.label, value)}
          className="h-11 rounded-full bg-ink px-6 text-[14.5px] font-medium text-paper disabled:opacity-60"
        >
          {busy && value ? (question.kind === "stay" ? "Writing…" : "Saving…") : "Save"}
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
