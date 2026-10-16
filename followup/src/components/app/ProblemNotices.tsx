"use client";

import { useState } from "react";
import Link from "next/link";
import type { OpenProblem } from "@/lib/openProblems";

/**
 * Problems at the top of Today (A-270): what broke, in one sentence, with the one thing to do and "Got it". The
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

  return (
    <section aria-label="Needs you" className="box mt-5 px-4 py-3.5 sm:px-5">
      <p className="text-[13px] text-ink-soft">Needs you</p>
      <ul className="mt-1">
        {shown.map((p, i) => (
          <li key={p.id} className={i ? "mt-2 border-t border-line pt-2" : ""}>
            <p className="flex items-baseline gap-2.5 text-[15px] leading-snug">
              <span aria-hidden="true" className="h-2 w-2 shrink-0 -translate-y-px rounded-full" style={{ background: "var(--state-needs)" }} />
              <span>{p.line}</span>
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-5 pl-[18px]">
              {p.action && (
                <Link href={p.action.href} className="inline-flex min-h-11 items-center text-[14.5px] font-medium underline underline-offset-[3px]">
                  {p.action.label}
                </Link>
              )}
              <button type="button" onClick={() => dismiss(p.id)} className="inline-flex min-h-11 items-center text-[14.5px] text-ink-soft hover:text-ink">
                Got it
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
