"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, MessageCircle } from "lucide-react";

/**
 * "Instagram" section of Settings. Different shape from Twilio's: there's
 * no per-business URL to generate — the webhook is app-wide (one shared
 * Meta Developer App), so this is just a paste-the-access-token flow. The
 * webhook URL + verify token shown here only need to be entered ONCE,
 * ever, in the Meta Developer Console's Webhooks product — not per
 * business — so they're shown mainly for reference/debugging.
 */
export default function InstagramConfig() {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [instagramUserId, setInstagramUserId] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [tokenDraft, setTokenDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showExamples, setShowExamples] = useState(false);
  const [copied, setCopied] = useState<"url" | "token" | null>(null);

  useEffect(() => {
    fetch("/api/instagram/config")
      .then((r) => r.json())
      .then(
        (data: {
          success: boolean;
          connected?: boolean;
          instagramUserId?: string | null;
          webhookUrl?: string;
          verifyToken?: string;
        }) => {
          if (data.success) {
            setConnected(!!data.connected);
            setInstagramUserId(data.instagramUserId ?? null);
            setWebhookUrl(data.webhookUrl ?? "");
            setVerifyToken(data.verifyToken ?? "");
          }
        }
      )
      .finally(() => setLoading(false));
  }, []);

  async function saveToken() {
    if (!tokenDraft.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/instagram/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: tokenDraft.trim() }),
      });
      const data: { success: boolean; instagramUserId?: string; message?: string } = await res.json();
      if (data.success) {
        setConnected(true);
        setInstagramUserId(data.instagramUserId ?? null);
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
      const res = await fetch("/api/instagram/config", { method: "DELETE" });
      const data: { success: boolean } = await res.json();
      if (data.success) {
        setConnected(false);
        setInstagramUserId(null);
      }
    } finally {
      setSaving(false);
    }
  }

  async function copy(which: "url" | "token", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt("Copy this:", value);
    }
  }

  if (loading) return null;

  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}>
          <MessageCircle className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Catch Instagram DMs</p>
          <p className="text-xs text-ink-soft mt-1">
            Needs an Instagram Business account and a connected Meta Developer App (free, but requires
            Meta&apos;s setup process). Paste the access token generated there — the account itself is detected
            automatically.
          </p>

          <button
            onClick={() => setShowExamples((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-ink-soft"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${showExamples ? "rotate-180" : ""}`} />
            Where&apos;s this webhook URL used?
          </button>
          {showExamples && (
            <div className="mt-2 rounded-lg bg-paper border border-line p-3 text-xs text-ink-soft space-y-2">
              <p>
                Unlike the other integrations above, this URL doesn&apos;t need to be pasted per-business — it&apos;s
                set up once, in the Meta Developer Console&apos;s Webhooks product, subscribed to the
                &quot;messages&quot; field for Instagram.
              </p>
              <div>
                <p className="font-medium text-ink">Callback URL</p>
                <pre className="mt-1 rounded-lg bg-card border border-line p-2 overflow-x-auto whitespace-pre-wrap break-all">
                  {webhookUrl}
                </pre>
                <button onClick={() => copy("url", webhookUrl)} className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1 border border-line">
                  {copied === "url" ? <Check className="h-3 w-3" /> : null}
                  {copied === "url" ? "Copied!" : "Copy"}
                </button>
              </div>
              <div>
                <p className="font-medium text-ink">Verify token</p>
                <pre className="mt-1 rounded-lg bg-card border border-line p-2 overflow-x-auto whitespace-pre-wrap break-all">
                  {verifyToken}
                </pre>
                <button onClick={() => copy("token", verifyToken)} className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1 border border-line">
                  {copied === "token" ? <Check className="h-3 w-3" /> : null}
                  {copied === "token" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          )}

          {connected ? (
            <div className="mt-3">
              <p className="text-xs flex items-center gap-1" style={{ color: "var(--sage)" }}>
                <Check className="h-3.5 w-3.5" /> Connected — Instagram account ID {instagramUserId}. Real DMs
                will become leads automatically.
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
                  placeholder="Instagram access token"
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
