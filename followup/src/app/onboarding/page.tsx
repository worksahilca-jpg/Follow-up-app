import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getGmailStatus } from "@/lib/integrations/gmail";
import { getOutlookStatus, outlookOAuthAvailable } from "@/lib/integrations/outlook";
import { instagramOAuthAvailable } from "@/lib/instagram";
import { facebookOAuthAvailable } from "@/lib/facebook";
import { META_CHANNELS_AVAILABLE } from "@/lib/pricing";
import { cameBackFromConnect, shouldResumeAtSources } from "@/lib/onboardingResume";
import OnboardingForm from "@/components/OnboardingForm";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/signin");

  const params = await searchParams;

  const [business, gmail, outlook] = await Promise.all([
    prisma.business.findUnique({
      where: { id: ctx.businessId },
      select: {
        name: true,
        industry: true,
        teamSize: true,
        onboarded: true,
        instagramUserId: true,
        facebookPageId: true,
        dismissedSetupSteps: true,
      },
    }),
    getGmailStatus(ctx.businessId),
    getOutlookStatus(ctx.businessId),
  ]);
  if (business?.onboarded) redirect("/dashboard");

  const instagramConnected = Boolean(business?.instagramUserId);
  const facebookConnected = Boolean(business?.facebookPageId);


  return (
    <OnboardingForm
      initialName={business?.name ?? ""}
      initialIndustry={business?.industry}
      initialTeamSize={business?.teamSize}
      // industry only ever gets set by this flow's own step-1 submit, so
      // its presence means step 1 is already done.
      step1Done={Boolean(business?.industry)}
      // See shouldResumeAtSources for the rule and why it is derived rather
      // than stored.
      resumeAtSources={shouldResumeAtSources({
        anyConnected: gmail.connected || outlook.connected || instagramConnected || facebookConnected,
        anyDismissed: (business?.dismissedSetupSteps.length ?? 0) > 0,
        cameBackFromConnect: cameBackFromConnect(params),
      })}
      sources={{
        gmailConnected: gmail.connected,
        outlookConnected: outlook.connected,
        outlookAvailable: outlookOAuthAvailable(),
        inboxEmail: gmail.email ?? outlook.email,
        inboxProvider: gmail.connected ? "gmail" : outlook.connected ? "outlook" : null,
        instagramConnected,
        instagramAvailable: instagramOAuthAvailable(),
        facebookConnected,
        facebookAvailable: facebookOAuthAvailable(),
        metaChannelsAvailable: META_CHANNELS_AVAILABLE,
      }}
    />
  );
}
