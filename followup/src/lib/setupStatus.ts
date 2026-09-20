import { prisma } from "@/lib/db";
import { hasActiveAccess } from "@/lib/billing";
import { getGmailStatus } from "@/lib/integrations/gmail";
import { getOutlookStatus } from "@/lib/integrations/outlook";
import { CARRIER_CHANNELS_AVAILABLE } from "@/lib/pricing";
import { businessDisplayName } from "@/lib/leadName";

/**
 * research/product/2026-09-10-ux-simplification.md §2 and §7.1: the
 * Sidebar's two persistent nag cards ("Not subscribed", "Gmail not
 * connected") were "proportionally enormous" in a 4-item sidebar and only
 * ever covered two of the several things a business might still need to
 * finish setting up. This computes the full ordered list of unfinished
 * setup steps so the dashboard can show exactly one — "the next thing" —
 * instead of a growing stack of banners on every page.
 *
 * Order matters: billing first (nothing else works without it), then
 * Gmail ("this is where most of your leads already are" — Settings'
 * own framing), then phone/text, then the website widget. Each check is
 * a fact already computed elsewhere in the app; nothing new is tracked
 * just for this list.
 */
export type SetupStep = {
  id: "billing" | "business" | "gmail" | "phone" | "widget";
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
};

export async function getIncompleteSetupSteps(businessId: string): Promise<SetupStep[]> {
  const [business, gmail, outlook, hasWidgetLead] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      // `tier` was missing, which is the whole of the billing bug below.
      select: { subscriptionStatus: true, tier: true, twilioPhoneNumber: true, name: true, industry: true },
    }),
    getGmailStatus(businessId),
    getOutlookStatus(businessId),
    prisma.lead.findFirst({ where: { businessId, source: "Website form" }, select: { id: true } }),
  ]);

  const steps: SetupStep[] = [];

  // `tier` was being dropped here, and hasActiveAccess treats tier === "free"
  // as real access. So a Free business — which can capture and process leads
  // perfectly well, proven by POST /api/leads returning 200 — was told on its
  // dashboard that it had to start a trial, while Settings → Billing told it
  // "Free… this is where you are now". Two screens, opposite claims, which
  // reads as a dark pattern rather than the bug it is.
  if (!hasActiveAccess(business?.subscriptionStatus, business?.tier)) {
    steps.push({
      id: "billing",
      title: "Start your free trial",
      description: "14 days, no card required — needed to sync, add leads, and send follow-ups.",
      ctaLabel: "Start trial",
      ctaHref: "/settings#billing",
    });
  }

  /**
   * The business has not said who it is.
   *
   * Second, right after billing, because it is cheap to fix and it
   * changes what every later step produces. An unnamed business gets
   * messages with no name in them (businessDisplayName, src/lib/
   * leadName.ts); a business with no industry is judged by a classifier
   * working blind, which is the single most expensive kind of blindness
   * here — see classifyAsProspect's own comment about the seven real
   * deals it threw away without it.
   *
   * It had no step at all until 2026-09-20, for the same reason it had
   * no Settings screen: both fields were asked once at onboarding and
   * then never mentioned again. The founder's own account still carried
   * the placeholder name months later, and four real people were
   * written to by "My Business".
   */
  if (businessDisplayName(business?.name) === "" || !business?.industry) {
    steps.push({
      id: "business",
      title: "Tell FollowUp about your business",
      description: "Your name goes in every message; your trade is how it tells a real customer from a sales pitch.",
      ctaLabel: "Add details",
      ctaHref: "/settings#business",
    });
  }

  // Outlook counts. This checked Gmail alone, so a business fully connected
  // to Outlook — capturing leads, running automation, working exactly as
  // intended — was nagged "Connect your inbox → Connect Gmail" forever, with
  // a permanently inflated remaining-steps count it could never clear.
  //
  // A revoked Gmail grant is deliberately NOT treated as "no inbox" here: it
  // has its own state (needsReconnect) and its own sentence on the dashboard,
  // because "you never connected one" and "the one you connected stopped
  // working" are different problems with different fixes.
  const hasInbox = gmail.connected || outlook.connected;
  if (!hasInbox && !gmail.needsReconnect) {
    steps.push({
      id: "gmail",
      title: "Connect your inbox",
      description: "This is where most of your leads already are.",
      ctaLabel: "Connect an inbox",
      ctaHref: "/settings#integrations",
    });
  }

  if (gmail.needsReconnect && !outlook.connected) {
    steps.push({
      id: "gmail",
      title: "Reconnect your inbox",
      description: `FollowUp has lost access to ${gmail.email ?? "your inbox"} and isn't catching new leads.`,
      ctaLabel: "Reconnect",
      ctaHref: "/settings#integrations",
    });
  }

  // Gated on the flag, which it was not, and the omission was expensive in a
  // way worth spelling out. Dropping the carrier channels hid Settings'
  // `id="phone"` section behind CARRIER_CHANNELS_AVAILABLE, but this step
  // kept being pushed for anyone without a twilioPhoneNumber — which is
  // everyone, because TwilioConfig is the only writer of that column and it
  // lives inside the same gate. So the step could never be completed:
  // "/settings#phone" opens Settings, getElementById("phone") returns null,
  // nothing scrolls, nothing errors.
  //
  // And SetupStrip renders steps[0] only. So every new business saw one
  // permanently unfinishable instruction, and "Add your website widget" —
  // the one capture channel needing no third party at all, no Google review,
  // no Meta approval — was never shown to anybody.
  //
  // channelAvailability.test.ts was written for exactly this class of bug
  // (a surface still promising a dropped channel) and did not reach this
  // file. It does now.
  if (CARRIER_CHANNELS_AVAILABLE && !business?.twilioPhoneNumber) {
    steps.push({
      id: "phone",
      title: "Catch the calls you miss too",
      description: "Needs a Twilio number, about 10 minutes.",
      ctaLabel: "Set up",
      ctaHref: "/settings#phone",
    });
  }

  if (!hasWidgetLead) {
    steps.push({
      id: "widget",
      title: "Add your website widget",
      description: "Paste one line into your site to capture leads straight from a contact form.",
      ctaLabel: "Get the code",
      ctaHref: "/settings#website-widget",
    });
  }

  return steps;
}
