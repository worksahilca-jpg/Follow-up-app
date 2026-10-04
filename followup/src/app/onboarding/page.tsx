import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getGmailStatus } from "@/lib/integrations/gmail";
import { getOutlookStatus, outlookOAuthAvailable } from "@/lib/integrations/outlook";
import OnboardingForm from "@/components/OnboardingForm";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/signin");

  const [business, gmail, outlook] = await Promise.all([
    prisma.business.findUnique({
      where: { id: ctx.businessId },
      select: { onboarded: true },
    }),
    getGmailStatus(ctx.businessId),
    getOutlookStatus(ctx.businessId),
  ]);
  if (business?.onboarded) redirect("/dashboard");

  return (
    // Gmail first (A-081): the form needs only the inbox state. A connected
    // inbox resumes on step 2; a failed connect stays on step 1 with the
    // provider's message (read from the URL in the form).
    <OnboardingForm
      sources={{
        gmailConnected: gmail.connected,
        outlookConnected: outlook.connected,
        outlookAvailable: outlookOAuthAvailable(),
        inboxEmail: gmail.email ?? outlook.email,
        inboxProvider: gmail.connected ? "gmail" : outlook.connected ? "outlook" : null,
      }}
    />
  );
}
