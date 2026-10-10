"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { ChevronLeft, Info } from "lucide-react";
import AppWindow from "./AppWindow";

const DESK = "(min-width: 64rem)";

function onDeskChange(cb: () => void) {
  const mq = window.matchMedia(DESK);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
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

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-30 flex h-[57px] items-center gap-0.5 border-b border-line bg-paper pl-0.5 pr-1.5 lg:hidden">
        <Link href="/leads" aria-label="Back to Customers" className="grid h-11 w-11 shrink-0 place-items-center">
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
