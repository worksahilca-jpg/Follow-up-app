"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Webhook } from "lucide-react";

/**
 * "Lead webhook" section of Settings — a generated, per-business URL that
 * Zapier/Make/a Google Forms bridge/a raw script can POST a lead to (see
 * src/app/api/webhooks/lead/[secret]/route.ts). Mirrors CopyEmbedSnippet's
 * shape, but the URL doesn't exist until the business asks for one, and
 * regenerating it deliberately breaks whatever was already pointed at the
 * old one — the intended "revoke" behavior, not a bug.
 */
export default function CopyWebhookUrl() {
  const [loading, setLoading] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showExamples, setShowExamples] = useState(false);

  useEffect(() => {
    fetch("/api/webhooks/config")
      .then((r) => r.json())
      .then((data: { success: boolean; webhookUrl?: string | null }) => {
        if (data.success) setWebhookUrl(data.webhookUrl ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/webhooks/config", { method: "POST" });
      const data: { success: boolean; webhookUrl?: string } = await res.json();
      if (data.success && data.webhookUrl) setWebhookUrl(data.webhookUrl);
    } finally {
      setGenerating(false);
      setConfirming(false);
    }
  }

  async function copy() {
    if (!webhookUrl) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this webhook URL:", webhookUrl);
    }
  }

  if (loading) return null;

  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}>
          <Webhook className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Send leads in from anywhere else</p>
          <p className="text-xs text-ink-soft mt-1">
            Point Zapier, Make, a Google Forms bridge, or any tool that can send a webhook at this URL, and
            every submission becomes a lead here — scored and ready to follow up on, same as an email. Send
            JSON or form fields: <code className="text-[11px]">name</code> (required),{" "}
            <code className="text-[11px]">email</code> or <code className="text-[11px]">phone</code>{" "}
            (one required), <code className="text-[11px]">message</code> (optional).
          </p>

          <button
            onClick={() => setShowExamples((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-ink-soft"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${showExamples ? "rotate-180" : ""}`} />
            What can I connect this to?
          </button>
          {showExamples && (
            <div className="mt-2 rounded-lg bg-paper border border-line p-3 text-xs text-ink-soft space-y-1.5">
              <p>
                FollowUp doesn&apos;t talk to Instagram, WhatsApp, or Google Forms directly — <strong>Zapier or
                Make</strong> already do, for free, and this URL is the address you give them to forward things to.
              </p>
              <p>
                <strong>Example:</strong> in Zapier, pick &quot;New Instagram DM&quot; (or &quot;New Google Forms
                response,&quot; or &quot;New Facebook Lead Ad&quot;) as the trigger, then &quot;Webhook&quot; as the
                action, and paste this URL. From then on, every DM/form/lead shows up here automatically — scored,
                with a reply drafted — no code, no manual entry.
              </p>
            </div>
          )}

          {!webhookUrl && (
            <button
              onClick={generate}
              disabled={generating}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium rounded-lg px-3.5 py-2 disabled:opacity-60"
              style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
            >
              {generating ? "Generating…" : "Generate webhook URL"}
            </button>
          )}

          {webhookUrl && (
            <>
              <pre className="mt-3 rounded-lg bg-paper border border-line p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">
                {webhookUrl}
              </pre>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  onClick={copy}
                  className="inline-flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-1.5 border border-line"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : null}
                  {copied ? "Copied!" : "Copy URL"}
                </button>
                {!confirming && (
                  <button onClick={() => setConfirming(true)} className="text-xs font-medium" style={{ color: "var(--coral)" }}>
                    Regenerate
                  </button>
                )}
              </div>
              {confirming && (
                <div className="mt-2 rounded-lg p-3" style={{ backgroundColor: "var(--coral-soft)" }}>
                  <p className="text-xs" style={{ color: "var(--coral)" }}>
                    Anything still pointed at the current URL (an existing Zapier step, etc.) will stop working
                    the moment you do this.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={generate}
                      disabled={generating}
                      className="rounded-lg px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
                      style={{ backgroundColor: "var(--coral)" }}
                    >
                      {generating ? "Regenerating…" : "Yes, regenerate"}
                    </button>
                    <button
                      onClick={() => setConfirming(false)}
                      disabled={generating}
                      className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
