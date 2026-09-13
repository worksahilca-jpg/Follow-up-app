"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Loader2 } from "lucide-react";

/**
 * Works one shift at one desk, on demand.
 *
 * `--ink` fill, not `--rust`: every in-app primary button is ink, and the
 * accent is reserved for genuinely interactive/selected states — see
 * design-brain/decisions/approved.md A-003. The operator's own tool should
 * read as calm, not as a marketing CTA.
 *
 * Kept deliberately plain: no optimistic state, no streaming. A shift is a
 * single bounded call, so the honest interaction is "it is working" and
 * then the real result — an invented progress bar would be dressing up a
 * wait we can't actually narrate yet. Streaming the transcript is what
 * turns this into a live floor, and that needs the tool-loop runner.
 */
export default function RunNowButton({ roleKey }: { roleKey: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setMessage(null);
    try {
      const res = await fetch("/api/office/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleKey }),
      });
      const data = (await res.json()) as { success: boolean; status?: string; summary?: string; message?: string };
      if (!data.success) {
        setMessage(data.message ?? "The shift could not be started.");
      } else if (data.status === "BLOCKED" || data.status === "FAILED") {
        setMessage(data.summary ?? "The shift did not run.");
        router.refresh();
      } else {
        router.refresh();
      }
    } catch {
      setMessage("Could not reach the office.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={run}
        disabled={running}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-60"
        style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
      >
        {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
        {running ? "On shift…" : "Run now"}
      </button>
      {message && (
        <span className="text-xs" style={{ color: "var(--coral)" }}>
          {message}
        </span>
      )}
    </div>
  );
}
