/**
 * task: /leads threw the same client-side "PrismaClient is unable to run
 * in this browser environment" error as /pipeline — LeadsPageClient
 * ("use client") imported matchesSavedFilter from @/lib/savedFilters, a
 * server-only Prisma data-access module, which forced Next's bundler to
 * put Prisma in the browser bundle. Fix: the pure predicate (and the two
 * type shapes it needs) now live here, with no server-only import at all.
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { describe, it, expect } from "vitest";
import { matchesSavedFilter } from "@/lib/savedFilterMatch";
import type { Lead } from "@/lib/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, "..", "..");

function lead(overrides: Partial<Lead>): Lead {
  return {
    id: "l1",
    name: "Test Lead",
    company: "",
    email: "lead@example.com",
    phone: "",
    source: "Website form",
    stage: "new",
    dealValue: 0,
    score: 0,
    priority: "none",
    scoreReason: "",
    scoreFactors: [],
    lastContacted: new Date().toISOString(),
    nextFollowUp: null,
    assignedTo: "Unassigned",
    notes: "",
    conversation: [],
    suggestedMessage: "",
    automationTier: "off",
    ...overrides,
  };
}

describe("matchesSavedFilter", () => {
  it("matches on every criterion supplied, AND not OR", () => {
    const l = lead({ source: "Instagram DM", dealValue: 2500, priority: "high" });
    expect(matchesSavedFilter(l, { source: "Instagram DM", priority: "high" })).toBe(true);
    expect(matchesSavedFilter(l, { source: "Instagram DM", priority: "low" })).toBe(false);
  });

  it("treats an empty criteria object as matching everything", () => {
    expect(matchesSavedFilter(lead({}), {})).toBe(true);
  });

  it("filters on minimum deal value and minimum days since contact", () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();
    const l = lead({ dealValue: 5000, lastContacted: tenDaysAgo });
    expect(matchesSavedFilter(l, { minDealValue: 4000, minDaysSinceContact: 7 })).toBe(true);
    expect(matchesSavedFilter(l, { minDealValue: 6000 })).toBe(false);
    expect(matchesSavedFilter(l, { minDaysSinceContact: 14 })).toBe(false);
  });
});

// Same regression class as pipeline.test.ts's guard: this exact bug (a
// client component transitively importing Prisma) hit both /leads and
// /pipeline in production.
describe("client-bundle safety (regression guard)", () => {
  it("src/lib/savedFilterMatch.ts imports nothing Prisma/db-related", () => {
    const source = readFileSync(join(srcRoot, "lib", "savedFilterMatch.ts"), "utf8");
    // Matches an actual import statement's specifier, not this file's own
    // (or savedFilterMatch.ts's) prose mentioning "@prisma/client"/"@/lib/db".
    expect(source).not.toMatch(/^import\b.*from\s+["'](@prisma\/client|@\/lib\/db)["']/m);
  });

  it("LeadsPageClient.tsx and SmartViewForm.tsx (both \"use client\") no longer import from the Prisma-backed savedFilters module", () => {
    const leadsPageClient = readFileSync(join(srcRoot, "app", "(app)", "leads", "LeadsPageClient.tsx"), "utf8");
    const smartViewForm = readFileSync(join(srcRoot, "components", "SmartViewForm.tsx"), "utf8");
    for (const source of [leadsPageClient, smartViewForm]) {
      expect(source).toMatch(/"use client"/);
      expect(source).not.toMatch(/from ["']@\/lib\/savedFilters["']/);
    }
    expect(leadsPageClient).toMatch(/matchesSavedFilter.*from ["']@\/lib\/savedFilterMatch["']/);
  });
});
