"use client";

import { useEffect, useState } from "react";
import Switch from "@/components/Switch";

/**
 * "Only admins send" (design brain A-041, from the Mercury study's
 * approvals). Teammates keep writing, editing and holding replies; the
 * send itself is refused for anyone who isn't an admin
 * (POST /api/leads/[id]/send, via sendRefusal in @/lib/sendingControl).
 *
 * No optimistic flip: the screen shows what the server agreed to, since
 * the send route acts on the server's answer.
 */
export default function OnlyAdminsSendSetting({ onChange }: { onChange?: (on: boolean) => void } = {}) {
  const [loaded, setLoaded] = useState(false);
  const [on, setOn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/automation/settings")
      .then((r) => r.json())
      .then((d: { onlyAdminsSend?: boolean; isAdmin?: boolean }) => {
        setOn(Boolean(d.onlyAdminsSend));
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
        body: JSON.stringify({ onlyAdminsSend: next }),
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
    <div className="mt-4 box p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium text-sm">Only admins send</p>
          <p className="text-xs text-ink-soft mt-1">
            Teammates can write and edit replies. An admin sends them.
            {loaded && !isAdmin && " Only an admin can change this."}
          </p>
        </div>
        <Switch checked={on} onChange={() => save(!on)} disabled={!loaded || !isAdmin || busy} label="Only admins send" />
      </div>
      {error && (
        <p className="mt-3 text-xs" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
