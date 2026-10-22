"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
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

/**
 * Your business › Your free hours (A-078, moved under Your business by A-316): when customers can book a call through
 * the booking link: days, hours and the business's time zone. Each change saves on its own; the summary line restates
 * the choice in words with a quiet "Saved". Which calendar the link checks is an app, so it lives under Connected apps
 * (CalendarConnection); this page links there.
 */
export default function BookingHoursConfig() {
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState<BookingHours>(DEFAULT_BOOKING_HOURS);
  const [timezone, setTimezone] = useState("America/New_York");
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [savedTick, setSavedTick] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // What the server last confirmed. A refused save restores THIS, not the
  // value a closure captured when the request started: two quick changes
  // in flight would otherwise let the first one's failure undo the second
  // one's success on screen (code review, 2026-10-01).
  const confirmed = useRef<{ hours: BookingHours; timezone: string }>({ hours: DEFAULT_BOOKING_HOURS, timezone: "America/New_York" });

  useEffect(() => {
    fetch("/api/business/booking-hours")
      .then((r) => r.json())
      .then((data: { success: boolean; timezone?: string; days?: number[]; startMinute?: number; endMinute?: number }) => {
        if (data.success && data.days && data.startMinute !== undefined && data.endMinute !== undefined) {
          const loaded = { days: data.days, startMinute: data.startMinute, endMinute: data.endMinute };
          setHours(loaded);
          if (data.timezone) setTimezone(data.timezone);
          confirmed.current = { hours: loaded, timezone: data.timezone ?? confirmed.current.timezone };
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  /**
   * Shows the change at once and saves it; on a refusal the last
   * server-confirmed value comes back, so the card never shows hours the
   * link isn't using. The same check the route makes runs first, so an
   * impossible choice (no days, end before start) is explained without a
   * round trip.
   */
  async function saveHours(nextHours: BookingHours, nextTimezone: string) {
    const problem = bookingHoursProblem(nextHours);
    if (problem) {
      setHoursError(problem);
      return;
    }
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
      confirmed.current = { hours: nextHours, timezone: nextTimezone };
      setSavedTick(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSavedTick(false), 2000);
    } catch (err) {
      setHours(confirmed.current.hours);
      setTimezone(confirmed.current.timezone);
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
      <p className="text-sm font-medium">When can people book?</p>
      <p className="text-[13px] text-ink-soft mt-1">30-minute calls. Only these days and hours are offered on your booking link.</p>

      <div role="group" aria-label="Days people can book" className="mt-2.5 flex flex-wrap gap-x-1.5 gap-y-2">
        {WEEKDAYS.map((d) => {
          const on = hours.days.includes(d.value);
          return (
            <button
              key={d.value}
              type="button"
              aria-pressed={on}
              onClick={() => toggleDay(d.value)}
              className="tap-44 h-9 min-w-[44px] px-3 rounded-full border text-[13px] font-medium"
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
          className="h-11 rounded-[10px] border px-2.5 text-[13px] lg:h-9"
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
          className="h-11 rounded-[10px] border px-2.5 text-[13px] lg:h-9"
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
          className="h-11 rounded-[10px] border px-2.5 text-[13px] lg:h-9"
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
      <p className="text-[13px] text-ink-soft mt-3">
        Which calendar it checks is under{" "}
        <Link href="/settings#connections" className="underline underline-offset-2 hover:text-ink">
          Connected apps
        </Link>
        .
      </p>
    </div>
  );
}
