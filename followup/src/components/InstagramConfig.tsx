"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, ChevronDown, MessageCircle } from "lucide-react";
import ChannelNotReceiving from "@/components/ChannelNotReceiving";

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
  // Connected and receiving are two different questions. Meta only
  // delivers DMs to an app subscribed to THIS account, and that
  // subscription can fail while the connection itself succeeds — see
  // activateInstagramWebhooks in src/lib/instagram.ts.
  const [receiving, setReceiving] = useState(false);
  const [instagramUserId, setInstagramUserId] = useState<string | null>(null);
  const [instagramUsername, setInstagramUsername] = useState<string | null>(null);
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
    // Suppressed while the account isn't receiving: this sentence makes
    // the same promise the block below has to walk back, and the two
    // sitting together is worse than either alone.
    oauthResult === "connected" && receiving
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
          receiving?: boolean;
          instagramUserId?: string | null;
          instagramUsername?: string | null;
          webhookUrl?: string;
          verifyToken?: string;
          oauthAvailable?: boolean;
        }) => {
          if (data.success) {
            setConnected(!!data.connected);
            setReceiving(!!data.receiving);
            setInstagramUserId(data.instagramUserId ?? null);
            setInstagramUsername(data.instagramUsername ?? null);
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
      // `.catch(() => null)`: a crash or a timeout answers in HTML, not
      // JSON. This used to throw here, skip the message entirely, and hand
      // the button back as "Connect" — so a refused connection looked like
      // a click that never happened (2026-09-24, four presses in six
      // seconds). Every outcome now says something.
      const data: { success: boolean; instagramUserId?: string; username?: string | null; receiving?: boolean; message?: string } | null =
        await res.json().catch(() => null);
      if (data?.success) {
        setConnected(true);
        setReceiving(!!data.receiving);
        setInstagramUserId(data.instagramUserId ?? null);
        setInstagramUsername(data.username ?? null);
        setTokenDraft("");
      } else {
        setSaveError(data?.message ?? `FollowUp didn't answer properly (error ${res.status}). Nothing was saved — try again in a moment.`);
      }
    } catch {
      setSaveError("Couldn't reach FollowUp. Check your connection and try again.");
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
        setReceiving(false);
        setInstagramUserId(null);
        setInstagramUsername(null);
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
    <div className="box p-5">
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
              {receiving ? (
                /* items-start, not items-center: when the sentence wraps, a
                   centred tick drifts to the middle line — on the id
                   fallback it sat beside the number, not beside
                   "Connected". Found by rendering it at 390px. */
                <p className="text-xs flex items-start gap-1" style={{ color: "var(--sage)" }}>
                  {/* The handle when Meta gave us one: "@followupbase" is
                      something an owner can check against the account they
                      meant; "17841427527466039" is not. The id stays as the
                      fallback for accounts connected before the handle was
                      stored — true, just less useful. */}
                  <Check className="h-3.5 w-3.5 shrink-0 mt-px" />
                  {/* One span, so the flex row holds exactly two items —
                      icon and sentence — and the handle cannot be split
                      from its full stop by the row's gap. */}
                  <span>
                    {instagramUsername ? (
                      <>
                        Connected as <span className="font-medium">@{instagramUsername}</span>.
                      </>
                    ) : (
                      <>Connected — Instagram account ID {instagramUserId}.</>
                    )}{" "}
                    Real DMs will become leads automatically.
                  </span>
                </p>
              ) : (
                /* This tick used to show regardless. The subscription was
                   attempted on connect and its result thrown into an audit
                   row, so an account Meta had refused looked identical to
                   one that worked — and stayed silent forever. */
                <ChannelNotReceiving
                  platform="Instagram"
                  subject="Your account"
                  missed="nothing people DM you reaches FollowUp"
                  otherCause="the account is no longer set up as a Business or Creator account"
                  retryPath="/api/instagram/subscribe"
                  onReceiving={() => setReceiving(true)}
                  /* Instagram alone has a fallback: src/lib/instagramPoll.ts
                     reads this account's conversations on a cron and feeds
                     them through the same pipeline, subscription or no
                     subscription. So DMs do arrive — just not the second
                     they are sent. Saying "nothing reaches FollowUp" here
                     was false, and telling a tester their working channel is
                     dead is how a tester is lost. */
                  stillWorks="FollowUp checks it for new DMs every few minutes and picks them up."
                />
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
                    href="/api/instagram/oauth/start"
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-paper"
                    style={{ backgroundColor: "var(--ink)" }}
                  >
                    Connect with Instagram
                  </a>
                  {/* Meta's rule while the app is unreviewed, said before
                      the click rather than discovered as a refusal after it
                      (docs/tester-onboarding-checklist.md). */}
                  <p className="mt-2 text-xs text-ink-soft">
                    While FollowUp is in beta, Meta only lets accounts Sahil added as testers connect. If Meta refuses,
                    ask him to add you.
                  </p>
                </div>
              ) : (
                /* Rendering null here meant the one-click button simply
                   was not there, with nothing saying why — the owner is
                   left to guess whether Instagram is unsupported, broken,
                   or something they did. Same sentence the WhatsApp panel
                   gives for the same state: it is ours to finish. */
                <p className="text-xs text-ink-soft">
                  One-click connect isn&apos;t switched on yet — it&apos;s waiting on FollowUp&apos;s setup with
                  Meta, not on anything at your end. Use an access token below in the meantime.
                </p>
              )}

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
