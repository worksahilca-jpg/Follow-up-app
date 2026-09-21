"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, MessageSquare } from "lucide-react";
import { useWhatsAppSignup } from "@/lib/useWhatsAppSignup";

/**
 * "WhatsApp" section of Settings — the owner's OWN number, through Meta.
 *
 * Rewritten 2026-09-19. Until then this panel asked for a Twilio account
 * and a Twilio-hosted WhatsApp sender, which meant a second number nobody
 * had ever seen. The founder's call: "Nobody wants to bring or use a new
 * number that is nowhere exposed for a business." Meta's Coexistence lets
 * the number already in the WhatsApp Business app on the owner's phone be
 * used here too, so this panel is now the same shape as Instagram's: one
 * sentence, one button, a connected line, a disconnect link.
 *
 * The Embedded Signup mechanism itself lives in `useWhatsAppSignup`
 * (src/lib/useWhatsAppSignup.ts), shared with the onboarding step that
 * asks where a business's leads come from — WhatsApp is the one source
 * that connects in a popup rather than a redirect, and it used to be
 * connectable only from this panel. What stays here is everything that
 * panel alone offers: the message template, the webhook reference, the
 * paste-a-token fallback for testing before Meta reviews the app, and
 * disconnecting.
 *
 * Copy rules (src/lib/__tests__/channelAvailability.test.ts): nothing here
 * offers or mentions the carrier channels.
 */

type Config = {
  connected: boolean;
  displayNumber: string | null;
  connectMode: string | null;
  templateName: string | null;
  templateLanguage: string | null;
  templateBody: string | null;
  twilioLegacy: boolean;
  signupAvailable: boolean;
  appId: string | null;
  configId: string | null;
  webhookUrl: string;
  verifyToken: string;
};

export default function WhatsAppConfig() {
  const signup = useWhatsAppSignup();
  const [config, setConfig] = useState<Config | null>(null);
  // Local only to the paste-a-token and disconnect paths below; the popup
  // signup carries its own state on the hook.
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [justConnected, setJustConnected] = useState(false);

  const [showManual, setShowManual] = useState(false);
  const [tokenDraft, setTokenDraft] = useState("");
  const [numberIdDraft, setNumberIdDraft] = useState("");
  const [wabaIdDraft, setWabaIdDraft] = useState("");

  const [templateNameDraft, setTemplateNameDraft] = useState("");
  const [templateLanguageDraft, setTemplateLanguageDraft] = useState("");
  const [templateBodyDraft, setTemplateBodyDraft] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

  const [showReference, setShowReference] = useState(false);
  const [copied, setCopied] = useState<"url" | "token" | null>(null);

  /**
   * This panel's own view of the config — the template, the webhook
   * reference, the Twilio-legacy flag. `useWhatsAppSignup` reads the same
   * endpoint for the parts it needs; two small reads of one cheap route
   * beat threading this panel's whole shape through a hook that two very
   * different surfaces share.
   */
  const load = useCallback(() => {
    return fetch("/api/whatsapp/config")
      .then((r) => r.json())
      .then((data: Config & { success: boolean }) => {
        if (!data.success) return;
        setConfig(data);
        setTemplateNameDraft(data.templateName ?? "");
        setTemplateLanguageDraft(data.templateLanguage ?? "");
        setTemplateBodyDraft(data.templateBody ?? "");
      });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function connectByToken() {
    if (!tokenDraft.trim() || !numberIdDraft.trim() || !wabaIdDraft.trim()) return;
    setConnecting(true);
    setConnectError(null);
    try {
      const res = await fetch("/api/whatsapp/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: tokenDraft.trim(), phoneNumberId: numberIdDraft.trim(), wabaId: wabaIdDraft.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string };
      if (!res.ok || !data.success) throw new Error(data.message || "Couldn't connect — check the three values.");
      setTokenDraft("");
      setNumberIdDraft("");
      setWabaIdDraft("");
      setJustConnected(true);
      await Promise.all([load(), signup.reload()]);
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Couldn't connect — check the three values.");
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    setConnecting(true);
    try {
      const res = await fetch("/api/whatsapp/config", { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean };
      if (data.success) {
        setJustConnected(false);
        signup.setError(null);
        await Promise.all([load(), signup.reload()]);
      }
    } finally {
      setConnecting(false);
    }
  }

  async function saveTemplate() {
    setSavingTemplate(true);
    setTemplateError(null);
    try {
      const res = await fetch("/api/whatsapp/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateName: templateNameDraft.trim(),
          templateLanguage: templateLanguageDraft.trim(),
          templateBody: templateBodyDraft.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string };
      if (!res.ok || !data.success) throw new Error(data.message || "Couldn't save — try again.");
      setTemplateSaved(true);
      setTimeout(() => setTemplateSaved(false), 2500);
      await load();
    } catch (err) {
      setTemplateError(err instanceof Error ? err.message : "Couldn't save — try again.");
    } finally {
      setSavingTemplate(false);
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

  if (!config) return null;

  const inputClass = "w-full rounded-lg border border-line bg-paper px-3 py-1.5 text-xs";
  const primaryButton = "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium disabled:opacity-60";

  return (
    <div className="box p-5">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}>
          <MessageSquare className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Catch WhatsApp messages</p>
          <p className="text-xs text-ink-soft mt-1">
            Your own WhatsApp number — the one already in the WhatsApp Business app on your phone. Anyone who
            messages it becomes a lead here, and replies go back from the same number. You keep using the app
            on your phone as before; what you send from there shows up here too.
          </p>

          {(justConnected || signup.justConnected) && (
            <p className="mt-2 text-xs" style={{ color: "var(--sage)" }} aria-live="polite">
              WhatsApp connected — new messages will become leads automatically.
            </p>
          )}
          {(connectError ?? signup.error) && (
            <p className="mt-2 text-xs" style={{ color: "var(--coral)" }} aria-live="polite">
              {connectError ?? signup.error}
            </p>
          )}

          {config.connected ? (
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-xs flex items-start gap-1.5" style={{ color: "var(--sage)" }}>
                  <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    Connected — {config.displayNumber ?? "your WhatsApp number"}.
                    {config.connectMode === "coexistence"
                      ? " Replies you send from the app on your phone show up here as well."
                      : config.connectMode === "cloud"
                        ? " This number lives only here, not in the app on a phone."
                        : ""}
                  </span>
                </p>
                {config.connectMode === "coexistence" && (
                  <p className="mt-1.5 text-xs text-ink-soft">
                    Keep opening the WhatsApp Business app on that phone at least once every 13 days, or Meta
                    pauses the connection.
                  </p>
                )}
                <button onClick={disconnect} disabled={connecting} className="mt-2 text-xs font-medium" style={{ color: "var(--coral)" }}>
                  Disconnect
                </button>
              </div>

              <div className="pt-3 border-t border-line space-y-2">
                <p className="text-xs font-medium">Following up after 24 hours</p>
                <p className="text-xs text-ink-soft">
                  WhatsApp lets a business reply freely for 24 hours after the customer&apos;s last message. After
                  that, only a message Meta approved in advance can go out — which is exactly FollowUp&apos;s
                  &quot;still interested?&quot; follow-up. Create one in{" "}
                  <a href="https://business.facebook.com/wa/manage/message-templates/" target="_blank" rel="noopener" className="underline">
                    WhatsApp Manager
                  </a>{" "}
                  (category Utility, one placeholder for the first name, e.g. &quot;Hi {"{{1}}"}, just following
                  up on your inquiry — still interested? Reply here anytime and I&apos;ll get right back to
                  you.&quot;), then enter its name and language below. Without one, a follow-up past 24 hours
                  isn&apos;t sent, and FollowUp tells you so.
                </p>
                {config.templateName && (
                  <p className="text-xs flex items-start gap-1.5" style={{ color: "var(--sage)" }}>
                    <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" /> Set up — a follow-up past 24 hours sends
                    &quot;{config.templateBody || config.templateName}&quot;.
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2">
                  <div>
                    <label htmlFor="wa-template-name" className="block text-xs font-medium text-ink-soft mb-1">
                      Template name
                    </label>
                    <input
                      id="wa-template-name"
                      value={templateNameDraft}
                      onChange={(e) => setTemplateNameDraft(e.target.value)}
                      placeholder="e.g. followup_still_interested"
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                  <div>
                    <label htmlFor="wa-template-language" className="block text-xs font-medium text-ink-soft mb-1">
                      Language
                    </label>
                    <input
                      id="wa-template-language"
                      value={templateLanguageDraft}
                      onChange={(e) => setTemplateLanguageDraft(e.target.value)}
                      placeholder="en"
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="wa-template-body" className="block text-xs font-medium text-ink-soft mb-1">
                    The approved wording, for your reference
                  </label>
                  <input
                    id="wa-template-body"
                    value={templateBodyDraft}
                    onChange={(e) => setTemplateBodyDraft(e.target.value)}
                    placeholder="e.g. Hi {{1}}, just following up…"
                    className={inputClass}
                  />
                </div>
                <button
                  onClick={saveTemplate}
                  disabled={savingTemplate}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-paper disabled:opacity-60"
                  style={{ backgroundColor: "var(--ink)" }}
                >
                  {savingTemplate ? "Saving…" : config.templateName ? "Update" : "Save"}
                </button>
                {templateSaved && (
                  <p className="text-xs flex items-center gap-1" style={{ color: "var(--sage)" }} aria-live="polite">
                    <Check className="h-3.5 w-3.5" /> Saved
                  </p>
                )}
                {templateError && (
                  <p className="text-xs" style={{ color: "var(--coral)" }} aria-live="polite">
                    {templateError}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {config.twilioLegacy && (
                <p className="text-xs text-ink-soft">
                  WhatsApp is still connected the earlier way, through your Twilio sender, and keeps working.
                  Connect your own number below to move over.
                </p>
              )}

              {config.signupAvailable ? (
                <div>
                  <button
                    onClick={signup.start}
                    disabled={signup.connecting || connecting}
                    className={primaryButton}
                    style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
                  >
                    {signup.connecting ? "Finishing in Meta's window…" : "Connect WhatsApp"}
                  </button>
                  <p className="mt-2 text-xs text-ink-soft">
                    Meta opens a window. Have the phone with your WhatsApp Business app ready — you&apos;ll scan a
                    code with it, and the number stays on that phone. While FollowUp is in beta, Meta only lets
                    accounts Sahil added as testers connect.
                  </p>
                </div>
              ) : (
                /* A file path inside our own repository was being shown to
                   the customer as if it were something they could open.
                   Nothing they can act on belongs here — this is ours to
                   finish, so the sentence says who it is waiting on. */
                <p className="text-xs text-ink-soft">
                  One-click connect isn&apos;t switched on yet — it&apos;s waiting on FollowUp&apos;s setup with Meta,
                  not on anything at your end. Use an access token below in the meantime.
                </p>
              )}

              <div>
                <button
                  onClick={() => setShowManual((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-ink-soft"
                >
                  <ChevronDown className={`h-3 w-3 transition-transform ${showManual ? "rotate-180" : ""}`} />
                  {config.signupAvailable ? "Have an access token instead?" : "Connect with an access token"}
                </button>
                {(showManual || !config.signupAvailable) && (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-ink-soft">
                      From WhatsApp Manager: a System User access token with the WhatsApp permissions, the phone
                      number ID, and the WhatsApp Business Account ID.
                    </p>
                    <input
                      id="wa-access-token"
                      type="password"
                      value={tokenDraft}
                      onChange={(e) => setTokenDraft(e.target.value)}
                      placeholder="Access token (kept secret, never shown again)"
                      className={inputClass}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        id="wa-phone-number-id"
                        inputMode="numeric"
                        value={numberIdDraft}
                        onChange={(e) => setNumberIdDraft(e.target.value)}
                        placeholder="Phone number ID"
                        className={`${inputClass} font-mono`}
                      />
                      <input
                        id="wa-waba-id"
                        inputMode="numeric"
                        value={wabaIdDraft}
                        onChange={(e) => setWabaIdDraft(e.target.value)}
                        placeholder="WhatsApp Business Account ID"
                        className={`${inputClass} font-mono`}
                      />
                    </div>
                    <button
                      onClick={connectByToken}
                      disabled={connecting || !tokenDraft.trim() || !numberIdDraft.trim() || !wabaIdDraft.trim()}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-paper disabled:opacity-60"
                      style={{ backgroundColor: "var(--ink)" }}
                    >
                      {connecting ? "Connecting…" : "Connect"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            onClick={() => setShowReference((v) => !v)}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-ink-soft"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${showReference ? "rotate-180" : ""}`} />
            Meta console reference
          </button>
          {showReference && (
            <div className="mt-2 rounded-lg bg-paper border border-line p-3 text-xs text-ink-soft space-y-2">
              <p>
                Webhook (set up once, not per business) — subscribed to messages, smb_message_echoes, history and
                smb_app_state_sync for WhatsApp.
              </p>
              <div>
                <p className="font-medium text-ink">Callback URL</p>
                <pre className="mt-1 rounded-lg bg-card border border-line p-2 overflow-x-auto whitespace-pre-wrap break-all">{config.webhookUrl}</pre>
                <button onClick={() => copy("url", config.webhookUrl)} className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1 border border-line">
                  {copied === "url" ? <Check className="h-3 w-3" /> : null}
                  {copied === "url" ? "Copied!" : "Copy"}
                </button>
              </div>
              <div>
                <p className="font-medium text-ink">Verify token</p>
                <pre className="mt-1 rounded-lg bg-card border border-line p-2 overflow-x-auto whitespace-pre-wrap break-all">{config.verifyToken}</pre>
                <button onClick={() => copy("token", config.verifyToken)} className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1 border border-line">
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
