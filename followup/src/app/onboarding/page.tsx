import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getGmailStatus } from "@/lib/integrations/gmail";
import { getOutlookStatus, outlookOAuthAvailable } from "@/lib/integrations/outlook";
import { instagramOAuthAvailable } from "@/lib/instagram";
import OnboardingForm from "@/components/OnboardingForm";

export const dynamic = "force-dynamic";

const CRM_NAMES: Record<string, string> = { followupboss: "Follow Up Boss", hubspot: "HubSpot", gohighlevel: "GoHighLevel" };

export default async function OnboardingPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/signin");

  const [business, gmail, outlook, instagram, crm] = await Promise.all([
    prisma.business.findUnique({
      where: { id: ctx.businessId },
      select: { onboarded: true },
    }),
    getGmailStatus(ctx.businessId),
    getOutlookStatus(ctx.businessId),
    // Connected means what the send path means (sendChannels.ts): an id and
    // a token. Counted, never selected, so the token never leaves the database.
    prisma.business.count({
      where: { id: ctx.businessId, instagramUserId: { not: null }, instagramAccessToken: { not: null } },
    }),
    // A connected CRM (A-272). Only the provider: the key column is never selected.
    prisma.crmConnection.findFirst({ where: { businessId: ctx.businessId, apiKey: { not: null } }, select: { provider: true } }),
  ]);
  if (business?.onboarded) redirect("/dashboard");

  return (
    // Instagram or Gmail (A-241): the form needs only what is connected. A
    // connected inbox or Instagram account resumes on step 2; a failed
    // connect stays on step 1 with the provider's message (read from the URL
    // in the form).
    <OnboardingForm
      sources={{
        gmailConnected: gmail.connected,
        outlookConnected: outlook.connected,
        outlookAvailable: outlookOAuthAvailable(),
        inboxEmail: gmail.email ?? outlook.email,
        inboxProvider: gmail.connected ? "gmail" : outlook.connected ? "outlook" : null,
        instagramConnected: instagram > 0,
        instagramAvailable: instagramOAuthAvailable(),
        crmName: crm ? (CRM_NAMES[crm.provider] ?? "Your CRM") : null,
      }}
    />
  );
}
