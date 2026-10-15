"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ChevronLeft, Info } from "lucide-react";
import AppWindow from "./AppWindow";
import { canSlide, navigateWithTransition } from "./PushNav";

const DESK = "(min-width: 64rem)";
/** A back-swipe starts this close to the left edge (px). */
const EDGE = 24;
/** It commits past this share of the width, or at this speed (px/ms). */
const COMMIT_SHARE = 1 / 3;
const FLICK = 0.5;

function onDeskChange(cb: () => void) {
  const mq = window.matchMedia(DESK);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * Swipe back from the left edge, like iOS (A-264): the page follows the
 * thumb; let go past a third of the way, or with a flick, and it slides out
 * to the Customers list; otherwise it springs back. The page is the app's
 * <main> (globals.css, main[data-swipe]). Only on a phone that can slide.
 */
function useEdgeSwipeBack(to: string) {
  const router = useRouter();
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastT = 0;
    let dx = 0;
    let velocity = 0;
    let mode: "off" | "undecided" | "swipe" = "off";

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (e.touches.length !== 1 || t.clientX > EDGE || !canSlide()) {
        mode = "off";
        return;
      }
      startX = lastX = t.clientX;
      startY = t.clientY;
      lastT = e.timeStamp;
      dx = 0;
      velocity = 0;
      mode = "undecided";
    };
    const onMove = (e: TouchEvent) => {
      if (mode === "off") return;
      const t = e.touches[0];
      if (mode === "undecided") {
        const mx = t.clientX - startX;
        const my = t.clientY - startY;
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
        if (mx <= Math.abs(my)) {
          mode = "off";
          return;
        }
        mode = "swipe";
        main.dataset.swipe = "dragging";
      }
      e.preventDefault();
      dx = Math.max(0, t.clientX - startX);
      const dt = e.timeStamp - lastT;
      if (dt > 0) velocity = (t.clientX - lastX) / dt;
      lastX = t.clientX;
      lastT = e.timeStamp;
      main.style.setProperty("--swipe-x", `${dx}px`);
    };
    const onEnd = () => {
      if (mode !== "swipe") {
        mode = "off";
        return;
      }
      mode = "off";
      const width = window.innerWidth || 1;
      if (dx > width * COMMIT_SHARE || velocity > FLICK) {
        // The page leaves from where the thumb let go; the view transition (PushNav.tsx) carries on from there.
        delete main.dataset.swipe;
        main.style.removeProperty("--swipe-x");
        const left = Math.max(0.3, 1 - dx / width);
        navigateWithTransition(router, "pop", to, { "--swipe-x": `${dx}px`, "--pop-ms": `${Math.round(320 * left)}ms` });
      } else {
        main.dataset.swipe = "settling";
        main.style.setProperty("--swipe-x", "0px");
        window.setTimeout(() => {
          if (main.dataset.swipe === "settling") {
            delete main.dataset.swipe;
            main.style.removeProperty("--swipe-x");
          }
        }, 400);
      }
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
      delete main.dataset.swipe;
      main.style.removeProperty("--swipe-x");
    };
  }, [router, to]);
}

/**
 * A customer's page on a phone works like a chat app (A-222; founder
 * 2026-10-10: "we cannot just fit the desktop in this mobile one"): its own
 * bar on top (Back, their name, an info button) in place of the app's, and
 * the computer's side column in a sheet behind the info button instead of
 * stacked under the chat.
 *
 * On a computer nothing changes: the side column sits beside the chat.
 * The column renders in one place at a time (beside the chat, or in the
 * sheet), so nothing in it is ever on the page twice.
 */
export default function CustomerSide({ name, line, children }: { name: string; line: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  // The server draws the computer's layout; the phone's sheet only exists once open.
  const desk = useSyncExternalStore(onDeskChange, () => window.matchMedia(DESK).matches, () => true);
  const first = name.split(" ")[0] || name;
  const inSheet = open && !desk;
  useEdgeSwipeBack("/leads");

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-30 flex h-[57px] items-center gap-0.5 border-b border-line bg-paper pl-0.5 pr-1.5 lg:hidden">
        <Link href="/leads" data-nav="pop" aria-label="Back to Customers" className="grid h-11 w-11 shrink-0 place-items-center">
          <ChevronLeft className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="title-serif truncate text-[19px] leading-tight">{name}</p>
          <p className="flex min-w-0 items-center gap-1.5 text-[12px] text-ink-faint">{line}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`About ${first}`}
          aria-haspopup="dialog"
          className="grid h-11 w-11 shrink-0 place-items-center text-ink-soft"
        >
          <Info className="h-[22px] w-[22px]" strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>

      {inSheet ? (
        <AppWindow label={`About ${first}`} size="small" onClose={() => setOpen(false)}>
          <h2 className="title-serif text-[22px] leading-tight">About {first}</h2>
          <div className="mt-4 grid min-w-0 gap-[18px]">{children}</div>
        </AppWindow>
      ) : (
        <aside className="hidden min-w-0 content-start gap-[18px] lg:grid lg:pt-1.5">{children}</aside>
      )}
    </>
  );
}
