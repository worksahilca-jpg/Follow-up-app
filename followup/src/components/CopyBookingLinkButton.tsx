"use client";

import { useState } from "react";

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
      type="button"
      onClick={copy}
      className="inline-flex h-[38px] items-center rounded-full border border-line bg-card px-3.5 text-[14px] font-medium hover:bg-card-2 disabled:opacity-60"
    >
      {copied ? "Copied" : "Copy booking link"}
    </button>
  );
}
