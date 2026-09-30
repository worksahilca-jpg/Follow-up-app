/**
 * Today's "About to be lost" section and the headline above it.
 *
 * The headline ("12 customers going quiet") counted every at-risk lead;
 * the section beneath it left out anyone set aside with Later and showed
 * at most eight rows, then labelled itself with the number of rows drawn
 * ("About to be lost · 8"). Two different numbers for the same people, one
 * glance apart. Both now come from one place.
 */
import { describe, expect, it } from "vitest";
import { aboutToBeLost, ABOUT_TO_BE_LOST_SHOWN } from "@/lib/rescue";
import type { Lead, Message } from "@/lib/types";

const NOW = new Date("2026-09-07T12:00:00Z");
const h = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

function waitingLead(id: string, hoursWaiting: number): Lead {
  const inbound: Message = { id: `m-${id}`, direction: "inbound", channel: "email", body: "Still keen?", date: h(hoursWaiting) };
  return {
    id, name: `Lead ${id}`, company: "", email: `${id}@x.com`, source: "Gmail", stage: "new", dealValue: 0,
    score: 80, reviewed: true, languageRead: null, languageReadAt: null, scoreReason: "asked for a quote", scoreFactors: [],
    priority: "high", lastContacted: h(hoursWaiting), nextFollowUp: null, assignedTo: "", notes: "",
    conversation: [inbound], suggestedMessage: "", automationTier: "assisted",
  };
}

describe("aboutToBeLost", () => {
  const leads = Array.from({ length: 12 }, (_, i) => waitingLead(`l${i}`, 30 + i));

  it("counts everyone at risk, not only the rows it draws", () => {
    const r = aboutToBeLost(leads, new Set(), NOW);
    expect(r.total).toBe(12);
    expect(r.shown).toHaveLength(ABOUT_TO_BE_LOST_SHOWN);
  });

  it("leaves out anyone already waiting for the owner's OK, in the count too", () => {
    const r = aboutToBeLost(leads, new Set(["l0", "l11"]), NOW);
    expect(r.total).toBe(10);
    expect(r.shown.map((l) => l.id)).not.toContain("l11");
    expect(r.shown.map((l) => l.id)).not.toContain("l0");
  });

  it("draws the most urgent first", () => {
    const r = aboutToBeLost(leads, new Set(), NOW);
    expect(r.shown[0].rescue.score).toBeGreaterThanOrEqual(r.shown[r.shown.length - 1].rescue.score);
  });
});
