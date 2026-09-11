import { prisma } from "@/lib/db";
import { hasActiveAccess } from "@/lib/billing";
import { getGmailStatus } from "@/lib/integrations/gmail";

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
  id: "billing" | "gmail" | "phone" | "widget";
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
};

export async function getIncompleteSetupSteps(businessId: string): Promise<SetupStep[]> {
  const [business, gmail, hasWidgetLead] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { subscriptionStatus: true, twilioPhoneNumber: true },
    }),
    getGmailStatus(businessId),
    prisma.lead.findFirst({ where: { businessId, source: "Website form" }, select: { id: true } }),
  ]);

  const steps: SetupStep[] = [];

  if (!hasActiveAccess(business?.subscriptionStatus)) {
    steps.push({
      id: "billing",
      title: "Start your free trial",
      description: "14 days, no card required — needed to sync, add leads, and send follow-ups.",
      ctaLabel: "Start trial",
      ctaHref: "/settings#billing",
    });
  }

  if (!gmail.connected) {
    steps.push({
      id: "gmail",
      title: "Connect your inbox",
      description: "This is where most of your leads already are.",
      ctaLabel: "Connect Gmail",
      ctaHref: "/settings#integrations",
    });
  }

  if (!business?.twilioPhoneNumber) {
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
