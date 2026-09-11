"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import TeamSection from "@/components/TeamSection";
import SourceRoutingSection from "@/components/SourceRoutingSection";
import CopyEmbedSnippet from "@/components/CopyEmbedSnippet";
import CopyWebhookUrl from "@/components/CopyWebhookUrl";
import OutboundWebhookConfig from "@/components/OutboundWebhookConfig";
import TwilioConfig from "@/components/TwilioConfig";
import InstagramConfig from "@/components/InstagramConfig";
import FacebookConfig from "@/components/FacebookConfig";
import CrmConfig from "@/components/CrmConfig";
import FilteredEmails from "@/components/FilteredEmails";
import DataPrivacySection from "@/components/DataPrivacySection";
import { Mail, Calendar, Check, RefreshCw, Zap, CreditCard, Search, MessageSquareHeart, ShieldCheck } from "lucide-react";

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageInner />
    </Suspense>
  );
}

// 12 sections in one long scroll was the actual complaint — grouping them
// into 4 tabs (research/product/2026-09-10-ux-simplification.md §6) means a
// visit only ever shows the one thing you came for. Every section keeps its
// existing id so links pointing at #billing etc. (see getIncompleteSetupSteps)
// keep working — this map is just which tab a given id lives under.
type SettingsTab = "connect" | "team" | "billing" | "advanced";
const TAB_LABEL: Record<SettingsTab, string> = {
  connect: "Connect",
  team: "Team",
  billing: "Billing",
  advanced: "Advanced",
};
const SECTION_TAB: Record<string, SettingsTab> = {
  integrations: "connect",
  "website-widget": "connect",
  "lead-webhook": "connect",
  "outbound-webhook": "connect",
  phone: "connect",
  social: "connect",
  crm: "connect",
  "lead-routing": "team",
  team: "team",
  billing: "billing",
  automation: "advanced",
  feedback: "advanced",
  data: "advanced",
};

function SettingsPageInner() {
  const searchParams = useSearchParams();
  // A link elsewhere in the app (a Sidebar nag, the dashboard's setup strip)
  // points at a specific section's id, e.g. /settings#billing — honor that
  // by opening straight into the tab that section lives in, so the browser's
  // own anchor scroll lands on it once it's actually in the DOM. Lazy
  // initializer so this only ever reads location.hash once, on mount.
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    if (typeof window === "undefined") return "connect";
    return SECTION_TAB[window.location.hash.slice(1)] ?? "connect";
  });
  const scrolledRef = useRef(false);

  useEffect(() => {
    if (scrolledRef.current) return;
    scrolledRef.current = true;
    const id = window.location.hash.slice(1);
    if (id && SECTION_TAB[id]) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
  }, []);

  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailPushActive, setGmailPushActive] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | undefined>();
  const [gmailStatusLoaded, setGmailStatusLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [scanningSpam, setScanningSpam] = useState(false);
  const [spamScanResult, setSpamScanResult] = useState<string | null>(null);

  const [outlookConnected, setOutlookConnected] = useState(false);
  const [outlookEmail, setOutlookEmail] = useState<string | undefined>();
  const [outlookOauthAvailable, setOutlookOauthAvailable] = useState(false);
  const [outlookStatusLoaded, setOutlookStatusLoaded] = useState(false);
  const [outlookSyncing, setOutlookSyncing] = useState(false);
  const [outlookSyncResult, setOutlookSyncResult] = useState<string | null>(null);
  const [outlookDisconnecting, setOutlookDisconnecting] = useState(false);

  const [autoAfterDays, setAutoAfterDays] = useState(5);
  const [automationOn, setAutomationOn] = useState(false);
  const [automationLoaded, setAutomationLoaded] = useState(false);
  const [automationSaving, setAutomationSaving] = useState(false);
  const [runningNow, setRunningNow] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [automationError, setAutomationError] = useState<string | null>(null);
  const [instantAckOn, setInstantAckOn] = useState(true);
  const [instantAckSaving, setInstantAckSaving] = useState(false);
  const [instantAckError, setInstantAckError] = useState<string | null>(null);
  const [unansweredOn, setUnansweredOn] = useState(true);
  const [unansweredHours, setUnansweredHours] = useState(24);
  const [unansweredSaving, setUnansweredSaving] = useState(false);
  const [unansweredError, setUnansweredError] = useState<string | null>(null);
  const [deadLeadOn, setDeadLeadOn] = useState(true);
  const [deadLeadDays, setDeadLeadDays] = useState(45);
  const [deadLeadSaving, setDeadLeadSaving] = useState(false);
  const [deadLeadError, setDeadLeadError] = useState<string | null>(null);

  const [billingActive, setBillingActive] = useState(false);
  const [billingStatus, setBillingStatus] = useState<string | null>(null);
  const [billingPeriodEnd, setBillingPeriodEnd] = useState<string | null>(null);
  const [billingLoaded, setBillingLoaded] = useState(false);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // Real connection state, fetched from the DB via the API route — not
  // local/demo state.
  useEffect(() => {
    fetch("/api/integrations/gmail/status")
      .then((r) => r.json())
      .then((data: { connected: boolean; email?: string; pushActive?: boolean }) => {
        setGmailConnected(data.connected);
        setGmailEmail(data.email);
        setGmailPushActive(Boolean(data.pushActive));
      })
      .finally(() => setGmailStatusLoaded(true));
  }, []);

  useEffect(() => {
    fetch("/api/integrations/outlook/status")
      .then((r) => r.json())
      .then((data: { connected: boolean; email?: string; oauthAvailable?: boolean }) => {
        setOutlookConnected(data.connected);
        setOutlookEmail(data.email);
        setOutlookOauthAvailable(Boolean(data.oauthAvailable));
      })
      .finally(() => setOutlookStatusLoaded(true));
  }, []);

  // Real automation settings (business-level master switch + delay).
  useEffect(() => {
    fetch("/api/automation/settings")
      .then((r) => r.json())
      .then(
        (data: {
          enabled: boolean;
          triggerDays: number;
          instantAck?: boolean;
          unansweredReply?: { enabled: boolean; hours: number };
          deadLeadReactivation?: { enabled: boolean; days: number };
        }) => {
          setAutomationOn(data.enabled);
          setAutoAfterDays(data.triggerDays);
          setInstantAckOn(data.instantAck ?? true);
          setUnansweredOn(data.unansweredReply?.enabled ?? true);
          setUnansweredHours(data.unansweredReply?.hours ?? 24);
          setDeadLeadOn(data.deadLeadReactivation?.enabled ?? true);
          setDeadLeadDays(data.deadLeadReactivation?.days ?? 45);
        }
      )
      .finally(() => setAutomationLoaded(true));
  }, []);

  async function saveAutomationSettings(enabled: boolean, triggerDays: number) {
    setAutomationSaving(true);
    setAutomationError(null);
    try {
      const res = await fetch("/api/automation/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, triggerDays }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setAutomationOn(!enabled); // revert the optimistic flip
        setAutomationError(data.message ?? "Couldn't save — try again.");
      }
    } finally {
      setAutomationSaving(false);
    }
  }

  async function saveUnanswered(enabled: boolean, hours: number) {
    setUnansweredSaving(true);
    setUnansweredError(null);
    try {
      const res = await fetch("/api/automation/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unansweredReply: { enabled, hours } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setUnansweredOn(!enabled);
        setUnansweredError(data.message ?? "Couldn't save — try again.");
      }
    } finally {
      setUnansweredSaving(false);
    }
  }

  async function saveDeadLead(enabled: boolean, days: number) {
    setDeadLeadSaving(true);
    setDeadLeadError(null);
    try {
      const res = await fetch("/api/automation/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deadLeadReactivation: { enabled, days } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setDeadLeadOn(!enabled);
        setDeadLeadError(data.message ?? "Couldn't save — try again.");
      }
    } finally {
      setDeadLeadSaving(false);
    }
  }

  async function saveInstantAck(next: boolean) {
    setInstantAckSaving(true);
    setInstantAckError(null);
    try {
      const res = await fetch("/api/automation/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instantAck: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setInstantAckOn(!next);
        setInstantAckError(data.message ?? "Couldn't save — try again.");
      }
    } finally {
      setInstantAckSaving(false);
    }
  }

  // Real subscription state, fetched from the DB via the API route.
  useEffect(() => {
    fetch("/api/billing/status")
      .then((r) => r.json())
      .then((data: { active: boolean; status: string | null; currentPeriodEnd: string | null }) => {
        setBillingActive(data.active);
        setBillingStatus(data.status);
        setBillingPeriodEnd(data.currentPeriodEnd);
      })
      .finally(() => setBillingLoaded(true));
  }, []);

  // Stripe's webhook (the only thing that flips subscriptionStatus in the
  // DB) can take a few seconds to land after Checkout redirects back here —
  // the banner below already tells the user that, so back the promise with
  // an actual poll instead of leaving them staring at a stale "Not
  // subscribed" until they think to refresh. Stops itself the moment
  // billing shows active, or after ~20s if something's actually wrong.
  useEffect(() => {
    if (searchParams.get("billing") !== "success" || !billingLoaded || billingActive) return;

    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch("/api/billing/status");
        const data: { active: boolean; status: string | null; currentPeriodEnd: string | null } = await res.json();
        if (data.active) {
          setBillingActive(data.active);
          setBillingStatus(data.status);
          setBillingPeriodEnd(data.currentPeriodEnd);
        }
      } catch {
        // ignore — just try again next tick
      }
      if (attempts >= 10) clearInterval(interval);
    }, 2000);

    return () => clearInterval(interval);
  }, [searchParams, billingLoaded, billingActive]);

  async function handleSubscribe() {
    setBillingBusy(true);
    setBillingError(null);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't start checkout.");
      window.location.href = data.url;
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "Couldn't start checkout.");
      setBillingBusy(false);
    }
  }

  async function handleManageBilling() {
    setBillingBusy(true);
    setBillingError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't open billing portal.");
      window.location.href = data.url;
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "Couldn't open billing portal.");
      setBillingBusy(false);
    }
  }

  async function handleRunAutomationNow() {
    setRunningNow(true);
    setRunResult(null);
    try {
      const res = await fetch("/api/automation/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? "Automation run failed.");
      const heldNote = data.held > 0 ? `, held ${data.held} for review` : "";
      const deferredNote = data.deferred > 0 ? `, waiting on ${data.deferred} until working hours` : "";
      const reactivatedNote = data.reactivated > 0 ? `, ${data.reactivated} of those were cold leads reactivated` : "";
      setRunResult(
        data.checked === 0
          ? "Checked — no leads are opted in and overdue right now."
          : `Checked ${data.checked} opted-in lead${data.checked === 1 ? "" : "s"}, sent ${data.sent}${heldNote}${deferredNote}${reactivatedNote}.`
      );
    } catch (err) {
      setRunResult(err instanceof Error ? err.message : "Automation run failed.");
    } finally {
      setRunningNow(false);
    }
  }

  // Surface the outcome of the OAuth redirect (?gmail=connected|error) —
  // pure derivation from the URL, no state needed.
  const gmailError =
    searchParams.get("gmail") === "error" ? searchParams.get("message") ?? "Couldn't connect Gmail." : null;
  const outlookError =
    searchParams.get("outlook") === "error" ? searchParams.get("message") ?? "Couldn't connect Outlook." : null;
  const billingRedirect = searchParams.get("billing"); // "success" | "canceled" | null
  // Just paid, but the webhook hasn't landed yet — the poll above is
  // already chasing it. Disable Subscribe during this window specifically
  // so an impatient click can't start a second Checkout session (and a
  // second charge) while the first one is still settling.
  const awaitingActivation = billingRedirect === "success" && billingLoaded && !billingActive;

  const [disconnecting, setDisconnecting] = useState(false);
  async function handleGmailDisconnect() {
    if (!window.confirm("Disconnect Gmail? FollowUp will stop reading this inbox and revoke its access at Google. You can reconnect any time.")) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/integrations/gmail/disconnect", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setGmailConnected(false);
        setGmailEmail(undefined);
        setGmailPushActive(false);
      } else {
        setSyncResult(data.message ?? "Couldn't disconnect — try again.");
      }
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleGmailSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/integrations/gmail/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? "Sync failed");
      if (data.count === 0) {
        setSyncResult("Synced — no new sales conversations found in your recent inbox.");
      } else {
        const scoredNote = data.scored > 0 ? `, AI-scored ${data.scored}` : "";
        setSyncResult(`Synced ${data.count} lead${data.count === 1 ? "" : "s"} from your inbox${scoredNote}.`);
      }
    } catch (err) {
      setSyncResult(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleOutlookDisconnect() {
    if (!window.confirm("Disconnect Outlook? FollowUp will stop reading this inbox. You can reconnect any time.")) return;
    setOutlookDisconnecting(true);
    try {
      const res = await fetch("/api/integrations/outlook/disconnect", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setOutlookConnected(false);
        setOutlookEmail(undefined);
      } else {
        setOutlookSyncResult(data.message ?? "Couldn't disconnect — try again.");
      }
    } finally {
      setOutlookDisconnecting(false);
    }
  }

  async function handleOutlookSync() {
    setOutlookSyncing(true);
    setOutlookSyncResult(null);
    try {
      const res = await fetch("/api/integrations/outlook/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? "Sync failed");
      if (data.count === 0) {
        setOutlookSyncResult("Synced — no new sales conversations found in your recent inbox.");
      } else {
        const scoredNote = data.scored > 0 ? `, AI-scored ${data.scored}` : "";
        setOutlookSyncResult(`Synced ${data.count} lead${data.count === 1 ? "" : "s"} from your inbox${scoredNote}.`);
      }
    } catch (err) {
      setOutlookSyncResult(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setOutlookSyncing(false);
    }
  }

  async function handleScanSpam() {
    setScanningSpam(true);
    setSpamScanResult(null);
    try {
      const res = await fetch("/api/integrations/gmail/scan-spam", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? "Spam scan failed");
      setSpamScanResult(
        data.count === 0
          ? "Checked your spam folder — nothing back there looked like a real lead."
          : `Found ${data.count} lead${data.count === 1 ? "" : "s"} sitting in spam — added to your list.`
      );
    } catch (err) {
      setSpamScanResult(err instanceof Error ? err.message : "Spam scan failed.");
    } finally {
      setScanningSpam(false);
    }
  }

  async function handleSendFeedback() {
    if (!feedbackText.trim()) return;
    setFeedbackSending(true);
    setFeedbackError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: feedbackText.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't send — try again.");
      setFeedbackText("");
      setFeedbackSent(true);
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : "Couldn't send — try again.");
    } finally {
      setFeedbackSending(false);
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-3xl">Settings</h1>
        <p className="text-ink-soft mt-1">Connect your inbox, set follow-up rules, and manage your team.</p>
      </div>

      <nav
        className="sticky top-0 z-10 -mx-1 flex gap-1 bg-paper/95 px-1 py-2 backdrop-blur-sm border-b border-line"
        aria-label="Settings sections"
      >
        {(Object.keys(TAB_LABEL) as SettingsTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors"
            style={
              activeTab === tab
                ? { backgroundColor: "var(--ink)", color: "var(--paper)" }
                : { color: "var(--ink-soft)" }
            }
          >
            {TAB_LABEL[tab]}
          </button>
        ))}
      </nav>

      <div hidden={activeTab !== "connect"} className="space-y-10">
      <section id="integrations" className="scroll-mt-16">
        <h2 className="font-display text-xl">Integrations</h2>
        <div className="mt-4 space-y-3">
          <IntegrationRow
            icon={<Mail className="h-4 w-4" />}
            name="Gmail + Calendar"
            description={
              gmailConnected && gmailEmail
                ? `Connected as ${gmailEmail} — ${gmailPushActive ? "new emails are picked up within seconds" : "new emails are picked up within 10 minutes"}`
                : "Required — FollowUp reads sales conversations from your inbox to score leads and draft replies, and puts booked calls on your Google Calendar."
            }
            connected={gmailConnected}
            loading={!gmailStatusLoaded}
            href={gmailConnected ? undefined : "/api/integrations/gmail/connect"}
          />
          {gmailConnected && (
            <div className="ml-[52px] flex items-center gap-3">
              <button
                onClick={handleGmailSync}
                disabled={syncing}
                className="text-sm font-medium rounded-lg px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-60"
                style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing…" : "Sync now"}
              </button>
              <button
                onClick={handleGmailDisconnect}
                disabled={disconnecting}
                className="text-sm font-medium rounded-lg px-3 py-1.5 disabled:opacity-60"
                style={{ backgroundColor: "var(--paper)", color: "var(--coral)", border: "1px solid var(--line)" }}
              >
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
              <a
                href="/api/integrations/gmail/connect"
                className="text-sm font-medium rounded-lg px-3 py-1.5 flex items-center gap-1.5"
                style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}
              >
                <Calendar className="h-3.5 w-3.5" />
                Reconnect
              </a>
              {syncResult && <span className="text-xs text-ink-soft">{syncResult}</span>}
            </div>
          )}
          {gmailConnected && (
            <p className="ml-[52px] text-xs text-ink-soft">
              Booking links now create real events on your Google Calendar. If you connected Gmail before this
              feature shipped, click <strong>Reconnect</strong> once to grant calendar access.
            </p>
          )}
          {gmailConnected && (
            <div className="ml-[52px] mt-2 rounded-lg border border-line px-4 py-3">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={handleScanSpam}
                  disabled={scanningSpam}
                  className="text-sm font-medium rounded-lg px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-60"
                  style={{ backgroundColor: "var(--gold-soft)", color: "var(--gold)" }}
                >
                  <Search className={`h-3.5 w-3.5 ${scanningSpam ? "animate-pulse" : ""}`} />
                  {scanningSpam ? "Checking…" : "Scan spam for missed leads"}
                </button>
                {spamScanResult && <span className="text-xs text-ink-soft">{spamScanResult}</span>}
              </div>
              <p className="text-xs text-ink-soft mt-2">
                A real lead&apos;s first message can land in spam by mistake — this checks that folder specifically
                and adds anything that looks like a genuine prospect, tagged so you can tell where it came from.
                Manual only; it never runs on its own.
              </p>
            </div>
          )}
          {gmailError && (
            <p className="text-xs" style={{ color: "var(--coral)" }}>
              {gmailError}
            </p>
          )}

          {/* Not every deployment has Outlook OAuth configured — when it
              isn't, there's nothing a business owner can do about that row,
              so it's not clutter to show, it's a dead end. Just leave it out. */}
          {outlookOauthAvailable && (
            <IntegrationRow
              icon={<Mail className="h-4 w-4" />}
              name="Outlook / Microsoft 365"
              description={
                outlookConnected && outlookEmail
                  ? `Connected as ${outlookEmail} — new emails are picked up within 10 minutes`
                  : "Optional second inbox — for a business that runs sales email through Microsoft 365 instead of (or alongside) Gmail."
              }
              connected={outlookConnected}
              loading={!outlookStatusLoaded}
              href={outlookConnected ? undefined : "/api/integrations/outlook/connect"}
            />
          )}
          {outlookConnected && (
            <div className="ml-[52px] flex items-center gap-3">
              <button
                onClick={handleOutlookSync}
                disabled={outlookSyncing}
                className="text-sm font-medium rounded-lg px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-60"
                style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${outlookSyncing ? "animate-spin" : ""}`} />
                {outlookSyncing ? "Syncing…" : "Sync now"}
              </button>
              <button
                onClick={handleOutlookDisconnect}
                disabled={outlookDisconnecting}
                className="text-sm font-medium rounded-lg px-3 py-1.5 disabled:opacity-60"
                style={{ backgroundColor: "var(--paper)", color: "var(--coral)", border: "1px solid var(--line)" }}
              >
                {outlookDisconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
              {outlookSyncResult && <span className="text-xs text-ink-soft">{outlookSyncResult}</span>}
            </div>
          )}
          {outlookError && (
            <p className="text-xs" style={{ color: "var(--coral)" }}>
              {outlookError}
            </p>
          )}
          {(gmailConnected || outlookConnected) && (
            <div className="ml-[52px] rounded-lg border border-line px-4 py-3">
              <FilteredEmails />
            </div>
          )}
        </div>
        {!gmailConnected && !outlookConnected && (
          <p className="text-xs text-ink-soft mt-2">
            Connect Gmail or Outlook to start pulling in your real leads — until then the dashboard stays empty.
          </p>
        )}
      </section>

      <section id="website-widget" className="scroll-mt-16">
        <h2 className="font-display text-xl">Website widget</h2>
        <div className="mt-4">
          <CopyEmbedSnippet />
        </div>
      </section>

      <section id="lead-webhook" className="scroll-mt-16">
        <h2 className="font-display text-xl">Lead webhook</h2>
        <div className="mt-4">
          <CopyWebhookUrl />
        </div>
      </section>

      <section id="outbound-webhook" className="scroll-mt-16">
        <h2 className="font-display text-xl">Outbound webhook</h2>
        <div className="mt-4">
          <OutboundWebhookConfig />
        </div>
      </section>

      <section id="phone" className="scroll-mt-16">
        <h2 className="font-display text-xl">Phone (SMS + calls)</h2>
        <div className="mt-4">
          <TwilioConfig />
        </div>
      </section>

      <section id="social" className="scroll-mt-16">
        <h2 className="font-display text-xl">Instagram &amp; Facebook</h2>
        <div className="mt-4">
          <InstagramConfig />
          <FacebookConfig />
        </div>
      </section>

      {/* Was buried inside the "Instagram" section under the wrong name —
          it's a CRM sync, unrelated to social DMs. Its own section, still
          in Connect since it's a channel like any other integration here. */}
      <section id="crm" className="scroll-mt-16">
        <h2 className="font-display text-xl">CRM sync</h2>
        <div className="mt-4">
          <CrmConfig />
        </div>
      </section>
      </div>

      <div hidden={activeTab !== "advanced"} className="space-y-10">
      <section id="automation" className="scroll-mt-16">
        <h2 className="font-display text-xl">Automation</h2>
        <div className="mt-4 rounded-xl border border-line bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Auto follow-up on silence</p>
              <p className="text-xs text-ink-soft mt-1">
                Master switch — on by default. Leads in Assisted or Autonomous (every new lead starts in
                Assisted) get an AI-drafted check-in after this many days of no response. <strong>Our promise:</strong>{" "}
                Assisted never sends anything about pricing, terms, or a tense conversation without your approval,
                and every follow-up stops the instant the lead replies. Autonomous sends every draft with no review
                at all — opt-in per lead only.
              </p>
            </div>
            <button
              onClick={() => {
                const next = !automationOn;
                setAutomationOn(next);
                saveAutomationSettings(next, autoAfterDays);
              }}
              disabled={!automationLoaded || automationSaving}
              className="relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-60"
              style={{ backgroundColor: automationOn ? "var(--rust)" : "var(--line)" }}
            >
              <span
                className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform"
                style={{ transform: automationOn ? "translateX(22px)" : "translateX(2px)" }}
              />
            </button>
          </div>
          {automationError && (
            <p className="mt-3 text-xs" style={{ color: "var(--coral)" }}>
              {automationError}
            </p>
          )}
          {automationOn && (
            <div className="mt-4 flex items-center gap-2 text-sm">
              <span>Wait</span>
              <input
                type="number"
                min={1}
                max={30}
                value={autoAfterDays}
                onChange={(e) => setAutoAfterDays(Number(e.target.value))}
                onBlur={() => saveAutomationSettings(automationOn, autoAfterDays)}
                className="w-16 rounded-lg border border-line bg-paper px-2 py-1 text-center"
              />
              <span>days before nudging a quiet lead</span>
            </div>
          )}
          <p className="text-xs text-ink-soft mt-3">
            The moment a lead replies, the silence clock resets — this never fires again until they&apos;ve gone
            quiet for the full window once more, so it can&apos;t talk past a conversation that&apos;s actually
            happening.
          </p>
          <p className="text-xs text-ink-soft mt-2">
            Every new lead starts in Assisted; set any lead to Off or Autonomous on its page. Every automated message is still logged in the lead&apos;s conversation
            history, and you can turn this off per-lead any time.
          </p>
          {automationOn && (
            <div className="mt-4 pt-4 border-t border-line flex items-center gap-3">
              <button
                onClick={handleRunAutomationNow}
                disabled={runningNow}
                className="text-sm font-medium rounded-lg px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-60"
                style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}
              >
                <Zap className={`h-3.5 w-3.5 ${runningNow ? "animate-pulse" : ""}`} />
                {runningNow ? "Checking…" : "Check for anyone waiting, right now"}
              </button>
              {runResult && <span className="text-xs text-ink-soft">{runResult}</span>}
            </div>
          )}
          {automationOn && (
            <p className="text-xs text-ink-soft mt-2">
              This also runs automatically every hour, so a lead that goes quiet is caught the same day — this
              button is just for checking sooner, or confirming it&apos;s working.
            </p>
          )}
        </div>
        <div className="mt-4 rounded-xl border border-line bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Instant reply to new leads</p>
              <p className="text-xs text-ink-soft mt-1">
                Within a minute of a new lead&apos;s first message — email, text, WhatsApp, or Instagram — FollowUp
                sends a short &ldquo;thanks, we got your message, I&apos;ll get back to you shortly,&rdquo; in the language
                they wrote in. <strong>Our promise:</strong> it&apos;s a fixed sentence, not an AI reply — it never
                states a fact about your business, never answers a question, goes out once per lead only, and never
                goes out if you&apos;ve already replied. Your real reply still comes from you.
              </p>
            </div>
            <button
              onClick={() => {
                const next = !instantAckOn;
                setInstantAckOn(next);
                saveInstantAck(next);
              }}
              disabled={!automationLoaded || instantAckSaving}
              className="relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-60"
              style={{ backgroundColor: instantAckOn ? "var(--rust)" : "var(--line)" }}
            >
              <span
                className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform"
                style={{ transform: instantAckOn ? "translateX(22px)" : "translateX(2px)" }}
              />
            </button>
          </div>
          {instantAckError && (
            <p className="mt-3 text-xs" style={{ color: "var(--coral)" }}>
              {instantAckError}
            </p>
          )}
        </div>
        <div className="mt-4 rounded-xl border border-line bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Reply for me when I haven&apos;t</p>
              <p className="text-xs text-ink-soft mt-1">
                The case that loses the most deals: a lead writes, and nobody answers. If a lead&apos;s message goes
                unanswered for this many hours, FollowUp drafts the reply and either sends it (Assisted, only when the
                safety check says it&apos;s safe — never pricing, terms, or a tense thread) or holds it for your
                one-click approval, and tells you either way. <strong>Our promise:</strong> it never talks over you —
                the moment anyone replies, the lead is no longer &ldquo;unanswered.&rdquo;
              </p>
            </div>
            <button
              onClick={() => {
                const next = !unansweredOn;
                setUnansweredOn(next);
                saveUnanswered(next, unansweredHours);
              }}
              disabled={!automationLoaded || unansweredSaving}
              className="relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-60"
              style={{ backgroundColor: unansweredOn ? "var(--rust)" : "var(--line)" }}
            >
              <span
                className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform"
                style={{ transform: unansweredOn ? "translateX(22px)" : "translateX(2px)" }}
              />
            </button>
          </div>
          {unansweredError && (
            <p className="mt-3 text-xs" style={{ color: "var(--coral)" }}>
              {unansweredError}
            </p>
          )}
          {unansweredOn && (
            <div className="mt-4 flex items-center gap-2 text-sm">
              <span>Step in after</span>
              <input
                type="number"
                min={1}
                max={168}
                value={unansweredHours}
                onChange={(e) => setUnansweredHours(Number(e.target.value))}
                onBlur={() => saveUnanswered(unansweredOn, unansweredHours)}
                className="w-16 rounded-lg border border-line bg-paper px-2 py-1 text-center"
              />
              <span>hours without a reply from you</span>
            </div>
          )}
        </div>
        <div className="mt-4 rounded-xl border border-line bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Reactivate cold leads</p>
              <p className="text-xs text-ink-soft mt-1">
                A lead nobody&apos;s heard from in a while isn&apos;t dead — real-estate reactivation data puts the
                odds of winning one back at 5-15%, often at 3-4x the conversion rate of a brand-new lead. Once a lead
                has gone quiet this many days on both sides, FollowUp switches to a different kind of message —
                naming how long it&apos;s actually been and leading with something worth their time, never a vague
                &ldquo;just checking in&rdquo; — instead of repeating the same follow-up.
              </p>
            </div>
            <button
              onClick={() => {
                const next = !deadLeadOn;
                setDeadLeadOn(next);
                saveDeadLead(next, deadLeadDays);
              }}
              disabled={!automationLoaded || deadLeadSaving}
              className="relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-60"
              style={{ backgroundColor: deadLeadOn ? "var(--rust)" : "var(--line)" }}
            >
              <span
                className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform"
                style={{ transform: deadLeadOn ? "translateX(22px)" : "translateX(2px)" }}
              />
            </button>
          </div>
          {deadLeadError && (
            <p className="mt-3 text-xs" style={{ color: "var(--coral)" }}>
              {deadLeadError}
            </p>
          )}
          {deadLeadOn && (
            <div className="mt-4 flex items-center gap-2 text-sm">
              <span>Switch to reactivation after</span>
              <input
                type="number"
                min={30}
                max={180}
                value={deadLeadDays}
                onChange={(e) => setDeadLeadDays(Number(e.target.value))}
                onBlur={() => saveDeadLead(deadLeadOn, deadLeadDays)}
                className="w-16 rounded-lg border border-line bg-paper px-2 py-1 text-center"
              />
              <span>days of silence on both sides</span>
            </div>
          )}
        </div>
      </section>
      </div>

      <div hidden={activeTab !== "team"} className="space-y-10">
      <section id="team" className="scroll-mt-16">
        <h2 className="font-display text-xl">Team</h2>
        <p className="text-sm text-ink-soft mt-1">
          Admins can invite teammates, change roles, and remove people. Everyone can see who&apos;s on the team.
        </p>
        <div className="mt-4">
          <TeamSection />
        </div>
      </section>

      <section id="lead-routing" className="scroll-mt-16">
        <h2 className="font-display text-xl">Lead routing</h2>
        <p className="text-sm text-ink-soft mt-1">
          Give a lead a head start based on where it came from — before anyone&apos;s looked at it.
        </p>
        <div className="mt-4">
          <SourceRoutingSection />
        </div>
      </section>
      </div>

      <div hidden={activeTab !== "billing"} className="space-y-10">
      <section id="billing" className="scroll-mt-16">
        <h2 className="font-display text-xl">Billing</h2>
        {billingRedirect === "success" && (
          <p className="mt-2 text-sm" style={{ color: "var(--sage)" }}>
            Subscription active — thanks! It may take a few seconds to reflect below.
          </p>
        )}
        {billingRedirect === "canceled" && (
          <p className="mt-2 text-sm text-ink-soft">Checkout canceled — no charge was made.</p>
        )}
        <div className="mt-4 rounded-xl border border-line bg-card p-5">
          <div className="flex items-center gap-4">
            <div
              className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}
            >
              <CreditCard className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">FollowUp — $29/month after a 14-day free trial</p>
              <p className="text-xs text-ink-soft mt-0.5">
                {!billingLoaded
                  ? "Checking your subscription…"
                  : billingStatus === "trialing"
                  ? billingPeriodEnd
                    ? `Free trial — first charge on ${new Date(billingPeriodEnd).toLocaleDateString()}.`
                    : "Free trial."
                  : billingActive
                  ? billingPeriodEnd
                    ? `Active — renews ${new Date(billingPeriodEnd).toLocaleDateString()}.`
                    : "Active."
                  : billingStatus === "past_due"
                  ? "Payment failed — update your card to keep your account active."
                  : billingStatus === "canceled"
                  ? "Subscription canceled — resubscribe to unlock leads, sync, and sending again."
                  : "Not subscribed yet — start a free 14-day trial, no card required, to unlock adding leads, syncing Gmail, and sending follow-ups."}
              </p>
            </div>
            {billingLoaded && (
              <button
                onClick={billingActive || billingStatus ? handleManageBilling : handleSubscribe}
                disabled={billingBusy || awaitingActivation}
                className="shrink-0 text-sm font-medium rounded-lg px-3.5 py-2 disabled:opacity-60"
                style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
              >
                {billingBusy
                  ? "One sec…"
                  : awaitingActivation
                  ? "Activating…"
                  : billingActive || billingStatus
                  ? "Manage billing"
                  : "Start free trial"}
              </button>
            )}
          </div>
          {billingError && (
            <p className="mt-3 text-xs" style={{ color: "var(--coral)" }}>
              {billingError}
            </p>
          )}
        </div>
      </section>
      </div>

      <div hidden={activeTab !== "advanced"} className="space-y-10">
      <section id="feedback" className="scroll-mt-16">
        <h2 className="font-display text-xl flex items-center gap-2">
          <MessageSquareHeart className="h-4 w-4 text-ink-soft" />
          Something we should know?
        </h2>
        <p className="text-sm text-ink-soft mt-1">
          Not a support ticket — just a place to tell us what&apos;s working or what isn&apos;t. Entirely optional,
          only here if you want it.
        </p>
        <div className="mt-4 rounded-xl border border-line bg-card p-5">
          {feedbackSent ? (
            <p className="text-sm flex items-center gap-1.5" style={{ color: "var(--sage)" }}>
              <Check className="h-4 w-4" /> Sent — thank you.
            </p>
          ) : (
            <>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Whatever's on your mind about FollowUp…"
                rows={3}
                maxLength={2000}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm resize-none"
              />
              <div className="mt-2 flex items-center justify-between">
                <button
                  onClick={handleSendFeedback}
                  disabled={feedbackSending || !feedbackText.trim()}
                  className="text-sm font-medium rounded-lg px-3.5 py-2 disabled:opacity-60"
                  style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
                >
                  {feedbackSending ? "Sending…" : "Send"}
                </button>
                {feedbackError && (
                  <span className="text-xs" style={{ color: "var(--coral)" }}>
                    {feedbackError}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      <section id="data" className="scroll-mt-16">
        <h2 className="font-display text-xl flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-ink-soft" />
          Your data
        </h2>
        <p className="text-sm text-ink-soft mt-1">Export everything, or permanently delete this business.</p>
        <div className="mt-4">
          <DataPrivacySection />
        </div>
      </section>
      </div>
    </div>
  );
}

function IntegrationRow({
  icon,
  name,
  description,
  connected,
  onToggle,
  href,
  loading,
}: {
  icon: React.ReactNode;
  name: string;
  description: string;
  connected: boolean;
  onToggle?: () => void;
  /** When set, "Connect" is a real navigation (e.g. to kick off OAuth) instead of a local toggle. */
  href?: string;
  loading?: boolean;
}) {
  const buttonStyle = {
    backgroundColor: connected ? "var(--sage-soft)" : "var(--ink)",
    color: connected ? "var(--sage)" : "var(--paper)",
  };
  const label = loading ? (
    "…"
  ) : connected ? (
    <span className="flex items-center gap-1">
      <Check className="h-3.5 w-3.5" /> Connected
    </span>
  ) : (
    "Connect"
  );

  return (
    <div className="rounded-lg border border-line px-4 py-3 flex items-center gap-4">
      <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-ink-soft mt-0.5">{description}</p>
      </div>
      {!connected && href ? (
        <a href={href} className="text-sm font-medium rounded-lg px-3 py-1.5 shrink-0" style={buttonStyle}>
          {label}
        </a>
      ) : (
        <button onClick={onToggle} disabled={!onToggle} className="text-sm font-medium rounded-lg px-3 py-1.5 shrink-0" style={buttonStyle}>
          {label}
        </button>
      )}
    </div>
  );
}
