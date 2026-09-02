"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";

/** Copies this lead's public booking link (/book/[leadId]) to the clipboard. */
export default function CopyBookingLinkButton({ leadId }: { leadId: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}/book/${leadId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail (permissions, insecure context) — fall
      // back to prompting so the link is still recoverable by hand.
      window.prompt("Copy this booking link:", url);
    }
  }

  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium"
    >
      <CalendarClock className="h-3.5 w-3.5" />
      {copied ? "Copied!" : "Copy booking link"}
    </button>
  );
}
