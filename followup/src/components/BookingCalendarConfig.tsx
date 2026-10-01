"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, Check } from "lucide-react";
import {
  WEEKDAYS,
  TIME_ZONES,
  DEFAULT_BOOKING_HOURS,
  bookingHoursProblem,
  describeBookingHours,
  describeTimeZone,
  timeOptions,
  type BookingHours,
} from "@/lib/bookingHours";

type Source = "followup" | "google";

/**
 * "Booking calendar" section of Settings — where a lead's booking link
 * (/book/[leadId]) checks availability and where a confirmed booking
 * actually lands. "FollowUp's calendar" is the original, always-available
 * behavior (the booking hours below, tracked entirely inside FollowUp).
 * "My Google Calendar" additionally reads the owner's real busy times
 * (see getGoogleCalendarBusyTimes in src/lib/integrations/gmail.ts) so a
 * lead can never book over a meeting that's already on it — gated on
 * Gmail being connected, since there'd be nothing to read otherwise.
 *
 * Below the two options, since A-078 (founder, 2026-10-01): when people
 * can book — days, hours and the business's time zone. Each change saves
 * on its own, the way the two options above always have; the summary
 * line restates the choice in words with a quiet "Saved".
 */
export default function BookingCalendarConfig() {
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<Source>("followup");
  const [gmailConnected, setGmailConnected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [hours, setHours] = useState<BookingHours>(DEFAULT_BOOKING_HOURS);
  const [timezone, setTimezone] = useState("America/New_York");
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [savedTick, setSavedTick] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/business/booking-source")
        .then((r) => r.json())
        .then((data: { success: boolean; bookingCalendarSource?: Source; gmailConnected?: boolean }) => {
          if (data.success) {
            setSource(data.bookingCalendarSource ?? "followup");
            setGmailConnected(!!data.gmailConnected);
          }
        }),
      fetch("/api/business/booking-hours")
        .then((r) => r.json())
        .then((data: { success: boolean; timezone?: string; days?: number[]; startMinute?: number; endMinute?: number }) => {
          if (data.success && data.days && data.startMinute !== undefined && data.endMinute !== undefined) {
            setHours({ days: data.days, startMinute: data.startMinute, endMinute: data.endMinute });
            if (data.timezone) setTimezone(data.timezone);
          }
        }),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  async function choose(next: Source) {
    if (next === source || saving) return;
    if (next === "google" && !gmailConnected) {
      setSaveError("Connect Gmail first — there's no Google Calendar to check without it.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/business/booking-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingCalendarSource: next }),
      });
      const data: { success: boolean; message?: string } = await res.json();
      if (data.success) {
        setSource(next);
      } else {
        setSaveError(data.message ?? "Couldn't save — try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  /**
   * Shows the change at once and saves it; on a refusal the previous value
   * comes back, so the card never shows hours the link isn't using. The
   * same check the route makes runs first, so an impossible choice (no
   * days, end before start) is explained without a round trip.
   */
  async function saveHours(nextHours: BookingHours, nextTimezone: string) {
    const problem = bookingHoursProblem(nextHours);
    if (problem) {
      setHoursError(problem);
      return;
    }
    const previous = { hours, timezone };
    setHours(nextHours);
    setTimezone(nextTimezone);
    setHoursError(null);
    try {
      const res = await fetch("/api/business/booking-hours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...nextHours, timezone: nextTimezone }),
      });
      const data: { success: boolean; message?: string } = await res.json();
      if (!data.success) throw new Error(data.message ?? "Couldn't save — try again.");
      setSavedTick(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSavedTick(false), 2000);
    } catch (err) {
      setHours(previous.hours);
      setTimezone(previous.timezone);
      setHoursError(err instanceof Error ? err.message : "Couldn't save — try again.");
    }
  }

  function toggleDay(day: number) {
    const on = hours.days.includes(day);
    const days = on ? hours.days.filter((d) => d !== day) : [...hours.days, day];
    void saveHours({ ...hours, days }, timezone);
  }

  if (loading) return null;

  const times = timeOptions();
  const selectStyle = { borderColor: "var(--line)", backgroundColor: "var(--card)", color: "var(--ink)" };
  const timezoneListed = TIME_ZONES.some((z) => z.value === timezone);

  return (
    <div className="box p-5">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}>
          <Calendar className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Where should FollowUp book meetings?</p>
          <p className="text-[13px] text-ink-soft mt-1">
            This decides what a lead sees as open on their booking link, and where a confirmed booking actually goes.
          </p>

          {saveError && (
            <p className="text-[13px] mt-2" style={{ color: "var(--coral)" }}>
              {saveError}
            </p>
          )}

          <div className="mt-3 space-y-2">
            <button
              onClick={() => choose("followup")}
              disabled={saving}
              className="w-full text-left rounded-[12px] border px-3 py-2.5 text-[13px] disabled:opacity-60"
              style={{ borderColor: source === "followup" ? "var(--rust)" : "var(--line)", backgroundColor: source === "followup" ? "var(--rust-soft)" : "transparent" }}
            >
              <span className="font-medium flex items-center gap-1.5">
                {source === "followup" && <Check className="h-3.5 w-3.5" style={{ color: "var(--rust)" }} />}
                FollowUp&apos;s built-in calendar
              </span>
              <span className="block text-ink-soft mt-0.5">Your booking hours below, tracked entirely inside FollowUp. Works with no calendar connected.</span>
            </button>

            <button
              onClick={() => choose("google")}
              disabled={saving}
              className="w-full text-left rounded-[12px] border px-3 py-2.5 text-[13px] disabled:opacity-60"
              style={{ borderColor: source === "google" ? "var(--rust)" : "var(--line)", backgroundColor: source === "google" ? "var(--rust-soft)" : "transparent" }}
            >
              <span className="font-medium flex items-center gap-1.5">
                {source === "google" && <Check className="h-3.5 w-3.5" style={{ color: "var(--rust)" }} />}
                My Google Calendar
              </span>
              <span className="block text-ink-soft mt-0.5">
                {gmailConnected
                  ? "Your booking hours below, minus anything already on your calendar — a lead can never book over a meeting you already have. Confirmed bookings land directly on it."
                  : "Requires Gmail connected above."}
              </span>
            </button>
          </div>

          <div className="mt-4 pt-4 border-t border-line">
            <p className="text-sm font-medium">When can people book?</p>
            <p className="text-[13px] text-ink-soft mt-1">30-minute calls. Only these days and hours are offered on your booking link.</p>

            <div role="group" aria-label="Days people can book" className="mt-2.5 flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => {
                const on = hours.days.includes(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleDay(d.value)}
                    className="h-9 min-w-[44px] px-3 rounded-full border text-[13px] font-medium"
                    style={
                      on
                        ? { backgroundColor: "var(--accent)", color: "var(--on-accent)", borderColor: "var(--accent)" }
                        : { backgroundColor: "transparent", color: "var(--ink-faint)", borderColor: "var(--line)" }
                    }
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
              <label htmlFor="booking-from" className="text-ink-soft">
                From
              </label>
              <select
                id="booking-from"
                value={hours.startMinute}
                onChange={(e) => void saveHours({ ...hours, startMinute: Number(e.target.value) }, timezone)}
                className="h-9 rounded-[10px] border px-2.5 text-[13px]"
                style={selectStyle}
              >
                {times
                  .filter((t) => t.value < 24 * 60)
                  .map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
              </select>
              <span className="text-ink-soft">to</span>
              <select
                id="booking-to"
                aria-label="To"
                value={hours.endMinute}
                onChange={(e) => void saveHours({ ...hours, endMinute: Number(e.target.value) }, timezone)}
                className="h-9 rounded-[10px] border px-2.5 text-[13px]"
                style={selectStyle}
              >
                {times
                  .filter((t) => t.value > 0)
                  .map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
              </select>
              <select
                id="booking-timezone"
                aria-label="Time zone"
                value={timezone}
                onChange={(e) => void saveHours(hours, e.target.value)}
                className="h-9 rounded-[10px] border px-2.5 text-[13px]"
                style={selectStyle}
              >
                {!timezoneListed && <option value={timezone}>{timezone}</option>}
                {TIME_ZONES.map((z) => (
                  <option key={z.value} value={z.value}>
                    {z.label}
                  </option>
                ))}
              </select>
            </div>

            {hoursError && (
              <p className="text-[13px] mt-2" style={{ color: "var(--coral)" }}>
                {hoursError}
              </p>
            )}

            <p className="text-[13px] text-ink-soft mt-3" aria-live="polite">
              People can book <span className="font-medium text-ink">{describeBookingHours(hours)}</span>, {describeTimeZone(timezone).replace(/\s*\(.*\)$/, "")} time.
              {savedTick && (
                <span className="inline-flex items-center gap-1 ml-2" style={{ color: "var(--sage)" }}>
                  <Check className="h-3 w-3" />
                  Saved
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
