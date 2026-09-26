"use client";

import { useState, type CSSProperties } from "react";
import { UNDO_WINDOW_MS } from "@/lib/undoWindow";

/**
 * The undo window, drawn (design brain A-048): a thin line under
 * "Sending to Priya in 7s · Undo" that drains over exactly the time left,
 * so how long you have reads at a glance. A CSS animation, so reduced
 * motion holds it still (globals.css) while the seconds keep counting.
 */
export default function UndoLine({ endsAt }: { endsAt: number }) {
  // Read once, when the window opens; the animation carries it from there.
  const [left] = useState(() => Math.max(0, endsAt - Date.now()));
  const style = {
    animationDuration: `${left}ms`,
    "--undo-from": String(Math.min(1, left / UNDO_WINDOW_MS)),
    backgroundColor: "var(--ink)",
  } as CSSProperties;
  return (
    <div className="h-[2px] w-full rounded-full overflow-hidden" style={{ backgroundColor: "var(--line)" }} aria-hidden="true">
      <div className="undo-line h-full w-full rounded-full" style={style} />
    </div>
  );
}
