/**
 * Gate for the platform-wide `/admin` dashboard (src/app/admin/**) —
 * founder-only, cross-tenant. Completely separate from two other allowlists
 * this codebase already has:
 *
 *  - ALLOWED_EMAILS (src/lib/auth.ts) gates ordinary sign-in to the product
 *    at all. Empty means "everyone allowed" — useful pre-launch.
 *  - TeamRole (ADMIN/SALES on User, see schema.prisma) is a per-BUSINESS
 *    role — a business's own admin can manage their team/billing/settings,
 *    but has no more claim to see every OTHER business's data than a SALES
 *    teammate does.
 *
 * PLATFORM_ADMIN_EMAILS is neither of those: it's the one allowlist that
 * grants cross-tenant visibility, so it fails CLOSED. Unset or empty means
 * NO ONE is a platform admin — the opposite default from ALLOWED_EMAILS —
 * and there is deliberately no hardcoded fallback admin email here. A
 * forgotten env var must never silently expose every business's data.
 */

import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";

const platformAdminEmails = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/** Pure allowlist check — no session lookup, easy to unit test on its own. */
export function isPlatformAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  // Deliberately NOT "empty list = allow everyone" (that's ALLOWED_EMAILS's
  // semantics). An empty list here means the feature is unconfigured, and
  // unconfigured must mean "no access," not "open."
  if (platformAdminEmails.length === 0) return false;
  return platformAdminEmails.includes(email.toLowerCase());
}

/**
 * The actual guard `/admin`'s layout runs, factored out so it has its own
 * regression test independent of Next's routing runtime. Looks the
 * signed-in session up itself rather than trusting a caller-supplied email,
 * and calls Next's notFound() — a 404, not a "not authorized" screen — so
 * this route doesn't confirm its own existence to someone who isn't
 * supposed to see it. Also called from src/lib/admin-data.ts itself, as a
 * second, independent check on the actual cross-tenant query — the same
 * belt-and-suspenders pattern this codebase already uses for per-business
 * data (e.g. getAnalytics() re-checking the session instead of trusting
 * that only a gated page ever calls it).
 */
export async function requirePlatformAdmin(): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!isPlatformAdmin(session?.user?.email)) {
    notFound();
  }
}
