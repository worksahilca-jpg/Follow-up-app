import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/signin");

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { onboarded: true },
  });
  if (!business?.onboarded) redirect("/onboarding");

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0">
        {/* pt-20 clears the fixed mobile top bar (see Sidebar) below lg;
            at lg and up that bar doesn't render, so padding goes back to
            matching py-10 like every other side. */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 lg:pt-10 pb-10">{children}</div>
      </main>
    </div>
  );
}
