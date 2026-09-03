"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Phone } from "lucide-react";

/**
 * "Phone (SMS + calls)" section of Settings. Unlike the other two webhook
 * components, this one has a real prerequisite the business doesn't have
 * yet (a paid Twilio account + phone number) — so it's written to be
 * useful to set up in advance: generate the URLs now, paste an Auth Token
 * in whenever the Twilio account exists, no rush either way.
 */
export default function TwilioConfig() {
  const [loading, setLoading] = useState(true);
  const [smsUrl, setSmsUrl] = useState<string | null>(null);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [hasAuthToken, setHasAuthToken] = useState(false);
  const [authTokenDraft, setAuthTokenDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<"sms" | "voice" | null>(null);
  const [showExamples, setShowExamples] = useState(false);

  useEffect(() => {
    fetch("/api/twilio/config")
      .then((r) => r.json())
      .then((data: { success: boolean; smsUrl?: string | null; voiceUrl?: string | null; hasAuthToken?: boolean }) => {
        if (data.success) {
          setSmsUrl(data.smsUrl ?? null);
          setVoiceUrl(data.voiceUrl ?? null);
          setHasAuthToken(!!data.hasAuthToken);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function generate() {
    setSaving(true);
    try {
      const res = await fetch("/api/twilio/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data: { success: boolean; smsUrl?: string; voiceUrl?: string } = await res.json();
      if (data.success) {
        setSmsUrl(data.smsUrl ?? null);
        setVoiceUrl(data.voiceUrl ?? null);
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveAuthToken() {
    if (!authTokenDraft.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/twilio/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authToken: authTokenDraft.trim() }),
      });
      const data: { success: boolean } = await res.json();
      if (data.success) {
        setHasAuthToken(true);
        setAuthTokenDraft("");
      }
    } finally {
      setSaving(false);
    }
  }

  async function copy(which: "sms" | "voice", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt("Copy this URL:", value);
    }
  }

  if (loading) return null;

  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}>
          <Phone className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Catch texts and calls</p>
          <p className="text-xs text-ink-soft mt-1">
            Needs a Twilio account and phone number (paid, ~$1/mo + per message/call — not required to use the
            rest of FollowUp). Set the URLs up now, connect the Twilio side whenever you&apos;re ready.
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
                Buy a phone number in the{" "}
                <a href="https://console.twilio.com/us1/develop/phone-numbers/manage/incoming" target="_blank" rel="noopener" className="underline">
                  Twilio Console
                </a>
                , open it, and paste the SMS URL below into &quot;A message comes in,&quot; and the Voice URL into
                &quot;A call comes in.&quot;
              </p>
              <p>
                A text becomes a lead immediately. A call gets a short recorded greeting — the caller leaves a
                message, Twilio transcribes it for free, and it lands here as a lead too, even if they hang up
                without saying anything.
              </p>
            </div>
          )}

          {!smsUrl && (
            <button
              onClick={generate}
              disabled={saving}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium rounded-lg px-3.5 py-2 disabled:opacity-60"
              style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
            >
              {saving ? "Generating…" : "Generate URLs"}
            </button>
          )}

          {smsUrl && voiceUrl && (
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-xs font-medium text-ink-soft mb-1">SMS URL — &quot;A message comes in&quot;</p>
                <pre className="rounded-lg bg-paper border border-line p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">
                  {smsUrl}
                </pre>
                <button onClick={() => copy("sms", smsUrl)} className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1 border border-line">
                  {copied === "sms" ? <Check className="h-3 w-3" /> : null}
                  {copied === "sms" ? "Copied!" : "Copy"}
                </button>
              </div>
              <div>
                <p className="text-xs font-medium text-ink-soft mb-1">Voice URL — &quot;A call comes in&quot;</p>
                <pre className="rounded-lg bg-paper border border-line p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">
                  {voiceUrl}
                </pre>
                <button onClick={() => copy("voice", voiceUrl)} className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1 border border-line">
                  {copied === "voice" ? <Check className="h-3 w-3" /> : null}
                  {copied === "voice" ? "Copied!" : "Copy"}
                </button>
              </div>

              <div className="pt-1 border-t border-line">
                {hasAuthToken ? (
                  <p className="text-xs flex items-center gap-1" style={{ color: "var(--sage)" }}>
                    <Check className="h-3.5 w-3.5" /> Auth Token saved — requests are verified as really coming
                    from Twilio.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-ink-soft mt-2">
                      Optional but recommended: paste your Twilio{" "}
                      <a href="https://console.twilio.com" target="_blank" rel="noopener" className="underline">
                        Auth Token
                      </a>{" "}
                      so FollowUp can verify requests are really from Twilio and not spoofed. Works without it too
                      — you can add this later.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <input
                        type="password"
                        value={authTokenDraft}
                        onChange={(e) => setAuthTokenDraft(e.target.value)}
                        placeholder="Twilio Auth Token"
                        className="flex-1 rounded-lg border border-line bg-paper px-3 py-1.5 text-xs"
                      />
                      <button
                        onClick={saveAuthToken}
                        disabled={saving || !authTokenDraft.trim()}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                        style={{ backgroundColor: "var(--ink)" }}
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
