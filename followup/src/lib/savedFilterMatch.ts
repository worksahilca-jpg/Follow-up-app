/**
 * Pure, client-safe Smart View pieces — deliberately split out of
 * savedFilters.ts. SavedFilterCriteria/SavedFilterSummary are just shapes,
 * and matchesSavedFilter() only ever tests one already-fetched Lead against
 * one already-fetched criteria object; none of that touches Prisma. But
 * savedFilters.ts (where these used to live) imports { prisma } from
 * "@/lib/db" at module scope for its *other* exports (getSavedFilters,
 * createSavedFilter, deleteSavedFilter) — and LeadsPageClient ("use client")
 * importing matchesSavedFilter from that file forced the whole module,
 * Prisma import included, into the browser bundle. @prisma/client throws
 * immediately when evaluated outside Node ("PrismaClient is unable to run
 * in this browser environment"), which is exactly the error users hit
 * opening /leads. Moving the pure pieces here, with no server-only import
 * in sight, is the fix.
 */
import type { Lead } from "@/lib/types";
import { daysSince } from "@/lib/demo-data";

export interface SavedFilterCriteria {
  source?: string;
  stage?: Lead["stage"];
  priority?: Lead["priority"];
  minDealValue?: number;
  minDaysSinceContact?: number;
}

export interface SavedFilterSummary {
  id: string;
  name: string;
  shared: boolean;
  createdById: string;
  criteria: SavedFilterCriteria;
}

/** Same predicate shape as the hardcoded quick filters in LeadsPageClient.tsx — every criterion set must match (AND, not OR). */
export function matchesSavedFilter(lead: Lead, criteria: SavedFilterCriteria): boolean {
  if (criteria.source && lead.source !== criteria.source) return false;
  if (criteria.stage && lead.stage !== criteria.stage) return false;
  if (criteria.priority && lead.priority !== criteria.priority) return false;
  if (criteria.minDealValue !== undefined && lead.dealValue < criteria.minDealValue) return false;
  if (criteria.minDaysSinceContact !== undefined && daysSince(lead.lastContacted) < criteria.minDaysSinceContact) return false;
  return true;
}
