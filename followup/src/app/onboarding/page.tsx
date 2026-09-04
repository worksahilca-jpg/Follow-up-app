import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getGmailStatus } from "@/lib/integrations/gmail";
import OnboardingForm from "@/components/OnboardingForm";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/signin");

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { name: true, industry: true, teamSize: true, onboarded: true },
  });
  if (business?.onboarded) redirect("/dashboard");

  const gmail = await getGmailStatus(ctx.businessId);

  return (
    <OnboardingForm
      initialName={business?.name ?? ""}
      initialIndustry={business?.industry}
      initialTeamSize={business?.teamSize}
      // industry only ever gets set by this flow's own step-1 submit, so
      // its presence means step 1 is already done — skip straight to
      // "Connect Gmail" for someone resuming (or bouncing back from the
      // Google OAuth round trip, which loses all client-side page state).
      step1Done={Boolean(business?.industry)}
      gmailConnected={gmail.connected}
      gmailEmail={gmail.email}
    />
  );
}
