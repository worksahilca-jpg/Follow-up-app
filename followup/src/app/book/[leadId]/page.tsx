"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Zap, Calendar, Check } from "lucide-react";

interface BookingData {
  leadName: string;
  businessName: string;
  durationMinutes: number;
  slots: string[];
}

// Public, unauthenticated page — a lead's own booking link, not a
// FollowUp-user page. Fully client-rendered: the interesting part is
// picking a slot in the VIEWER's own local time (via toLocaleString, no
// server-side timezone guessing needed) and confirming it.
export default function BookingPage() {
  const params = useParams<{ leadId: string }>();
  const leadId = params.leadId;

  const [data, setData] = useState<BookingData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/book/${leadId}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) throw new Error(json.message ?? "This booking link isn't valid.");
        setData(json);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "This booking link isn't valid."));
  }, [leadId]);

  // Group slots by calendar day in the viewer's own timezone.
  const byDay = useMemo(() => {
    if (!data) return [];
    const groups = new Map<string, string[]>();
    for (const iso of data.slots) {
      const d = new Date(iso);
      const dayLabel = d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
      if (!groups.has(dayLabel)) groups.set(dayLabel, []);
      groups.get(dayLabel)!.push(iso);
    }
    return [...groups.entries()];
  }, [data]);

  async function confirm() {
    if (!selected) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      const res = await fetch(`/api/book/${leadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: selected }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Couldn't confirm — try another time.");
      setConfirmedAt(json.scheduledAt);
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "Couldn't confirm — try another time.");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-line">
        <div className="max-w-2xl mx-auto px-6 py-5 flex items-center gap-2">
          <Zap className="h-5 w-5" style={{ color: "var(--rust)" }} />
          <span className="font-display text-lg">FollowUp</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-16 flex-1 w-full">
        {loadError && (
          <div className="text-center py-16">
            <p className="text-ink-soft">{loadError}</p>
          </div>
        )}

        {!loadError && !data && <p className="text-ink-soft text-center py-16">Loading…</p>}

        {data && !confirmedAt && (
          <>
            <h1 className="font-display text-3xl">Book a call with {data.businessName}</h1>
            <p className="text-ink-soft mt-2">
              Hi {data.leadName.split(" ")[0]} — pick a time that works for you. All times shown in your own
              timezone. {data.durationMinutes} minutes.
            </p>

            {byDay.length === 0 && (
              <p className="text-sm text-ink-soft mt-8">No open times in the next couple weeks — check back soon.</p>
            )}

            <div className="mt-8 space-y-6">
              {byDay.map(([day, isoSlots]) => (
                <div key={day}>
                  <h2 className="text-sm font-semibold flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-ink-soft" />
                    {day}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {isoSlots.map((iso) => (
                      <button
                        key={iso}
                        onClick={() => setSelected(iso)}
                        className="rounded-lg border px-3 py-1.5 text-sm font-medium"
                        style={{
                          borderColor: selected === iso ? "var(--rust)" : "var(--line)",
                          backgroundColor: selected === iso ? "var(--rust-soft)" : "transparent",
                          color: selected === iso ? "var(--rust)" : "var(--ink)",
                        }}
                      >
                        {new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {selected && (
              <div className="mt-8 pt-6 border-t border-line flex items-center gap-3">
                <button
                  onClick={confirm}
                  disabled={confirming}
                  className="rounded-lg px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                  style={{ backgroundColor: "var(--rust)" }}
                >
                  {confirming
                    ? "Booking…"
                    : `Confirm ${new Date(selected).toLocaleString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}`}
                </button>
              </div>
            )}
            {confirmError && (
              <p className="text-sm mt-3" style={{ color: "var(--rust)" }}>
                {confirmError}
              </p>
            )}
          </>
        )}

        {confirmedAt && (
          <div className="text-center py-16">
            <div
              className="mx-auto h-14 w-14 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: "var(--sage-soft)", color: "var(--sage)" }}
            >
              <Check className="h-7 w-7" />
            </div>
            <h1 className="font-display text-2xl mt-5">You&apos;re booked</h1>
            <p className="text-ink-soft mt-2">
              {new Date(confirmedAt).toLocaleString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
