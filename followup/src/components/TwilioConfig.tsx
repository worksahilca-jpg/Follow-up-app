"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Phone, PhoneCall, ShieldAlert, X } from "lucide-react";

type NumberStatus = {
  config: { voiceUrl: string; smsUrl: string; voiceCapable: boolean; smsCapable: boolean } | null;
  voiceMatches: boolean;
  smsMatches: boolean;
  calls: Array<{ sid: string; from: string; status: string; durationSeconds: number; startTime: string | null; error: string | null }>;
};

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
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
  const [hasAuthToken, setHasAuthToken] = useState(false);
  const [authTokenDraft, setAuthTokenDraft] = useState("");
  const [accountSid, setAccountSid] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [accountSidDraft, setAccountSidDraft] = useState("");
  const [phoneNumberDraft, setPhoneNumberDraft] = useState("");
  const [whatsappPhoneNumber, setWhatsappPhoneNumber] = useState<string | null>(null);
  const [whatsappPhoneNumberDraft, setWhatsappPhoneNumberDraft] = useState("");
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [voiceAgentEnabled, setVoiceAgentEnabled] = useState(false);
  const [numberStatus, setNumberStatus] = useState<NumberStatus | null>(null);
  const [numberError, setNumberError] = useState<string | null>(null);
  const [numberLoading, setNumberLoading] = useState(false);
  const [configuringNumber, setConfiguringNumber] = useState(false);
  const [savingVoiceAgent, setSavingVoiceAgent] = useState(false);
  const [savingOutbound, setSavingOutbound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<"sms" | "voice" | "whatsapp" | null>(null);
  const [showExamples, setShowExamples] = useState(false);

  useEffect(() => {
    fetch("/api/twilio/config")
      .then((r) => r.json())
      .then(
        (data: {
          success: boolean;
          smsUrl?: string | null;
          voiceUrl?: string | null;
          whatsappUrl?: string | null;
          hasAuthToken?: boolean;
          accountSid?: string | null;
          phoneNumber?: string | null;
          whatsappPhoneNumber?: string | null;
          voiceAgentEnabled?: boolean;
        }) => {
          if (data.success) {
            setSmsUrl(data.smsUrl ?? null);
            setVoiceUrl(data.voiceUrl ?? null);
            setWhatsappUrl(data.whatsappUrl ?? null);
            setHasAuthToken(!!data.hasAuthToken);
            setAccountSid(data.accountSid ?? null);
            setPhoneNumber(data.phoneNumber ?? null);
            setAccountSidDraft(data.accountSid ?? "");
            setPhoneNumberDraft(data.phoneNumber ?? "");
            setWhatsappPhoneNumber(data.whatsappPhoneNumber ?? null);
            setWhatsappPhoneNumberDraft(data.whatsappPhoneNumber ?? "");
            setVoiceAgentEnabled(!!data.voiceAgentEnabled);
          }
        }
      )
      .finally(() => setLoading(false));
  }, []);

  // Only worth asking Twilio once there's an Account SID + number to ask about.
  useEffect(() => {
    if (accountSid && phoneNumber) void loadNumberStatus();
  }, [accountSid, phoneNumber]);

  async function generate() {
    setSaving(true);
    try {
      const res = await fetch("/api/twilio/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data: { success: boolean; smsUrl?: string; voiceUrl?: string; whatsappUrl?: string } = await res.json();
      if (data.success) {
        setSmsUrl(data.smsUrl ?? null);
        setVoiceUrl(data.voiceUrl ?? null);
        setWhatsappUrl(data.whatsappUrl ?? null);
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

  async function saveOutbound() {
    if (!accountSidDraft.trim() || !phoneNumberDraft.trim()) return;
    setSavingOutbound(true);
    try {
      const res = await fetch("/api/twilio/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountSid: accountSidDraft.trim(), phoneNumber: phoneNumberDraft.trim() }),
      });
      const data: { success: boolean } = await res.json();
      if (data.success) {
        setAccountSid(accountSidDraft.trim());
        setPhoneNumber(phoneNumberDraft.trim());
      }
    } finally {
      setSavingOutbound(false);
    }
  }

  async function saveWhatsapp() {
    if (!whatsappPhoneNumberDraft.trim()) return;
    setSavingWhatsapp(true);
    try {
      const res = await fetch("/api/twilio/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsappPhoneNumber: whatsappPhoneNumberDraft.trim() }),
      });
      const data: { success: boolean } = await res.json();
      if (data.success) {
        setWhatsappPhoneNumber(whatsappPhoneNumberDraft.trim());
      }
    } finally {
      setSavingWhatsapp(false);
    }
  }

  async function loadNumberStatus() {
    setNumberLoading(true);
    setNumberError(null);
    try {
      const res = await fetch("/api/twilio/number");
      const data: { success: boolean; message?: string } & Partial<NumberStatus> = await res.json();
      if (data.success && data.calls) {
        setNumberStatus({ config: data.config ?? null, voiceMatches: !!data.voiceMatches, smsMatches: !!data.smsMatches, calls: data.calls });
      } else {
        setNumberError(data.message ?? "Couldn't reach Twilio.");
      }
    } catch {
      setNumberError("Couldn't reach Twilio.");
    } finally {
      setNumberLoading(false);
    }
  }

  async function configureNumber() {
    setConfiguringNumber(true);
    setNumberError(null);
    try {
      const res = await fetch("/api/twilio/number", { method: "POST" });
      const data: { success: boolean; message?: string } = await res.json();
      if (!data.success) setNumberError(data.message ?? "Twilio rejected the change.");
      await loadNumberStatus();
    } finally {
      setConfiguringNumber(false);
    }
  }

  async function toggleVoiceAgent(next: boolean) {
    setSavingVoiceAgent(true);
    try {
      const res = await fetch("/api/twilio/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceAgentEnabled: next }),
      });
      const data: { success: boolean } = await res.json();
      if (data.success) setVoiceAgentEnabled(next);
    } finally {
      setSavingVoiceAgent(false);
    }
  }

  async function copy(which: "sms" | "voice" | "whatsapp", value: string) {
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

              <div className="pt-3 border-t border-line">
                <p className="text-xs font-medium">Send text replies</p>
                <div className="mt-2 rounded-lg border border-line p-2.5" style={{ backgroundColor: "var(--gold-soft)" }}>
                  <p className="text-xs flex items-start gap-1.5" style={{ color: "var(--ink)" }}>
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: "var(--gold)" }} />
                    <span>
                      <strong className="font-medium">Know your consent obligations.</strong> Automated texts
                      from FollowUp — follow-ups and the missed-call reply — fall under TCPA rules in the US:
                      sending texts without the recipient&apos;s prior consent can carry real per-message
                      liability, and it&apos;s your business&apos;s liability, not FollowUp&apos;s. If you&apos;re
                      not sure your leads have opted in to texting, check with your own legal counsel before
                      relying on this channel.
                    </span>
                  </p>
                </div>
                <div className="mt-2 rounded-lg border border-line p-2.5" style={{ backgroundColor: "var(--gold-soft)" }}>
                  <p className="text-xs flex items-start gap-1.5" style={{ color: "var(--ink)" }}>
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: "var(--gold)" }} />
                    <span>
                      <strong className="font-medium">Register your number for A2P 10DLC.</strong> This is
                      separate from consent, above — it&apos;s about whether texts arrive at all. US carriers
                      (AT&amp;T, T-Mobile, Verizon) now block or heavily throttle automated texts from an
                      unregistered number, so an unregistered Twilio number can look &quot;Connected&quot; here
                      while its messages quietly never reach anyone. Registration (a Brand + Campaign) happens
                      once per Twilio account, in Twilio&apos;s own console — real cost, and typically a few
                      weeks to fully clear every carrier, so it&apos;s worth starting well before you&apos;re
                      relying on this channel.{" "}
                      <a
                        href="https://www.twilio.com/docs/messaging/compliance/a2p-10dlc/quickstart"
                        target="_blank"
                        rel="noopener"
                        className="underline"
                      >
                        Register in the Twilio Console
                      </a>
                      .
                    </span>
                  </p>
                </div>
                {accountSid && phoneNumber ? (
                  <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "var(--sage)" }}>
                    <Check className="h-3.5 w-3.5" /> Connected — replying to a text/call lead now sends a real SMS
                    from {phoneNumber}.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-ink-soft mt-1">
                      So &quot;Send now&quot; can actually text back a lead that only has a phone number, not just
                      email. Both values are shown openly on your{" "}
                      <a href="https://console.twilio.com" target="_blank" rel="noopener" className="underline">
                        Twilio Console
                      </a>{" "}
                      home page.
                    </p>
                    <div className="mt-2 space-y-2">
                      <input
                        value={accountSidDraft}
                        onChange={(e) => setAccountSidDraft(e.target.value)}
                        placeholder="Account SID (starts with AC...)"
                        className="w-full rounded-lg border border-line bg-paper px-3 py-1.5 text-xs"
                      />
                      <input
                        value={phoneNumberDraft}
                        onChange={(e) => setPhoneNumberDraft(e.target.value)}
                        placeholder="Your Twilio number, e.g. +18609358202"
                        className="w-full rounded-lg border border-line bg-paper px-3 py-1.5 text-xs"
                      />
                      <button
                        onClick={saveOutbound}
                        disabled={savingOutbound || !accountSidDraft.trim() || !phoneNumberDraft.trim()}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                        style={{ backgroundColor: "var(--ink)" }}
                      >
                        {savingOutbound ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </>
                )}
              </div>

              {accountSid && phoneNumber && (
                <div className="pt-3 border-t border-line">
                  <p className="text-xs font-medium">Point your number at FollowUp</p>
                  <p className="text-xs text-ink-soft mt-1">
                    Skip pasting URLs into the Twilio Console — FollowUp can set your number&apos;s &quot;A call comes
                    in&quot; and &quot;A message comes in&quot; webhooks itself, using the Account SID and Auth Token
                    you already saved.
                  </p>
                  {numberLoading && !numberStatus ? (
                    <p className="text-xs text-ink-soft mt-2">Checking with Twilio…</p>
                  ) : numberStatus ? (
                    <div className="mt-2 space-y-1.5">
                      {numberStatus.config ? (
                        <>
                          <p className="text-xs flex items-center gap-1" style={{ color: numberStatus.voiceMatches ? "var(--sage)" : "var(--gold)" }}>
                            {numberStatus.voiceMatches ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                            Calls {numberStatus.voiceMatches ? "reach FollowUp" : numberStatus.config.voiceUrl ? "go somewhere else" : "aren't configured"}
                          </p>
                          <p className="text-xs flex items-center gap-1" style={{ color: numberStatus.smsMatches ? "var(--sage)" : "var(--gold)" }}>
                            {numberStatus.smsMatches ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                            Texts {numberStatus.smsMatches ? "reach FollowUp" : numberStatus.config.smsUrl ? "go somewhere else" : "aren't configured"}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs flex items-center gap-1" style={{ color: "var(--gold)" }}>
                          <X className="h-3.5 w-3.5" /> {phoneNumber} isn&apos;t in this Twilio account — check the number and Account SID above.
                        </p>
                      )}
                      {numberStatus.config && !(numberStatus.voiceMatches && numberStatus.smsMatches) && (
                        <button
                          onClick={configureNumber}
                          disabled={configuringNumber}
                          className="mt-1 inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium disabled:opacity-60"
                          style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
                        >
                          {configuringNumber ? "Setting up…" : "Set up my number automatically"}
                        </button>
                      )}
                      {numberStatus.calls.length > 0 && (
                        <div className="mt-2">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-soft mb-1">Recent calls to your number</p>
                          <ul className="space-y-1">
                            {numberStatus.calls.map((c) => (
                              <li key={c.sid} className="text-xs rounded-lg border border-line bg-paper px-2.5 py-1.5">
                                <span className="font-medium">{c.from || "unknown"}</span>
                                <span className="text-ink-soft"> · {c.status}{c.durationSeconds ? ` · ${c.durationSeconds}s` : ""}{c.startTime ? ` · ${new Date(c.startTime).toLocaleString()}` : ""}</span>
                                {c.error && <div className="mt-0.5" style={{ color: "var(--gold)" }}>{c.error}</div>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <button onClick={loadNumberStatus} disabled={numberLoading} className="text-xs underline text-ink-soft disabled:opacity-60">
                        {numberLoading ? "Refreshing…" : "Refresh"}
                      </button>
                    </div>
                  ) : null}
                  {numberError && (
                    <p className="text-xs mt-2" style={{ color: "var(--gold)" }}>{numberError}</p>
                  )}
                </div>
              )}

              {whatsappUrl && (
                <div className="pt-3 border-t border-line">
                  <p className="text-xs font-medium">WhatsApp</p>
                  <p className="text-xs text-ink-soft mt-1">
                    Same Twilio account, a separate{" "}
                    <a
                      href="https://console.twilio.com/us1/develop/sms/senders/whatsapp-senders"
                      target="_blank"
                      rel="noopener"
                      className="underline"
                    >
                      WhatsApp Sender
                    </a>
                    . Paste the URL below into that sender&apos;s &quot;When a message comes in&quot; webhook. A
                    WhatsApp message merges into the same lead as a text from that number — it&apos;s just another
                    way they can reach you.
                  </p>
                  <div className="mt-2">
                    <pre className="rounded-lg bg-paper border border-line p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">
                      {whatsappUrl}
                    </pre>
                    <button onClick={() => copy("whatsapp", whatsappUrl)} className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1 border border-line">
                      {copied === "whatsapp" ? <Check className="h-3 w-3" /> : null}
                      {copied === "whatsapp" ? "Copied!" : "Copy"}
                    </button>
                  </div>

                  {!accountSid && (
                    <p className="text-xs text-ink-soft mt-2">
                      Save your Account SID above first — replying over WhatsApp uses the same Twilio credentials as
                      texting.
                    </p>
                  )}

                  {whatsappPhoneNumber ? (
                    <p className="text-xs mt-2 flex items-center gap-1" style={{ color: "var(--sage)" }}>
                      <Check className="h-3.5 w-3.5" /> Connected — replying to a WhatsApp lead sends a real WhatsApp
                      message from {whatsappPhoneNumber}.
                    </p>
                  ) : (
                    accountSid && (
                      <div className="mt-2 space-y-2">
                        <p className="text-xs text-ink-soft">
                          The WhatsApp-enabled number Twilio gave your sender (shown on that sender&apos;s page in
                          the Console) — often the same digits as your Twilio number above, sometimes a different
                          one.
                        </p>
                        <input
                          value={whatsappPhoneNumberDraft}
                          onChange={(e) => setWhatsappPhoneNumberDraft(e.target.value)}
                          placeholder="Your WhatsApp number, e.g. +18609358202"
                          className="w-full rounded-lg border border-line bg-paper px-3 py-1.5 text-xs"
                        />
                        <button
                          onClick={saveWhatsapp}
                          disabled={savingWhatsapp || !whatsappPhoneNumberDraft.trim()}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                          style={{ backgroundColor: "var(--ink)" }}
                        >
                          {savingWhatsapp ? "Saving…" : "Save"}
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}

              <div className="pt-3 border-t border-line">
                <p className="text-xs font-medium flex items-center gap-1.5">
                  <PhoneCall className="h-3.5 w-3.5" /> Live AI voice agent
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}
                  >
                    Beta
                  </span>
                </p>
                <p className="text-xs text-ink-soft mt-1">
                  Off by default. On, a call is answered live by an AI that actually talks with the caller —
                  no more &quot;leave a message after the tone.&quot; It speaks the caller&apos;s own language,
                  not just English. Off, calls work exactly as they do today (a recorded voicemail).
                </p>
                <div className="mt-2 rounded-lg border border-line p-2.5" style={{ backgroundColor: "var(--gold-soft)" }}>
                  <p className="text-xs flex items-start gap-1.5" style={{ color: "var(--ink)" }}>
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: "var(--gold)" }} />
                    <span>
                      <strong className="font-medium">Real per-minute cost, and a compliance step that&apos;s
                      on you.</strong> Every call the agent answers costs real money (Twilio + OpenAI, on top of
                      what you already pay for texting). Every call also opens with a spoken notice that
                      it&apos;s an AI and the call may be recorded — several states legally require caller
                      consent to record a call, and that notice is how it&apos;s obtained here. Turning this on
                      is a decision worth checking against your own state&apos;s call-recording law first, not
                      just a feature switch.
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => toggleVoiceAgent(!voiceAgentEnabled)}
                  disabled={savingVoiceAgent}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium disabled:opacity-60"
                  style={
                    voiceAgentEnabled
                      ? { backgroundColor: "var(--sage-soft)", color: "var(--sage)" }
                      : { backgroundColor: "var(--ink)", color: "var(--paper)" }
                  }
                >
                  {voiceAgentEnabled ? <Check className="h-4 w-4" /> : null}
                  {savingVoiceAgent ? "Saving…" : voiceAgentEnabled ? "On — calls are answered live" : "Turn on"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
