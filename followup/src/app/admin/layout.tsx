import { requirePlatformAdmin } from "@/lib/platformAdmin";

/**
 * Platform admin — founder-only, cross-tenant. Deliberately NOT under the
 * `(app)` route group: no Sidebar (so it's not just "not in the nav," it's
 * a route that shares none of the per-business chrome), and no dependency
 * on the caller having an onboarded business the way every other
 * authenticated page requires (see (app)/layout.tsx's redirect to
 * /onboarding) — a platform admin's own business status is irrelevant to
 * whether they can see this.
 *
 * requirePlatformAdmin() calls Next's notFound() (a real 404) rather than
 * showing a "not authorized" message for anyone whose email isn't in
 * PLATFORM_ADMIN_EMAILS — see src/lib/platformAdmin.ts for why.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">{children}</div>
    </div>
  );
}
