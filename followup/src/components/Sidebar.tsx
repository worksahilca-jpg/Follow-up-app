"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Sun, Users, ChartColumn, Settings, CircleHelp, ChevronDown, LogOut } from "lucide-react";
import SidebarSearch from "@/components/app/SidebarSearch";
import NotificationBell from "./NotificationBell";
import FeedbackDialog from "./FeedbackDialog";
import LogoMark from "@/components/LogoMark";

/**
 * The app frame (step 1 of the app plan: A-209, A-211, A-212, A-213; the
 * map is design-brain/components/app-map.md).
 *
 * Desk: the sidebar sits on a quiet frame beside the page's white sheet.
 * Three places, each with a word: Today, Customers, Results. Only Today
 * keeps a count, because that's who needs you. Settings and Help sit at
 * the foot. Your email, plan, team and Sign out live in a menu under the
 * business name, so the foot stays short. Settings opens as a window over
 * the page (src/app/(app)/@modal).
 *
 * Phone: four tabs at the bottom (Today, Customers, Results, Settings),
 * and "Alerts" written beside the bell at the top.
 *
 * Results is the Numbers page (A-066), back in the menu (A-209).
 */
type Counts = { today?: number; customers?: number };

const places = [
  { href: "/dashboard", label: "Today", icon: Sun, count: "today" as const },
  { href: "/leads", label: "Customers", icon: Users },
  { href: "/analytics", label: "Results", icon: ChartColumn },
];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(href + "/");
}

/** A row in the desk sidebar: icon and word; the place you're in is a soft fill. */
const rowClass = "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors hover:bg-[var(--nav-on)]";
function rowStyle(active: boolean) {
  return {
    backgroundColor: active ? "var(--nav-on)" : undefined,
    color: active ? "var(--ink)" : "var(--ink-soft)",
    fontWeight: active ? 500 : 400,
  };
}

export default function Sidebar({ businessName = "", counts = {} }: { businessName?: string; counts?: Counts }) {
  const pathname = usePathname();
  const initial = (businessName.trim()[0] ?? "F").toUpperCase();
  const settingsActive = isActive(pathname, "/settings");

  return (
    <>
      {/* Phone: a quiet top bar (brand, and the bell with its word) … */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-30 flex items-center justify-between border-b border-line bg-paper px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <LogoMark height={20} />
          <span className="text-base font-semibold">FollowUp</span>
        </Link>
        <NotificationBell align="right" label="Alerts" />
      </header>

      {/* … and four tabs at the bottom, in thumb reach. */}
      <nav
        aria-label="Main"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 grid grid-cols-4 border-t border-line bg-paper px-2 pt-1.5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)" }}
      >
        {[...places, { href: "/settings", label: "Settings", icon: Settings }].map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="flex min-h-12 flex-col items-center justify-center gap-1 text-[11.5px]"
              style={{ color: active ? "var(--ink)" : "var(--state-checked)", fontWeight: active ? 600 : 500 }}
            >
              <Icon className="h-6 w-6" strokeWidth={1.8} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Desk column, on the frame. */}
      <aside className="hidden lg:flex w-[232px] shrink-0 flex-col h-screen sticky top-0 px-3 py-3.5">
        <div className="flex items-center justify-between gap-1">
          <BusinessMenu initial={initial} name={businessName || "FollowUp"} />
          <NotificationBell />
        </div>

        <SidebarSearch />

        <nav aria-label="Main" className="mt-4 flex flex-col gap-0.5">
          {places.map(({ href, label, icon: Icon, count }) => {
            const active = isActive(pathname, href);
            const n = count ? counts[count] : undefined;
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined} className={rowClass} style={rowStyle(active)}>
                <Icon className="h-4 w-4" strokeWidth={1.8} />
                <span className="flex-1">{label}</span>
                {typeof n === "number" && n > 0 && <span className="text-[12.5px] text-ink-faint tabular-nums">{n}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-0.5">
          <Link href="/settings" aria-current={settingsActive ? "page" : undefined} className={rowClass} style={rowStyle(settingsActive)}>
            <Settings className="h-4 w-4" strokeWidth={1.8} />
            Settings
          </Link>
          {/* Help: tell the people building FollowUp what broke, from any screen. */}
          <FeedbackDialog label="Help" icon={CircleHelp} className={rowClass + " text-left"} />
        </div>
      </aside>
    </>
  );
}

/**
 * The business name opens a small menu: which account this is (founder,
 * 2026-10-04: "I am not able to see which id I am logged in"), the plan,
 * the team, and Sign out. Plan and Team open Settings at their page.
 */
function BusinessMenu({ initial, name }: { initial: string; name: string }) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "flex h-9 w-full items-center justify-between gap-3 rounded-[9px] px-2.5 text-left text-sm text-ink hover:bg-[var(--nav-on)]";
  return (
    <div className="relative min-w-0 flex-1" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 w-full min-w-0 items-center gap-2.5 rounded-lg px-1.5 hover:bg-[var(--nav-on)]"
      >
        <span
          aria-hidden
          className="h-6 w-6 shrink-0 rounded-[7px] inline-flex items-center justify-center text-xs font-semibold"
          style={{ background: "var(--accent)", color: "var(--on-accent)" }}
        >
          {initial}
        </span>
        <span className="min-w-0 truncate text-sm font-semibold text-ink">{name}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-faint" strokeWidth={2} />
      </button>
      {open && (
        <div role="menu" aria-label={name} className="box-lift absolute left-0 top-11 z-50 w-[256px] p-1.5">
          {session?.user?.email && (
            <p className="truncate px-2.5 pb-1.5 pt-2 text-[12.5px] text-ink-faint" title={session.user.email}>
              {session.user.email}
            </p>
          )}
          <Link role="menuitem" href="/settings#billing" className={item} onClick={() => setOpen(false)}>
            Your plan
          </Link>
          <Link role="menuitem" href="/settings#team" className={item} onClick={() => setOpen(false)}>
            Team
          </Link>
          <div className="my-1 border-t border-line" />
          <button role="menuitem" type="button" className={item} onClick={() => signOut({ callbackUrl: "/" })}>
            Sign out
            <LogOut className="h-4 w-4 text-ink-faint" strokeWidth={1.8} />
          </button>
        </div>
      )}
    </div>
  );
}
