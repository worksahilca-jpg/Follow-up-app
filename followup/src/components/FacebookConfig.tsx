"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, MessageSquare } from "lucide-react";

/**
 * "Facebook" section of Settings — Messenger DMs and Lead Ads from one
 * Page. Same paste-a-token flow as Instagram; the Page is detected from
 * the token. The webhook is the shared Meta-app callback (entered once in
 * the Meta console, subscribed to "messages" and "leadgen" for Pages).
 */
export default function FacebookConfig() {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [pageName, setPageName] = useState<string | null>(null);
  const [pageId, setPageId] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [tokenDraft, setTokenDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    fetch("/api/facebook/config")
      .then((r) => r.json())
      .then((data: { success: boolean; connected?: boolean; pageId?: string | null; pageName?: string | null; webhookUrl?: string; verifyToken?: string }) => {
        if (data.success) {
          setConnected(!!data.connected);
          setPageId(data.pageId ?? null);
          setPageName(data.pageName ?? null);
          setWebhookUrl(data.webhookUrl ?? "");
          setVerifyToken(data.verifyToken ?? "");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function saveToken() {
    if (!tokenDraft.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/facebook/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: tokenDraft.trim() }),
      });
      const data: { success: boolean; pageId?: string; pageName?: string | null; message?: string } = await res.json();
      if (data.success) {
        setConnected(true);
        setPageId(data.pageId ?? null);
        setPageName(data.pageName ?? null);
        setTokenDraft("");
      } else {
        setSaveError(data.message ?? "Couldn't save that token.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    setSaving(true);
    try {
      const res = await fetch("/api/facebook/config", { method: "DELETE" });
      const data: { success: boolean } = await res.json();
      if (data.success) {
        setConnected(false);
        setPageId(null);
        setPageName(null);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}>
          <MessageSquare className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Catch Facebook Messenger DMs and Lead Ads</p>
          <p className="text-xs text-ink-soft mt-1">
            Anyone who messages your Facebook Page, or fills in one of your Facebook or Instagram lead-ad forms,
            becomes a lead and gets the instant reply. Paste a Page access token from the Meta Developer App —
            the Page is detected automatically.
          </p>

          <button onClick={() => setShowHelp((v) => !v)} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-ink-soft">
            <ChevronDown className={`h-3 w-3 transition-transform ${showHelp ? "rotate-180" : ""}`} />
            Meta console setup (once, not per business)
          </button>
          {showHelp && (
            <div className="mt-2 rounded-lg bg-paper border border-line p-3 text-xs text-ink-soft space-y-2">
              <p>
                In the Meta Developer App: Webhooks → Page → subscribe to <strong>messages</strong> and{" "}
                <strong>leadgen</strong> with this callback URL and verify token. Then Messenger → Settings →
                subscribe the Page. Lead Ads also need the <strong>leads_retrieval</strong> permission.
              </p>
              <pre className="rounded-lg bg-card border border-line p-2 overflow-x-auto whitespace-pre-wrap break-all">{webhookUrl}</pre>
              <pre className="rounded-lg bg-card border border-line p-2 overflow-x-auto whitespace-pre-wrap break-all">{verifyToken}</pre>
            </div>
          )}

          {connected ? (
            <div className="mt-3">
              <p className="text-xs flex items-center gap-1" style={{ color: "var(--sage)" }}>
                <Check className="h-3.5 w-3.5" /> Connected — {pageName ?? "Page"} ({pageId}). Messenger DMs and lead-form
                submissions become leads automatically.
              </p>
              <button onClick={disconnect} disabled={saving} className="mt-2 text-xs font-medium" style={{ color: "var(--coral)" }}>
                Disconnect
              </button>
            </div>
          ) : (
            <div className="mt-3">
              {saveError && (
                <p className="mb-1.5 text-xs" style={{ color: "var(--coral)" }}>
                  {saveError}
                </p>
              )}
              <div className="flex gap-2">
                <input
                  type="password"
                  value={tokenDraft}
                  onChange={(e) => setTokenDraft(e.target.value)}
                  placeholder="Facebook Page access token"
                  className="flex-1 rounded-lg border border-line bg-paper px-3 py-1.5 text-xs"
                />
                <button
                  onClick={saveToken}
                  disabled={saving || !tokenDraft.trim()}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                  style={{ backgroundColor: "var(--ink)" }}
                >
                  {saving ? "Connecting…" : "Connect"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
