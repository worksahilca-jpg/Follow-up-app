"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";

/**
 * A page pushes in like iOS (A-264, founder 2026-10-15: "the feel of this
 * product as Apple"). On a phone, a link marked `data-nav="push"` slides
 * its page in from the right; one marked `data-nav="pop"` slides the
 * current page out again. A link may carry `data-phone-href`: the page a
 * phone opens instead (a customer's own page, A-222, not the panel beside
 * the list, which is the computer's shape).
 *
 * How: the browser's view transition (`document.startViewTransition`)
 * snapshots the page, the navigation runs, and the two snapshots slide
 * (globals.css, html[data-nav]). Nothing re-renders mid-flight, so the
 * move stays at 60 frames. Where the browser has no view transitions, or
 * the owner asked for less motion, or this is a computer, the link works
 * as it always did.
 *
 * The navigation is a normal router push; the transition waits for the
 * URL to change (the page's own loading shape, A-254, commits almost at
 * once) and never longer than a moment, so a slow network can't freeze
 * the screen.
 */
export const PHONE = "(max-width: 63.99rem)";
const LESS = "(prefers-reduced-motion: reduce)";
const MAX_WAIT_MS = 1200;

type Dir = "push" | "pop";
type Router = { push: (href: string) => void };
type ViewTransitionDocument = Document & { startViewTransition?: (update: () => Promise<void>) => { finished: Promise<void> } };

/** Resolves the transition in flight once the URL has changed (PushNav's effect calls it). */
let pending: (() => void) | null = null;

/** True when this navigation can slide: a phone, a browser with view transitions, no "less motion" ask. */
export function canSlide(): boolean {
  const doc = document as ViewTransitionDocument;
  return Boolean(doc.startViewTransition) && window.matchMedia(PHONE).matches && !window.matchMedia(LESS).matches;
}

/**
 * Go to `to` with the page sliding `dir`. Falls back to a plain push where
 * it can't slide. `vars` are custom properties set on <html> for the run
 * (a back-swipe hands over where the thumb left the page).
 */
export function navigateWithTransition(router: Router, dir: Dir, to: string, vars: Record<string, string> = {}) {
  const doc = document as ViewTransitionDocument;
  if (!canSlide() || !doc.startViewTransition) {
    router.push(to);
    return;
  }
  const root = document.documentElement;
  root.dataset.nav = dir;
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  pending?.();
  const transition = doc.startViewTransition(
    () =>
      new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          if (pending === finish) pending = null;
          resolve();
        };
        pending = finish;
        setTimeout(finish, MAX_WAIT_MS);
        router.push(to);
      })
  );
  transition.finished.finally(() => {
    delete root.dataset.nav;
    for (const k of Object.keys(vars)) root.style.removeProperty(k);
  });
}

export default function PushNav() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const key = `${pathname}?${search.toString()}`;

  // The URL changed: the new page is in the document, the transition may run.
  useEffect(() => {
    pending?.();
  }, [key]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href][data-nav]");
      if (!(a instanceof HTMLAnchorElement)) return;
      const dir = a.dataset.nav;
      if (dir !== "push" && dir !== "pop") return;
      if (!window.matchMedia(PHONE).matches) return;
      const href = a.dataset.phoneHref || a.getAttribute("href") || "";
      const url = new URL(href, location.href);
      if (url.origin !== location.origin) return;
      const to = url.pathname + url.search;
      if (!canSlide()) {
        // No slide here; a phone-only destination still needs the push.
        if (a.dataset.phoneHref) {
          e.preventDefault();
          router.push(to);
        }
        return;
      }
      e.preventDefault();
      navigateWithTransition(router, dir, to);
    };
    // Capture phase: this runs before the link's own click handler, which steps aside once the event is prevented.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  return null;
}
