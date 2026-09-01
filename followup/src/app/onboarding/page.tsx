import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import OnboardingForm from "@/components/OnboardingForm";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/signin");

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { name: true, onboarded: true },
  });
  if (business?.onboarded) redirect("/dashboard");

  return <OnboardingForm initialName={business?.name ?? ""} />;
}
