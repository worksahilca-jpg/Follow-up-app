"use client";

import { useEffect, useState } from "react";

/**
 * "Catching up" at the top of a long conversation (design brain A-043,
 * the Intercom study): two or three sentences a teammate reads instead of
 * the whole thread. Loaded after the page, so a slow summary never holds
 * the conversation back; says nothing at all when there isn't one.
 */
export default function CatchUp({ leadId }: { leadId: string }) {
  const [text, setText] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetch(`/api/leads/${leadId}/catch-up`)
      .then((r) => r.json())
      .then((d: { success?: boolean; text?: string | null; count?: number }) => {
        if (d.success && d.text) {
          setText(d.text);
          setCount(d.count ?? 0);
        }
      })
      .catch(() => {});
  }, [leadId]);

  if (!text) return null;
  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: "var(--card-2)" }}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold">Catching up</p>
        <a href="#conversation" className="text-xs text-ink-soft underline underline-offset-2">
          Show all {count} messages
        </a>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed">{text}</p>
    </div>
  );
}
