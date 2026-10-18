"use client";

import { useState } from "react";
import Link from "next/link";
import type { OpenProblem } from "@/lib/openProblems";

/**
 * Problems at the top of Today (A-270, a line since A-286): what broke, in one sentence, with the one thing to do and "Got it". The
 * orange dot means the owner's turn and is never alone: the sentence says what.
 */
export default function ProblemNotices({ problems }: { problems: OpenProblem[] }) {
  const [gone, setGone] = useState<string[]>([]);
  const shown = problems.filter((p) => !gone.includes(p.id));
  if (shown.length === 0) return null;

  const dismiss = (id: string) => {
    setGone((g) => [...g, id]);
    void fetch(`/api/notifications/${encodeURIComponent(id)}/read`, { method: "POST" }).catch(() => {});
  };

  // One line each under the day's sentence (A-286; was a box, A-270): what broke, the one thing to do, and "Got it".
  return (
    <section aria-label="Needs you" className="mt-3">
      <ul>
        {shown.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-x-4 text-[14.5px] leading-snug">
            <span className="flex items-baseline gap-2.5 py-1">
              <span aria-hidden="true" className="h-2 w-2 shrink-0 -translate-y-px rounded-full" style={{ background: "var(--state-needs)" }} />
              <span>{p.line}</span>
            </span>
            <span className="flex items-center gap-x-4 pl-[18px] sm:pl-0">
              {p.action && (
                <Link href={p.action.href} className="inline-flex min-h-11 items-center font-medium underline underline-offset-[3px]">
                  {p.action.label}
                </Link>
              )}
              <button type="button" onClick={() => dismiss(p.id)} className="inline-flex min-h-11 min-w-11 items-center justify-center text-ink-soft hover:text-ink">
                Got it
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
