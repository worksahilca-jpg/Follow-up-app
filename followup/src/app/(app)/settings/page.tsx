"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import SettingsList from "@/components/app/SettingsList";
import { GROUP_PAGE, GROUP_SLUG, PAGE_SECTIONS, PARENT_PAGE, groupOfPage, groupOfSlug, pageForId as pageFor, SETTINGS_MOVED, type SettingsGroup } from "@/lib/settingsGroups";
import AppWindow from "@/components/app/AppWindow";
import { planFor, planLine, type FollowUpPlans } from "@/lib/followUpPlans";
import { describeBookingHours, describeTimeZone, type BookingHours } from "@/lib/bookingHours";
import Link from "next/link";
import TeamSection from "@/components/TeamSection";
import BusinessProfileSection from "@/components/BusinessProfileSection";
import BusinessFactsSection from "@/components/BusinessFactsSection";
import HowYouWorkSection from "@/components/HowYouWorkSection";
import SourceRoutingSection from "@/components/SourceRoutingSection";
import CopyWebhookUrl from "@/components/CopyWebhookUrl";
import OutboundWebhookConfig from "@/components/OutboundWebhookConfig";
import TwilioConfig from "@/components/TwilioConfig";
import Connections from "@/components/settings/Connections";
import Switch from "@/components/Switch";
import BookingCalendarConfig from "@/components/BookingCalendarConfig";
import DataPrivacySection from "@/components/DataPrivacySection";
import AlertsSection from "@/components/AlertsSection";
import OnlyAdminsSendSetting from "@/components/OnlyAdminsSendSetting";
import TeamCallsSetting from "@/components/TeamCallsSetting";
import TeamWeek from "@/components/TeamWeek";
import SignInsSection from "@/components/SignInsSection";
import { TIER_INFO, VOICE_ADDON_INFO, VOICE_ADDON_AVAILABLE, CARRIER_CHANNELS_AVAILABLE, FREE_TIER_LEAD_CAP } from "@/lib/pricing";
import { ChevronRight, CreditCard } from "lucide-react";

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
  // One page each since A-253 (R-115: "Connect this or that … Connected, Okay, Done").
  connections: { title: "Connected apps", sections: PAGE_SECTIONS.connections },
  replies: { title: "Sending replies", sections: PAGE_SECTIONS.replies },
  booking: { title: "Your free hours", lede: "When customers can book a call through your link, and which calendar it checks.", sections: PAGE_SECTIONS.booking },
  alerts: { title: "Alerts", lede: "How FollowUp tells you a customer needs you: on your phone, by email, or both.", sections: PAGE_SECTIONS.alerts },
  business: { title: "Your business", sections: PAGE_SECTIONS.business },
  team: { title: "Team", lede: "Admins can invite teammates, change roles and remove people.", sections: PAGE_SECTIONS.team },
  billing: { title: "Your plan", sections: PAGE_SECTIONS.billing },
  security: { title: "Sign-ins", sections: PAGE_SECTIONS.security },
  data: { title: "Your data", lede: "Download everything, or permanently delete this business.", sections: PAGE_SECTIONS.data },
  // Off owners' Settings (A-253): no row leads here, and nobody outside used any of it (2026-10-14). A direct link
  // still opens it, so what a business set up keeps working and support can reach it.
  advanced: { title: "Advanced", sections: PAGE_SECTIONS.advanced },
};
/** One grey line under a group's title (A-213). */
const GROUP_WHY: Record<SettingsGroup, string> = {
  "Connected apps": "The places FollowUp reads and answers for you.",
  "Sending replies": "What FollowUp sends, and when. Change it any time.",
  Alerts: "How FollowUp tells you a customer needs you.",
  "Your business": "Who you are, so replies sound like you.",
  Account: "Your team, your plan, how you sign in, and your data.",
};

function SettingsPageInner() {
  const searchParams = useSearchParams();
  const [group, setGroup] = useState<SettingsGroup>("Connected apps");
  // The phone has stepped from the five home rows into one group's list (#write, #replies-out, #more).
  const [groupOpen, setGroupOpen] = useState(false);
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
      const back = ["instagram", "facebook", "gmail", "outlook"].some((k) => params.get(k));
      const page = pageFor(id) ?? (back ? "connections" : params.get("billing") ? "billing" : null);
      // The desk shows a page beside the side list, never an empty one: with nothing asked for, the first place.
      if (!page && !groupOfSlug(id) && window.matchMedia("(min-width: 64rem)").matches) return GROUP_PAGE["Connected apps"] ?? null;
      return page;
    };
    const readGroup = () => {
      const g = groupOfSlug(window.location.hash.slice(1));
      if (g) setGroup(g);
      setGroupOpen(Boolean(g));
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenPage(read());
    readGroup();
    // Back and forward move between Settings, a group's list and a page.
    const onPop = () => {
      setOpenPage(read());
      readGroup();
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
  // Google refused the saved access: the inbox row says so and offers Reconnect (A-253).
  const [gmailNeedsReconnect, setGmailNeedsReconnect] = useState(false);

  const [outlookConnected, setOutlookConnected] = useState(false);
  const [outlookEmail, setOutlookEmail] = useState<string | undefined>();
  const [outlookOauthAvailable, setOutlookOauthAvailable] = useState(false);
  const [outlookStatusLoaded, setOutlookStatusLoaded] = useState(false);

  // The follow-up plans (A-245): which days each customer gets. Changed on /workflows.
  const [followUpPlans, setFollowUpPlans] = useState<FollowUpPlans>({});
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


  // "This week" under each rule (A-044). Null until counted, and stays
  // null if counting failed, so a card shows no record rather than zeros.
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
  // Pause all sending, and who may send (A-041). Read with the rest of the
  // automation settings; the rules card and the permission card both
  // depend on them.
  const [sendingPaused, setSendingPaused] = useState(false);
  const [onlyAdminsSend, setOnlyAdminsSend] = useState(false);
  // Bumped when "Your team calls customers" changes, so This week appears or goes (A-103).
  const [teamWeekKey, setTeamWeekKey] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pauseSaving, setPauseSaving] = useState(false);
  // Granting it asks first; revoking does not. The asymmetry is the
  // point — a confirmation on the way out would be a speed bump in front
  // of the safer answer.
  // Channels whose rule already says "Handle it all". This is the fact an
  // owner cannot get anywhere else: a source rule applies at lead
  // CREATION, so granting this does not just affect leads they chose one
  // by one — every new lead from these channels lands on unreviewed
  // sending from the next one onwards. While the permission is off those
  // leads are quietly downgraded to Assisted (see sourceRouting.ts), so
  // the rule looks harmless right up until the moment it isn't.
  // null = not asked yet, or the read failed: the panel then states the
  // rule in general terms rather than an invented "no channels".
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
      .then((data: { connected: boolean; email?: string; pushActive?: boolean; needsReconnect?: boolean }) => {
        setGmailConnected(data.connected);
        setGmailEmail(data.email);
        setGmailPushActive(Boolean(data.pushActive));
        setGmailNeedsReconnect(Boolean(data.needsReconnect));
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

  useEffect(() => {
    fetch("/api/follow-up-plans")
      .then((r) => r.json())
      .then((data: { success?: boolean; plans?: FollowUpPlans }) => {
        if (data?.success && data.plans) setFollowUpPlans(data.plans);
      })
      .catch(() => {});
  }, []);

  // Real automation settings (business-level master switch + delay).
  useEffect(() => {
    fetch("/api/automation/settings")
      .then((r) => r.json())
      .then(
        (data: { holdAllForApproval?: boolean; sendingPaused?: boolean; onlyAdminsSend?: boolean; isAdmin?: boolean }) => {
          setHoldAllForApproval(data.holdAllForApproval ?? false);
          setSendingPaused(data.sendingPaused ?? false);
          setOnlyAdminsSend(data.onlyAdminsSend ?? false);
          setIsAdmin(data.isAdmin ?? false);
        }
      )
      .catch(() => {});
  }, []);

  // "Mon–Sat, 9:00 am–7:00 pm · Toronto" on the Booking hours row (A-253).
  const [bookingSummary, setBookingSummary] = useState("");
  useEffect(() => {
    fetch("/api/business/booking-hours")
      .then((r) => r.json())
      .then((data: { success?: boolean; timezone?: string } & Partial<BookingHours>) => {
        if (!data?.success || !data.days || data.startMinute === undefined || data.endMinute === undefined) return;
        const city = data.timezone ? describeTimeZone(data.timezone).replace(/\s*\(.*$/, "") : "";
        setBookingSummary(describeBookingHours({ days: data.days, startMinute: data.startMinute, endMinute: data.endMinute }) + (city ? ` · ${city}` : ""));
      })
      .catch(() => {});
  }, []);





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
    go(window.location.pathname + (first ? `#${first}` : ""));
    setOpenPage(page);
    if (!page) setGroupOpen(false);
  }

  /** "←" to `hash`: the browser's Back when that is where this step came from, so Back never loops. */
  function back(hash: string, open: () => void) {
    if (window.history.state?.settingsFrom === hash) window.history.back();
    else open();
  }

  /** A group's short list: the phone steps into it, the desk's side list shows it. */
  function openGroup(g: SettingsGroup) {
    go(window.location.pathname + `#${GROUP_SLUG[g]}`);
    setGroup(g);
    setGroupOpen(true);
    setOpenPage(null);
  }

  function go(url: string) {
    // Each step remembers where it came from, so "←" can be the browser's own Back (see back()).
    window.history.pushState({ settingsFrom: window.location.hash }, "", url);
    // pushState fires no event of its own: this tells the desk's stem (Sidebar, A-257) where Settings is now.
    window.dispatchEvent(new Event(SETTINGS_MOVED));
    window.scrollTo(0, 0);
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

  const billingRedirect = searchParams.get("billing"); // "success" | "canceled" | null
  // Just paid, but the webhook hasn't landed yet — the poll above is
  // already chasing it. Disable Subscribe during this window specifically
  // so an impatient click can't start a second Checkout session (and a
  // second charge) while the first one is still settling.
  const awaitingActivation = billingRedirect === "success" && billingLoaded && !billingActive;

  async function handleGmailDisconnect(): Promise<boolean> {
    if (!window.confirm("Disconnect Gmail? FollowUp will stop reading this inbox and revoke its access at Google. You can reconnect any time.")) return false;
    const res = await fetch("/api/integrations/gmail/disconnect", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      setGmailConnected(false);
      setGmailEmail(undefined);
      setGmailPushActive(false);
      return true;
    }
    window.alert(data.message ?? "Couldn't disconnect. Try again.");
    return false;
  }


  async function handleOutlookDisconnect(): Promise<boolean> {
    if (!window.confirm("Disconnect Outlook? FollowUp will stop reading this inbox. You can reconnect any time.")) return false;
    const res = await fetch("/api/integrations/outlook/disconnect", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      setOutlookConnected(false);
      setOutlookEmail(undefined);
      return true;
    }
    window.alert(data.message ?? "Couldn't disconnect. Try again.");
    return false;
  }



  const page = openPage ? PAGES[openPage] : null;
  const parentPage = openPage ? PARENT_PAGE[openPage] : undefined;
  // The side list follows the page that's open (a link to #billing lands in "Your business").
  const pageGroup = openPage ? groupOfPage(openPage) : null;
  const navGroup: SettingsGroup = pageGroup ?? group;
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
    // Desk: Settings is its own page and its tree is the app's left column
    // (A-257). Phone: the one list, one level per screen, as before.
    <div>
      {/* No side list here: on a computer the app's own column becomes Settings' tree (Sidebar, A-257). */}
      <div className="min-w-0">
      {!page ? (
        // Phone: Settings' five rows, or the group a row stepped into. Desk: the group the side list has open.
        <div>
          <h1 className={"title-serif text-[32px] leading-[1.1] lg:hidden" + (groupOpen ? " hidden" : "")}>Settings</h1>
          <div className={groupOpen ? "" : "hidden lg:block"}>
            <button type="button" onClick={() => back("", () => openMore(null))} className="min-h-11 text-[13px] text-ink-faint hover:text-ink lg:hidden">
              ← Settings
            </button>
            <Path trail={["Settings"]} />
            <h1 className="title-serif text-[30px] leading-[1.12] lg:mt-2 lg:text-[28px]">{navGroup}</h1>
            <p className="mt-1 text-[14px] text-ink-faint">{GROUP_WHY[navGroup]}</p>
          </div>
          <div className="mt-6 lg:mt-5">
            <SettingsList
              gmail={{ connected: gmailConnected, email: gmailEmail }}
              outlook={{ connected: outlookConnected, email: outlookEmail }}
              holdAll={holdAllForApproval}
              paused={sendingPaused}
              planStatus={planStatus}
              onOpen={openMore}
              onGroup={openGroup}
              group={navGroup}
              groupOpen={groupOpen}
            />
          </div>
        </div>
      ) : (
        <div className="max-w-[640px]">
          {/* Back one step: to the page this one opened from (Booking hours → How replies go out), the page's
              group, or Settings for a group that is this one page. */}
          <button
            type="button"
            onClick={() =>
              parentPage
                ? back(`#${PAGES[parentPage].sections[0]}`, () => openMore(parentPage))
                : pageGroup && !GROUP_PAGE[pageGroup]
                  ? back(`#${GROUP_SLUG[pageGroup]}`, () => openGroup(pageGroup))
                  : back("", () => openMore(null))
            }
            className="min-h-11 text-[13px] text-ink-faint hover:text-ink lg:hidden"
          >
            ← {parentPage ? PAGES[parentPage].title : pageGroup && !GROUP_PAGE[pageGroup] ? pageGroup : "Settings"}
          </button>
          <Path trail={["Settings", ...(parentPage ? [PAGES[parentPage].title] : pageGroup && !GROUP_PAGE[pageGroup] ? [pageGroup] : [])]} />
          <h1 className="title-serif mt-1 text-[30px] leading-[1.12] lg:mt-2 lg:text-[28px]">{page.title}</h1>
          {page.lede && <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{page.lede}</p>}
        </div>
      )}

      {/* One setting's own page. Every section stays mounted, so each
          panel keeps its state while the owner moves around. */}
      <div hidden={!page} className="mt-7 max-w-[640px] space-y-8">
      {/* Where customers write (A-253): one row per place, Connect or Connected; the rest happens in the back. */}
      <section id="connections" hidden={!visible("connections")} className="scroll-mt-16">
        <h2 className="sr-only">Connected apps</h2>
        <Connections
          gmail={{ connected: gmailConnected, email: gmailEmail, loaded: gmailStatusLoaded }}
          outlook={{ connected: outlookConnected, email: outlookEmail, loaded: outlookStatusLoaded }}
          gmailPushActive={gmailPushActive}
          gmailNeedsReconnect={gmailNeedsReconnect}
          outlookAvailable={outlookOauthAvailable}
          isAdmin={isAdmin}
          onGmailDisconnect={handleGmailDisconnect}
          onOutlookDisconnect={handleOutlookDisconnect}
        />
      </section>

      {/* How replies go out (A-253): who sends, then the plan, booking hours and pause. The four "FollowUp writes"
          switches live on the Follow-up plan page; the hours and days use their defaults. */}
      <section id="replies-out" hidden={!visible("replies-out")} className="scroll-mt-16">
        <h2 className="sr-only">Sending replies</h2>
        <p id="who-sends" className="text-[14px] text-ink-faint">
          Who sends your replies?
        </p>
        <div role="radiogroup" aria-labelledby="who-sends" className={BOX + " mt-3"}>
          <ChoiceRow
            first
            checked={!holdAllForApproval}
            title="FollowUp sends them"
            sub="A price, a date or anything unsure waits for you."
            disabled={!isAdmin || permissionSaving || sendingPaused}
            onSelect={() => {
              if (!holdAllForApproval) return;
              // Saying yes to sending is read first, then pressed (no "are you sure?"): the four facts and this
              // business's own queue, in a small window.
              setConfirmingPermission(true);
              setPermissionError(null);
              setSendPreview(null);
              fetch("/api/automation/send-preview")
                .then((r) => r.json())
                .then((d) => {
                  if (d?.success) setSendPreview(d);
                })
                .catch(() => {});
            }}
          />
          <ChoiceRow
            checked={holdAllForApproval}
            title="I check each one first"
            disabled={!isAdmin || permissionSaving || sendingPaused}
            // Taking the permission back is always one press, never a confirmation.
            onSelect={() => !holdAllForApproval && saveSendPermission(false)}
          />
        </div>
        {!isAdmin && <p className="mt-2 text-[14px] text-ink-soft">Only an admin can change who sends.</p>}

        <div className={BOX + " mt-6"}>
          <Link href="/workflows" className={ROW + " hover:bg-card-2"}>
            <span className="shrink-0 whitespace-nowrap">When to check in</span>
            <span className="min-w-0 flex-1 truncate text-right text-[15px] text-ink-faint">{planLine(followUpPlans, planFor(followUpPlans, "most"))}</span>
            <ChevronRight aria-hidden className="h-[18px] w-[18px] shrink-0 text-ink-faint" />
          </Link>
          <button type="button" onClick={() => openMore("booking")} className={ROW + " border-t border-line-2 text-left hover:bg-card-2"}>
            <span className="shrink-0 whitespace-nowrap">Your free hours</span>
            <span className="min-w-0 flex-1 truncate text-right text-[15px] text-ink-faint">{bookingSummary}</span>
            <ChevronRight aria-hidden className="h-[18px] w-[18px] shrink-0 text-ink-faint" />
          </button>
          <div className={ROW + " border-t border-line-2"}>
            <span className="flex-1">Stop all sending</span>
            {/* Anyone can pause (it only ever holds messages); an admin turns it back off. */}
            <Switch checked={sendingPaused} onChange={() => savePause(!sendingPaused)} disabled={pauseSaving || (sendingPaused && !isAdmin)} label="Stop all sending" />
          </div>
        </div>
        {sendingPaused && (
          <p className="mt-2 text-[14px] text-ink-soft">
            Paused. Everything waits for your OK until you turn this off.{!isAdmin && " An admin can turn it back on."}
          </p>
        )}
        {permissionError && !confirmingPermission && (
          <p role="alert" className="mt-2 text-[14px]" style={{ color: "var(--coral)" }}>
            {permissionError}
          </p>
        )}

        {confirmingPermission && (
          <AppWindow
            label="Let FollowUp send your replies"
            size="small"
            onClose={() => {
              setConfirmingPermission(false);
              setPermissionError(null);
            }}
          >
            <div className="p-6">
              <p className="pr-8 text-[20px] font-semibold leading-tight">Let FollowUp send your replies?</p>
              <ul className="mt-4 grid gap-2 text-[15px] leading-snug">
                <li>FollowUp sends your replies and follow-ups itself, signed as your business.</li>
                <li>Anything about a price or a date, or anything it isn&apos;t sure of, still waits for you.</li>
                <li>Follow-ups stop the moment a customer replies.</li>
                <li>Every message is written down, with the reason. You can change this any time.</li>
              </ul>
              {/* This business's own queue, said exactly: what waits only because of this setting stays waiting
                  (the backlog rule in automation.ts); only conversations from now on go out by themselves. */}
              {sendPreview && sendPreview.total > 0 && (
                <p className="mt-4 text-[14px] text-ink-soft">
                  {sendPreview.total} {sendPreview.total === 1 ? "reply is" : "replies are"} waiting now.{" "}
                  {sendPreview.heldOnlyBySetting > 0
                    ? `Saying yes won't send ${sendPreview.heldOnlyBySetting === 1 ? "the one" : `the ${sendPreview.heldOnlyBySetting}`} waiting only because of this; you can send ${sendPreview.heldOnlyBySetting === 1 ? "it" : "them"} from Today.`
                    : "None of them waits only because of this."}
                </p>
              )}
              {permissionError && (
                <p role="alert" className="mt-3 text-[14px]" style={{ color: "var(--coral)" }}>
                  {permissionError}
                </p>
              )}
              <div className="mt-6 flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={() => saveSendPermission(true)}
                  disabled={permissionSaving}
                  className="min-h-[50px] w-full rounded-full bg-ink text-[16px] font-semibold text-on-accent disabled:opacity-60"
                >
                  {permissionSaving ? "Saving…" : "Yes, FollowUp sends them"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingPermission(false);
                    setPermissionError(null);
                  }}
                  className="min-h-11 text-[15px] text-ink-soft hover:text-ink"
                >
                  Not yet
                </button>
              </div>
            </div>
          </AppWindow>
        )}
      </section>

      {/* Booking hours have their own page (A-080's "How it writes" group);
          they used to sit inside the Email page under the Gmail row. */}
      <section id="booking" hidden={!visible("booking")} className="scroll-mt-16">
        <h2 className={sectionLabel} style={SECTION_STYLE}>Your free hours</h2>
        <div className="mt-4">
          <BookingCalendarConfig />
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

      {/* Alerts, its own row since the phone redesign (A-220): how the owner
          hears that a reply is waiting. Renders nothing until the server has
          at least one alert channel set up — see the component. */}
      <div hidden={!visible("alerts")}>
        <AlertsSection />
      </div>

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

/** A group of rows (A-253): one white box, rows split by a hairline. */
const BOX = "overflow-hidden rounded-[16px] border border-line bg-card";
/** A row in it: the label, what's set in grey, and a chevron or a switch. */
const ROW = "flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-[16px]";

/** One of "Who sends your replies?": a radio the whole row presses. */
function ChoiceRow({
  checked,
  title,
  sub,
  first = false,
  disabled,
  onSelect,
}: {
  checked: boolean;
  title: string;
  sub?: string;
  first?: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onClick={onSelect}
      className={"flex min-h-[60px] w-full items-start gap-3.5 px-4 py-4 text-left hover:bg-card-2 disabled:cursor-not-allowed disabled:hover:bg-transparent" + (first ? "" : " border-t border-line-2")}
    >
      <span
        aria-hidden
        className="mt-px h-[22px] w-[22px] shrink-0 rounded-full"
        style={checked ? { border: "7px solid var(--ink)" } : { border: "1.5px solid var(--ink-faint)" }}
      />
      <span className="min-w-0">
        <span className="block text-[17px] font-semibold">{title}</span>
        {sub && <span className="mt-0.5 block text-[14px] text-ink-soft">{sub}</span>}
      </span>
    </button>
  );
}

/**
 * Where a page sits, on a computer ("Settings › Account", A-257): the stem
 * on the left moves you, this only says where you are. The phone's "←"
 * already says it one step at a time.
 */
function Path({ trail }: { trail: string[] }) {
  return (
    <p className="hidden items-center text-[13px] text-ink-faint lg:flex">
      {trail.map((t, i) => (
        <span key={t} className="flex items-center">
          {i > 0 && (
            <span aria-hidden="true" className="mx-1.5">
              ›
            </span>
          )}
          <span className={i === trail.length - 1 ? "text-ink-soft" : ""}>{t}</span>
        </span>
      ))}
    </p>
  );
}
