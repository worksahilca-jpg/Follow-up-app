"use client";

import { useEffect } from "react";

const KEY = "fu-seen-day";

/**
 * Tells FollowUp, once per browser day, that this person opened the app
 * (POST /api/account/seen, src/lib/appOpens.ts). Renders nothing. The day
 * is remembered in this browser so ordinary navigation sends nothing; if
 * storage is unavailable it simply asks, and the server's own once-a-day
 * guard keeps the record to one row.
 */
export default function SeenPing() {
  useEffect(() => {
    const today = new Date().toLocaleDateString("en-CA");
    try {
      if (window.localStorage.getItem(KEY) === today) return;
    } catch {
      // Private window or blocked storage: ask anyway.
    }
    fetch("/api/account/seen", { method: "POST" })
      .then((res) => {
        if (!res.ok) return;
        try {
          window.localStorage.setItem(KEY, today);
        } catch {
          // Nothing to remember it in; the server deduplicates.
        }
      })
      .catch(() => {
        // Best effort: never in the owner's way.
      });
  }, []);
  return null;
}
