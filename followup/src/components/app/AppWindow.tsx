"use client";

import { createContext, useContext, useEffect, useRef, useSyncExternalStore } from "react";
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
 * The dimmed page is a plain see-through layer, never a blur (brand
 * principle "Every frame is smooth": a blur over the page is redrawn every
 * frame).
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

function Window({ label, onClose, size = "large", children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const win = ref.current;
    // A field asked for focus first (autoFocus) keeps it; otherwise the window takes it.
    if (win && !win.contains(document.activeElement)) win.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close.current();
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
  }, []);

  return (
    <InWindow.Provider value={true}>
      <div className="app-win-dim" onClick={onClose} aria-hidden />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className={`app-win app-win--${size}`}>
        <span className="app-win__grab" aria-hidden />
        <button type="button" onClick={onClose} aria-label="Close" className="app-win__x">
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
        <div className="app-win__body">{children}</div>
      </div>
    </InWindow.Provider>
  );
}
