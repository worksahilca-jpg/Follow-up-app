import { requirePlatformAdmin } from "@/lib/platformAdmin";
import { getDecisions } from "@/lib/adminDecisionsData";
import AdminNav from "@/components/admin/AdminNav";

/**
 * Platform admin — founder-only, cross-tenant. Deliberately NOT under the
 * `(app)` route group: no per-business Sidebar, and no dependency on the
 * caller having an onboarded business the way every other authenticated
 * page requires (see (app)/layout.tsx's redirect to /onboarding) — a
 * platform admin's own business status is irrelevant to whether they can
 * see this.
 *
 * Its own places instead (founder, 2026-10-18: "organise the admin page so
 * that I can make decisions"): Decide, Accuracy tests, Testers, Usage, The
 * office, in the app's frame (desk column + sheet), chips on the phone.
 *
 * requirePlatformAdmin() calls Next's notFound() (a real 404) rather than
 * showing a "not authorized" message for anyone whose email isn't in
 * PLATFORM_ADMIN_EMAILS — see src/lib/platformAdmin.ts for why. Each page
 * checks again itself (adminPagesGuarded.test.ts): a layout is not a
 * security boundary.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();
  const decisions = await getDecisions();

  return (
    <div className="theme-auto min-h-screen bg-paper text-ink lg:flex lg:bg-sidebar">
      <AdminNav decisions={decisions.length} />
      <main className="flex-1 min-w-0 lg:pt-2">
        <div className="app-sheet">
          <div className="max-w-[1152px] mx-auto px-5 sm:px-8 lg:px-14 pt-6 lg:pt-9 pb-16">{children}</div>
        </div>
      </main>
    </div>
  );
}
