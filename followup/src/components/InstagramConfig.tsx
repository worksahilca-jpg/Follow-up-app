"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, ChevronDown, MessageCircle } from "lucide-react";

/**
 * "Instagram" section of Settings. Two ways to connect:
 *  - "Connect with Instagram" (one click, once INSTAGRAM_APP_ID/SECRET are
 *    set — see docs/meta-oauth-setup.md) — real OAuth via
 *    /api/instagram/oauth/start, the only path a non-technical business
 *    owner can actually use on their own.
 *  - Paste an access token by hand — kept as a fallback (a Meta reviewer,
 *    or before OAuth is configured); the account itself is still detected
 *    automatically from the token.
 * The webhook URL/verify token are shown for reference — set up once in
 * the Meta console, not per business.
 */
export default function InstagramConfig() {
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [instagramUserId, setInstagramUserId] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [oauthAvailable, setOauthAvailable] = useState(false);
  const [tokenDraft, setTokenDraft] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showExamples, setShowExamples] = useState(false);
  const [copied, setCopied] = useState<"url" | "token" | null>(null);

  // Derived straight from the URL, not state — a plain read of what the
  // OAuth callback (src/app/api/instagram/oauth/callback/route.ts)
  // redirected back with. The effect below only does the one real side
  // effect (refetching connection status), never sets this.
  const oauthResult = searchParams.get("instagram");
  const statusMessage =
    oauthResult === "connected"
      ? { kind: "success" as const, text: "Instagram connected — real DMs will become leads automatically." }
      : oauthResult === "error"
        ? { kind: "error" as const, text: searchParams.get("message") ?? "Couldn't connect Instagram." }
        : null;

  function load() {
    return fetch("/api/instagram/config")
      .then((r) => r.json())
      .then(
        (data: {
          success: boolean;
          connected?: boolean;
          instagramUserId?: string | null;
          webhookUrl?: string;
          verifyToken?: string;
          oauthAvailable?: boolean;
        }) => {
          if (data.success) {
            setConnected(!!data.connected);
            setInstagramUserId(data.instagramUserId ?? null);
            setWebhookUrl(data.webhookUrl ?? "");
            setVerifyToken(data.verifyToken ?? "");
            setOauthAvailable(!!data.oauthAvailable);
          }
        }
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (oauthResult === "connected") load();
  }, [oauthResult]);

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
            Anyone who messages your Instagram Business account becomes a lead and gets the instant reply,
            automatically.
          </p>

          {statusMessage && (
            <p className="mt-2 text-xs" style={{ color: statusMessage.kind === "success" ? "var(--sage)" : "var(--coral)" }}>
              {statusMessage.text}
            </p>
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
            <div className="mt-3 space-y-3">
              {oauthAvailable ? (
                <a
                  href="/api/instagram/oauth/start"
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white"
                  style={{ backgroundColor: "var(--ink)" }}
                >
                  Connect with Instagram
                </a>
              ) : null}

              <div>
                <button
                  onClick={() => setShowManual((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-ink-soft"
                >
                  <ChevronDown className={`h-3 w-3 transition-transform ${showManual ? "rotate-180" : ""}`} />
                  {oauthAvailable ? "Have an access token instead?" : "Paste an access token"}
                </button>
                {(showManual || !oauthAvailable) && (
                  <div className="mt-2">
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
          )}

          <button
            onClick={() => setShowExamples((v) => !v)}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-ink-soft"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${showExamples ? "rotate-180" : ""}`} />
            Meta console reference
          </button>
          {showExamples && (
            <div className="mt-2 rounded-lg bg-paper border border-line p-3 text-xs text-ink-soft space-y-2">
              <p>Webhook (set up once, not per business) — subscribed to &quot;messages&quot; for Instagram.</p>
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
        </div>
      </div>
    </div>
  );
}
