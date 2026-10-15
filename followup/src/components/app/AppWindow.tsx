"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * A window that opens over the page (A-213, founder 2026-10-10: "see how
 * they pop up a new window for settings and stuff").
 *
 * Desk: centred, the page dimmed behind it. Phone: a sheet that rises from
 * the bottom. Esc, the ×, or a click on the dimmed page closes it. Focus
 * moves into the window and stays there until it closes, then goes back to
 * what opened it.
 *
 * It leaves the way it came (A-264, the Apple feel): the phone's sheet
 * slides back down and can be pulled down by the thumb, from the handle or
 * from the top of its content; let go past a third of the way, or with a
 * flick, and it goes; otherwise it springs back. The computer's window
 * fades and settles a touch smaller. The page behind lightens with it.
 *
 * The dimmed page is a plain see-through layer, never a blur (brand
 * principle "Every frame is smooth": a blur over the page is redrawn every
 * frame). Only `translate`, `scale` and opacity ever move.
 *
 * It renders into <body>, so a window opened from inside the sidebar (Search)
 * or a page is never painted under the page: the sidebar is sticky, and a
 * sticky box keeps whatever is inside it in its own layer.
 */
const InWindow = createContext(false);

/** True inside a window, so a screen that is also a page (Settings) can act like a window. */
export function useInWindow(): boolean {
  return useContext(InWindow);
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const PHONE = "(max-width: 63.99rem)";
const LESS = "(prefers-reduced-motion: reduce)";
/** How far the sheet has to be pulled (px), or how fast (px/ms), to go. */
const PULL_TO_CLOSE = 120;
const FLICK = 0.6;

type Props = {
  label: string;
  onClose: () => void;
  size?: "large" | "small";
  children: React.ReactNode;
};

const noop = () => () => {};

export default function AppWindow(props: Props) {
  // true in the browser, false while rendering on the server (no <body> to portal into there).
  const inBrowser = useSyncExternalStore(noop, () => true, () => false);
  return inBrowser ? createPortal(<Window {...props} />, document.body) : null;
}

/** How long the leaving takes, so the parent is told once it has left. */
function leaveMs(): number {
  if (window.matchMedia(LESS).matches) return 0;
  return window.matchMedia(PHONE).matches ? 300 : 180;
}

function Window({ label, onClose, size = "large", children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  const [closing, setClosing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const leaving = useRef(false);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  // Leave first, then tell the parent (which unmounts the window).
  const requestClose = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    const ms = leaveMs();
    if (ms === 0) {
      close.current();
      return;
    }
    setClosing(true);
    window.setTimeout(() => close.current(), ms);
  }, []);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const win = ref.current;
    // A field asked for focus first (autoFocus) keeps it; otherwise the window takes it.
    if (win && !win.contains(document.activeElement)) win.focus();
    const onKey = (e: KeyboardEvent) => {
      // A window opened from inside another (a connection's window over the Settings window, A-253): only the top
      // one answers, so Esc closes it and not Settings too. Windows render into <body> in the order they open.
      const open = document.querySelectorAll(".app-win");
      if (win && open[open.length - 1] !== win) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        requestClose();
        return;
      }
      if (e.key !== "Tab" || !win) return;
      const items = Array.from(win.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === win)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    // The page behind stays still while the window is open.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, [requestClose]);

  // The phone's sheet follows the thumb. A pull starts on the handle, or on the
  // content while it sits at its top; a pull upward is the content scrolling.
  useEffect(() => {
    const win = ref.current;
    if (!win) return;
    let startY = 0;
    let lastY = 0;
    let lastT = 0;
    let dy = 0;
    let velocity = 0;
    let mode: "undecided" | "pull" | "scroll" | "off" = "off";
    const body = () => win.querySelector<HTMLElement>(".app-win__body");

    const onStart = (e: TouchEvent) => {
      if (leaving.current || e.touches.length !== 1 || !window.matchMedia(PHONE).matches || window.matchMedia(LESS).matches) {
        mode = "off";
        return;
      }
      const t = e.touches[0];
      startY = lastY = t.clientY;
      lastT = e.timeStamp;
      dy = 0;
      velocity = 0;
      const inBody = body()?.contains(e.target as Node) ?? false;
      const atTop = (body()?.scrollTop ?? 0) <= 0;
      mode = inBody && !atTop ? "scroll" : "undecided";
    };
    const onMove = (e: TouchEvent) => {
      if (mode === "off" || mode === "scroll") return;
      const t = e.touches[0];
      const y = t.clientY;
      if (mode === "undecided") {
        const moved = y - startY;
        if (Math.abs(moved) < 6) return;
        if (moved < 0) {
          mode = "scroll";
          return;
        }
        mode = "pull";
        setDragging(true);
      }
      e.preventDefault();
      dy = Math.max(0, y - startY);
      const dt = e.timeStamp - lastT;
      if (dt > 0) velocity = (y - lastY) / dt;
      lastY = y;
      lastT = e.timeStamp;
      win.style.setProperty("--sheet-y", `${dy}px`);
    };
    const onEnd = () => {
      if (mode !== "pull") {
        mode = "off";
        return;
      }
      mode = "off";
      setDragging(false);
      if (dy > PULL_TO_CLOSE || velocity > FLICK) {
        win.style.removeProperty("--sheet-y");
        requestClose();
      } else {
        // Springs back (the transition on .app-win), from where the thumb left it.
        win.style.setProperty("--sheet-y", "0px");
      }
    };
    win.addEventListener("touchstart", onStart, { passive: true });
    win.addEventListener("touchmove", onMove, { passive: false });
    win.addEventListener("touchend", onEnd);
    win.addEventListener("touchcancel", onEnd);
    return () => {
      win.removeEventListener("touchstart", onStart);
      win.removeEventListener("touchmove", onMove);
      win.removeEventListener("touchend", onEnd);
      win.removeEventListener("touchcancel", onEnd);
    };
  }, [requestClose]);

  const cls = `app-win app-win--${size}${closing ? " app-win--closing" : ""}${dragging ? " app-win--dragging" : ""}`;
  return (
    <InWindow.Provider value={true}>
      <div className={`app-win-dim${closing ? " app-win-dim--closing" : ""}`} onClick={requestClose} aria-hidden />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className={cls}>
        <span className="app-win__grab" aria-hidden />
        <button type="button" onClick={requestClose} aria-label="Close" className="app-win__x">
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
        <div className="app-win__body">{children}</div>
      </div>
    </InWindow.Provider>
  );
}
