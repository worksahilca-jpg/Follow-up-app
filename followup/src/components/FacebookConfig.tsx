"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Check, ChevronDown, MessageSquare } from "lucide-react";

interface PendingPage {
  id: string;
  name: string;
}

/**
 * "Facebook" section of Settings — Messenger DMs and Lead Ads from one
 * Page. Same shape as Instagram: a one-click "Connect with Facebook"
 * (real OAuth via /api/facebook/oauth/start) once FACEBOOK_APP_ID/SECRET
 * are set (docs/meta-oauth-setup.md), with a manual paste-a-token
 * fallback. If the signed-in Facebook account manages more than one
 * Page, the callback redirects here with ?facebook=choose_page and this
 * component shows a picker (the Page's own access token never leaves the
 * server — see /api/facebook/oauth/pending-pages and /select-page).
 */
export default function FacebookConfig() {
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  // Connected and receiving are two different questions. A Page can be
  // saved, named and readable while Facebook sends FollowUp nothing at
  // all, because the per-Page subscription never went through — see
  // subscribeFacebookPageWebhooks in src/lib/facebook.ts.
  const [receiving, setReceiving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [pageName, setPageName] = useState<string | null>(null);
  const [pageId, setPageId] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [oauthAvailable, setOauthAvailable] = useState(false);
  const [tokenDraft, setTokenDraft] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [pendingPages, setPendingPages] = useState<PendingPage[] | null>(null);

  // Derived straight from the URL — see the same pattern's comment in
  // InstagramConfig.tsx. The effect below only does real side effects
  // (refetching status, fetching the page list), never sets this.
  const oauthResult = searchParams.get("facebook");
  const statusMessage =
    // Suppressed while the Page isn't receiving: this sentence makes the
    // same promise the block below has to walk back, and the two sitting
    // together is worse than either alone.
    oauthResult === "connected" && receiving
      ? { kind: "success" as const, text: "Facebook connected — Messenger DMs and lead-form submissions become leads automatically." }
      : oauthResult === "error"
        ? { kind: "error" as const, text: searchParams.get("message") ?? "Couldn't connect Facebook." }
        : null;

  function load() {
    return fetch("/api/facebook/config")
      .then((r) => r.json())
      .then((data: { success: boolean; connected?: boolean; receiving?: boolean; pageId?: string | null; pageName?: string | null; webhookUrl?: string; verifyToken?: string; oauthAvailable?: boolean }) => {
        if (data.success) {
          setConnected(!!data.connected);
          setReceiving(!!data.receiving);
          setPageId(data.pageId ?? null);
          setPageName(data.pageName ?? null);
          setWebhookUrl(data.webhookUrl ?? "");
          setVerifyToken(data.verifyToken ?? "");
          setOauthAvailable(!!data.oauthAvailable);
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (oauthResult === "connected") {
      load();
    } else if (oauthResult === "choose_page") {
      fetch("/api/facebook/oauth/pending-pages")
        .then((r) => r.json())
        .then((data: { success: boolean; pages?: PendingPage[] }) => setPendingPages(data.pages ?? []));
    }
  }, [oauthResult]);

  async function choosePage(id: string) {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/facebook/oauth/select-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: id }),
      });
      const data: { success: boolean; message?: string } = await res.json();
      if (data.success) {
        setPendingPages(null);
        load(); // the "Connected" card below appears once `connected` flips true
      } else {
        setSaveError(data.message ?? "Couldn't connect that Page.");
      }
    } finally {
      setSaving(false);
    }
  }

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
      const data: { success: boolean; pageId?: string; pageName?: string | null; receiving?: boolean; message?: string } = await res.json();
      if (data.success) {
        setConnected(true);
        setReceiving(!!data.receiving);
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

  async function retrySubscription() {
    setRetrying(true);
    setRetryError(null);
    try {
      const res = await fetch("/api/facebook/subscribe", { method: "POST" });
      const data: { success: boolean; receiving?: boolean; message?: string } = await res.json();
      setReceiving(!!data.receiving);
      // Facebook's own sentence, shown as it came: it names the missing
      // permission or the lost Page role, which is what to act on.
      if (!data.success) setRetryError(data.message ?? "Facebook turned it down again.");
    } finally {
      setRetrying(false);
    }
  }

  async function disconnect() {
    setSaving(true);
    try {
      const res = await fetch("/api/facebook/config", { method: "DELETE" });
      const data: { success: boolean } = await res.json();
      if (data.success) {
        setConnected(false);
        setReceiving(false);
        setRetryError(null);
        setPageId(null);
        setPageName(null);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  return (
    <div className="box p-5">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}>
          <MessageSquare className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Catch Facebook Messenger DMs and Lead Ads</p>
          <p className="text-xs text-ink-soft mt-1">
            Anyone who messages your Facebook Page, or fills in one of your Facebook or Instagram lead-ad forms,
            becomes a lead and gets the instant reply.
          </p>

          {statusMessage && (
            <p className="mt-2 text-xs" style={{ color: statusMessage.kind === "success" ? "var(--sage)" : "var(--coral)" }}>
              {statusMessage.text}
            </p>
          )}

          {pendingPages && (
            <div className="mt-3 rounded-lg border border-line bg-paper p-3">
              <p className="text-xs font-medium">Which Page should FollowUp watch?</p>
              {saveError && (
                <p className="mt-1 text-xs" style={{ color: "var(--coral)" }}>
                  {saveError}
                </p>
              )}
              <div className="mt-2 space-y-1.5">
                {pendingPages.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => choosePage(p.id)}
                    disabled={saving}
                    className="block w-full text-left rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!pendingPages && (connected ? (
            <div className="mt-3">
              {receiving ? (
                <p className="text-xs flex items-center gap-1" style={{ color: "var(--sage)" }}>
                  <Check className="h-3.5 w-3.5" /> Connected — {pageName ?? "Page"} ({pageId}). Messenger DMs and lead-form
                  submissions become leads automatically.
                </p>
              ) : (
                /* The green tick used to show here regardless, on a Page
                   that would never receive a thing. Connected is the
                   smaller half of the promise; this states the other half
                   plainly, and gives the one action that can change it. */
                <div className="rounded-lg p-3" style={{ backgroundColor: "var(--coral-soft)" }}>
                  <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--coral)" }}>
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Facebook isn&apos;t sending messages through yet
                  </p>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--coral)" }}>
                    {pageName ?? "Your Page"} is linked, but Facebook hasn&apos;t switched the connection on — so nothing
                    people send the Page reaches FollowUp. This usually clears once Meta approves the app; it can also
                    mean you no longer manage the Page.
                  </p>
                  {retryError && (
                    <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--coral)" }}>
                      Facebook said: {retryError}
                    </p>
                  )}
                  <button
                    onClick={retrySubscription}
                    disabled={retrying}
                    className="mt-2 rounded-lg px-3 py-1.5 text-xs font-medium text-paper disabled:opacity-60"
                    style={{ backgroundColor: "var(--ink)" }}
                  >
                    {retrying ? "Checking…" : "Try again"}
                  </button>
                </div>
              )}
              <button onClick={disconnect} disabled={saving} className="mt-2 text-xs font-medium" style={{ color: "var(--coral)" }}>
                Disconnect
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {oauthAvailable ? (
                <div>
                  <a
                    href="/api/facebook/oauth/start"
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-paper"
                    style={{ backgroundColor: "var(--ink)" }}
                  >
                    Connect with Facebook
                  </a>
                  {/* Same sentence as the Instagram panel, same reason. */}
                  <p className="mt-2 text-xs text-ink-soft">
                    While FollowUp is in beta, Meta only lets accounts Sahil added as testers connect. If Meta refuses,
                    ask him to add you.
                  </p>
                </div>
              ) : null}

              <div>
                <button
                  onClick={() => setShowManual((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-ink-soft"
                >
                  <ChevronDown className={`h-3 w-3 transition-transform ${showManual ? "rotate-180" : ""}`} />
                  {oauthAvailable ? "Have a Page access token instead?" : "Paste a Page access token"}
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
                        placeholder="Facebook Page access token"
                        className="flex-1 rounded-lg border border-line bg-paper px-3 py-1.5 text-xs"
                      />
                      <button
                        onClick={saveToken}
                        disabled={saving || !tokenDraft.trim()}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-paper disabled:opacity-60"
                        style={{ backgroundColor: "var(--ink)" }}
                      >
                        {saving ? "Connecting…" : "Connect"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          <button onClick={() => setShowHelp((v) => !v)} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-ink-soft">
            <ChevronDown className={`h-3 w-3 transition-transform ${showHelp ? "rotate-180" : ""}`} />
            Meta console reference
          </button>
          {showHelp && (
            <div className="mt-2 rounded-lg bg-paper border border-line p-3 text-xs text-ink-soft space-y-2">
              <p>
                Webhook (set up once, not per business): subscribed to <strong>messages</strong> and{" "}
                <strong>leadgen</strong> for Pages. Lead Ads also need the <strong>leads_retrieval</strong> permission.
              </p>
              <pre className="rounded-lg bg-card border border-line p-2 overflow-x-auto whitespace-pre-wrap break-all">{webhookUrl}</pre>
              <pre className="rounded-lg bg-card border border-line p-2 overflow-x-auto whitespace-pre-wrap break-all">{verifyToken}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
