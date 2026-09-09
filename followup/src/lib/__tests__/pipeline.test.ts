/**
 * task: /pipeline threw a client-side "PrismaClient is unable to run in
 * this browser environment" error for every visitor — PipelinePageClient
 * ("use client") imported getPipelineData from @/lib/leads-data, a
 * server-only Prisma data-access module, which forced Next's bundler to
 * put Prisma (and @/lib/db's live PrismaClient instantiation) in the
 * browser bundle. Fix: the pure grouping logic now lives here, with no
 * server-only import at all.
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { describe, it, expect } from "vitest";
import { getPipelineData } from "@/lib/pipeline";
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

describe("getPipelineData", () => {
  it("groups leads by stage and sums deal value per stage", () => {
    const leads = [
      lead({ id: "a", stage: "new", dealValue: 100 }),
      lead({ id: "b", stage: "new", dealValue: 50 }),
      lead({ id: "c", stage: "won", dealValue: 900 }),
    ];
    const stages = getPipelineData(leads);
    const newStage = stages.find((s) => s.id === "new")!;
    const wonStage = stages.find((s) => s.id === "won")!;
    expect(newStage.leads.map((l) => l.id)).toEqual(["a", "b"]);
    expect(newStage.value).toBe(150);
    expect(wonStage.leads.map((l) => l.id)).toEqual(["c"]);
    expect(wonStage.value).toBe(900);
  });

  it("includes every pipeline stage even with zero leads in it", () => {
    const stages = getPipelineData([]);
    expect(stages.map((s) => s.id)).toEqual(["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"]);
    expect(stages.every((s) => s.leads.length === 0 && s.value === 0)).toBe(true);
  });
});

// The regression this whole fix is about: a client component importing
// this module (or the equally-pure savedFilterMatch.ts) must never end up
// pulling in Prisma. Source-scanning rather than a runtime import check —
// a runtime import of "@/lib/pipeline" in this Node test environment
// wouldn't reproduce the browser-only failure @prisma/client throws.
describe("client-bundle safety (regression guard)", () => {
  it("src/lib/pipeline.ts imports nothing Prisma/db-related", () => {
    const source = readFileSync(join(srcRoot, "lib", "pipeline.ts"), "utf8");
    // Matches an actual import statement's specifier, not this file's own
    // (or pipeline.ts's) prose mentioning "@prisma/client"/"@/lib/db".
    expect(source).not.toMatch(/^import\b.*from\s+["'](@prisma\/client|@\/lib\/db)["']/m);
  });

  it("PipelinePageClient.tsx (\"use client\") no longer imports from the Prisma-backed leads-data module", () => {
    const source = readFileSync(join(srcRoot, "app", "(app)", "pipeline", "PipelinePageClient.tsx"), "utf8");
    expect(source).toMatch(/"use client"/);
    expect(source).not.toMatch(/from ["']@\/lib\/leads-data["']/);
    expect(source).toMatch(/getPipelineData.*from ["']@\/lib\/pipeline["']/);
  });
});
