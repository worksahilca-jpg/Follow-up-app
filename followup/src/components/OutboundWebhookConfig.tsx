"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Send, X } from "lucide-react";

/**
 * "Send lead events out" section of Settings — the reverse direction of
 * CopyWebhookUrl: instead of generating a URL for other tools to send leads
 * IN to, this lets the business paste a URL of THEIRS (a Zapier/Make step,
 * their real CRM's own inbound webhook, a Slack incoming webhook, etc.) for
 * FollowUp to send lead events OUT to. See src/lib/outboundWebhook.ts for
 * exactly what gets sent and when.
 */
export default function OutboundWebhookConfig() {
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);
  const [showExamples, setShowExamples] = useState(false);

  useEffect(() => {
    fetch("/api/webhooks/outbound")
      .then((r) => r.json())
      .then((data: { success: boolean; url?: string | null }) => {
        if (data.success) setUrl(data.url ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setSaveError(null);
    setTestResult(null);
    try {
      const res = await fetch("/api/webhooks/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: draft }),
      });
      const data: { success: boolean; url?: string | null; message?: string } = await res.json();
      if (data.success) {
        setUrl(data.url ?? null);
        setEditing(false);
      } else {
        setSaveError(data.message ?? "Couldn't save that URL.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      const res = await fetch("/api/webhooks/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "" }),
      });
      const data: { success: boolean } = await res.json();
      if (data.success) {
        setUrl(null);
        setTestResult(null);
      }
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/webhooks/outbound", { method: "PUT" });
      const data: { success: boolean } = await res.json();
      setTestResult(data.success ? "ok" : "fail");
    } catch {
      setTestResult("fail");
    } finally {
      setTesting(false);
    }
  }

  if (loading) return null;

  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}>
          <Send className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Send lead events out</p>
          <p className="text-xs text-ink-soft mt-1">
            The other direction: paste a webhook URL from your real CRM, a Zapier/Make step, or a Slack incoming
            webhook, and FollowUp will POST every new lead and every pipeline stage change there — the same
            events, live, wherever you actually run your business.
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
                Already use a real CRM (HubSpot, Pipedrive, GoHighLevel, etc.)? Most of them have their own
                &quot;inbound webhook&quot; or accept a Zapier trigger — paste that URL here and every FollowUp
                lead gets pushed straight into it too, automatically.
              </p>
              <p>
                No CRM yet? A free <a href="https://webhook.site" target="_blank" rel="noopener" className="underline">webhook.site</a> URL
                or a Slack &quot;Incoming Webhook&quot; both work here for testing — or point it at a Zapier step
                that adds a row to a Google Sheet, so every lead lands in a spreadsheet automatically.
              </p>
            </div>
          )}

          {!url && !editing && (
            <button
              onClick={() => {
                setEditing(true);
                setDraft("");
                setSaveError(null);
              }}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium rounded-lg px-3.5 py-2"
              style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
            >
              Add a webhook URL
            </button>
          )}

          {editing && (
            <div className="mt-3">
              <input
                type="url"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="https://hooks.zapier.com/..."
                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm"
                autoFocus
              />
              {saveError && (
                <p className="mt-1.5 text-xs" style={{ color: "var(--coral)" }}>
                  {saveError}
                </p>
              )}
              <div className="mt-2 flex gap-2">
                <button
                  onClick={save}
                  disabled={saving || !draft.trim()}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                  style={{ backgroundColor: "var(--ink)" }}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setSaveError(null);
                  }}
                  disabled={saving}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {url && !editing && (
            <>
              <pre className="mt-3 rounded-lg bg-paper border border-line p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">
                {url}
              </pre>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <button
                  onClick={sendTest}
                  disabled={testing}
                  className="inline-flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-1.5 border border-line disabled:opacity-60"
                >
                  {testing ? "Sending…" : "Send test event"}
                </button>
                <button
                  onClick={() => {
                    setEditing(true);
                    setDraft(url);
                    setSaveError(null);
                  }}
                  className="text-xs font-medium text-ink-soft"
                >
                  Change
                </button>
                <button onClick={remove} disabled={saving} className="text-xs font-medium" style={{ color: "var(--coral)" }}>
                  Remove
                </button>
              </div>
              {testResult === "ok" && (
                <p className="mt-2 text-xs flex items-center gap-1" style={{ color: "var(--sage)" }}>
                  <Check className="h-3.5 w-3.5" /> Delivered — check the other end for a test event.
                </p>
              )}
              {testResult === "fail" && (
                <p className="mt-2 text-xs flex items-center gap-1" style={{ color: "var(--coral)" }}>
                  <X className="h-3.5 w-3.5" /> Couldn&apos;t deliver — double check the URL is right and reachable.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
