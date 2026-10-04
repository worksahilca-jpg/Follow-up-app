import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import Sidebar from "@/components/Sidebar";
import SeenPing from "@/components/SeenPing";
import { getPendingApprovals, onTodayNow } from "@/lib/pendingApprovals";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/signin");

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { onboarded: true, name: true },
  });
  if (!business?.onboarded) redirect("/onboarding");

  // The two counts the canvas sidebar shows: who needs you today, and how
  // many customers there are. Best effort: a failed count hides the number,
  // never the page.
  const [today, customers] = await Promise.all([
    // What Today shows, so the two numbers agree: not what was set aside with "Later".
    getPendingApprovals(ctx.businessId)
      .then((a) => onTodayNow(a).length)
      .catch(() => undefined),
    prisma.lead.count({ where: { businessId: ctx.businessId } }).catch(() => undefined),
  ]);

  return (
    <div className="flex min-h-screen">
      {/* One "opened today" record per person per day (src/lib/appOpens.ts). */}
      <SeenPing />
      <Sidebar businessName={business.name ?? ""} counts={{ today, customers }} />
      <main className="flex-1 min-w-0">
        {/* Below lg: pt-20 clears the fixed top bar and pb-28 the three
            bottom tabs (see Sidebar). The canvas pages sit at 36px/56px.
            A page that is a working surface (an open customer) marks
            its root .app-bleed and gets the whole width instead; see
            globals.css. */}
        <div className="app-frame max-w-[1152px] mx-auto px-5 sm:px-8 lg:px-14 pt-20 lg:pt-9 pb-28 lg:pb-12">{children}</div>
      </main>
    </div>
  );
}
