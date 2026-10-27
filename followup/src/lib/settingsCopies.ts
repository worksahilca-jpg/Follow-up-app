/**
 * The answers Settings brings with it (see src/lib/pageCopies.ts): every
 * no-argument, read-only GET a Settings part makes when it first opens.
 *
 * `reads` is how many parts open with the same answer. A path is listed only
 * where nothing but the reading parts themselves changes what it returns, so
 * a copy can't be stale when a later part opens:
 *  - automation/settings: the page (sending, "not now"), then the Team page's
 *    two switches, which read only their own fields (onlyAdminsSend, teamCalls).
 *  - booking-hours, instagram/facebook/whatsapp config, onboarding, alerts,
 *    team: the list or the page first, then the one part that changes them.
 *
 * Left out on purpose, so their parts ask the server as before:
 *  - business/past-replies: says whether Gmail is connected, which the
 *    Connected apps page can change before Sending replies opens.
 *  - business/delete: the business name to type, which Your business can change.
 *  - crm/stages: asks the CRM itself, an outside call.
 *  - facebook/oauth/pending-pages: reads the request's own cookie.
 *  - twilio/config, webhooks/config, webhooks/outbound, source-rules: the
 *    Advanced page, off owners' Settings (A-253), and they carry webhook
 *    secrets that have no reason to ride along with every visit.
 */
import { collectCopies, type CopySource, type PageCopies } from "@/lib/pageCopies";
import { GET as accountSignIns } from "@/app/api/account/sign-ins/route";
import { GET as alerts } from "@/app/api/alerts/route";
import { GET as automationSettings } from "@/app/api/automation/settings/route";
import { GET as billingStatus } from "@/app/api/billing/status/route";
import { GET as askPlan } from "@/app/api/business/ask-plan/route";
import { GET as bookingHours } from "@/app/api/business/booking-hours/route";
import { GET as bookingSource } from "@/app/api/business/booking-source/route";
import { GET as facts } from "@/app/api/business/facts/route";
import { GET as habits } from "@/app/api/business/habits/route";
import { GET as privacy } from "@/app/api/business/privacy/route";
import { GET as crmConfig } from "@/app/api/crm/config/route";
import { GET as embedConfig } from "@/app/api/embed/config/route";
import { GET as facebookConfig } from "@/app/api/facebook/config/route";
import { GET as followUpPlans } from "@/app/api/follow-up-plans/route";
import { GET as instagramConfig } from "@/app/api/instagram/config/route";
import { GET as gmailFiltered } from "@/app/api/integrations/gmail/filtered/route";
import { GET as gmailStatus } from "@/app/api/integrations/gmail/status/route";
import { GET as outlookStatus } from "@/app/api/integrations/outlook/status/route";
import { GET as practice } from "@/app/api/leads/practice/route";
import { GET as notCustomers } from "@/app/api/not-customers/route";
import { GET as onboarding } from "@/app/api/onboarding/route";
import { GET as team } from "@/app/api/team/route";
import { GET as teamWeek } from "@/app/api/team/week/route";
import { GET as whatsappConfig } from "@/app/api/whatsapp/config/route";

export const SETTINGS_SOURCES: Record<string, CopySource> = {
  // The page itself.
  "/api/integrations/gmail/status": { get: gmailStatus },
  "/api/integrations/outlook/status": { get: outlookStatus },
  "/api/follow-up-plans": { get: followUpPlans },
  "/api/automation/settings": { get: automationSettings, reads: 3 },
  "/api/business/ask-plan": { get: askPlan },
  "/api/business/booking-hours": { get: bookingHours, reads: 2 },
  "/api/billing/status": { get: billingStatus },
  // The list's status words (SettingsList), then the page each row opens.
  "/api/instagram/config": { get: instagramConfig, reads: 2 },
  "/api/facebook/config": { get: facebookConfig, reads: 2 },
  "/api/whatsapp/config": { get: whatsappConfig, reads: 2 },
  "/api/onboarding": { get: onboarding, reads: 2 },
  "/api/alerts": { get: alerts, reads: 2 },
  "/api/team": { get: team, reads: 2 },
  // Connected apps (what a computer opens first).
  "/api/embed/config": { get: embedConfig },
  "/api/integrations/gmail/filtered": { get: gmailFiltered },
  "/api/business/booking-source": { get: bookingSource },
  "/api/crm/config": { get: crmConfig },
  // The other pages.
  "/api/business/habits": { get: habits },
  "/api/business/facts": { get: facts },
  "/api/not-customers": { get: notCustomers },
  "/api/team/week": { get: teamWeek },
  "/api/account/sign-ins": { get: accountSignIns },
  "/api/leads/practice": { get: practice },
  "/api/business/privacy": { get: privacy },
};

export function settingsCopies(): Promise<PageCopies> {
  return collectCopies(SETTINGS_SOURCES);
}
