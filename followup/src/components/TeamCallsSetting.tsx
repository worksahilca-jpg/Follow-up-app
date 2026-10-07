"use client";

import { useEffect, useState } from "react";
import Switch from "@/components/Switch";

/**
 * "Your team calls customers" (design brain A-103, the realtor team pilot).
 * Off by default. On: each customer with a phone number gets the Call box
 * (No answer, Already spoke), Today lists the calls to make, and admins see
 * "This week" on this page. Admins only; the server checks (requireAdmin).
 *
 * No optimistic flip, like Only admins send: the screen shows what the
 * server agreed to.
 */
export default function TeamCallsSetting({ onChange, bare = false }: { onChange?: (on: boolean) => void; /** Inside a canvas card: no box of its own. */ bare?: boolean } = {}) {
  const [loaded, setLoaded] = useState(false);
  const [on, setOn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/automation/settings")
      .then((r) => r.json())
      .then((d: { teamCalls?: boolean; isAdmin?: boolean }) => {
        setOn(Boolean(d.teamCalls));
        setIsAdmin(Boolean(d.isAdmin));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  async function save(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/automation/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamCalls: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(typeof data.message === "string" ? data.message : "Couldn't save. Try again.");
        return;
      }
      setOn(next);
      onChange?.(next);
    } catch {
      setError("Couldn't reach FollowUp. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="team-calls" className={(bare ? "py-2" : "mt-4 box p-5") + " scroll-mt-16"}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className={bare ? "text-base" : "font-medium text-sm"}>Your team calls customers</p>
          <p className="text-[13px] text-ink-soft mt-1">
            Adds a Call button to each customer, and the calls to make on Today.
            {loaded && !isAdmin && " Only an admin can change this."}
          </p>
        </div>
        <Switch checked={on} onChange={() => save(!on)} disabled={!loaded || !isAdmin || busy} label="Your team calls customers" />
      </div>
      {error && (
        <p className="mt-3 text-[13px]" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
