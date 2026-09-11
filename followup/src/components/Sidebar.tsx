"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  GitBranch,
  Workflow,
  BarChart3,
  Activity,
  Settings,
  Compass,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import NotificationBell from "./NotificationBell";

const nav = [
  { href: "/dashboard", label: "Today", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: GitBranch },
  { href: "/workflows", label: "Workflows", icon: Workflow },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  // Below the lg breakpoint the sidebar itself becomes an off-canvas
  // drawer (see the `fixed ... lg:sticky` combo below) instead of a
  // permanent 240px column — there was previously no mobile treatment at
  // all here, which is why the whole authenticated app rendered like a
  // squeezed desktop layout on a phone rather than adapting.
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile-only top bar — the sidebar itself is off-screen below lg,
          so this is what actually gets you to it and to notifications. */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-30 flex items-center justify-between border-b border-line bg-card px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Compass className="h-5 w-5" style={{ color: "var(--rust)" }} />
          <span className="font-display text-lg">FollowUp</span>
        </Link>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-soft hover:bg-paper transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Backdrop, mobile only, closes the drawer on tap-outside. */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40"
          style={{ backgroundColor: "color-mix(in srgb, var(--ink) 40%, transparent)" }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={
          "w-60 shrink-0 border-r border-line bg-card flex flex-col h-screen fixed lg:sticky top-0 inset-y-0 left-0 z-50 transition-transform duration-200 " +
          (mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0")
        }
      >
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Compass className="h-5 w-5" style={{ color: "var(--rust)" }} />
            <span className="font-display text-lg" style={{ color: "var(--ink)" }}>
              FollowUp
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <div className="hidden lg:block">
              <NotificationBell />
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="lg:hidden h-8 w-8 rounded-lg flex items-center justify-center text-ink-soft hover:bg-paper transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <p className="text-xs text-ink-soft mt-1 truncate">{session?.user?.email ?? ""}</p>
      </div>
      <nav className="flex-1 px-3 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname?.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className="relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors"
              style={{
                backgroundColor: active ? "var(--rust-soft)" : "transparent",
                color: active ? "var(--rust)" : "var(--ink-soft)",
                fontWeight: active ? 600 : 500,
              }}
            >
              {/* A thin accent bar instead of relying on the tint alone to
                  say "you are here" — reads at a glance even for someone
                  scanning quickly, not just on close inspection. */}
              {active && (
                <span
                  className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full"
                  style={{ backgroundColor: "var(--rust)" }}
                  aria-hidden
                />
              )}
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      {/* research/product/2026-09-10-ux-simplification.md §2/§7.1: these
          two nag cards ("Not subscribed", "Gmail not connected") used to
          live here permanently, on every page — proportionally enormous
          in a slim sidebar, and only ever covered two of the several
          things a business might still need to finish setting up. That
          same signal now shows once, on Today, as SetupStrip — one
          unfinished step at a time instead of a growing stack of
          banners everywhere. */}
      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        className="flex items-center gap-2.5 rounded-lg px-3 py-2 mx-3 mb-4 text-sm text-ink-soft hover:bg-paper transition-colors"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
      </aside>
    </>
  );
}
