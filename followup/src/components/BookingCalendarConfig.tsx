"use client";

import { useEffect, useState } from "react";
import { Calendar, Check } from "lucide-react";

type Source = "followup" | "google";

/**
 * "Booking calendar" section of Settings — where a lead's booking link
 * (/book/[leadId]) checks availability and where a confirmed booking
 * actually lands. "FollowUp's calendar" is the original, always-available
 * behavior (fixed business hours, tracked entirely inside FollowUp).
 * "My Google Calendar" additionally reads the owner's real busy times
 * (see getGoogleCalendarBusyTimes in src/lib/integrations/gmail.ts) so a
 * lead can never book over a meeting that's already on it — gated on
 * Gmail being connected, since there'd be nothing to read otherwise.
 */
export default function BookingCalendarConfig() {
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<Source>("followup");
  const [gmailConnected, setGmailConnected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/business/booking-source")
      .then((r) => r.json())
      .then((data: { success: boolean; bookingCalendarSource?: Source; gmailConnected?: boolean }) => {
        if (data.success) {
          setSource(data.bookingCalendarSource ?? "followup");
          setGmailConnected(!!data.gmailConnected);
        }
      })
      .finally(() => setLoading(false));
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

  if (loading) return null;

  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}>
          <Calendar className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Where should FollowUp book meetings?</p>
          <p className="text-xs text-ink-soft mt-1">
            This decides what a lead sees as open on their booking link, and where a confirmed booking actually goes.
          </p>

          {saveError && (
            <p className="text-xs mt-2" style={{ color: "var(--coral)" }}>
              {saveError}
            </p>
          )}

          <div className="mt-3 space-y-2">
            <button
              onClick={() => choose("followup")}
              disabled={saving}
              className="w-full text-left rounded-lg border px-3 py-2.5 text-xs disabled:opacity-60"
              style={{ borderColor: source === "followup" ? "var(--rust)" : "var(--line)", backgroundColor: source === "followup" ? "var(--rust-soft)" : "transparent" }}
            >
              <span className="font-medium flex items-center gap-1.5">
                {source === "followup" && <Check className="h-3.5 w-3.5" style={{ color: "var(--rust)" }} />}
                FollowUp&apos;s built-in calendar
              </span>
              <span className="block text-ink-soft mt-0.5">Fixed business hours, tracked entirely inside FollowUp. Works with no calendar connected.</span>
            </button>

            <button
              onClick={() => choose("google")}
              disabled={saving}
              className="w-full text-left rounded-lg border px-3 py-2.5 text-xs disabled:opacity-60"
              style={{ borderColor: source === "google" ? "var(--rust)" : "var(--line)", backgroundColor: source === "google" ? "var(--rust-soft)" : "transparent" }}
            >
              <span className="font-medium flex items-center gap-1.5">
                {source === "google" && <Check className="h-3.5 w-3.5" style={{ color: "var(--rust)" }} />}
                My Google Calendar
              </span>
              <span className="block text-ink-soft mt-0.5">
                {gmailConnected
                  ? "Checks your real busy times too — a lead can never book over a meeting you already have. Confirmed bookings land directly on your calendar."
                  : "Requires Gmail connected above."}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
