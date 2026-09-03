"use client";

import { useEffect, useState } from "react";
import { Check, Code2 } from "lucide-react";

/**
 * "Website widget" section of Settings — a copy-pasteable iframe snippet
 * for /embed/[businessId] (see that page and its API route). Every real
 * submission through it becomes a real, scored lead automatically, same
 * as a Gmail-sourced one — the point of the whole feature.
 */
export default function CopyEmbedSnippet() {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/embed/config")
      .then((r) => r.json())
      .then((data: { success: boolean; embedUrl?: string }) => {
        if (data.success && data.embedUrl) setEmbedUrl(data.embedUrl);
      });
  }, []);

  const snippet = embedUrl
    ? `<iframe src="${embedUrl}" style="width:100%;max-width:420px;height:540px;border:none;" title="Contact us"></iframe>`
    : "";

  async function copy() {
    if (!snippet) return;
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this embed code:", snippet);
    }
  }

  if (!embedUrl) return null;

  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}>
          <Code2 className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Add a contact form to your own website</p>
          <p className="text-xs text-ink-soft mt-1">
            Paste this into your site&apos;s HTML. Every real submission becomes a lead here automatically —
            scored and ready to follow up on, same as an email.
          </p>
          <pre className="mt-3 rounded-lg bg-paper border border-line p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">
            {snippet}
          </pre>
          <button
            onClick={copy}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-1.5 border border-line"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : null}
            {copied ? "Copied!" : "Copy embed code"}
          </button>
        </div>
      </div>
    </div>
  );
}
