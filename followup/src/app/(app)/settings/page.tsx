"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import TeamSection from "@/components/TeamSection";
import SourceRoutingSection from "@/components/SourceRoutingSection";
import CopyEmbedSnippet from "@/components/CopyEmbedSnippet";
import CopyWebhookUrl from "@/components/CopyWebhookUrl";
import OutboundWebhookConfig from "@/components/OutboundWebhookConfig";
import TwilioConfig from "@/components/TwilioConfig";
import WhatsAppConfig from "@/components/WhatsAppConfig";
import InstagramConfig from "@/components/InstagramConfig";
import FacebookConfig from "@/components/FacebookConfig";
import CrmConfig from "@/components/CrmConfig";
import BookingCalendarConfig from "@/components/BookingCalendarConfig";
import FilteredEmails from "@/components/FilteredEmails";
import DataPrivacySection from "@/components/DataPrivacySection";
import { TIER_INFO, VOICE_ADDON_INFO, VOICE_ADDON_AVAILABLE, CARRIER_CHANNELS_AVAILABLE, FREE_TIER_LEAD_CAP } from "@/lib/pricing";
// A leaf module, not @/lib/automation — that one imports Prisma, and this is a client component.
import { UNANSWERED_META_DM_MAX_HOURS } from "@/lib/metaWindow";
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
type SettingsTab = "connect" | "channels" | "team" | "billing" | "advanced";
const TAB_LABEL: Record<SettingsTab, string> = {
  connect: "Connect",
  channels: "Channels",
  team: "Team",
  billing: "Billing",
  advanced: "Advanced",
};
const SECTION_TAB: Record<string, SettingsTab> = {
  integrations: "connect",
  crm: "connect",
  "website-widget": "channels",
  "lead-webhook": "channels",
  "outbound-webhook": "channels",
  phone: "channels",
  // Every other <section id> in this file has a row here; WhatsApp's was
  // missed when it moved out of the Twilio panel into its own section.
  // Without it /settings#whatsapp opens on whatever tab was last used and
  // the browser's anchor scroll finds nothing, because the section is
  // inside a hidden tab.
  whatsapp: "channels",
  social: "channels",
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
  // Business.holdAllForApproval — true for every beta tester. Three of
  // the four rules below still run but send nothing; describeAutomation-
  // State() is the sentence that claims otherwise, so it reads this.
  const [holdAllForApproval, setHoldAllForApproval] = useState(false);

  const [billingActive, setBillingActive] = useState(false);
  const [billingStatus, setBillingStatus] = useState<string | null>(null);
  const [billingPeriodEnd, setBillingPeriodEnd] = useState<string | null>(null);
  const [billingTier, setBillingTier] = useState<"free" | "plus" | "pro">("free");
  const [voiceAddonEnabled, setVoiceAddonEnabled] = useState(false);
  // Only meaningful on Free (0 on Plus/Pro — there's no cap to show
  // progress against) — see /api/billing/status.
  const [leadsUsedThisMonth, setLeadsUsedThisMonth] = useState(0);
  const [billingLoaded, setBillingLoaded] = useState(false);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  // Local choice while picking a plan — irrelevant once already subscribed
  // (adding/removing Voice on an existing subscription is a portal action,
  // not a new checkout; see handleSubscribe).
  const [voiceAddonWanted, setVoiceAddonWanted] = useState(false);

  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // The 4 automation rules used to be 4 separate panels, each repeating its
  // own "Our promise" paragraph — research/product/2026-09-10-ux-
  // simplification.md §7: one switch + one plain-English summary up top,
  // with the individual rules and their timings tucked behind an expander
  // for whoever actually wants to tune them.
  const [automationDetailsOpen, setAutomationDetailsOpen] = useState(false);
  const previousAutomationStateRef = useRef<{
    automationOn: boolean;
    instantAckOn: boolean;
    unansweredOn: boolean;
    deadLeadOn: boolean;
  } | null>(null);

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
          holdAllForApproval?: boolean;
        }) => {
          setAutomationOn(data.enabled);
          setAutoAfterDays(data.triggerDays);
          setInstantAckOn(data.instantAck ?? true);
          setUnansweredOn(data.unansweredReply?.enabled ?? true);
          setUnansweredHours(data.unansweredReply?.hours ?? 24);
          setDeadLeadOn(data.deadLeadReactivation?.enabled ?? true);
          setDeadLeadDays(data.deadLeadReactivation?.days ?? 45);
          setHoldAllForApproval(data.holdAllForApproval ?? false);
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

  // One sentence describing exactly what's active right now, built from the
  // same 4 flags the individual rules already use — never drifts out of
  // sync with reality the way 4 separately-worded "Our promise" blocks could.
  function describeAutomationState(): string {
    const clauses: string[] = [];
    if (instantAckOn) clauses.push("sends an instant acknowledgement to every new lead");
    // On a holding account (Business.holdAllForApproval) these three
    // still run and still write the message — it just lands in the
    // approval queue rather than going out. The instant acknowledgement
    // above is deliberately exempt and really does send, so the verb has
    // to change per clause, not once for the whole sentence.
    const writes = holdAllForApproval ? "drafts a nudge for" : "nudges";
    if (automationOn) clauses.push(`${writes} a quiet lead after ${autoAfterDays} day${autoAfterDays === 1 ? "" : "s"} of silence`);
    if (unansweredOn) {
      // On Instagram and Messenger the engine caps this at
      // UNANSWERED_META_DM_MAX_HOURS whatever is configured (see
      // @/lib/metaWindow). This sentence describes what is ACTIVE, so it has
      // to say so, or it is the exact false promise trustCopy.test.ts exists
      // to catch — a number the owner set, silently meaning something else.
      const dmCapped = unansweredHours > UNANSWERED_META_DM_MAX_HOURS;
      clauses.push(
        `${holdAllForApproval ? "drafts a reply" : "steps in"} if you haven't answered within ${unansweredHours} hour${unansweredHours === 1 ? "" : "s"}` +
          (dmCapped ? ` (${UNANSWERED_META_DM_MAX_HOURS} on Instagram and Messenger)` : "")
      );
    }
    if (deadLeadOn)
      clauses.push(
        `${holdAllForApproval ? "drafts a reactivation message" : "switches to a reactivation message"} after ${deadLeadDays} days of silence on both sides`
      );
    if (clauses.length === 0) return "Off — nothing goes out on its own. Every reply is one you send yourself.";
    const sentence =
      clauses.length === 1
        ? `Right now FollowUp ${clauses[0]}.`
        : `Right now FollowUp ${clauses.slice(0, -1).join(", ")}, and ${clauses[clauses.length - 1]}.`;
    // The one thing an owner most needs to know about their own account,
    // and until 2026-09-20 the only place it appeared was two server
    // files. "Waits for you" is the whole point of the beta setting, so
    // it belongs in the sentence that claims to describe what is active.
    // As of 2026-09-20 the instant acknowledgement is held too (founder:
    // "don't send any replies without asking me"), so there is no longer
    // an exception to carve out — every rule above produces a draft that
    // waits. This sentence said the opposite for exactly one day.
    if (!holdAllForApproval) return sentence;
    return `${sentence} Nothing above sends on its own — every one of those is written for you and waits in Approvals until you press send.`;
  }

  const anyAutomationOn = automationOn || instantAckOn || unansweredOn || deadLeadOn;
  const automationBusy = automationSaving || instantAckSaving || unansweredSaving || deadLeadSaving;

  // The master switch doesn't have its own server-side flag — it's just all
  // 4 rules at once. Turning it off remembers which ones were actually on
  // so turning it back on restores exactly that, instead of guessing.
  async function handleMasterToggle() {
    if (anyAutomationOn) {
      if (
        !window.confirm(
          "Turn off every automated follow-up? Nothing will go out on its own until you turn this back on — you can still reply to leads yourself any time."
        )
      )
        return;
      previousAutomationStateRef.current = { automationOn, instantAckOn, unansweredOn, deadLeadOn };
      if (automationOn) {
        setAutomationOn(false);
        saveAutomationSettings(false, autoAfterDays);
      }
      if (instantAckOn) {
        setInstantAckOn(false);
        saveInstantAck(false);
      }
      if (unansweredOn) {
        setUnansweredOn(false);
        saveUnanswered(false, unansweredHours);
      }
      if (deadLeadOn) {
        setDeadLeadOn(false);
        saveDeadLead(false, deadLeadDays);
      }
    } else {
      // Nothing was on to remember (e.g. this is the first toggle this
      // visit) — the app's own default is everything on, so restore that.
      const prev = previousAutomationStateRef.current ?? {
        automationOn: true,
        instantAckOn: true,
        unansweredOn: true,
        deadLeadOn: true,
      };
      if (prev.automationOn) {
        setAutomationOn(true);
        saveAutomationSettings(true, autoAfterDays);
      }
      if (prev.instantAckOn) {
        setInstantAckOn(true);
        saveInstantAck(true);
      }
      if (prev.unansweredOn) {
        setUnansweredOn(true);
        saveUnanswered(true, unansweredHours);
      }
      if (prev.deadLeadOn) {
        setDeadLeadOn(true);
        saveDeadLead(true, deadLeadDays);
      }
      previousAutomationStateRef.current = null;
    }
  }

  // Real subscription state, fetched from the DB via the API route.
  useEffect(() => {
    fetch("/api/billing/status")
      .then((r) => r.json())
      .then(
        (data: {
          active: boolean;
          status: string | null;
          currentPeriodEnd: string | null;
          tier: "free" | "plus" | "pro";
          voiceAddonEnabled: boolean;
          leadsUsedThisMonth: number;
        }) => {
          setBillingActive(data.active);
          setBillingStatus(data.status);
          setBillingPeriodEnd(data.currentPeriodEnd);
          setBillingTier(data.tier);
          setVoiceAddonEnabled(data.voiceAddonEnabled);
          setLeadsUsedThisMonth(data.leadsUsedThisMonth);
        }
      )
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
        const data: {
          active: boolean;
          status: string | null;
          currentPeriodEnd: string | null;
          tier: "free" | "plus" | "pro";
          voiceAddonEnabled: boolean;
        } = await res.json();
        if (data.active) {
          setBillingActive(data.active);
          setBillingStatus(data.status);
          setBillingPeriodEnd(data.currentPeriodEnd);
          setBillingTier(data.tier);
          setVoiceAddonEnabled(data.voiceAddonEnabled);
        }
      } catch {
        // ignore — just try again next tick
      }
      if (attempts >= 10) clearInterval(interval);
    }, 2000);

    return () => clearInterval(interval);
  }, [searchParams, billingLoaded, billingActive]);

  async function handleSubscribe(tier: "plus" | "pro") {
    setBillingBusy(true);
    setBillingError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, voiceAddon: voiceAddonWanted }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't start checkout.");
      window.location.assign(data.url);
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
      window.location.assign(data.url);
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

      {/* Below lg a fixed top bar (Sidebar.tsx) covers the top of the viewport,
          so `top-0` parked this tab row underneath it and the tabs vanished as
          soon as the page scrolled. Offset by the bar's own height; at lg the
          bar doesn't render, so it goes back to 0. overflow-x-auto because the
          tabs don't all fit across a 390px phone. */}
      <nav
        className="sticky top-[var(--app-header-h)] lg:top-0 z-10 -mx-1 flex gap-1 overflow-x-auto bg-paper/95 px-1 py-2 backdrop-blur-sm border-b border-line"
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
            <div className="sm:ml-[52px] flex items-center gap-3">
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
            <p className="sm:ml-[52px] text-xs text-ink-soft">
              If you connected Gmail before booking links existed, click <strong>Reconnect</strong> once to grant
              calendar access.
            </p>
          )}
          <div className="sm:ml-[52px]">
            <BookingCalendarConfig />
          </div>
          {gmailConnected && (
            <div className="sm:ml-[52px] mt-3 border-t border-line pt-3">
              <div className="flex items-center gap-3 flex-wrap">
                {/* Neutral, not --gold. A-005 reserves gold for "going cold" —
                    a lead state — and this is an action the owner takes, not a
                    status the app is reporting. Scanning the spam folder isn't
                    urgent either: painting it amber told the owner something
                    was wrong when nothing is. */}
                <button
                  onClick={handleScanSpam}
                  disabled={scanningSpam}
                  className="text-sm font-medium rounded-lg border border-line px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-60 hover:bg-paper transition-colors"
                  style={{ color: "var(--ink-soft)" }}
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
            <div className="sm:ml-[52px] flex items-center gap-3">
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
            <div className="sm:ml-[52px] border-t border-line pt-3">
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

      {/* Was buried inside the "Instagram" section under the wrong name —
          it's a CRM sync, unrelated to social DMs. Grouped with Connect
          since it's about where leads/contacts come from, not a channel. */}
      <section id="crm" className="scroll-mt-16">
        <h2 className="font-display text-xl">CRM sync</h2>
        <div className="mt-4">
          <CrmConfig />
        </div>
      </section>
      </div>

      <div hidden={activeTab !== "channels"} className="space-y-10">
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

      {/* Carrier channels are dropped for now (CARRIER_CHANNELS_AVAILABLE,
          @/lib/pricing). The section is hidden rather than removed: the
          Twilio routes stay live, so a business that already configured a
          number keeps working instead of having it go dark without warning.
          What is switched off is the offer to set one up.

          WhatsApp used to be configured inside this same panel and is NOT
          behind this flag — it rides the same Twilio account but gates on
          Meta's approval, not a carrier's (META_CHANNELS_AVAILABLE). It has
          its own section below, which must stay reachable whatever this
          flag says; that is what src/lib/__tests__/channelAvailability.test.ts
          asserts. */}
      {CARRIER_CHANNELS_AVAILABLE && (
        <section id="phone" className="scroll-mt-16">
          <h2 className="font-display text-xl">Phone (SMS + calls)</h2>
          <div className="mt-4">
            <TwilioConfig />
          </div>
        </section>
      )}

      {/* The three Meta channels sit together, in the order a business is
          most likely to already have them. */}
      <section id="whatsapp" className="scroll-mt-16">
        <h2 className="font-display text-xl">WhatsApp</h2>
        <div className="mt-4">
          <WhatsAppConfig />
        </div>
      </section>

      <section id="social" className="scroll-mt-16">
        <h2 className="font-display text-xl">Instagram &amp; Facebook</h2>
        <div className="mt-4">
          <InstagramConfig />
          <FacebookConfig />
        </div>
      </section>
      </div>

      <div hidden={activeTab !== "advanced"} className="space-y-10">
      <section id="automation" className="scroll-mt-16">
        <h2 className="font-display text-xl">Automation</h2>
        <div className="mt-4 rounded-[var(--radius-box)] bg-card [box-shadow:var(--shadow-box)] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-sm">Automatic follow-ups</p>
              <p className="text-xs text-ink-soft mt-1">{describeAutomationState()}</p>
            </div>
            <button
              onClick={handleMasterToggle}
              disabled={!automationLoaded || automationBusy}
              className="relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-60"
              style={{ backgroundColor: anyAutomationOn ? "var(--rust)" : "var(--line)" }}
            >
              <span
                className="absolute top-0.5 h-5 w-5 rounded-full transition-transform"
                style={{
                  transform: anyAutomationOn ? "translateX(22px)" : "translateX(2px)",
                  backgroundColor: anyAutomationOn ? "var(--on-accent)" : "var(--ink)",
                }}
              />
            </button>
          </div>
          {(automationError || instantAckError || unansweredError || deadLeadError) && (
            <p className="mt-3 text-xs" style={{ color: "var(--coral)" }}>
              {automationError || instantAckError || unansweredError || deadLeadError}
            </p>
          )}
          <button
            onClick={() => setAutomationDetailsOpen((v) => !v)}
            className="mt-4 text-xs font-medium underline underline-offset-2 text-ink-soft"
          >
            {automationDetailsOpen ? "Hide the individual rules" : "Change the timings"}
          </button>
        </div>

        {automationDetailsOpen && (
        <>
        <div className="mt-4 rounded-[var(--radius-box)] bg-card [box-shadow:var(--shadow-box)] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Auto follow-up on silence</p>
              <p className="text-xs text-ink-soft mt-1">
                Leads in Assisted or Autonomous (every new lead starts in Assisted) get an AI-drafted check-in
                after this many days of no response. <strong>Our promise:</strong>{" "}
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
                className="absolute top-0.5 h-5 w-5 rounded-full transition-transform"
                style={{
                  transform: automationOn ? "translateX(22px)" : "translateX(2px)",
                  backgroundColor: automationOn ? "var(--on-accent)" : "var(--ink)",
                }}
              />
            </button>
          </div>
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
        <div className="mt-4 rounded-[var(--radius-box)] bg-card [box-shadow:var(--shadow-box)] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Instant reply to new leads</p>
              <p className="text-xs text-ink-soft mt-1">
                Within a minute of a new lead&apos;s first email, FollowUp sends a short &ldquo;thanks, we got your
                message, I&apos;ll get back to you shortly,&rdquo; in the language they wrote in. On WhatsApp, Instagram
                and Messenger it waits two to three minutes first, so you get the chance to answer the message yourself
                — reply in that time and FollowUp stays quiet. If it does reply, it tells you what it sent.{" "}
                <strong>Our promise:</strong> it&apos;s written for that specific message, so it reads like you
                rather than a template &mdash; but it is checked twice before it goes out, and it never states a fact
                about your business. It cannot quote a price, a date, a time or a number the lead didn&apos;t write
                themselves, and it cannot answer their question. If either check has any doubt, it falls back to a
                fixed, always-safe line instead. It goes out once per lead only, never if you&apos;ve already replied,
                and never to someone who asked us to stop. Your real answer still comes from you.
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
                className="absolute top-0.5 h-5 w-5 rounded-full transition-transform"
                style={{
                  transform: instantAckOn ? "translateX(22px)" : "translateX(2px)",
                  backgroundColor: instantAckOn ? "var(--on-accent)" : "var(--ink)",
                }}
              />
            </button>
          </div>
          {instantAckError && (
            <p className="mt-3 text-xs" style={{ color: "var(--coral)" }}>
              {instantAckError}
            </p>
          )}
        </div>
        <div className="mt-4 rounded-[var(--radius-box)] bg-card [box-shadow:var(--shadow-box)] p-5">
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
                className="absolute top-0.5 h-5 w-5 rounded-full transition-transform"
                style={{
                  transform: unansweredOn ? "translateX(22px)" : "translateX(2px)",
                  backgroundColor: unansweredOn ? "var(--on-accent)" : "var(--ink)",
                }}
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
          {/* Only while the number is actually being overridden. At 20 or
              below the ceiling changes nothing, and a note that changes
              nothing is noise (brand principle 8). It appears the moment the
              owner types 21, on the same screen as the field, which is
              where the "why did it go out early" question would otherwise
              be asked. */}
          {unansweredOn && unansweredHours > UNANSWERED_META_DM_MAX_HOURS && (
            <p className="text-xs text-ink-soft mt-2">
              On Instagram and Messenger, FollowUp steps in by {UNANSWERED_META_DM_MAX_HOURS} hours whatever you set
              here. Meta only lets a business reply within a day of the lead&apos;s last message — after that,
              nothing gets through.
            </p>
          )}
        </div>
        <div className="mt-4 rounded-[var(--radius-box)] bg-card [box-shadow:var(--shadow-box)] p-5">
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
                className="absolute top-0.5 h-5 w-5 rounded-full transition-transform"
                style={{
                  transform: deadLeadOn ? "translateX(22px)" : "translateX(2px)",
                  backgroundColor: deadLeadOn ? "var(--on-accent)" : "var(--ink)",
                }}
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
        </>
        )}
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
        {/* No subhead here — SourceRoutingSection's own intro line already
            says what this does ("what happens automatically... before
            anyone looks at it"); a second sentence saying the same thing
            in different words right above it was redundant. */}
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
        {billingLoaded && (billingActive || billingStatus) ? (
          // Already on a plan — show what it is and hand off to Stripe's
          // portal for anything else (upgrading/downgrading tier, adding or
          // dropping Voice, updating a card). A dedicated in-app
          // tier-switch flow is real follow-up work, not built here — see
          // the PR description for why.
          <div className="mt-4 rounded-[var(--radius-box)] bg-card [box-shadow:var(--shadow-box)] p-5">
            <div className="flex items-center gap-4">
              <div
                className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}
              >
                <CreditCard className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  FollowUp {TIER_INFO[billingTier].label} — {TIER_INFO[billingTier].priceLabel}
                  {voiceAddonEnabled && ` + Voice (${VOICE_ADDON_INFO.priceLabel})`}
                </p>
                <p className="text-xs text-ink-soft mt-0.5">
                  {billingStatus === "beta"
                    ? "Beta — every Pro feature, free while you test. Nothing to pay and nothing to manage."
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
                    : "Subscription canceled — resubscribe to unlock leads, sync, and sending again."}
                </p>
              </div>
              {/* No Stripe customer exists behind the beta plan, so the
                  portal would 400 — there is nothing to manage. */}
              {billingStatus !== "beta" && (
                <button
                  onClick={handleManageBilling}
                  disabled={billingBusy}
                  className="shrink-0 text-sm font-medium rounded-lg px-3.5 py-2 disabled:opacity-60"
                  style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
                >
                  {billingBusy ? "One sec…" : "Manage billing"}
                </button>
              )}
            </div>
            {billingError && (
              <p className="mt-3 text-xs" style={{ color: "var(--coral)" }}>
                {billingError}
              </p>
            )}
          </div>
        ) : (
          <div className="mt-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {(["free", "plus", "pro"] as const).map((tier) => (
                <div key={tier} className="rounded-[var(--radius-box)] bg-card [box-shadow:var(--shadow-box)] p-5">
                  <p className="text-sm font-medium">{TIER_INFO[tier].label}</p>
                  <p className="font-display text-2xl mt-1">{TIER_INFO[tier].priceLabel}</p>
                  <p className="text-xs text-ink-soft mt-2">
                    {tier === "free"
                      ? "Email + web widget, 20 leads/mo, assisted only. No card needed — this is where you are now."
                      : tier === "plus"
                      ? "Every channel (WhatsApp, Instagram, Messenger, CRM sync) plus autonomous send. 14-day free trial."
                      : "Everything in Plus, no lead cap, multi-agent lead routing, priority support. 14-day free trial."}
                  </p>
                  {tier === "free" && billingLoaded && (
                    <div className="mt-3">
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="font-medium">
                          {leadsUsedThisMonth}/{FREE_TIER_LEAD_CAP} leads this month
                        </span>
                        {leadsUsedThisMonth >= FREE_TIER_LEAD_CAP && (
                          <span style={{ color: "var(--coral)" }}>At the cap</span>
                        )}
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--line)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, (leadsUsedThisMonth / FREE_TIER_LEAD_CAP) * 100)}%`,
                            backgroundColor: leadsUsedThisMonth >= FREE_TIER_LEAD_CAP ? "var(--coral)" : "var(--rust)",
                          }}
                        />
                      </div>
                      <p className="text-xs text-ink-soft mt-1.5">
                        {leadsUsedThisMonth >= FREE_TIER_LEAD_CAP
                          ? "New leads still come in — they just won't be scored or drafted until next month, or you upgrade."
                          : "Resets on the 1st. Leads still come in past the cap, they just stop getting scored/drafted."}
                      </p>
                    </div>
                  )}
                  {tier !== "free" && (
                    <button
                      onClick={() => handleSubscribe(tier)}
                      disabled={billingBusy || awaitingActivation}
                      className="mt-4 w-full text-sm font-medium rounded-lg px-3.5 py-2 disabled:opacity-60"
                      style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
                    >
                      {billingBusy ? "One sec…" : awaitingActivation ? "Activating…" : "Start free trial"}
                    </button>
                  )}
                </div>
              ))}
            </div>
            {/* Hidden while the voice agent is deferred (VOICE_ADDON_AVAILABLE,
                see @/lib/pricing). The checkout affordance only: a business
                that already has the add-on keeps it, keeps being billed, and
                still sees it in the plan summary above. */}
            {VOICE_ADDON_AVAILABLE && (
              <label className="mt-3 flex items-center gap-2.5 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  checked={voiceAddonWanted}
                  onChange={(e) => setVoiceAddonWanted(e.target.checked)}
                  className="h-4 w-4"
                />
                Add Voice ({VOICE_ADDON_INFO.priceLabel}, {VOICE_ADDON_INFO.includedMinutes} min included, then{" "}
                {VOICE_ADDON_INFO.overagePerMinute}/min) — applies to whichever plan you pick above
              </label>
            )}
            {billingError && (
              <p className="mt-3 text-xs" style={{ color: "var(--coral)" }}>
                {billingError}
              </p>
            )}
          </div>
        )}
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
        <div className="mt-4 rounded-[var(--radius-box)] bg-card [box-shadow:var(--shadow-box)] p-5">
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
