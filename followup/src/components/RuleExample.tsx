"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { OPEN_IN_PLACE } from "@/lib/motion";
import { Eye } from "lucide-react";

type Example = { leadId: string; leadName: string; what: string; text: string };

/**
 * "See an example" (design brain A-044): what a rule would write for a
 * real recent customer. Marked as an example; nothing is sent or saved.
 */
export default function RuleExample({ rule }: { rule: string }) {
  const [example, setExample] = useState<Example | null>(null);
  const [shown, setShown] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load(skip: string[]) {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/automation/rule-example", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rule, skip }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(typeof data.message === "string" ? data.message : "Couldn't write an example.");
      if (!data.example) {
        setNote(typeof data.message === "string" ? data.message : "No customer fits this one yet.");
        return;
      }
      setExample(data.example);
      setShown([...skip, data.example.leadId]);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Couldn't write an example.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      {!example && (
        <button
          onClick={() => load([])}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 min-h-9 text-xs font-medium disabled:opacity-60"
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          {busy ? "Writing an example…" : "See an example"}
        </button>
      )}
      {example && (
        // Opens where "See an example" was (A-048).
        <motion.div initial={OPEN_IN_PLACE.initial} animate={OPEN_IN_PLACE.animate} className="rounded-lg p-4" style={{ backgroundColor: "var(--card-2)" }} role="status">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs text-ink-soft">
              Example: {example.what} for <span className="text-ink font-medium">{example.leadName}</span>
            </p>
            <button
              onClick={() => load(shown)}
              disabled={busy}
              className="text-xs text-ink-soft underline underline-offset-2 disabled:opacity-60"
            >
              {busy ? "Writing…" : "Try another customer"}
            </button>
          </div>
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{example.text}</p>
          <p className="mt-2 text-xs text-ink-soft">Only an example. Nothing was sent.</p>
        </motion.div>
      )}
      {note && <p className="mt-2 text-xs text-ink-soft">{note}</p>}
    </div>
  );
}
