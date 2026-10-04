"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Sun, Users, Settings, LogOut } from "lucide-react";
import SidebarSearch from "@/components/app/SidebarSearch";
import NotificationBell from "./NotificationBell";
import FeedbackDialog from "./FeedbackDialog";
import LogoMark from "@/components/LogoMark";

/**
 * The app frame, as drawn on the canvas App, Today and TodayCalm boards
 * (design-decisions 2026-09-27).
 *
 * Desktop: a warm grey column. The business is the header, its first
 * letter in a black square. A search box, then two places: Today and
 * Customers. Settings sits at the foot. The current page is a white row
 * with a hairline edge.
 *
 * Phone: three tabs at the bottom (Today, Customers, Settings).
 *
 * Two places, not three (A-082, founder 2026-10-04: "today and inbox is
 * same no?"): Today is who needs you, Customers is everyone. Inbox showed
 * the same people a third time; /inbox now redirects to Customers.
 *
 * Pipeline, Follow-up plans, Analytics and Activity are no longer in the
 * menu. The pages still exist and are linked from Settings.
 */
type Counts = { today?: number; customers?: number };

const places = [
  { href: "/dashboard", label: "Today", icon: Sun, count: "today" as const },
  { href: "/leads", label: "Customers", icon: Users, count: "customers" as const },
];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(href + "/");
}

export default function Sidebar({ businessName = "", counts = {} }: { businessName?: string; counts?: Counts }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const initial = (businessName.trim()[0] ?? "F").toUpperCase();
  const settingsActive = isActive(pathname, "/settings");

  return (
    <>
      {/* Phone: a quiet top bar (brand and notifications) … */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-30 flex items-center justify-between border-b border-line bg-paper px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <LogoMark height={20} />
          <span className="text-base font-semibold">FollowUp</span>
        </Link>
        <NotificationBell align="right" />
      </header>

      {/* … and three tabs at the bottom, in thumb reach. */}
      <nav
        aria-label="Main"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 grid grid-cols-3 border-t border-line bg-paper px-6 pt-1.5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)" }}
      >
        {[places[0], places[1], { href: "/settings", label: "Settings", icon: Settings }].map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="flex min-h-12 flex-col items-center justify-center gap-1 text-[11.5px]"
              style={{ color: active ? "var(--ink)" : "#a8a29e", fontWeight: active ? 600 : 500 }}
            >
              <Icon className="h-6 w-6" strokeWidth={1.8} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Desktop column. */}
      <aside className="hidden lg:flex w-[232px] shrink-0 flex-col h-screen sticky top-0 border-r border-line bg-sidebar px-3 py-3.5">
        <div className="flex items-center justify-between gap-2">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5 h-9 px-1.5">
            <span
              aria-hidden
              className="h-6 w-6 shrink-0 rounded-[7px] inline-flex items-center justify-center text-xs font-semibold"
              style={{ background: "var(--accent)", color: "var(--on-accent)" }}
            >
              {initial}
            </span>
            <span className="truncate text-sm font-semibold text-ink">{businessName || "FollowUp"}</span>
          </Link>
          <NotificationBell />
        </div>

        <SidebarSearch />

        <nav aria-label="Main" className="mt-4 flex flex-col gap-0.5">
          {places.map(({ href, label, icon: Icon, count }) => {
            const active = isActive(pathname, href);
            const n = count ? counts[count] : undefined;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className="flex h-8 items-center gap-2.5 rounded-lg border px-2.5 text-sm"
                style={{
                  backgroundColor: active ? "var(--card)" : "transparent",
                  borderColor: active ? "var(--line)" : "transparent",
                  color: active ? "var(--ink)" : "var(--ink-soft)",
                  fontWeight: active ? 500 : 400,
                }}
              >
                <Icon className="h-4 w-4" strokeWidth={1.8} />
                <span className="flex-1">{label}</span>
                {typeof n === "number" && n > 0 && <span className="text-[12.5px] text-ink-faint tabular-nums">{n}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-0.5">
          <Link
            href="/settings"
            aria-current={settingsActive ? "page" : undefined}
            className="flex h-8 items-center gap-2.5 rounded-lg border px-2.5 text-sm"
            style={{
              backgroundColor: settingsActive ? "var(--card)" : "transparent",
              borderColor: settingsActive ? "var(--line)" : "transparent",
              color: settingsActive ? "var(--ink)" : "var(--ink-soft)",
              fontWeight: settingsActive ? 500 : 400,
            }}
          >
            <Settings className="h-4 w-4" strokeWidth={1.8} />
            Settings
          </Link>
          <FeedbackDialog />
          {/* Which account this is, always in view on the desk (founder,
              2026-10-04). The phone shows it in Settings, on Sign-ins. */}
          {session?.user?.email && (
            <p className="mt-2 truncate border-t border-line px-2.5 pt-2.5 text-[12.5px] text-ink-faint" title={session.user.email}>
              {session.user.email}
            </p>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-sm text-ink-soft hover:bg-card-2"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.8} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
