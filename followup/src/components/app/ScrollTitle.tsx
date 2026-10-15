"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * iOS large titles (A-264): a page's title sits big on the page, and once
 * it scrolls away it appears, small and centred, in the phone's top bar.
 *
 * `ScrollTitle` is the watcher: an empty mark placed by the page's title.
 * While the mark is above the top bar, html[data-title-collapsed] is set
 * and the bar's `BarTitle` (Sidebar.tsx) fades the title in. Nothing on a
 * computer: the bar isn't there.
 */
let current = "";
const listeners = new Set<() => void>();

function setTitle(title: string) {
  if (current === title) return;
  current = title;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** The title the phone's top bar shows once the page's own has scrolled away. */
export function BarTitle() {
  const title = useSyncExternalStore(subscribe, () => current, () => "");
  return (
    <span className="bar-title" aria-hidden>
      {title}
    </span>
  );
}

export default function ScrollTitle({ title }: { title: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    setTitle(title);
    const io = new IntersectionObserver(
      ([entry]) => {
        // Collapsed once the title has gone up past the bar (56px), not when it is below the screen.
        const gone = !entry.isIntersecting && entry.boundingClientRect.top < 56;
        if (gone) root.dataset.titleCollapsed = "";
        else delete root.dataset.titleCollapsed;
      },
      { rootMargin: "-56px 0px 0px 0px", threshold: 0 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      delete root.dataset.titleCollapsed;
      setTitle("");
    };
  }, [title]);

  return <span ref={ref} aria-hidden className="block h-px w-px" />;
}
