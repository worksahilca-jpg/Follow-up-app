"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  GitBranch,
  Settings,
  Sparkles,
} from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Today", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: GitBranch },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [gmailStatus, setGmailStatus] = useState<{ connected: boolean; email?: string } | null>(null);

  useEffect(() => {
    fetch("/api/integrations/gmail/status")
      .then((r) => r.json())
      .then(setGmailStatus)
      .catch(() => setGmailStatus({ connected: false }));
  }, [pathname]); // re-check on navigation so it updates right after connecting

  return (
    <aside className="w-60 shrink-0 border-r border-line bg-card flex flex-col h-screen sticky top-0">
      <div className="px-5 pt-6 pb-5">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" style={{ color: "var(--rust)" }} />
          <span className="font-display text-lg" style={{ color: "var(--ink)" }}>
            FollowUp
          </span>
        </Link>
        <p className="text-xs text-ink-soft mt-1">
          {gmailStatus?.connected ? gmailStatus.email : "Not connected"}
        </p>
      </div>
      <nav className="flex-1 px-3 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname?.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors"
              style={{
                backgroundColor: active ? "var(--rust-soft)" : "transparent",
                color: active ? "var(--rust)" : "var(--ink-soft)",
                fontWeight: active ? 600 : 500,
              }}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      {gmailStatus && !gmailStatus.connected && (
        <div className="p-4 mx-3 mb-4 rounded-lg" style={{ backgroundColor: "var(--slate-soft)" }}>
          <p className="text-xs font-medium" style={{ color: "var(--slate)" }}>
            Gmail not connected
          </p>
          <p className="text-xs mt-1 text-ink-soft">
            Connect Gmail in Settings to pull in your real leads.
          </p>
        </div>
      )}
    </aside>
  );
}
