/**
 * Smart Views — saved, named lead-list filters (see
 * research/market/2026-09-05-competitor-feature-gaps.md #2.1, modeled on
 * Close's Smart Views). The eight hardcoded quick-filter chips in
 * LeadsPageClient.tsx can't express a combination like "Instagram leads
 * over $2k, no contact in 10 days" — this lets a user build one, save it
 * with a name, and reapply it with one click, either just for themselves
 * or shared with the whole business.
 *
 * Criteria is evaluated client-side against the same Lead[] the page
 * already has (see matchesCriteria below and its use in
 * LeadsPageClient.tsx) rather than as a server-side query — the lead list
 * for a single business is small enough that this stays simple and
 * exactly mirrors how the existing quick filters already work.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
// Types (and the pure matchesSavedFilter predicate) now live in
// savedFilterMatch.ts, which has no Prisma dependency — see that file's
// header for why. Re-exported here so any other server-side caller of
// "@/lib/savedFilters" for these types keeps working unchanged; client
// components must import them from "@/lib/savedFilterMatch" directly,
// never from this file (see leads/LeadsPageClient.tsx).
export type { SavedFilterCriteria, SavedFilterSummary } from "@/lib/savedFilterMatch";
import type { SavedFilterCriteria, SavedFilterSummary } from "@/lib/savedFilterMatch";

/** Every Smart View this user can see: their own private ones plus every shared one on the business. */
export async function getSavedFilters(businessId: string, userId: string): Promise<SavedFilterSummary[]> {
  const rows = await prisma.savedFilter.findMany({
    where: { businessId, OR: [{ shared: true }, { createdById: userId }] },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    shared: row.shared,
    createdById: row.createdById,
    criteria: row.criteria as SavedFilterCriteria,
  }));
}

export async function createSavedFilter(
  businessId: string,
  createdById: string,
  name: string,
  shared: boolean,
  criteria: SavedFilterCriteria
): Promise<{ success: boolean; message?: string; filter?: SavedFilterSummary }> {
  if (!name.trim()) return { success: false, message: "Give this view a name." };
  if (Object.keys(criteria).length === 0) return { success: false, message: "Pick at least one filter criterion." };

  const row = await prisma.savedFilter.create({
    data: { businessId, createdById, name: name.trim(), shared, criteria: criteria as unknown as Prisma.InputJsonValue },
  });
  return {
    success: true,
    filter: { id: row.id, name: row.name, shared: row.shared, createdById: row.createdById, criteria },
  };
}

/** Only the creator can delete a Smart View — a shared one is still someone's, not the business's. */
export async function deleteSavedFilter(
  businessId: string,
  userId: string,
  filterId: string
): Promise<{ success: boolean; message?: string }> {
  const row = await prisma.savedFilter.findUnique({ where: { id: filterId } });
  if (!row || row.businessId !== businessId) return { success: false, message: "View not found." };
  if (row.createdById !== userId) return { success: false, message: "Only the person who saved this view can delete it." };

  await prisma.savedFilter.delete({ where: { id: filterId } });
  return { success: true };
}

// Moved to src/lib/savedFilterMatch.ts along with the types above — pure,
// no Prisma dependency of its own, but LeadsPageClient ("use client")
// importing it from *this* file pulled this file's own
// `import { prisma } from "@/lib/db"` into the browser bundle, which throws
// at runtime ("PrismaClient is unable to run in this browser environment").
// Re-exported here for any other (server-side) caller of matchesSavedFilter
// from "@/lib/savedFilters".
export { matchesSavedFilter } from "@/lib/savedFilterMatch";
