"use client";

/**
 * The one place FollowUp's Notification rows actually get read — see
 * src/lib/engagement.ts for the only thing that creates them today (a
 * lead in rapid back-and-forth, right now, worth a human's attention).
 * Polls rather than pushes, on purpose: this is a small, occasional
 * signal, not a chat app — a 45s poll is plenty timely for "someone's
 * actively texting" without needing a websocket.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

interface NotificationItem {
  id: string;
  leadId: string | null;
  message: string;
  read: boolean;
  createdAt: string;
}

const POLL_MS = 45_000;

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.round(diffMs / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  function load() {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data: { success: boolean; notifications?: NotificationItem[]; unreadCount?: number }) => {
        if (data.success) {
          setNotifications(data.notifications ?? []);
          setUnreadCount(data.unreadCount ?? 0);
        }
      })
      .catch(() => {});
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  // Close on an outside click — a dropdown that only closes via its own
  // button is a common small annoyance worth just avoiding.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    } catch {
      // Best-effort — a failed mark-read isn't worth surfacing an error for.
    }
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
    } catch {
      // Best-effort, same as above.
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative h-8 w-8 rounded-lg flex items-center justify-center text-ink-soft hover:bg-paper transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span
            className="absolute top-0.5 right-0.5 h-4 min-w-4 px-1 rounded-full text-[10px] font-semibold flex items-center justify-center text-white"
            style={{ backgroundColor: "var(--rust)" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-10 z-50 w-80 rounded-xl border border-line bg-card shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-line">
            <span className="text-sm font-medium">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs font-medium" style={{ color: "var(--rust)" }}>
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 && (
              <p className="px-4 py-6 text-sm text-ink-soft text-center">Nothing yet.</p>
            )}
            {notifications.map((n) => {
              const content = (
                <div
                  className="px-4 py-3 text-sm border-b border-line last:border-0 hover:bg-paper transition-colors"
                  style={{ backgroundColor: n.read ? "transparent" : "var(--rust-soft)" }}
                >
                  <p className="text-ink leading-snug">{n.message}</p>
                  <p className="text-xs text-ink-soft mt-1">{timeAgo(n.createdAt)}</p>
                </div>
              );
              return n.leadId ? (
                <Link key={n.id} href={`/leads/${n.leadId}`} onClick={() => !n.read && markRead(n.id)}>
                  {content}
                </Link>
              ) : (
                <button key={n.id} onClick={() => !n.read && markRead(n.id)} className="block w-full text-left">
                  {content}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
