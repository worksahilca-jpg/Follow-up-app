"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Sun, Users, History, ChartColumn, Settings, CircleHelp, ChevronsUpDown, LogOut, ArrowLeft, ChevronRight } from "lucide-react";
import { BarTitle } from "@/components/app/ScrollTitle";
import FeedbackDialog from "./FeedbackDialog";
import LogoMark from "@/components/LogoMark";
import { GROUP_ICON } from "@/components/app/settingsIcons";
import { SETTINGS_BRANCHES, SETTINGS_GROUPS, SETTINGS_MOVED, groupHref, settingsPlace } from "@/lib/settingsGroups";

/**
 * The app frame (step 1 of the app plan: A-209, A-211, A-212, A-213; the
 * map is design-brain/components/app-map.md). Simplified after the founder,
 * 2026-10-10: "simplify, copy Wispr if you want".
 *
 * Desk, like Wispr's sidebar: the brand at the top, then the four places
 * (Today, Customers, Activity, Results). No Search row (founder 2026-10-17:
 * "why there is search button on the top of today we dont eed it right ?"):
 * finding a person is what Customers' own search box is for.
 * Only Today keeps a count, because that's who needs you. Settings and Help
 * sit at the foot, and under them the account: the business name, which
 * opens your email, plan, team and Sign out. Settings opens as
 * a window over the page (src/app/(app)/@modal).
 *
 * Phone: four tabs at the bottom (Today, Customers, Activity, Results),
 * and Settings, with its word, at the top right.
 *
 * Activity took the bell's place (A-256): what FollowUp did, and the few
 * things only the bell used to say, in one list. Results is the Numbers
 * page (A-066), back in the menu (A-209).
 *
 * In Settings, the desk column becomes Settings' own tree (A-257, founder:
 * "every sub-branch should be in a branch in a stem"): Back to FollowUp,
 * the five parents, and the branches of the one you are in on a thin line.
 */
type Counts = { today?: number; customers?: number };

const places = [
  { href: "/dashboard", label: "Today", icon: Sun, count: "today" as const },
  { href: "/leads", label: "Customers", icon: Users },
  { href: "/activity", label: "Activity", icon: History },
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
  // A customer's page brings its own phone bar (Back, their name) and no tabs, like a chat app (A-222).
  const ownPhoneBar = /^\/leads\/[^/]+$/.test(pathname ?? "");
  // Settings, the follow-up plans page (its "When to check in" branch), "Try it yourself" (A-288), "What FollowUp
  // asks" (A-302) and "Tell FollowUp about your business" (A-312) show Settings' tree.
  const inSettings =
    settingsActive || isActive(pathname, "/workflows") || isActive(pathname, "/practice") || isActive(pathname, "/asks") || isActive(pathname, "/tell");

  return (
    <>
      {/* Phone: a quiet top bar (brand, and Settings with its word) … */}
      {!ownPhoneBar && (
        <header className="lg:hidden fixed top-0 inset-x-0 z-30 flex items-center justify-between border-b border-line bg-paper px-4 py-1.5">
          <Link href="/dashboard" className="flex min-h-11 items-center gap-2">
            <LogoMark height={20} />
            <span className="text-base font-semibold">FollowUp</span>
          </Link>
          {/* The page's title, once its own has scrolled away (A-264, iOS large titles). */}
          <BarTitle />
          <Link
            href="/settings"
            aria-current={inSettings ? "page" : undefined}
            className="flex h-11 items-center gap-1.5 rounded-[10px] px-2 text-[14px]"
            style={{ color: inSettings ? "var(--ink)" : "var(--ink-soft)", fontWeight: inSettings ? 600 : 400 }}
          >
            <Settings className="h-4 w-4" strokeWidth={1.8} />
            Settings
          </Link>
        </header>
      )}

      {/* … and four tabs at the bottom, in thumb reach. */}
      {!ownPhoneBar && (
        <nav
          aria-label="Main"
          className="lg:hidden fixed bottom-0 inset-x-0 z-30 grid grid-cols-4 border-t border-line bg-paper px-2 pt-1.5"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)" }}
        >
          {places.map(({ href, label, icon: Icon, count }) => {
            const active = isActive(pathname, href);
            // Today's count on its tab, as the desk column already shows it (A-283; founder: "yes do all 3").
            // A small charcoal badge on the icon, like an iPhone app's: no colour (R-128).
            const n = count ? counts[count] : undefined;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={n ? `${label}, ${n} waiting` : undefined}
                className="flex min-h-12 flex-col items-center justify-center gap-1 text-[12px]"
                style={{ color: active ? "var(--ink)" : "var(--state-checked)", fontWeight: active ? 600 : 500 }}
              >
                <span className="relative">
                  <Icon className="h-6 w-6" strokeWidth={1.8} />
                  {n ? (
                    <span
                      aria-hidden="true"
                      className="absolute -right-2.5 -top-1.5 flex h-[19px] min-w-[19px] items-center justify-center rounded-full px-1 text-[12px] font-semibold tabular-nums"
                      style={{ background: "var(--accent)", color: "var(--on-accent)", boxShadow: "0 0 0 2px var(--paper)" }}
                    >
                      {n > 99 ? "99+" : n}
                    </span>
                  ) : null}
                </span>
                {label}
              </Link>
            );
          })}
        </nav>
      )}

      {/* Desk column, on the frame. */}
      <aside className="hidden lg:flex w-[224px] shrink-0 flex-col h-screen sticky top-0 px-3 pb-3 pt-2.5">
        <div className="flex h-9 items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 rounded-lg px-2.5 py-1">
            <LogoMark height={17} />
            <span className="text-[15px] font-semibold tracking-[-0.01em]">FollowUp</span>
          </Link>
        </div>

        {inSettings ? (
          <SettingsTree pathname={pathname ?? ""} />
        ) : (
        <nav aria-label="Main" className="mt-5 flex flex-col gap-0.5">
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
        )}

        <div className="mt-auto flex flex-col gap-0.5">
          {!inSettings && (
            <Link href="/settings" className={rowClass} style={rowStyle(false)}>
              <Settings className="h-4 w-4" strokeWidth={1.8} />
              Settings
            </Link>
          )}
          {/* Help: tell the people building FollowUp what broke, from any screen. */}
          <FeedbackDialog label="Help" icon={CircleHelp} className={rowClass + " text-left"} />
          <div className="mx-2.5 my-2 border-t border-line" aria-hidden />
          <BusinessMenu initial={initial} name={businessName || "Your business"} />
        </div>
      </aside>
    </>
  );
}

/** The address's #part, followed as Settings moves (hash links, Back, and its own pushState steps). */
function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  window.addEventListener(SETTINGS_MOVED, onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(SETTINGS_MOVED, onChange);
  };
}

/**
 * Inside Settings a plain #link moves the page (it listens for the hash);
 * from the plans page, or to it, it's an ordinary page change.
 */
function TreeLink({ href, sameDoc, ...rest }: { href: string; sameDoc: boolean } & Omit<React.ComponentProps<"a">, "href">) {
  return sameDoc && href.startsWith("/settings#") ? <a href={href.slice("/settings".length)} {...rest} /> : <Link href={href} {...rest} />;
}

/** Settings' tree in the desk column (A-257): the parents, and the open one's branches on a stem. */
function SettingsTree({ pathname }: { pathname: string }) {
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => "");
  const { group, branch } = settingsPlace(pathname, hash);
  const sameDoc = pathname === "/settings";
  return (
    <nav aria-label="Settings" className="mt-5 flex flex-col gap-0.5">
      <Link href="/dashboard" className={rowClass} style={rowStyle(false)}>
        <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
        Back to FollowUp
      </Link>
      <p className="mb-1.5 mt-5 px-2.5 text-[20px] font-semibold tracking-[-0.01em] text-ink">Settings</p>
      {SETTINGS_GROUPS.map((g) => {
        const Icon = GROUP_ICON[g];
        const open = g === group;
        const branches = SETTINGS_BRANCHES[g];
        return (
          <div key={g}>
            <TreeLink
              href={groupHref(g)}
              sameDoc={sameDoc}
              aria-current={open && !branch ? "page" : undefined}
              aria-expanded={branches ? open : undefined}
              className={rowClass}
              style={{ ...rowStyle(open && !branch), color: open ? "var(--ink)" : "var(--ink-soft)" }}
            >
              <Icon className="h-4 w-4" strokeWidth={1.8} />
              <span className="flex-1">{g}</span>
              {branches && (
                <ChevronRight
                  aria-hidden="true"
                  className="h-3.5 w-3.5 text-ink-faint transition-transform"
                  style={open ? { transform: "rotate(90deg)" } : undefined}
                />
              )}
            </TreeLink>
            {open && branches && (
              <div className="mb-1.5 ml-[17px] mt-0.5 flex flex-col gap-0.5 border-l border-line pl-2.5">
                {branches.map((b) => (
                  <TreeLink
                    key={b.label}
                    href={b.href}
                    sameDoc={sameDoc}
                    aria-current={b.label === branch ? "page" : undefined}
                    className="flex h-8 items-center rounded-lg px-2.5 text-sm transition-colors hover:bg-[var(--nav-on)]"
                    style={rowStyle(b.label === branch)}
                  >
                    {b.label}
                  </TreeLink>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

/**
 * The business name, at the foot, opens a small menu upward: which account
 * this is (founder, 2026-10-04: "I am not able to see which id I am logged
 * in"), the plan, the team, and Sign out. Plan and Team open Settings at
 * their page.
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
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 w-full min-w-0 items-center gap-2.5 rounded-lg px-2 hover:bg-[var(--nav-on)]"
      >
        <span
          aria-hidden
          className="h-5 w-5 shrink-0 rounded-[6px] inline-flex items-center justify-center text-[12px] font-semibold"
          style={{ background: "var(--accent)", color: "var(--on-accent)" }}
        >
          {initial}
        </span>
        <span className="min-w-0 flex-1 truncate text-left text-sm font-medium text-ink">{name}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-ink-faint" strokeWidth={2} />
      </button>
      {open && (
        <div role="menu" aria-label={name} className="box-lift absolute bottom-11 left-0 z-50 w-[256px] p-1.5">
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
