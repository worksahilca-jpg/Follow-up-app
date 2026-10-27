"use client";

import { fetchOnOpen } from "@/lib/pageCopies";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { calendarFootnote, calendarLabel, calendarQuestion, calendarsFor, type CalendarKey } from "@/lib/calendarUsed";
import { BOX, PILL, ConnectedMark, ConnectionRow, ConnectionSheet } from "./connectionBits";

type Source = "followup" | "google";

/**
 * The calendar, under Connected apps with every other app (A-316, founder: "All the applications should be right
 * there"). One row saying which calendar the owner books in; its window holds the two choices that used to sit on
 * the free-hours page: which calendar they use (A-305, the same list as the question on Today) and where customers
 * book until FollowUp can book into it (FollowUp's own calendar, or Google Calendar with Gmail connected). The days
 * and hours customers can book stay in Your business › Your free hours.
 */
export default function CalendarConnection({ isAdmin }: { isAdmin: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [source, setSource] = useState<Source>("followup");
  const [gmailConnected, setGmailConnected] = useState(false);
  const [calendarUsed, setCalendarUsed] = useState<CalendarKey | null>(null);
  const [realtor, setRealtor] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOnOpen("/api/business/booking-source")
      .then((r) => r.json())
      .then((data: { success: boolean; bookingCalendarSource?: Source; gmailConnected?: boolean; calendarUsed?: CalendarKey | null; realtor?: boolean }) => {
        if (!data.success) return;
        setSource(data.bookingCalendarSource ?? "followup");
        setGmailConnected(!!data.gmailConnected);
        setCalendarUsed(data.calendarUsed ?? null);
        setRealtor(!!data.realtor);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  /** Which calendar they book in: the same answer as the question on Today, from the same list. */
  async function pickCalendar(key: CalendarKey) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/business/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendar: key }),
      });
      const data: { success: boolean; message?: string; gmailConnected?: boolean; bookingCalendarSource?: Source } = await res.json();
      if (!data.success) {
        setError(data.message ?? "Couldn't save — try again.");
        return;
      }
      setCalendarUsed(key);
      setGmailConnected(!!data.gmailConnected);
      if (data.bookingCalendarSource) setSource(data.bookingCalendarSource);
    } catch {
      setError("Couldn't save — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  /** Where customers book: FollowUp's calendar, or Google Calendar (only with Gmail connected). */
  async function choose(next: Source) {
    if (next === source || saving) return;
    if (next === "google" && !gmailConnected) {
      setError("Connect Gmail first — there's no Google Calendar to check without it.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/business/booking-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingCalendarSource: next }),
      });
      const data: { success: boolean; message?: string } = await res.json();
      if (data.success) setSource(next);
      else setError(data.message ?? "Couldn't save — try again.");
    } catch {
      setError("Couldn't save — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  // An owner who picked Google Calendar before the question existed (A-305) still books into it.
  const label = calendarUsed ? calendarLabel(calendarUsed) : source === "google" ? calendarLabel("google") : null;
  const footnote = calendarFootnote(calendarUsed, source, gmailConnected);
  const close = () => {
    setOpen(false);
    setError(null);
  };

  return (
    <>
      <div className={BOX}>
        {label ? (
          <ConnectionRow
            glyph="calendar"
            name="Calendar"
            sub={label}
            first
            onOpen={() => setOpen(true)}
            mark={source === "google" && gmailConnected ? <ConnectedMark /> : undefined}
          />
        ) : (
          <ConnectionRow
            glyph="calendar"
            name="Calendar"
            sub="Not chosen yet"
            first
            action={
              isAdmin ? (
                <button type="button" onClick={() => setOpen(true)} className={PILL}>
                  Choose
                </button>
              ) : null
            }
          />
        )}
      </div>

      {open && (
        <ConnectionSheet
          label="Calendar"
          glyph="calendar"
          title="Calendar"
          status={label ? <p className="mt-0.5 text-[15px] text-ink-soft">{label}</p> : undefined}
          onClose={close}
        >
          <p id="which-calendar" className="mt-5 text-[14px] text-ink-faint">
            {calendarQuestion(realtor)}
          </p>
          <div role="group" aria-labelledby="which-calendar" className="mt-2.5 flex flex-wrap gap-2">
            {calendarsFor(realtor).map((c) => {
              const on = c.key === calendarUsed;
              return (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={on}
                  disabled={saving || !isAdmin}
                  onClick={() => void pickCalendar(c.key)}
                  className={
                    "inline-flex min-h-11 items-center rounded-full border px-4 text-[15px] disabled:opacity-60 " +
                    (on ? "border-ink bg-ink text-paper" : "border-line-strong bg-card text-ink hover:bg-card-2")
                  }
                >
                  {c.label}
                </button>
              );
            })}
          </div>
          {footnote && <p className="mt-2.5 text-[14px] leading-snug text-ink-soft">{footnote}</p>}

          <p id="where-customers-book" className="mt-6 text-[14px] text-ink-faint">
            Where customers book
          </p>
          <div role="radiogroup" aria-labelledby="where-customers-book" className="mt-2.5 space-y-2">
            {(
              [
                ["followup", "FollowUp's built-in calendar", "Your free hours, tracked entirely inside FollowUp. Works with no calendar connected."],
                [
                  "google",
                  "My Google Calendar",
                  gmailConnected
                    ? "Your free hours, minus anything already on your calendar — a customer can never book over a meeting you already have. Confirmed bookings land directly on it."
                    : "Connect Gmail first.",
                ],
              ] as const
            ).map(([key, title, sub]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={source === key}
                onClick={() => void choose(key)}
                disabled={saving || !isAdmin}
                className="w-full rounded-[12px] border px-3.5 py-3 text-left text-[14px] disabled:opacity-60"
                style={{ borderColor: source === key ? "var(--accent)" : "var(--line)", backgroundColor: source === key ? "var(--accent-soft)" : "transparent" }}
              >
                <span className="flex items-center gap-1.5 text-[15px] font-medium">
                  {source === key && <Check aria-hidden className="h-3.5 w-3.5" />}
                  {title}
                </span>
                <span className="mt-0.5 block leading-snug text-ink-soft">{sub}</span>
              </button>
            ))}
          </div>
          {!isAdmin && <p className="mt-2.5 text-[14px] text-ink-soft">Only an admin can change these.</p>}
          {error && (
            <p role="alert" className="mt-2.5 text-[14px]" style={{ color: "var(--coral)" }}>
              {error}
            </p>
          )}
        </ConnectionSheet>
      )}
    </>
  );
}
