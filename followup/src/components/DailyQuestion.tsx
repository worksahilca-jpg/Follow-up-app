"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GROUP, ListRow } from "@/components/app/IosList";
import { cantBookYet, type CalendarKey, type CalendarOutcome } from "@/lib/calendarUsed";

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
   * "calendar": which calendar they book in (A-305), a tap on one of `choices`, answered at /api/business/calendar.
   */
  kind?: "stay" | "plan" | "calendar";
  maxLength?: number;
  choices?: { key: CalendarKey; label: string }[];
};

/** After a calendar is picked: FollowUp can't book into it yet (choose), or one line saying where customers book. */
type CalendarState =
  | { step: "choose"; key: CalendarKey; label: string; gmailConnected: boolean }
  | { step: "done"; line: string; href: string; link: string };

const CALENDAR_DONE: Record<Exclude<CalendarOutcome, "choose">, Omit<Extract<CalendarState, { step: "done" }>, "step">> = {
  // The calendar lives under Connected apps, the hours under Your business (A-316).
  google: { line: "Saved. Customers book straight into your Google Calendar.", href: "/settings#connections", link: "See your calendar" },
  connect_gmail: {
    line: "Saved. Connect Gmail and FollowUp books straight into your Google Calendar. Until then, customers book in FollowUp's calendar.",
    href: "/settings#connections",
    link: "Connect Gmail",
  },
  followup: { line: "Saved. Customers book in FollowUp's calendar, in your booking hours.", href: "/settings#booking", link: "See your booking hours" },
};

const CHOICE_PILL =
  "inline-flex min-h-11 items-center rounded-full border border-line-strong bg-card px-4 text-[15px] text-ink hover:bg-card-2 disabled:opacity-60";

export default function DailyQuestion({ question }: { question: DailyQuestionProps | null }) {
  const router = useRouter();
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"saved" | "planned" | "later" | null>(null);
  // What FollowUp did with the news (A-260): who it wrote for, and who it didn't and why.
  const [lines, setLines] = useState<string[]>([]);
  const [calendar, setCalendar] = useState<CalendarState | null>(null);

  async function post(url: string, body: unknown): Promise<Record<string, unknown> | null> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok || !data.success) {
        setError(typeof data.message === "string" ? data.message : "That didn't save. Try again.");
        return null;
      }
      return data;
    } catch {
      setError("That didn't save. Check your connection and try again.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  /** A calendar pill (A-305): saved at once; the card then says where customers book, or asks which one meanwhile. */
  async function pickCalendar(key: CalendarKey) {
    const data = await post("/api/business/calendar", { calendar: key });
    if (!data) return;
    const outcome = data.outcome as CalendarOutcome;
    if (outcome === "choose") {
      setCalendar({ step: "choose", key, label: String(data.label ?? ""), gmailConnected: Boolean(data.gmailConnected) });
      return;
    }
    setCalendar({ step: "done", ...CALENDAR_DONE[outcome] });
    router.refresh();
  }

  /** "Until it can, where should customers book?": the same choice as Settings › Where customers book. */
  async function chooseSource(source: "followup" | "google") {
    if (!(await post("/api/business/booking-source", { bookingCalendarSource: source }))) return;
    setCalendar({
      step: "done",
      line: source === "google" ? "Saved. Customers book in your Google Calendar." : "Saved. Customers book in FollowUp's calendar.",
      href: "/settings#connections",
      link: "See your calendar",
    });
    router.refresh();
  }

  async function calendarNotNow() {
    if (!(await post("/api/business/calendar", { notNow: true }))) return;
    setDone("later");
    router.refresh();
  }

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

  if (calendar?.step === "done") {
    return (
      <section className="mt-5 box p-4 sm:p-5 max-w-[640px]" role="status">
        <p className="text-[15px] leading-snug">{calendar.line}</p>
        <Link href={calendar.href} className="mt-3 inline-block text-[14px] text-ink-soft underline underline-offset-2">
          {calendar.link}
        </Link>
      </section>
    );
  }
  if (calendar?.step === "choose") {
    return (
      <section className="mt-5 box p-4 sm:p-5 max-w-[640px]" aria-labelledby="calendar-choose">
        <p className="text-[12.5px] text-ink-soft">One quick question</p>
        <h2 id="calendar-choose" className="mt-1 text-[17px] font-semibold leading-snug tracking-[-0.01em]">
          {cantBookYet(calendar.key)}
        </h2>
        <p className="mt-1 text-[13.5px] leading-normal text-ink-soft">Until it can, where should customers book?</p>
        {/* The lines under each choice wrap: on a phone they are the reason to pick it, so they are never cut off. */}
        <div className={GROUP + " mt-3"}>
          <ListRow first label="FollowUp's calendar" sub={<span className="whitespace-normal">Your booking hours. Nothing to connect.</span>} onClick={() => void chooseSource("followup")} disabled={busy} />
          {calendar.gmailConnected ? (
            <ListRow label="My Google Calendar" sub={<span className="whitespace-normal">Checks when you&apos;re busy, and adds each booking.</span>} onClick={() => void chooseSource("google")} disabled={busy} />
          ) : (
            <ListRow label="My Google Calendar" sub={<span className="whitespace-normal">Connect Gmail first, then pick this.</span>} href="/settings#connections" />
          )}
        </div>
        {error && (
          <p className="mt-2 text-[13px]" role="alert" style={{ color: "var(--coral)" }}>
            {error}
          </p>
        )}
        <p className="mt-3 text-[13.5px] text-ink-faint">
          {calendar.key === "other" ? "We've noted it." : `We've noted ${calendar.label}.`} You can change this in Settings.
        </p>
      </section>
    );
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

  if (question.kind === "calendar") {
    return (
      <section className="mt-5 box p-4 sm:p-5 max-w-[640px]" aria-labelledby="daily-question">
        <p className="text-[12.5px] text-ink-soft">One quick question</p>
        <h2 id="daily-question" className="mt-1 text-[17px] font-semibold leading-snug tracking-[-0.01em]">
          {question.question}
        </h2>
        <p className="mt-1 text-[13.5px] leading-normal text-ink-soft">{question.why}</p>
        <div role="group" aria-label="Calendars" className="mt-3 flex flex-wrap gap-2">
          {(question.choices ?? []).map((c) => (
            <button key={c.key} type="button" disabled={busy} onClick={() => void pickCalendar(c.key)} className={CHOICE_PILL}>
              {c.label}
            </button>
          ))}
        </div>
        {error && (
          <p className="mt-2 text-[13px]" role="alert" style={{ color: "var(--coral)" }}>
            {error}
          </p>
        )}
        <div className="mt-3">
          <button type="button" disabled={busy} onClick={() => void calendarNotNow()} className="h-11 px-1 text-[14px] text-ink-soft underline underline-offset-2">
            Not now
          </button>
        </div>
      </section>
    );
  }

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
