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
  LogOut,
  Menu,
  X,
} from "lucide-react";
import NotificationBell from "./NotificationBell";
import FeedbackDialog from "./FeedbackDialog";

const nav = [
  { href: "/dashboard", label: "Today", icon: LayoutDashboard },
  { href: "/leads", label: "Customers", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: GitBranch },
  { href: "/workflows", label: "Follow-up plans", icon: Workflow },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

import LogoMark from "@/components/LogoMark";

export default function Sidebar({ businessName = "" }: { businessName?: string }) {
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
      <header className="lg:hidden fixed top-0 inset-x-0 z-30 flex items-center justify-between border-b border-line bg-paper px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <LogoMark height={20} />
          <span className="text-base font-semibold">FollowUp</span>
        </Link>
        <div className="flex items-center gap-1">
          <NotificationBell align="right" />
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-soft hover:bg-card-2 transition-colors"
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

      {/* The canvas App/Today boards: a warm grey column, the business as
          the header (its first letter in a black square), plain nav rows,
          and the current page as a white row with a hairline edge. */}
      <aside
        className={
          "w-60 shrink-0 border-r border-line bg-sidebar flex flex-col h-screen fixed lg:sticky top-0 inset-y-0 left-0 z-50 transition-transform duration-200 " +
          (mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0")
        }
      >
      <div className="px-3 pt-3.5 pb-2">
        <div className="flex items-center justify-between gap-2">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5 h-9 px-1.5">
            <span
              aria-hidden
              className="h-6 w-6 shrink-0 rounded-[7px] inline-flex items-center justify-center text-xs font-semibold"
              style={{ background: "var(--accent)", color: "var(--on-accent)" }}
            >
              {(businessName.trim()[0] ?? "F").toUpperCase()}
            </span>
            <span className="truncate text-sm font-semibold text-ink">{businessName || "FollowUp"}</span>
          </Link>
          <div className="flex items-center gap-1">
            <div className="hidden lg:block">
              <NotificationBell />
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="lg:hidden h-8 w-8 rounded-lg flex items-center justify-center text-ink-soft hover:bg-card-2 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <p className="px-1.5 text-xs text-ink-faint truncate">{session?.user?.email ?? ""}</p>
      </div>
      <nav className="flex-1 px-3 pt-3 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname?.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              aria-current={active ? "page" : undefined}
              className="flex items-center gap-2.5 h-8 rounded-lg px-2.5 text-sm border transition-colors"
              style={{
                backgroundColor: active ? "var(--card)" : "transparent",
                borderColor: active ? "var(--line)" : "transparent",
                color: active ? "var(--ink)" : "var(--ink-soft)",
                fontWeight: active ? 500 : 400,
              }}
            >
              <Icon className="h-4 w-4" strokeWidth={1.8} />
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
      <FeedbackDialog />
      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        className="flex items-center gap-2.5 h-8 rounded-lg px-2.5 mx-3 mb-4 text-sm text-ink-soft hover:bg-card-2 transition-colors"
      >
        <LogOut className="h-4 w-4" strokeWidth={1.8} />
        Sign out
      </button>
      </aside>
    </>
  );
}
