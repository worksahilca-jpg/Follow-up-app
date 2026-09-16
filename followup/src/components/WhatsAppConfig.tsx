"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, ChevronDown, MessageSquare } from "lucide-react";

/**
 * "WhatsApp" section of Settings.
 *
 * Split out of TwilioConfig on 2026-09-16. WhatsApp is delivered through
 * the same Twilio account as the carrier channels, so for a while it lived
 * inside the "Phone (SMS + calls)" panel — which meant that when the
 * carrier channels were dropped (CARRIER_CHANNELS_AVAILABLE, @/lib/pricing)
 * and that panel was hidden, WhatsApp had no setup UI at all. A channel the
 * product offers has to be connectable on its own.
 *
 * It is a separate panel rather than a flag inside the old one because the
 * two setups genuinely differ, not just cosmetically:
 *  - the Auth Token is REQUIRED here (src/lib/twilio.ts's sendWhatsApp bails
 *    without it), where in the carrier panel it was optional and only used
 *    to verify inbound signatures;
 *  - the number is the WhatsApp Sender's number, which is not always the
 *    Twilio voice/SMS number;
 *  - what a business has to wait for is Meta's review of its business, not
 *    anything a carrier controls.
 *
 * The three credential fields all POST to the same /api/twilio/config
 * endpoint the carrier panel uses — they are one Twilio account, and saving
 * them here is the same save. Nothing about SMS or calls is offered here,
 * in either affordance or copy.
 */
export default function WhatsAppConfig() {
  const [loading, setLoading] = useState(true);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
  const [accountSid, setAccountSid] = useState<string | null>(null);
  const [hasAuthToken, setHasAuthToken] = useState(false);
  const [whatsappPhoneNumber, setWhatsappPhoneNumber] = useState<string | null>(null);
  const [accountSidDraft, setAccountSidDraft] = useState("");
  const [authTokenDraft, setAuthTokenDraft] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");
  const [editingAccount, setEditingAccount] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountSaved, setAccountSaved] = useState(false);
  const [templateSid, setTemplateSid] = useState<string | null>(null);
  const [templateBody, setTemplateBody] = useState<string | null>(null);
  const [templateSidDraft, setTemplateSidDraft] = useState("");
  const [templateBodyDraft, setTemplateBodyDraft] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateSaved, setTemplateSaved] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showExamples, setShowExamples] = useState(false);

  useEffect(() => {
    fetch("/api/twilio/config")
      .then((r) => r.json())
      .then(
        (data: {
          success: boolean;
          whatsappUrl?: string | null;
          accountSid?: string | null;
          hasAuthToken?: boolean;
          whatsappPhoneNumber?: string | null;
          whatsappTemplateSid?: string | null;
          whatsappTemplateBody?: string | null;
        }) => {
          if (!data.success) return;
          setWhatsappUrl(data.whatsappUrl ?? null);
          setAccountSid(data.accountSid ?? null);
          setHasAuthToken(!!data.hasAuthToken);
          setWhatsappPhoneNumber(data.whatsappPhoneNumber ?? null);
          setAccountSidDraft(data.accountSid ?? "");
          setPhoneDraft(data.whatsappPhoneNumber ?? "");
          setTemplateSid(data.whatsappTemplateSid ?? null);
          setTemplateBody(data.whatsappTemplateBody ?? null);
          setTemplateSidDraft(data.whatsappTemplateSid ?? "");
          setTemplateBodyDraft(data.whatsappTemplateBody ?? "");
        }
      )
      .finally(() => setLoading(false));
  }, []);

  // All three are needed before a reply can actually go out
  // (src/lib/twilio.ts sendWhatsApp), so "connected" means all three.
  const connected = !!accountSid && hasAuthToken && !!whatsappPhoneNumber;

  async function generate() {
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/twilio/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data: { success: boolean; whatsappUrl?: string; message?: string } = await res.json();
      if (data.success) setWhatsappUrl(data.whatsappUrl ?? null);
      else setGenerateError(data.message ?? "Couldn't generate the URL — try again.");
    } catch {
      setGenerateError("Couldn't generate the URL — try again.");
    } finally {
      setGenerating(false);
    }
  }

  // One save for all three values rather than the three separate saves the
  // old panel had: they are useless individually — a reply needs every one
  // of them — so three "Saved" moments only made a half-connected state
  // look finished.
  async function saveAccount() {
    if (!accountSidDraft.trim() || !phoneDraft.trim() || (!hasAuthToken && !authTokenDraft.trim())) return;
    setSavingAccount(true);
    setAccountError(null);
    try {
      const res = await fetch("/api/twilio/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountSid: accountSidDraft.trim(),
          whatsappPhoneNumber: phoneDraft.trim(),
          // Left out entirely when blank, so an existing saved token isn't
          // wiped by someone editing only the number.
          ...(authTokenDraft.trim() ? { authToken: authTokenDraft.trim() } : {}),
        }),
      });
      const data: { success: boolean; message?: string } = await res.json();
      if (data.success) {
        setAccountSid(accountSidDraft.trim());
        setWhatsappPhoneNumber(phoneDraft.trim());
        if (authTokenDraft.trim()) setHasAuthToken(true);
        setAuthTokenDraft("");
        setEditingAccount(false);
        setAccountSaved(true);
        setTimeout(() => setAccountSaved(false), 2500);
      } else {
        setAccountError(data.message ?? "Couldn't save — try again.");
      }
    } catch {
      setAccountError("Couldn't save — try again.");
    } finally {
      setSavingAccount(false);
    }
  }

  async function saveTemplate() {
    setSavingTemplate(true);
    setTemplateError(null);
    try {
      const res = await fetch("/api/twilio/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsappTemplateSid: templateSidDraft.trim(),
          whatsappTemplateBody: templateBodyDraft.trim(),
        }),
      });
      const data: { success: boolean; message?: string } = await res.json();
      if (data.success) {
        setTemplateSid(templateSidDraft.trim() || null);
        setTemplateBody(templateBodyDraft.trim() || null);
        setTemplateSaved(true);
        setTimeout(() => setTemplateSaved(false), 2500);
      } else {
        setTemplateError(data.message ?? "Couldn't save — try again.");
      }
    } catch {
      setTemplateError("Couldn't save — try again.");
    } finally {
      setSavingTemplate(false);
    }
  }

  async function copyUrl(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this URL:", value);
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
          <p className="text-sm font-medium">Catch WhatsApp messages</p>
          <p className="text-xs text-ink-soft mt-1">
            Anyone who messages your business on WhatsApp becomes a lead here, and your replies go back to them
            on WhatsApp. Two things are needed first: a{" "}
            <a href="https://console.twilio.com" target="_blank" rel="noopener" className="underline">
              Twilio
            </a>{" "}
            account (paid, from about $1/month), and Meta&apos;s approval of your business — the same review
            Instagram and Messenger need.
          </p>

          <button
            onClick={() => setShowExamples((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-ink-soft"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${showExamples ? "rotate-180" : ""}`} />
            How does this work?
          </button>
          {showExamples && (
            <div className="mt-2 rounded-lg bg-paper border border-line p-3 text-xs text-ink-soft space-y-1.5">
              <p>
                In the Twilio Console, add a{" "}
                <a
                  href="https://console.twilio.com/us1/develop/sms/senders/whatsapp-senders"
                  target="_blank"
                  rel="noopener"
                  className="underline"
                >
                  WhatsApp Sender
                </a>{" "}
                for your business number, open it, and paste the URL below into &quot;When a message comes
                in.&quot;
              </p>
              <p>
                From then on, a WhatsApp message arrives here as a lead with the whole conversation attached, and
                anything you send back from FollowUp lands in their WhatsApp.
              </p>
            </div>
          )}

          {/* Its own block, not a sibling of the inline disclosure button
              above — two inline-flex buttons in a row put "Generate URL"
              beside "How does this work?" and made the primary action look
              like part of the sentence. */}
          {!whatsappUrl && (
            <div className="mt-3">
              <button
                onClick={generate}
                disabled={generating}
                className="inline-flex items-center gap-1.5 text-sm font-medium rounded-lg px-3.5 py-2 disabled:opacity-60"
                style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
              >
                {generating ? "Generating…" : "Generate URL"}
              </button>
              {generateError && (
                <p className="mt-2 text-xs" style={{ color: "var(--coral)" }} aria-live="polite">
                  {generateError}
                </p>
              )}
            </div>
          )}

          {whatsappUrl && (
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-xs font-medium text-ink-soft mb-1">
                  WhatsApp URL — &quot;When a message comes in&quot;
                </p>
                <pre className="rounded-lg bg-paper border border-line p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">
                  {whatsappUrl}
                </pre>
                <button
                  onClick={() => copyUrl(whatsappUrl)}
                  className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1 border border-line"
                >
                  {copied ? <Check className="h-3 w-3" /> : null}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>

              <div className="rounded-lg border border-line p-2.5" style={{ backgroundColor: "var(--gold-soft)" }}>
                <p className="text-xs flex items-start gap-1.5" style={{ color: "var(--ink)" }}>
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: "var(--coral)" }} />
                  <span>
                    <strong className="font-medium">Verify your business with Meta.</strong> Until Meta Business
                    Verification clears on your own Meta Business Manager, a new sender can start at most 250
                    conversations a day. It&apos;s a one-time review each business does for itself, usually 2-10
                    business days. Replying to someone who messaged you first isn&apos;t affected by that limit.{" "}
                    <a
                      href="https://www.twilio.com/docs/whatsapp/self-sign-up"
                      target="_blank"
                      rel="noopener"
                      className="underline"
                    >
                      WhatsApp sender setup &amp; verification
                    </a>
                    .
                  </span>
                </p>
              </div>

              <div className="pt-3 border-t border-line">
                <p className="text-xs font-medium">Let FollowUp reply for you</p>
                {connected && !editingAccount ? (
                  <>
                    <p className="text-xs mt-1 flex items-start gap-1.5" style={{ color: "var(--sage)" }}>
                      <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      Connected — a reply to a WhatsApp lead is sent from {whatsappPhoneNumber}.
                    </p>
                    <button
                      onClick={() => {
                        setEditingAccount(true);
                        setAccountError(null);
                      }}
                      className="mt-1.5 text-xs font-medium underline underline-offset-2 text-ink-soft"
                    >
                      Change these details
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-ink-soft mt-1">
                      Three values from your{" "}
                      <a href="https://console.twilio.com" target="_blank" rel="noopener" className="underline">
                        Twilio Console
                      </a>
                      : the Account SID and Auth Token from its home page, and the WhatsApp number Twilio gave
                      your sender — shown on that sender&apos;s own page.
                    </p>
                    <div className="mt-2 space-y-2">
                      <div>
                        <label htmlFor="wa-account-sid" className="block text-xs font-medium text-ink-soft mb-1">
                          Account SID
                        </label>
                        <input
                          id="wa-account-sid"
                          value={accountSidDraft}
                          onChange={(e) => setAccountSidDraft(e.target.value)}
                          placeholder="Starts with AC…"
                          className="w-full rounded-lg border border-line bg-paper px-3 py-1.5 text-xs"
                        />
                      </div>
                      <div>
                        <label htmlFor="wa-auth-token" className="block text-xs font-medium text-ink-soft mb-1">
                          Auth Token
                        </label>
                        <input
                          id="wa-auth-token"
                          type="password"
                          value={authTokenDraft}
                          onChange={(e) => setAuthTokenDraft(e.target.value)}
                          placeholder={hasAuthToken ? "Saved — leave blank to keep it" : "Kept secret, never shown again"}
                          className="w-full rounded-lg border border-line bg-paper px-3 py-1.5 text-xs"
                        />
                      </div>
                      <div>
                        <label htmlFor="wa-number" className="block text-xs font-medium text-ink-soft mb-1">
                          Your WhatsApp number
                        </label>
                        <input
                          id="wa-number"
                          inputMode="tel"
                          value={phoneDraft}
                          onChange={(e) => setPhoneDraft(e.target.value)}
                          placeholder="e.g. +18609358202"
                          className="w-full rounded-lg border border-line bg-paper px-3 py-1.5 text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={saveAccount}
                          disabled={
                            savingAccount ||
                            !accountSidDraft.trim() ||
                            !phoneDraft.trim() ||
                            (!hasAuthToken && !authTokenDraft.trim())
                          }
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                          style={{ backgroundColor: "var(--ink)" }}
                        >
                          {savingAccount ? "Saving…" : "Save"}
                        </button>
                        {editingAccount && connected && (
                          <button
                            onClick={() => {
                              setEditingAccount(false);
                              setAccountSidDraft(accountSid ?? "");
                              setPhoneDraft(whatsappPhoneNumber ?? "");
                              setAuthTokenDraft("");
                              setAccountError(null);
                            }}
                            className="text-xs font-medium text-ink-soft"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
                {accountSaved && (
                  <p className="mt-2 text-xs flex items-center gap-1" style={{ color: "var(--sage)" }} aria-live="polite">
                    <Check className="h-3.5 w-3.5" /> Saved
                  </p>
                )}
                {accountError && (
                  <p className="mt-2 text-xs" style={{ color: "var(--coral)" }} aria-live="polite">
                    {accountError}
                  </p>
                )}
              </div>

              {connected && (
                <div className="pt-3 border-t border-line space-y-2">
                  <p className="text-xs font-medium">Re-opening a conversation after 24 hours</p>
                  <p className="text-xs text-ink-soft">
                    WhatsApp only lets you write to someone more than 24 hours after their last message using a
                    message they approved in advance. Create one for this exact case in your{" "}
                    <a
                      href="https://console.twilio.com/us1/develop/sms/content-template-builder"
                      target="_blank"
                      rel="noopener"
                      className="underline"
                    >
                      Twilio Content Template Builder
                    </a>{" "}
                    — a single variable for the lead&apos;s first name is enough (e.g. &quot;Hi {"{{1}}"}, just
                    checking in — still interested? Reply anytime and we&apos;ll pick right back up.&quot;). Once
                    it&apos;s approved, paste its Content SID below. Until then, a follow-up past 24 hours goes by
                    email instead.
                  </p>
                  {templateSid && (
                    <p className="text-xs flex items-start gap-1.5" style={{ color: "var(--sage)" }}>
                      <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" /> Set up — a reply past 24 hours sends
                      &quot;{templateBody || templateSid}&quot; instead of falling back.
                    </p>
                  )}
                  <div>
                    <label htmlFor="wa-template-sid" className="block text-xs font-medium text-ink-soft mb-1">
                      Content SID
                    </label>
                    <input
                      id="wa-template-sid"
                      value={templateSidDraft}
                      onChange={(e) => setTemplateSidDraft(e.target.value)}
                      placeholder="e.g. HXa1b2c3d4e5f6…"
                      className="w-full rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label htmlFor="wa-template-body" className="block text-xs font-medium text-ink-soft mb-1">
                      The approved wording, for your reference
                    </label>
                    <input
                      id="wa-template-body"
                      value={templateBodyDraft}
                      onChange={(e) => setTemplateBodyDraft(e.target.value)}
                      placeholder="e.g. Hi {{1}}, just checking in…"
                      className="w-full rounded-lg border border-line bg-paper px-3 py-1.5 text-xs"
                    />
                  </div>
                  <button
                    onClick={saveTemplate}
                    disabled={savingTemplate}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                    style={{ backgroundColor: "var(--ink)" }}
                  >
                    {savingTemplate ? "Saving…" : templateSid ? "Update" : "Save"}
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
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
