"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import SettingsList from "@/components/app/SettingsList";
import { SETTINGS_GROUPS, groupOfPage, type SettingsGroup } from "@/lib/settingsGroups";
import { useInWindow } from "@/components/app/AppWindow";
import { quietReminderDays, SILENCE_DEFAULT_TRIGGER_DAYS } from "@/lib/reminderCadence";
import TeamSection from "@/components/TeamSection";
// A leaf module, not @/lib/automation — that one imports Prisma, and this is a client component.
import { UNANSWERED_META_DM_MAX_HOURS } from "@/lib/metaWindow";
import BusinessProfileSection from "@/components/BusinessProfileSection";
import BusinessFactsSection from "@/components/BusinessFactsSection";
import TrackRecord from "@/components/TrackRecord";
import HowYouWorkSection from "@/components/HowYouWorkSection";
import SourceRoutingSection from "@/components/SourceRoutingSection";
import CopyEmbedSnippet from "@/components/CopyEmbedSnippet";
import SetupStepRestore from "@/components/SetupStepRestore";
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
import AlertsSection from "@/components/AlertsSection";
import OnlyAdminsSendSetting from "@/components/OnlyAdminsSendSetting";
import TeamCallsSetting from "@/components/TeamCallsSetting";
import TeamWeek from "@/components/TeamWeek";
import SignInsSection from "@/components/SignInsSection";
import YourRulesCard from "@/components/YourRulesCard";
import RuleCard, { RuleNumber, type RuleRecordCounts } from "@/components/RuleCard";
import { TIER_INFO, VOICE_ADDON_INFO, VOICE_ADDON_AVAILABLE, CARRIER_CHANNELS_AVAILABLE, FREE_TIER_LEAD_CAP } from "@/lib/pricing";
import { Mail, Calendar, Check, RefreshCw, CreditCard, Search } from "lucide-react";
import { safeBannerText } from "@/lib/bannerText";

/** Section headings on a setting's page read like the list's group labels
 *  (SettingsList): small and quiet, the card under them carries it.
 *  Inline weight because the global h2 rule is unlayered. */
const SECTION_LABEL = "text-sm text-ink-faint";
const SECTION_STYLE = { fontWeight: 400, letterSpacing: 0 } as const;

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
/**
 * Settings, as one list (A-069, the SettingsAll board): every setting opens
 * its own page. A page shows one or more of the sections below by their
 * existing ids, so every old link (/settings#billing, #security in the
 * sign-in email, #alerts in every alert email) still lands on the right
 * page.
 */
type SettingsPage = { title: string; lede?: string; sections: string[] };
const PAGES: Record<string, SettingsPage> = {
  email: { title: "Email", lede: "Connect Gmail or Outlook. FollowUp reads new customers’ emails and replies from your own address.", sections: ["integrations"] },
  website: { title: "Website form", lede: "A contact form for your own site. What people send lands in Today.", sections: ["website-widget"] },
  social: { title: "Instagram, Facebook, WhatsApp", lede: "Customers who message your Instagram, your Facebook Page or your WhatsApp Business number show up in Today.", sections: ["social", "whatsapp"] },
  replies: { title: "Replies and check-ins", lede: "What FollowUp writes on its own, and when. Anything about a price or a date still comes to you.", sections: ["automation", "alerts"] },
  booking: { title: "Booking hours", lede: "When customers can book a call through your link, and which calendar it checks.", sections: ["booking"] },
  pause: { title: "Pause all sending", sections: ["pause"] },
  business: { title: "Your business", sections: ["business"] },
  team: { title: "Team", lede: "Admins can invite teammates, change roles and remove people.", sections: ["team"] },
  billing: { title: "Your plan", sections: ["billing"] },
  security: { title: "Sign-ins and security", sections: ["security"] },
  data: { title: "Your data", lede: "Download everything, or permanently delete this business.", sections: ["data"] },
  feedback: { title: "Tell us something", lede: "Not a support ticket. A place to tell us what’s working or what isn’t.", sections: ["feedback"] },
  // One page for what most businesses never need (A-080): the CRM, other
  // tools, phone, and routing by source.
  advanced: { title: "Advanced", lede: "Your CRM, other tools like Zapier or Make, and where new customers go by the place they wrote. Most businesses never need these.", sections: ["crm", "lead-webhook", "outbound-webhook", "phone", "lead-routing"] },
};
/** Old section id (or a page id) → the page that shows it. */
function pageFor(id: string): string | null {
  if (PAGES[id]) return id;
  for (const [page, def] of Object.entries(PAGES)) if (def.sections.includes(id)) return page;
  return null;
}

/** One grey line under each group's title in the side list's pane (A-213). */
const GROUP_WHY: Record<SettingsGroup, string> = {
  "Follow-up plan": "What FollowUp does, and when. Change it any time.",
  "Where customers write": "The places FollowUp reads and answers for you.",
  "How it writes": "How replies are written, and when they go.",
  "Your business": "Who you are, who's on your team, and your plan.",
  Account: "How you sign in, and your data.",
};

function SettingsPageInner() {
  const searchParams = useSearchParams();
  // Opened over a page (src/app/(app)/@modal): moving between Settings'
  // own pages adds no history, so closing returns in one step.
  const inWindow = useInWindow();
  const [group, setGroup] = useState<SettingsGroup>("Follow-up plan");
  // A link elsewhere in the app (a Sidebar nag, the dashboard's setup strip)
  // points at a specific section's id, e.g. /settings#billing — honor that
  // by opening straight into the tab that section lives in, so the browser's
  // own anchor scroll lands on it once it's actually in the DOM. Lazy
  // initializer so this only ever reads location.hash once, on mount.
  /**
   * "connect" on both sides, always. The URL is read AFTER mount.
   *
   * Found 2026-09-23: on the deployed settings page the tabs could not
   * be clicked at all. They took focus, so they looked alive, and
   * nothing happened. The console said:
   *
   *   "A tree hydrated but some attributes of the server rendered HTML
   *    didn't match the client properties. This won't be patched up."
   *
   * This initializer was the cause. It read `window.location` while
   * rendering, so the server produced one tab and the client's first
   * render produced another. React hit the mismatch, stopped patching,
   * and the buttons kept their native focus behaviour while their
   * onClick handlers were never bound. An owner sees a settings page
   * permanently stuck on whichever tab the server picked.
   *
   * The lazy initializer looked like the careful choice — it reads the
   * hash once instead of on every render — and that is exactly why it
   * was wrong: during hydration "once" still happens on both sides, and
   * only one of them has a `window`.
   *
   * So the first client render now matches the server byte for byte,
   * and the effect below moves the tab once hydration is safely done.
   */
  const [openPage, setOpenPage] = useState<string | null>(null);

  // Reading the URL is the entire job of this effect, and the URL is a
  // browser-only thing that must not be touched until hydration is over
  // — which is exactly what the lint rule below is warning about in the
  // general case and exactly why this is the right place here. One
  // setState, once, on mount.
  useEffect(() => {

    // An OAuth callback comes back with a query string and no hash, and
    // the page its failure belongs to is not the list: land the owner on
    // the page they just acted on, where the error is.
    const read = () => {
      const params = new URLSearchParams(window.location.search);
      const id = window.location.hash.slice(1);
      return pageFor(id) ?? (params.get("instagram") ? "social" : params.get("gmail") || params.get("outlook") ? "email" : params.get("billing") ? "billing" : null);
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenPage(read());
    // Back and forward move between the list and a page.
    const onPop = () => {
      setOpenPage(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("hashchange", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("hashchange", onPop);
    };
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

  const [autoAfterDays, setAutoAfterDays] = useState(SILENCE_DEFAULT_TRIGGER_DAYS);
  const [automationOn, setAutomationOn] = useState(false);
  const [automationLoaded, setAutomationLoaded] = useState(false);
  const [automationSaving, setAutomationSaving] = useState(false);
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
  // Business.holdAllForApproval — true by default for every account since
  // 2026-09-21. All FOUR rules below still run but send nothing; this said
  // "three of the four" while the instant acknowledgement was exempt, and
  // kept saying it for a day after the exemption was withdrawn.
  // The thank-you rule's wording reads this ("writes" vs "thanks them").
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

  // "This week" under each rule (A-044). Null until counted, and stays
  // null if counting failed, so a card shows no record rather than zeros.
  const [ruleRecords, setRuleRecords] = useState<Record<string, RuleRecordCounts> | null>(null);
  useEffect(() => {
    fetch("/api/automation/rule-records")
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && d.records) setRuleRecords(d.records);
      })
      .catch(() => {});
  }, []);
  // Granting permission to send is the one control on this page that
  // causes real messages to reach real customers, so it does not share
  // the automation section's optimistic-flip pattern: nothing moves on
  // screen until the server has said yes.
  const [permissionSaving, setPermissionSaving] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [confirmingPermission, setConfirmingPermission] = useState(false);
  // Business.autonomousAllowed — a separate question from the switch
  // above. That one asks whether anything sends by itself; this asks
  // whether anything may send WITHOUT BEING CHECKED.
  const [autonomousAllowed, setAutonomousAllowed] = useState(false);
  // Pause all sending, and who may send (A-041). Read with the rest of the
  // automation settings; the rules card and the permission card both
  // depend on them.
  const [sendingPaused, setSendingPaused] = useState(false);
  const [onlyAdminsSend, setOnlyAdminsSend] = useState(false);
  // Bumped when "Your team calls customers" changes, so This week appears or goes (A-103).
  const [teamWeekKey, setTeamWeekKey] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pauseSaving, setPauseSaving] = useState(false);
  const [autonomousSaving, setAutonomousSaving] = useState(false);
  const [autonomousError, setAutonomousError] = useState<string | null>(null);
  // Granting it asks first; revoking does not. The asymmetry is the
  // point — a confirmation on the way out would be a speed bump in front
  // of the safer answer.
  const [confirmingAutonomous, setConfirmingAutonomous] = useState(false);
  // Channels whose rule already says "Handle it all". This is the fact an
  // owner cannot get anywhere else: a source rule applies at lead
  // CREATION, so granting this does not just affect leads they chose one
  // by one — every new lead from these channels lands on unreviewed
  // sending from the next one onwards. While the permission is off those
  // leads are quietly downgraded to Assisted (see sourceRouting.ts), so
  // the rule looks harmless right up until the moment it isn't.
  // null = not asked yet, or the read failed: the panel then states the
  // rule in general terms rather than an invented "no channels".
  const [autonomousRuleSources, setAutonomousRuleSources] = useState<string[] | null>(null);
  // What is waiting right now, split by whether the approval setting is
  // the only thing holding it. Fetched when the confirmation opens rather
  // than on page load — it scans the audit trail, and only someone
  // actually deciding needs the answer. null means "not asked yet or
  // couldn't read it": the panel then describes the rules without
  // numbers, which is honest, rather than showing a confident zero.
  const [sendPreview, setSendPreview] = useState<{
    total: number;
    heldOnlyBySetting: number;
    wouldWaitAnyway: number;
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
          autonomousAllowed?: boolean;
          sendingPaused?: boolean;
          onlyAdminsSend?: boolean;
          isAdmin?: boolean;
        }) => {
          setAutomationOn(data.enabled);
          setAutoAfterDays(data.triggerDays);
          setInstantAckOn(data.instantAck ?? true);
          setUnansweredOn(data.unansweredReply?.enabled ?? true);
          setUnansweredHours(data.unansweredReply?.hours ?? 24);
          setDeadLeadOn(data.deadLeadReactivation?.enabled ?? true);
          setDeadLeadDays(data.deadLeadReactivation?.days ?? 45);
          setHoldAllForApproval(data.holdAllForApproval ?? false);
          setAutonomousAllowed(data.autonomousAllowed ?? false);
          setSendingPaused(data.sendingPaused ?? false);
          setOnlyAdminsSend(data.onlyAdminsSend ?? false);
          setIsAdmin(data.isAdmin ?? false);
        }
      )
      .finally(() => setAutomationLoaded(true));
  }, []);

  /**
   * The three rule savers below take `revertTo`: what the rule's switch
   * goes back to if the save fails. A switch press flipped it first, so it
   * goes back; saving the rule's NUMBER never touched the switch, and used
   * to flip it anyway — a rejected "3 days" showed the whole rule as off
   * while the server still had it on. On success the number is taken from
   * the server's answer, which clamps it: typing 5 into the welcome-back
   * days saved 30, and the page went on saying 5.
   */
  async function saveAutomationSettings(enabled: boolean, triggerDays: number, revertTo: boolean = !enabled) {
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
        setAutomationOn(revertTo); // revert the optimistic flip, if there was one
        setAutomationError(data.message ?? "Couldn't save — try again.");
      } else if (typeof data.triggerDays === "number") {
        setAutoAfterDays(data.triggerDays);
      }
    } catch {
      // Offline: nothing was saved, so the switch must not look saved.
      setAutomationOn(revertTo);
      setAutomationError("Couldn't reach the server — try again.");
    } finally {
      setAutomationSaving(false);
    }
  }

  async function saveUnanswered(enabled: boolean, hours: number, revertTo: boolean = !enabled) {
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
        setUnansweredOn(revertTo);
        setUnansweredError(data.message ?? "Couldn't save — try again.");
      } else if (typeof data.unansweredReply?.hours === "number") {
        setUnansweredHours(data.unansweredReply.hours);
      }
    } catch {
      setUnansweredOn(revertTo);
      setUnansweredError("Couldn't reach the server — try again.");
    } finally {
      setUnansweredSaving(false);
    }
  }

  async function saveDeadLead(enabled: boolean, days: number, revertTo: boolean = !enabled) {
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
        setDeadLeadOn(revertTo);
        setDeadLeadError(data.message ?? "Couldn't save — try again.");
      } else if (typeof data.deadLeadReactivation?.days === "number") {
        setDeadLeadDays(data.deadLeadReactivation.days);
      }
    } catch {
      setDeadLeadOn(revertTo);
      setDeadLeadError("Couldn't reach the server — try again.");
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
    } catch {
      setInstantAckOn(!next);
      setInstantAckError("Couldn't reach the server — try again.");
    } finally {
      setInstantAckSaving(false);
    }
  }

  // One sentence describing exactly what's active right now, built from the
  // same 4 flags the individual rules already use — never drifts out of
  // sync with reality the way 4 separately-worded "Our promise" blocks could.
  /**
   * Grant or withdraw the permission to send without asking.
   *
   * `autoSendPermission` is the positive form — the API owns the single
   * inversion to Business.holdAllForApproval, so this file never writes a
   * `!` against it (see the settings route's schema comment: getting that
   * backwards means messaging every customer a business has).
   *
   * No optimistic flip. The rest of this page flips first and reverts on
   * failure, which is right for a timing preference and wrong here: an
   * owner who sees "on" must be looking at a server that agrees, because
   * the next cron tick acts on the server's answer, not the screen's.
   */
  async function saveSendPermission(granted: boolean) {
    setPermissionSaving(true);
    setPermissionError(null);
    try {
      const res = await fetch("/api/automation/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoSendPermission: granted }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setPermissionError(data.message ?? "Couldn't save — try again.");
        return;
      }
      setHoldAllForApproval(!granted);
      // Either decision replaces a pause (see the settings route).
      setSendingPaused(false);
      setConfirmingPermission(false);
    } catch {
      setPermissionError("Couldn't reach the server — try again.");
    } finally {
      setPermissionSaving(false);
    }
  }

  /**
   * Pause all sending, or resume it (A-041). Same no-optimistic-flip rule
   * as the permission above: the screen moves when the server has.
   */
  /** Open one setting's page (or go back to the list with null). */
  function openMore(section: string | null) {
    const page = section ? pageFor(section) : null;
    const first = page ? PAGES[page].sections[0] : "";
    const url = window.location.pathname + (first ? `#${first}` : "");
    if (inWindow) window.history.replaceState(window.history.state, "", url);
    else window.history.pushState(null, "", url);
    setOpenPage(page);
    if (inWindow) document.querySelector(".app-win__body")?.scrollTo(0, 0);
    else window.scrollTo(0, 0);
  }

  async function savePause(paused: boolean) {
    setPauseSaving(true);
    setPermissionError(null);
    try {
      const res = await fetch("/api/automation/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setPermissionError(data.message ?? "Couldn't save — try again.");
        return;
      }
      setSendingPaused(paused);
      setHoldAllForApproval(paused);
    } catch {
      setPermissionError("Couldn't reach the server — try again.");
    } finally {
      setPauseSaving(false);
    }
  }

  /**
   * Grant or withdraw permission for the Auto mode.
   *
   * No optimistic flip, for the same reason as the switch above: the next
   * cron tick acts on the server's answer, not the screen's, and an owner
   * who sees "allowed" must be looking at a server that agrees.
   *
   * Withdrawing does not need a confirmation. Taking a permission away is
   * always allowed and always safe; only granting one deserves a pause.
   */
  async function saveAutonomousPermission(granted: boolean): Promise<boolean> {
    setAutonomousSaving(true);
    setAutonomousError(null);
    try {
      const res = await fetch("/api/automation/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autonomousAllowed: granted }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setAutonomousError(data.message ?? "Couldn't save — try again.");
        return false;
      }
      setAutonomousAllowed(granted);
      return true;
    } catch {
      setAutonomousError("Couldn't reach the server — try again.");
      return false;
    } finally {
      setAutonomousSaving(false);
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

  // Surface the outcome of the OAuth redirect (?gmail=connected|error) —
  // pure derivation from the URL, no state needed.
  const gmailError =
    searchParams.get("gmail") === "error" ? safeBannerText(searchParams.get("message"), "Couldn't connect Gmail.") : null;
  const outlookError =
    searchParams.get("outlook") === "error" ? safeBannerText(searchParams.get("message"), "Couldn't connect Outlook.") : null;
  // Instagram was missing from this list entirely.
  //
  // Found 2026-09-23, connecting a brand-new demo account: the OAuth
  // callback redirected to /settings?instagram=error&message=… exactly
  // as Gmail's and Outlook's do, and nothing on the page read it. The
  // connect had failed at Meta's long-lived token exchange, the page
  // rendered as though nothing had happened, and the only trace was the
  // query string in the address bar.
  //
  // A failed connect that says nothing is worse than one that says the
  // wrong thing: the owner presses Connect, the screen looks unchanged,
  // and they have no idea whether to wait, retry, or give up. The
  // channel then silently receives nothing forever.
  const instagramError =
    searchParams.get("instagram") === "error" ? safeBannerText(searchParams.get("message"), "Couldn't connect Instagram.") : null;
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
      // A big inbox is read in budgeted passes; the automatic sync picks up
      // where this one stopped within a couple of minutes.
      const moreNote = data.truncated ? " Still reading the rest — more will appear on their own." : "";
      if (data.count === 0) {
        setSyncResult(`Synced — no new sales conversations found in your recent inbox.${moreNote}`);
      } else {
        const scoredNote = data.scored > 0 ? `, ${data.scored} sorted by how likely they are to book` : "";
        setSyncResult(`Synced ${data.count} lead${data.count === 1 ? "" : "s"} from your inbox${scoredNote}.${moreNote}`);
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
        const scoredNote = data.scored > 0 ? `, ${data.scored} sorted by how likely they are to book` : "";
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

  const page = openPage ? PAGES[openPage] : null;
  // The side list follows the page that's open (a link to #billing lands in "Your business").
  const navGroup: SettingsGroup = (openPage ? groupOfPage(openPage) : null) ?? group;
  const visible = (id: string) => Boolean(page?.sections.includes(id));
  // A page with one section: its title is the h1, so the section's own
  // label would say it twice.
  const sectionLabel = page && page.sections.length > 1 ? SECTION_LABEL : "sr-only";
  const planStatus =
    billingStatus === "beta"
      ? "Founding tester"
      : billingTier === "free"
      ? billingLoaded
        ? `Free · ${leadsUsedThisMonth} of ${FREE_TIER_LEAD_CAP} this month`
        : "Free"
      : TIER_INFO[billingTier].label;

  return (
    // Desk: a side list of the groups beside the open one (A-212, A-213,
    // like Wispr's Settings window). Phone: the one list, as before.
    <div className={"lg:grid lg:grid-cols-[212px_minmax(0,1fr)] " + (inWindow ? "lg:min-h-full" : "lg:gap-10")}>
      <nav
        aria-label="Settings sections"
        className={
          "hidden lg:flex lg:flex-col lg:gap-0.5 text-[14.5px] " +
          (inWindow ? "lg:bg-card-2 lg:px-3 lg:py-5" : "lg:sticky lg:top-6 lg:self-start lg:rounded-[14px] lg:bg-card-2 lg:p-3")
        }
      >
        <p className="px-2.5 pb-2 font-mono text-[11px] uppercase tracking-[0.09em] text-ink-faint">Settings</p>
        {SETTINGS_GROUPS.map((g) => {
          const on = g === navGroup && openPage !== "feedback";
          return (
            <button
              key={g}
              type="button"
              aria-current={on ? "true" : undefined}
              onClick={() => {
                setGroup(g);
                if (openPage) openMore(null);
              }}
              className="rounded-[9px] px-2.5 py-2 text-left hover:bg-paper"
              style={on ? { background: "var(--paper)", color: "var(--ink)", fontWeight: 600, boxShadow: "0 0 0 1px var(--line)" } : { color: "var(--ink-soft)" }}
            >
              {g}
            </button>
          );
        })}
        <button type="button" onClick={() => openMore("feedback")} className="mt-6 px-2.5 py-2 text-left text-[13px] text-ink-faint hover:text-ink">
          Something broke? Tell us
        </button>
      </nav>
      <div className={"min-w-0 " + (inWindow ? "lg:px-10 lg:pb-10 lg:pt-8" : "")}>
      {!page ? (
        // The list (A-080): one column, the plan on top, five groups of
        // rows, each opening its own page. On the desk, only the group
        // the side list has open.
        <div>
          <h1 className="title-serif text-[32px] leading-[1.1] lg:hidden">Settings</h1>
          <div className="hidden lg:block">
            <h1 className="title-serif text-[32px] leading-[1.12]">{navGroup}</h1>
            <p className="mt-1.5 text-[14.5px] text-ink-faint">{GROUP_WHY[navGroup]}</p>
          </div>
          <div className="mt-6">
            <SettingsList
              gmail={{ connected: gmailConnected, email: gmailEmail }}
              outlook={{ connected: outlookConnected, email: outlookEmail }}
              checkInDays={quietReminderDays(autoAfterDays)}
              instantAck={instantAckOn}
              holdAll={holdAllForApproval}
              paused={sendingPaused}
              planStatus={planStatus}
              onOpen={openMore}
              selected={navGroup}
            />
          </div>
        </div>
      ) : (
        <div className="max-w-[640px]">
          <button type="button" onClick={() => openMore(null)} className="text-[13px] text-ink-faint hover:text-ink">
            <span className="lg:hidden">← Settings</span>
            <span className="hidden lg:inline">← {openPage === "feedback" ? "Settings" : navGroup}</span>
          </button>
          <h1 className="title-serif mt-2 text-[30px] leading-[1.12] lg:text-[32px]">{page.title}</h1>
          {page.lede && <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{page.lede}</p>}
        </div>
      )}

      {/* One setting's own page. Every section stays mounted, so each
          panel keeps its state while the owner moves around. */}
      <div hidden={!page} className="mt-7 max-w-[640px] space-y-8">
      <section id="integrations" hidden={!visible("integrations")} className="scroll-mt-16">
        <h2 className={sectionLabel} style={SECTION_STYLE}>Integrations</h2>
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
            <div className="sm:ml-[52px] flex flex-wrap sm:flex-nowrap items-center gap-3">
              <button
                onClick={handleGmailSync}
                disabled={syncing}
                className="text-sm font-medium rounded-full px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-60"
                style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing…" : "Sync now"}
              </button>
              <button
                onClick={handleGmailDisconnect}
                disabled={disconnecting}
                className="text-sm font-medium rounded-full px-3 py-1.5 disabled:opacity-60"
                style={{ backgroundColor: "var(--paper)", color: "var(--coral)", border: "1px solid var(--line)" }}
              >
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
              <a
                href="/api/integrations/gmail/connect"
                className="text-sm font-medium rounded-full px-3 py-1.5 flex items-center gap-1.5"
                style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}
              >
                <Calendar className="h-3.5 w-3.5" />
                Reconnect
              </a>
              {syncResult && <span className="text-[13px] text-ink-soft">{syncResult}</span>}
            </div>
          )}
          {gmailConnected && (
            <p className="sm:ml-[52px] text-[13px] text-ink-soft">
              If you connected Gmail before booking links existed, click <strong>Reconnect</strong> once to grant
              calendar access.
            </p>
          )}
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
                  className="text-sm font-medium rounded-full border border-line px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-60 hover:bg-paper transition-colors"
                  style={{ color: "var(--ink-soft)" }}
                >
                  <Search className={`h-3.5 w-3.5 ${scanningSpam ? "animate-pulse" : ""}`} />
                  {scanningSpam ? "Checking…" : "Scan spam for missed leads"}
                </button>
                {spamScanResult && <span className="text-[13px] text-ink-soft">{spamScanResult}</span>}
              </div>
              <p className="text-[13px] text-ink-soft mt-2">
                A real lead&apos;s first message can land in spam by mistake — this checks that folder specifically
                and adds anything that looks like a genuine prospect, tagged so you can tell where it came from.
                Manual only; it never runs on its own.
              </p>
            </div>
          )}
          {gmailError && (
            <p className="text-[13px]" style={{ color: "var(--coral)" }}>
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
                className="text-sm font-medium rounded-full px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-60"
                style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${outlookSyncing ? "animate-spin" : ""}`} />
                {outlookSyncing ? "Syncing…" : "Sync now"}
              </button>
              <button
                onClick={handleOutlookDisconnect}
                disabled={outlookDisconnecting}
                className="text-sm font-medium rounded-full px-3 py-1.5 disabled:opacity-60"
                style={{ backgroundColor: "var(--paper)", color: "var(--coral)", border: "1px solid var(--line)" }}
              >
                {outlookDisconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
              {outlookSyncResult && <span className="text-[13px] text-ink-soft">{outlookSyncResult}</span>}
            </div>
          )}
          {outlookError && (
            <p className="text-[13px]" style={{ color: "var(--coral)" }}>
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
          <p className="text-[13px] text-ink-soft mt-2">
            {/* Until 2026-09-22 this promised that the dashboard would show
                nothing at all without an inbox. It sits under the
                Gmail/Outlook panel, so naming the inbox is right — but the
                dashboard fills from any of eight sources, and a business
                capturing through the website widget was told its working
                setup produced nothing. The sentence now claims only what
                this panel actually controls. */}
            Connect Gmail or Outlook to pull leads in from your inbox. The other sources below work on
            their own.
          </p>
        )}
      </section>

      {/* Booking hours have their own page (A-080's "How it writes" group);
          they used to sit inside the Email page under the Gmail row. */}
      <section id="booking" hidden={!visible("booking")} className="scroll-mt-16">
        <h2 className={sectionLabel} style={SECTION_STYLE}>Booking hours</h2>
        <div className="mt-4">
          <BookingCalendarConfig />
        </div>
      </section>

      {/* Was buried inside the "Instagram" section under the wrong name —
          it's a CRM sync, unrelated to social DMs. Grouped with Connect
          since it's about where leads/contacts come from, not a channel. */}
      <section id="crm" hidden={!visible("crm")} className="scroll-mt-16">
        <h2 className={sectionLabel} style={SECTION_STYLE}>CRM sync</h2>
        <div className="mt-4">
          <CrmConfig />
        </div>
      </section>

      <section id="website-widget" hidden={!visible("website-widget")} className="scroll-mt-16">
        <h2 className={sectionLabel} style={SECTION_STYLE}>Website widget</h2>
        <div className="mt-4">
          <CopyEmbedSnippet />
          {/* Only appears if the owner told Today they have no website. */}
          <SetupStepRestore
            id="widget"
            note="You told FollowUp you don’t have a website, so it stopped asking."
          />
        </div>
      </section>

      <section id="lead-webhook" hidden={!visible("lead-webhook")} className="scroll-mt-16">
        <h2 className={sectionLabel} style={SECTION_STYLE}>Lead webhook</h2>
        <div className="mt-4">
          <CopyWebhookUrl />
        </div>
      </section>

      <section id="outbound-webhook" hidden={!visible("outbound-webhook")} className="scroll-mt-16">
        <h2 className={sectionLabel} style={SECTION_STYLE}>Outbound webhook</h2>
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
        <section id="phone" hidden={!visible("phone")} className="scroll-mt-16">
          <h2 className={sectionLabel} style={SECTION_STYLE}>Phone (SMS + calls)</h2>
          <div className="mt-4">
            <TwilioConfig />
          </div>
        </section>
      )}

      {/* The three Meta channels sit together on one page, in the order a
          business is most likely to already have them. */}
      <section id="social" hidden={!visible("social")} className="scroll-mt-16">
        <h2 className={sectionLabel} style={SECTION_STYLE}>Instagram &amp; Facebook</h2>
        {instagramError && (
          <p className="text-[13px]" style={{ color: "var(--coral)" }}>
            {instagramError}
          </p>
        )}
        <div className="mt-4">
          <InstagramConfig />
          <FacebookConfig />
        </div>
      </section>

      <section id="whatsapp" hidden={!visible("whatsapp")} className="scroll-mt-16">
        <h2 className={sectionLabel} style={SECTION_STYLE}>WhatsApp</h2>
        <div className="mt-4">
          <WhatsAppConfig />
        </div>
      </section>

      {/* Pause all sending (A-041), on its own page since A-080: the list
          shows Off or Paused; this is where it changes. */}
      <section id="pause" hidden={!visible("pause")} className="scroll-mt-16">
        <h2 className={sectionLabel} style={SECTION_STYLE}>Pause all sending</h2>
        <div className="mt-4 flex items-center gap-3.5 rounded-[14px] border border-line bg-card px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="text-base">{sendingPaused ? "Sending is paused" : "Pause all sending"}</div>
            <div className="mt-0.5 text-[13.5px] leading-snug text-ink-faint">
              {sendingPaused
                ? "Everything waits for your OK until you resume. Your settings stayed as they were."
                : "Everything waits for your OK until you resume. Your settings stay."}
            </div>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => savePause(!sendingPaused)}
              disabled={pauseSaving}
              className="h-11 shrink-0 rounded-full border bg-card px-[18px] text-[15px] font-medium disabled:opacity-60"
              style={{ borderColor: "var(--line-strong)" }}
            >
              {pauseSaving ? "…" : sendingPaused ? "Resume" : "Pause"}
            </button>
          )}
        </div>
      </section>

      <section id="automation" hidden={!visible("automation")} className="scroll-mt-16">
        <h2 className={sectionLabel} style={SECTION_STYLE}>Automation</h2>
        {/* The owner's own record with the drafts (research round 2, #3), above the rules it informs. */}
        <TrackRecord holdAll={holdAllForApproval} />

        {/* Permission to send, above the rules it governs — because it
            decides what all of them DO, and reading the timings first
            without knowing whether anything leaves the building is the
            wrong order. Founder, 2026-09-22: "followup will be sending
            automatically followups if they have allowed and given the
            permission."

            Deliberately not a Switch like everything else in this
            section. A switch is for a preference; this is a decision
            whose consequence is that strangers receive messages written
            by a machine on this business's behalf. It states what will
            happen, and granting takes a second, explicit press. Turning
            it back off is one press, no confirmation — stopping should
            never be harder than starting. */}
        {/* Above the controls that change them. */}
        {automationLoaded && (
          <YourRulesCard holdAll={holdAllForApproval} paused={sendingPaused} autonomousAllowed={autonomousAllowed} onlyAdminsSend={onlyAdminsSend} />
        )}

        <div className="mt-4 box p-5">
          {sendingPaused ? (
            /* Paused: a hold the owner meant to be temporary. Resume puts
               sending back as it was; anything that waited during the
               pause keeps waiting (see @/lib/sendingControl). */
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-sm">Sending is paused</p>
                <p className="text-[13px] text-ink-soft mt-1">
                  Everything waits for your OK until you resume. What waited during the pause still waits for you.
                  {!isAdmin && " An admin can resume it."}
                </p>
                {isAdmin && (
                  <button
                    onClick={() => saveSendPermission(false)}
                    disabled={permissionSaving || pauseSaving}
                    className="mt-3 text-[13px] font-medium underline underline-offset-2 text-ink-soft"
                  >
                    Stop sending by itself for good
                  </button>
                )}
              </div>
              {isAdmin && (
                <button
                  onClick={() => savePause(false)}
                  disabled={pauseSaving || permissionSaving}
                  className="shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium disabled:opacity-60"
                  style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
                >
                  {pauseSaving ? "Resuming…" : "Resume"}
                </button>
              )}
            </div>
          ) : (
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-medium text-sm">
                {/* Named as in onboarding's "How should FollowUp work?" step, so
                    the choice an owner made there is recognisable here. */}
                {holdAllForApproval ? "Assisted: FollowUp asks you before every message" : "Automatic: FollowUp sends on your behalf"}
              </p>
              <p className="text-[13px] text-ink-soft mt-1">
                {holdAllForApproval
                  ? "Every follow-up it writes waits in Today until you send it. One exception: if a customer asks a price or a date and 30 minutes pass, they get a short “let me check” so they aren’t left waiting. The answer still waits for you."
                  : "Simple, low-risk follow-ups go out on their own. Anything about price, or anything sensitive, still waits for you — and it stops the moment a customer replies."}
              </p>
              {/* Stopping for good stays one press, as it always was; it
                  just moves under Pause, which is what most owners who
                  want to stop for now actually mean. */}
              {!holdAllForApproval && isAdmin && (
                <button
                  onClick={() => saveSendPermission(false)}
                  disabled={permissionSaving || pauseSaving}
                  className="mt-3 text-[13px] font-medium underline underline-offset-2 text-ink-soft"
                >
                  {permissionSaving ? "Saving…" : "Stop sending by itself for good"}
                </button>
              )}
            </div>
            {!holdAllForApproval && (
              /* Anyone on the team can pause: it only ever holds messages. */
              <button
                onClick={() => savePause(true)}
                disabled={pauseSaving || permissionSaving}
                className="shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium border"
                style={{ borderColor: "var(--line)" }}
              >
                {pauseSaving ? "Pausing…" : "Pause all sending"}
              </button>
            )}
          </div>
          )}

          {holdAllForApproval && !sendingPaused && !confirmingPermission && (
            <button
              onClick={() => {
                setConfirmingPermission(true);
                setSendPreview(null);
                fetch("/api/automation/send-preview")
                  .then((r) => r.json())
                  .then((d) => {
                    // Only on an explicit success. A failed read leaves
                    // it null so the box shows the rules with no counts,
                    // rather than "0 waiting" for a queue it couldn't read.
                    if (d?.success) setSendPreview(d);
                  })
                  .catch(() => {});
              }}
              className="mt-4 text-[13px] font-medium underline underline-offset-2 text-ink-soft"
            >
              Let FollowUp send without asking
            </button>
          )}

          {holdAllForApproval && !sendingPaused && confirmingPermission && (
            <div className="mt-4 rounded-[12px] p-4" style={{ backgroundColor: "var(--card-2)" }}>
              {/* --card-2, not --ink-soft. The first draft used
                  --ink-soft for this surface, which is a TEXT token
                  (#9ca3af / #52525b) — so the four facts below, set in
                  text-ink-soft, rendered the same colour as the surface
                  behind them and were invisible. --card-2 is the
                  documented inset surface: "a second step for an inset
                  surface (a code block, a quoted message)", which is
                  exactly what this is. Caught by rendering the panel; no
                  test would have seen it.

                  What actually changes, in the order an owner would ask
                  it. No "are you sure?" — that asks for nerve, not for a
                  decision. This asks them to read four facts. */}
              <p className="text-sm font-medium">If you allow this, from the next check onwards:</p>
              <ul className="mt-2 space-y-1.5 text-[13px] text-ink-soft">
                <li>• FollowUp will send follow-ups to your customers itself, signed as your business.</li>
                <li>• Only the simple, low-risk ones. Anything about price or anything sensitive still waits for you.</li>
                <li>• It still stops the moment a customer replies.</li>
                <li>• Every message it sends is written down, with the reason, and you can turn this off at any time.</li>
              </ul>

              {/* The abstract rules above, made concrete with this
                  business's own queue.

                  Carefully worded. It does NOT say these would have been
                  sent: while the hold is on, both schedulers skip the risk
                  classifier entirely, so nothing has ever judged these
                  drafts (see @/lib/sendPreview). What is knowable is which
                  ones the setting is the ONLY thing stopping — that is what
                  the number is, and the sentence says exactly that and no
                  more. Absent when the count could not be read, rather than
                  showing a zero the queue does not support. */}
              {sendPreview && sendPreview.total > 0 && (
                <p className="mt-3 text-[13px]" style={{ color: "var(--ink)" }}>
                  Right now {sendPreview.total} {sendPreview.total === 1 ? "follow-up is" : "follow-ups are"} waiting.{" "}
                  {sendPreview.heldOnlyBySetting > 0 ? (
                    <>
                      <strong>{sendPreview.heldOnlyBySetting}</strong>{" "}
                      {sendPreview.heldOnlyBySetting === 1 ? "is" : "are"} waiting only because of this setting.{" "}
                      {/* Was "FollowUp will check those and send what passes",
                          which stopped being true on 2026-09-23: granting
                          stamps autoSendAllowedAt, and everything already
                          waiting stays waiting (the backlog rule in
                          automation.ts) until the owner releases it. */}
                      Turning this on won&apos;t send {sendPreview.heldOnlyBySetting === 1 ? "it" : "them"} — only
                      conversations from now on go out by themselves. You can send what&apos;s already waiting with one tap
                      in Today.
                    </>
                  ) : (
                    <>None of them are waiting only because of this setting.</>
                  )}
                  {/* "The other N" only makes sense when some were
                      counted. With none held by the setting it came out as
                      "None of them are waiting only because of this
                      setting. The other 4 need you either way." — there is
                      no "other". Caught by rendering the empty-split case;
                      the counts were right and the sentence was not. */}
                  {sendPreview.heldOnlyBySetting > 0 && sendPreview.wouldWaitAnyway > 0 && (
                    <>
                      {" "}
                      The other {sendPreview.wouldWaitAnyway} {sendPreview.wouldWaitAnyway === 1 ? "needs" : "need"} you
                      either way.
                    </>
                  )}{" "}
                  {/* The queue renders on the dashboard (ApprovalQueue in
                      (app)/dashboard/page.tsx) — there is no /approvals
                      route, which the first draft of this line linked to. */}
                  <a href="/dashboard" className="underline underline-offset-2">
                    Read them first
                  </a>
                  .
                </p>
              )}
              {permissionError && (
                <p className="mt-3 text-[13px]" style={{ color: "var(--coral)" }}>
                  {permissionError}
                </p>
              )}
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => saveSendPermission(true)}
                  disabled={permissionSaving}
                  className="rounded-full px-3 py-1.5 text-[13px] font-medium"
                  style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
                >
                  {permissionSaving ? "Saving…" : "Yes, send on my behalf"}
                </button>
                <button
                  onClick={() => {
                    setConfirmingPermission(false);
                    setPermissionError(null);
                  }}
                  disabled={permissionSaving}
                  className="rounded-full px-3 py-1.5 text-[13px] font-medium text-ink-soft"
                >
                  Not yet
                </button>
              </div>
            </div>
          )}

          {permissionError && !confirmingPermission && (
            <p className="mt-3 text-[13px]" style={{ color: "var(--coral)" }}>
              {permissionError}
            </p>
          )}
        </div>

        {/* The second, narrower permission. Deliberately its own box and
            not a row inside the one above: an owner can say yes to "send
            on my behalf" and no to "send things nobody checked" forever,
            and burying the second inside the first would read as one
            decision with a detail attached. */}
        <div className="mt-4 box p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-medium text-sm">Let some leads skip the check</p>
              <p className="mt-1 text-[13px] text-ink-soft leading-relaxed">
                {autonomousAllowed
                  ? "A lead set to \u201cHandle it all\u201d sends every reply straight away \u2014 including price, dates and tense conversations \u2014 with nobody reading it first."
                  : "Off. Every reply is checked before it goes, even on a lead set to \u201cHandle it all\u201d \u2014 anything about price, dates or a tense conversation waits for you."}
              </p>
            </div>
            {/* Turning it OFF is one press. Turning it ON opens the panel
                below first — the same shape as the send permission above,
                which asks an owner to read what changes rather than to
                confirm they meant to click. */}
            {(autonomousAllowed || !confirmingAutonomous) && (
              <button
                onClick={() => {
                  if (autonomousAllowed) {
                    saveAutonomousPermission(false);
                    return;
                  }
                  setConfirmingAutonomous(true);
                  setAutonomousError(null);
                  setAutonomousRuleSources(null);
                  fetch("/api/source-rules")
                    .then((r) => r.json())
                    .then((d) => {
                      // Only on an explicit success, so a failed read
                      // leaves it null and the panel says nothing about
                      // channels rather than claiming there are none.
                      if (d?.success && Array.isArray(d.rules)) {
                        setAutonomousRuleSources(
                          d.rules
                            .filter((r: { automationTierDefault?: string | null }) => r.automationTierDefault === "AUTONOMOUS")
                            .map((r: { source: string }) => r.source)
                        );
                      }
                    })
                    .catch(() => {});
                }}
                disabled={autonomousSaving}
                className="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium disabled:opacity-60"
                style={
                  autonomousAllowed
                    ? { backgroundColor: "var(--card-2)", color: "var(--ink)" }
                    : { backgroundColor: "var(--ink)", color: "var(--paper)" }
                }
              >
                {autonomousSaving ? "Saving\u2026" : autonomousAllowed ? "Turn off" : "Allow it"}
              </button>
            )}
          </div>

          {!autonomousAllowed && confirmingAutonomous && (
            <div className="mt-4 rounded-[12px] p-4" style={{ backgroundColor: "var(--card-2)" }}>
              <p className="text-sm font-medium">If you allow this, from the next check onwards:</p>
              <ul className="mt-2 space-y-1.5 text-[13px] text-ink-soft">
                <li>• Only leads you set to &ldquo;Handle it all&rdquo; are affected. Every new lead still starts in Assisted.</li>
                <li>• On those leads, nobody reads the message first — including price, dates and tense conversations.</li>
                <li>• The check that holds risky drafts back does not run on them.</li>
                <li>• Every message is still written down, with the reason, and you can turn this off at any time.</li>
              </ul>
              {autonomousRuleSources && autonomousRuleSources.length > 0 && (
                <p className="mt-3 text-[13px]" style={{ color: "var(--ink)" }}>
                  <strong>
                    {autonomousRuleSources.length === 1
                      ? `Your ${autonomousRuleSources[0]} rule`
                      : `${autonomousRuleSources.length} channel rules (${autonomousRuleSources.join(", ")})`}
                  </strong>{" "}
                  {autonomousRuleSources.length === 1 ? "is" : "are"} set to &ldquo;Handle it all&rdquo;, so every new lead from{" "}
                  {autonomousRuleSources.length === 1 ? "that channel" : "those channels"} will go onto this the moment it
                  arrives — you won&apos;t be choosing them one at a time.
                </p>
              )}
              {autonomousError && (
                <p className="mt-3 text-[13px]" style={{ color: "var(--coral)" }}>
                  {autonomousError}
                </p>
              )}
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={async () => {
                    // Closed only on a yes from the server. A failed
                    // save leaves the panel open with the error inside
                    // it, rather than collapsing back to a button that
                    // still says "Allow it" for no visible reason.
                    if (await saveAutonomousPermission(true)) setConfirmingAutonomous(false);
                  }}
                  disabled={autonomousSaving}
                  className="rounded-full px-3 py-1.5 text-[13px] font-medium"
                  style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
                >
                  {autonomousSaving ? "Saving\u2026" : "Yes, let those leads skip the check"}
                </button>
                <button
                  onClick={() => {
                    setConfirmingAutonomous(false);
                    setAutonomousError(null);
                  }}
                  disabled={autonomousSaving}
                  className="rounded-full px-3 py-1.5 text-[13px] font-medium text-ink-soft"
                >
                  Not yet
                </button>
              </div>
            </div>
          )}

          {autonomousError && !confirmingAutonomous && (
            <p className="mt-3 text-[13px]" style={{ color: "var(--coral)" }}>
              {autonomousError}
            </p>
          )}
        </div>

        {/* The four rules as sentences (design brain A-044, the Zapier
            study). Each used to be a switch named after the machinery
            ("Auto follow-up on silence") with a paragraph under it, behind
            a "Change the timings" expander. Now each rule says what
            happens, when it stops, and what it did this week, with its
            one number inside the sentence. Same settings, same saves. */}
        {/* #16 (founder, 2026-10-05, A-094): each rule is its sentence, its number and one
            "stops when" line. What every rule shares (price waits for you) is said once, in
            the page's lede and "Your rules", not under every switch. */}
        <div className="mt-6 space-y-3">
          <RuleCard
            when="When a new customer writes for the first time,"
            does={holdAllForApproval ? "FollowUp writes a short thank-you right away." : "FollowUp thanks them right away."}
            stops="Once per customer, in their language. Never if you've already replied."
            checked={instantAckOn}
            onToggle={() => {
              const next = !instantAckOn;
              setInstantAckOn(next);
              saveInstantAck(next);
            }}
            disabled={!automationLoaded || instantAckSaving}
            label="Thank new customers right away"
            exampleRule={"instant_ack"}
            record={ruleRecords?.instant_ack ?? null}
            error={instantAckError}
          />

          <RuleCard
            when="When a customer writes and you haven't answered,"
            does="FollowUp writes a reply within minutes."
            stops="It stops the moment anyone replies."
            checked={unansweredOn}
            onToggle={() => {
              const next = !unansweredOn;
              setUnansweredOn(next);
              saveUnanswered(next, unansweredHours);
            }}
            disabled={!automationLoaded || unansweredSaving}
            label="Reply when you haven't"
            exampleRule={"unanswered"}
            record={ruleRecords?.unanswered ?? null}
            error={unansweredError}
          >
            {unansweredOn && (
              <p className="mt-3 text-sm">
                If one was missed, it checks again after{" "}
                <RuleNumber
                  value={unansweredHours}
                  min={1}
                  max={168}
                  onChange={setUnansweredHours}
                  onCommit={() => saveUnanswered(unansweredOn, unansweredHours, unansweredOn)}
                  label="Hours before checking again"
                  disabled={unansweredSaving}
                />{" "}
                hours.
              </p>
            )}
            {/* Kept as one line through the #16 cut (A-094): without it the number above silently
                means something else on three channels (brand principle 1). Only shown while it
                changes something. */}
            {unansweredOn && unansweredHours > UNANSWERED_META_DM_MAX_HOURS && (
              <p className="text-[13px] text-ink-soft mt-2">
                On Instagram, Messenger and WhatsApp it&apos;s {UNANSWERED_META_DM_MAX_HOURS} hours at most. Meta only
                lets a business reply freely within a day of the lead&apos;s last message.
              </p>
            )}
          </RuleCard>

          <RuleCard
            when="When they go quiet after you wrote,"
            does={
              <>
                FollowUp checks in on day{" "}
                <RuleNumber
                  value={autoAfterDays}
                  min={1}
                  max={30}
                  onChange={setAutoAfterDays}
                  onCommit={() => saveAutomationSettings(automationOn, autoAfterDays, automationOn)}
                  label="Day of the first check-in"
                  disabled={!automationOn || automationSaving}
                />
                , then {listDays(quietReminderDays(autoAfterDays).slice(1))}.
              </>
            }
            stops="Stops when they answer. 8am to 8pm, never more than one a day."
            checked={automationOn}
            onToggle={() => {
              const next = !automationOn;
              setAutomationOn(next);
              saveAutomationSettings(next, autoAfterDays);
            }}
            disabled={!automationLoaded || automationSaving}
            label="Check in when they go quiet"
            exampleRule={"silence"}
            record={ruleRecords?.silence ?? null}
            error={automationError}
          />

          <RuleCard
            when="When nobody has written for"
            does={
              <>
                <RuleNumber
                  value={deadLeadDays}
                  min={30}
                  max={180}
                  onChange={setDeadLeadDays}
                  onCommit={() => saveDeadLead(deadLeadOn, deadLeadDays, deadLeadOn)}
                  label="Days of silence before a welcome-back"
                  disabled={!deadLeadOn || deadLeadSaving}
                />{" "}
                days, FollowUp writes one welcome-back message.
              </>
            }
            stops="Once per customer."
            checked={deadLeadOn}
            onToggle={() => {
              const next = !deadLeadOn;
              setDeadLeadOn(next);
              saveDeadLead(next, deadLeadDays);
            }}
            disabled={!automationLoaded || deadLeadSaving}
            label="Welcome back after a long silence"
            exampleRule={DEAD_LEAD_RULE}
            record={ruleRecords?.[DEAD_LEAD_RULE] ?? null}
            error={deadLeadError}
          />
        </div>

      </section>

      {/* Directly under Automation: that section decides that replies wait
          for the owner, and this is how the owner hears one is waiting.
          Renders nothing until the server has at least one alert channel
          set up — see the component. */}
      <div hidden={!visible("alerts")}>
        <AlertsSection />
      </div>

      {/* Who this business IS, above who works in it. Until 2026-09-20
          there was nowhere at all to change the business's own name or
          trade — they were asked once in the onboarding wizard and then
          unreachable, which is how four real people received "Thank you
          for contacting My Business". This tab is the account-identity
          tab, so it belongs here and it belongs first. */}
      <section id="business" hidden={!visible("business")} className="scroll-mt-16">
        <h2 className={sectionLabel} style={SECTION_STYLE}>Your business</h2>
        <div className="mt-4">
          <BusinessProfileSection />
        </div>
        {/* What FollowUp knows (A-096): what it will say about the business on its own. */}
        <div className="mt-4">
          <BusinessFactsSection />
        </div>
        {/* How you work (A-099): what FollowUp does for the owner because they said yes on Today. */}
        <div className="mt-4 empty:hidden">
          <HowYouWorkSection />
        </div>
      </section>

      <section id="team" hidden={!visible("team")} className="scroll-mt-16">
        <h2 className={sectionLabel} style={SECTION_STYLE}>Team</h2>
        {/* "This week" (A-103): admins only, and only while the team calls customers. The page's own lede already says what admins can do, so it isn't said twice. */}
        <div className="mt-4 empty:hidden">
          <TeamWeek key={teamWeekKey} />
        </div>
        <div className="mt-4">
          <TeamSection onlyAdminsSend={onlyAdminsSend} />
        </div>
        <OnlyAdminsSendSetting onChange={setOnlyAdminsSend} />
        <TeamCallsSetting onChange={() => setTeamWeekKey((k) => k + 1)} />
      </section>

      <section id="lead-routing" hidden={!visible("lead-routing")} className="scroll-mt-16">
        <h2 className={sectionLabel} style={SECTION_STYLE}>Lead routing</h2>
        {/* No subhead here — SourceRoutingSection's own intro line already
            says what this does ("what happens automatically... before
            anyone looks at it"); a second sentence saying the same thing
            in different words right above it was redundant. */}
        <div className="mt-4">
          <SourceRoutingSection />
        </div>
      </section>

      <section id="billing" hidden={!visible("billing")} className="scroll-mt-16">
        <h2 className={sectionLabel} style={SECTION_STYLE}>Billing</h2>
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
          <div className="mt-4 box p-5">
            <div className="flex items-center gap-4">
              <div
                className="h-9 w-9 rounded-[10px] flex items-center justify-center shrink-0"
                style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}
              >
                <CreditCard className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {billingStatus === "beta" ? (
                    // Founding-tester card (founder, 2026-09-29): no price a
                    // tester can't act on, and no promise beyond these two.
                    "Founding tester"
                  ) : (
                    <>
                      FollowUp {TIER_INFO[billingTier].label} — {TIER_INFO[billingTier].priceLabel}
                      {voiceAddonEnabled && ` + Voice (${VOICE_ADDON_INFO.priceLabel})`}
                    </>
                  )}
                </p>
                <p className="text-[13px] text-ink-soft mt-0.5">
                  {billingStatus === "beta"
                    ? "Everything is free while we test. You have every feature. When paid plans start, founding testers get a special price."
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
                {billingStatus === "beta" && (
                  <p className="text-[13px] text-ink-soft mt-2">
                    We&apos;ll email you at least 30 days before anything changes. Nothing is charged without you choosing a plan.
                  </p>
                )}
              </div>
              {/* No Stripe customer exists behind the beta plan, so the
                  portal would 400 — there is nothing to manage. */}
              {billingStatus !== "beta" && (
                <button
                  onClick={handleManageBilling}
                  disabled={billingBusy}
                  className="shrink-0 text-sm font-medium rounded-full px-3.5 py-2 disabled:opacity-60"
                  style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
                >
                  {billingBusy ? "One sec…" : "Manage billing"}
                </button>
              )}
            </div>
            {billingError && (
              <p className="mt-3 text-[13px]" style={{ color: "var(--coral)" }}>
                {billingError}
              </p>
            )}
          </div>
        ) : (
          <div className="mt-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {(["free", "plus", "pro"] as const).map((tier) => (
                <div key={tier} className="box p-5">
                  <p className="text-sm font-medium">{TIER_INFO[tier].label}</p>
                  <p className="font-display text-2xl mt-1">{TIER_INFO[tier].priceLabel}</p>
                  <p className="text-[13px] text-ink-soft mt-2">
                    {tier === "free"
                      ? "Email and your website form, 20 new customers a month. No card needed — this is where you are now."
                      : tier === "plus"
                      ? "Every channel (WhatsApp, Instagram, Messenger, your CRM), and “Handle it all” for customers you choose. 14-day free trial."
                      : "Everything in Plus, no limit on customers, new customers shared across your team, priority support. 14-day free trial."}
                  </p>
                  {tier === "free" && billingLoaded && (
                    <div className="mt-3">
                      <div className="flex items-baseline justify-between text-[13px]">
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
                      <p className="text-[13px] text-ink-soft mt-1.5">
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
                      className="mt-4 w-full text-sm font-medium rounded-full px-3.5 py-2 disabled:opacity-60"
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
              <p className="mt-3 text-[13px]" style={{ color: "var(--coral)" }}>
                {billingError}
              </p>
            )}
          </div>
        )}
      </section>

      <section id="feedback" hidden={!visible("feedback")} className="scroll-mt-16">
        <h2 className={sectionLabel} style={SECTION_STYLE}>
          Something we should know?
        </h2>
        <p className="mt-1 text-[14.5px] leading-relaxed text-ink-soft">
          Not a support ticket — just a place to tell us what&apos;s working or what isn&apos;t. Entirely optional,
          only here if you want it.
        </p>
        <div className="mt-4 box p-5">
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
                className="w-full rounded-[12px] border border-line bg-paper px-3 py-2 text-sm resize-none"
              />
              <div className="mt-2 flex items-center justify-between">
                <button
                  onClick={handleSendFeedback}
                  disabled={feedbackSending || !feedbackText.trim()}
                  className="text-sm font-medium rounded-full px-3.5 py-2 disabled:opacity-60"
                  style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
                >
                  {feedbackSending ? "Sending…" : "Send"}
                </button>
                {feedbackError && (
                  <span className="text-[13px]" style={{ color: "var(--coral)" }}>
                    {feedbackError}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      <section id="security" hidden={!visible("security")} className="scroll-mt-16">
        <h2 className={sectionLabel} style={SECTION_STYLE}>Sign-ins and security</h2>
        <SignInsSection />
      </section>

      <section id="data" hidden={!visible("data")} className="scroll-mt-16">
        <h2 className={sectionLabel} style={SECTION_STYLE}>
          Your data
        </h2>
        <div className="mt-4">
          <DataPrivacySection />
        </div>
      </section>
      </div>
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
    <div className="rounded-[12px] border border-line px-4 py-3 flex items-center gap-4">
      <div className="h-9 w-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-[13px] text-ink-soft mt-0.5 wrap-break-word">{description}</p>
      </div>
      {!connected && href ? (
        <a href={href} className="text-sm font-medium rounded-full px-3 py-1.5 shrink-0" style={buttonStyle}>
          {label}
        </a>
      ) : (
        <button onClick={onToggle} disabled={!onToggle} className="text-sm font-medium rounded-full px-3 py-1.5 shrink-0" style={buttonStyle}>
          {label}
        </button>
      )}
    </div>
  );
}

/**
 * The welcome-back rule's key in the records (DEAD_LEAD_ACTION in
 * @/lib/automation). Spelled out here because this client component must
 * not import automation.ts, which pulls in the database client.
 */
const DEAD_LEAD_RULE = "dead_lead_reactivation";

/** "3, 7, 14 and 30" — the reminder days as an owner reads them. */
function listDays(days: number[]): string {
  return days.length < 2 ? days.join("") : `${days.slice(0, -1).join(", ")} and ${days[days.length - 1]}`;
}
