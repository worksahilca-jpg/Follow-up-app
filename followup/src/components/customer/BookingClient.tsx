"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import s from "./customer.module.css";
import { CalendarIcon, Check, GlobeIcon, PoweredBy } from "./bits";
import { googleCalendarUrl, icsFile } from "@/lib/calendarLinks";

/**
 * The booking page a customer opens from a follow-up (design brain A-065).
 *
 * The business is the brand (A-017): its name is the header, FollowUp a
 * credit at the foot. One day at a time, then that day's times, all in the
 * customer's own time zone (the browser's, so nothing is guessed on the
 * server). Nothing is booked until "Book this time".
 *
 * It promises only what exists: there is no reschedule or cancel, so a
 * change is "reply to the message this link came in".
 */
type BookingData = { leadName: string; businessName: string; durationMinutes: number; bookingDays?: number[]; slots: string[] };
type Day = { key: string; date: Date; slots: string[] };

const CHANGE_LINE = "Need a different time? Reply to the message this link came in.";

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * The open days in order, with the days between them that are full, so a
 * gap reads as full rather than missing. A day the business never books
 * on (its booking days, A-078) is left out, as weekends were when the
 * hours were fixed: calling a closed Wednesday "full" would be untrue.
 */
function toDays(slots: string[], bookingDays: number[] = [1, 2, 3, 4, 5]): Day[] {
  if (slots.length === 0) return [];
  const byKey = new Map<string, string[]>();
  for (const iso of slots) {
    const k = dayKey(new Date(iso));
    byKey.set(k, [...(byKey.get(k) ?? []), iso]);
  }
  const first = new Date(slots[0]);
  const last = new Date(slots[slots.length - 1]);
  const cursor = new Date(first.getFullYear(), first.getMonth(), first.getDate());
  const end = new Date(last.getFullYear(), last.getMonth(), last.getDate());
  const days: Day[] = [];
  while (cursor <= end) {
    const k = dayKey(cursor);
    const open = byKey.get(k) ?? [];
    const offered = bookingDays.includes(cursor.getDay());
    if (open.length > 0 || offered) days.push({ key: k, date: new Date(cursor), slots: open });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

const timeFmt = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const longDay = (d: Date) => d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

function timeRange(start: Date, minutes: number): string {
  const end = new Date(start.getTime() + minutes * 60_000);
  const f = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
  return typeof f.formatRange === "function" ? f.formatRange(start, end) : `${f.format(start)} – ${f.format(end)}`;
}

function zoneName(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz ? tz.split("/").pop()!.replace(/_/g, " ") : "";
  } catch {
    return "";
  }
}

export default function BookingClient({ leadId }: { leadId: string }) {
  const [data, setData] = useState<BookingData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dayKeyPicked, setDayKeyPicked] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [bookedAt, setBookedAt] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/book/${leadId}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) throw new Error(json.message ?? "This booking link isn't valid.");
        setData(json);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "This booking link isn't valid."));
  }, [leadId]);

  useEffect(() => {
    load();
  }, [load]);

  const days = useMemo(() => toDays(data?.slots ?? [], data?.bookingDays), [data]);
  const day = days.find((d) => d.key === dayKeyPicked) ?? days.find((d) => d.slots.length > 0) ?? null;
  const morning = day ? day.slots.filter((iso) => new Date(iso).getHours() < 12) : [];
  const afternoon = day ? day.slots.filter((iso) => new Date(iso).getHours() >= 12) : [];
  const minutes = data?.durationMinutes ?? 30;
  const business = data?.businessName ?? "";
  const first = data?.leadName?.split(" ")[0] ?? "";
  // Only ever drawn once the times have loaded, in the browser, so this
  // is the customer's zone and never the server's.
  const zone = data ? zoneName() : "";

  async function book() {
    if (!picked) return;
    setBooking(true);
    setBookError(null);
    try {
      const res = await fetch(`/api/book/${leadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: picked }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Couldn't book that time. Pick another.");
      setBookedAt(json.scheduledAt);
    } catch (err) {
      setBookError(err instanceof Error ? err.message : "Couldn't book that time. Pick another.");
      // The time may have gone to someone else: show what is open now.
      setPicked(null);
      load();
    } finally {
      setBooking(false);
    }
  }

  function downloadIcs(startIso: string) {
    const file = icsFile(
      { title: `Call with ${business}`, startIso, minutes, details: CHANGE_LINE },
      `${leadId}-${startIso}@followupbase.io`
    );
    const url = URL.createObjectURL(new Blob([file], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "call.ics";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const timeButton = (iso: string) => {
    const at = new Date(iso);
    const on = picked === iso;
    return (
      <button
        key={iso}
        type="button"
        className={s.time}
        aria-pressed={on}
        aria-label={`${timeFmt(at)} on ${longDay(at)}`}
        onClick={() => {
          setPicked(iso);
          setBookError(null);
        }}
      >
        {on && <Check size={14} />}
        {timeFmt(at)}
      </button>
    );
  };

  let body: React.ReactNode;
  if (loadError) {
    body = (
      <div className={s.state}>
        <p className={s.doneP}>{loadError} Reply to the message this link came in, and ask for a new one.</p>
      </div>
    );
  } else if (!data) {
    body = <p className={s.lede}>Loading the open times…</p>;
  } else if (bookedAt) {
    const at = new Date(bookedAt);
    body = (
      <div className={s.state} role="status">
        <div className={s.tick}>
          <Check size={24} />
        </div>
        <h1 className={s.doneH}>You&apos;re booked.</h1>
        <p className={s.doneP}>
          {business} has your time. Need to change it? Reply to the message this link came in.
        </p>
        <div className={s.doneCard}>
          <div className={s.when} style={{ marginTop: 0 }}>
            <CalendarIcon />
            <div>
              <div className={s.whenDay}>{longDay(at)}</div>
              <div className={s.whenTime}>{timeRange(at, minutes)}, your time</div>
              <div className={s.whenTime} style={{ fontSize: 14.5 }}>
                With {business}
              </div>
            </div>
          </div>
          <div className={s.addCal}>
            <a className={s.ghost} href={googleCalendarUrl({ title: `Call with ${business}`, startIso: bookedAt, minutes, details: CHANGE_LINE })} target="_blank" rel="noopener noreferrer">
              Add to Google Calendar
            </a>
            <button type="button" className={s.ghost} style={{ font: "inherit", fontSize: 14.5, fontWeight: 500, cursor: "pointer" }} onClick={() => downloadIcs(bookedAt)}>
              Add to Apple / Outlook
            </button>
          </div>
        </div>
      </div>
    );
  } else {
    const pickedAt = picked ? new Date(picked) : null;
    body = (
      <div className={s.grid}>
        <div style={{ minWidth: 0 }}>
          <div className={`${s.mono} ${s.eyebrowWide}`}>Book a call</div>
          <h1 className={s.h1}>{first ? `Hi ${first}, pick a time that suits you.` : "Pick a time that suits you."}</h1>
          <p className={s.lede}>
            A {minutes}-minute call with {business}.
          </p>
          {zone && (
            <div className={s.zone}>
              <GlobeIcon />
              Times in your time zone · {zone}
            </div>
          )}

          {days.length === 0 ? (
            <p className={s.lede} style={{ marginTop: 32 }}>
              No open times in the next 10 days. Reply to the message this link came in, and {business} will find a time with you.
            </p>
          ) : (
            <>
              <div className={s.section}>
                <div className={s.mono}>Day</div>
                <div className={s.days} role="group" aria-label="Pick a day">
                  {days.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      className={s.day}
                      aria-pressed={day?.key === d.key}
                      disabled={d.slots.length === 0}
                      aria-label={`${longDay(d.date)}, ${d.slots.length === 0 ? "full" : `${d.slots.length} times open`}`}
                      onClick={() => {
                        setDayKeyPicked(d.key);
                        setPicked(null);
                        setBookError(null);
                      }}
                    >
                      <div className={s.dayName}>{d.date.toLocaleDateString(undefined, { weekday: "short" })}</div>
                      <div className={s.dayNum}>{d.date.getDate()}</div>
                      <div className={s.dayCount}>{d.slots.length === 0 ? "full" : `${d.slots.length} times`}</div>
                    </button>
                  ))}
                </div>
              </div>
              {morning.length > 0 && (
                <div className={s.timeGroup}>
                  <div className={s.mono}>Morning</div>
                  <div className={s.times}>{morning.map(timeButton)}</div>
                </div>
              )}
              {afternoon.length > 0 && (
                <div className={s.timeGroup}>
                  <div className={s.mono}>Afternoon</div>
                  <div className={s.times}>{afternoon.map(timeButton)}</div>
                </div>
              )}
              {bookError && (
                <p className={s.error} style={{ marginTop: 16 }} role="alert">
                  {bookError}
                </p>
              )}
            </>
          )}
        </div>

        {days.length > 0 && (
          <aside className={s.summary} aria-live="polite">
            <div className={s.mono}>Your call</div>
            {pickedAt ? (
              <>
                <div className={s.when}>
                  <CalendarIcon />
                  <div>
                    <div className={s.whenDay}>{longDay(pickedAt)}</div>
                    <div className={s.whenTime}>{timeRange(pickedAt, minutes)}, your time</div>
                  </div>
                </div>
                <button type="button" className={`${s.btn} ${s.summaryBtn}`} onClick={book} disabled={booking}>
                  {booking ? "Booking…" : "Book this time"}
                </button>
              </>
            ) : (
              <p className={s.summaryEmpty}>Pick a day, then a time. Nothing is booked until you press Book.</p>
            )}
            <p className={s.change}>{CHANGE_LINE}</p>
          </aside>
        )}

        {pickedAt && (
          <div className={s.bar}>
            <div className={s.barTop}>
              <span>
                {pickedAt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {timeFmt(pickedAt)}
              </span>
              <span>{minutes} min</span>
            </div>
            <button type="button" className={s.btn} onClick={book} disabled={booking}>
              {booking ? "Booking…" : "Book this time"}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div className={`${s.wrap} ${s.headerInner}`}>{business}</div>
      </header>
      <main className={`${s.wrap} ${s.main}`}>{body}</main>
      <footer className={`${s.wrap} ${s.footer}`}>
        <PoweredBy />
      </footer>
    </div>
  );
}
