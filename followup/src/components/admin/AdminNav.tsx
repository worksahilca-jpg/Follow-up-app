"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, FlaskConical, ListChecks, Users, ChartColumn, Briefcase, ArrowLeft } from "lucide-react";
import LogoMark from "@/components/LogoMark";

/**
 * The admin's places (founder, 2026-10-18: "organise the admin page so that
 * I can make decisions, train the model and all"). One list, like the app's
 * desk column: Decide first, then the places that hold the detail. On the
 * phone the same places are a row of chips under the title bar.
 */
const places = [
  { href: "/admin", label: "Decide", icon: Home },
  { href: "/admin/train", label: "Train", icon: BookOpen },
  { href: "/admin/tests", label: "Accuracy tests", icon: FlaskConical },
  // Night plan B1 + B3 (2026-10-31): every rule FollowUp follows, where it lives and the tests that prove it.
  { href: "/admin/rulebook", label: "Rulebook", icon: ListChecks },
  { href: "/admin/testers", label: "Testers", icon: Users },
  { href: "/admin/usage", label: "Usage", icon: ChartColumn },
  { href: "/admin/office", label: "The office", icon: Briefcase },
];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

const rowClass = "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors hover:bg-[var(--nav-on)]";
function rowStyle(active: boolean) {
  return {
    backgroundColor: active ? "var(--nav-on)" : undefined,
    color: active ? "var(--ink)" : "var(--ink-soft)",
    fontWeight: active ? 500 : 400,
  };
}

export default function AdminNav({ decisions }: { decisions: number }) {
  const pathname = usePathname();
  return (
    <>
      {/* Phone: the places as chips, scrolling sideways on their own. */}
      <nav aria-label="Admin" className="lg:hidden flex gap-2 overflow-x-auto px-5 pt-4 pb-1 sm:px-8">
        {places.map(({ href, label }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm whitespace-nowrap"
              style={{
                background: active ? "var(--accent)" : undefined,
                color: active ? "var(--on-accent)" : "var(--ink)",
                borderColor: active ? "var(--accent)" : "var(--line-strong)",
                fontWeight: 500,
              }}
            >
              {label}
              {href === "/admin" && decisions > 0 ? <span className="ml-1.5 tabular-nums opacity-70">{decisions}</span> : null}
            </Link>
          );
        })}
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm whitespace-nowrap text-ink-soft"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
          Back to FollowUp
        </Link>
      </nav>

      {/* Laptop: the desk column. */}
      <aside className="hidden lg:flex w-[224px] shrink-0 flex-col h-screen sticky top-0 px-3 pb-3 pt-2.5">
        <div className="flex h-9 items-center gap-2 px-2.5">
          <LogoMark height={17} />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">FollowUp</span>
          <span className="text-[13px] text-ink-faint">admin</span>
        </div>
        <nav aria-label="Admin" className="mt-5 flex flex-col gap-0.5">
          {places.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined} className={rowClass} style={rowStyle(active)}>
                <Icon className="h-4 w-4" strokeWidth={1.8} />
                <span className="flex-1">{label}</span>
                {href === "/admin" && decisions > 0 && <span className="text-[12.5px] text-ink-faint tabular-nums">{decisions}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto">
          <Link href="/dashboard" className={rowClass} style={rowStyle(false)}>
            <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
            Back to FollowUp
          </Link>
        </div>
      </aside>
    </>
  );
}
