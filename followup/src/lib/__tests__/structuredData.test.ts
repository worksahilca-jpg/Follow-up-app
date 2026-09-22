/**
 * What FollowUp tells an answer engine it is.
 *
 * On 2026-09-21 Google's AI Overview described FollowUp, unprompted, as
 * catering to "independent sales representatives and field sales teams
 * (such as solar sales and door-to-door sales)". None of that came from
 * this codebase — the site shipped no structured data at all, so a model
 * filled the vacuum, partly from a competitor listed on the same page.
 *
 * "Door-to-door sales" is not a neutral mistake. CLAUDE.md is explicit that
 * FollowUp is never designed as a spam tool or an aggressive sales
 * platform, and that is exactly the shelf a searcher just put it on.
 *
 * These assertions are about honesty and consistency rather than SEO
 * mechanics: the two ways this file could do real damage are by saying
 * something untrue, or by saying something the rest of the site does not.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { buildStructuredData } from "@/lib/structuredData";

const graph = () => buildStructuredData()["@graph"] as Record<string, unknown>[];
const node = (type: string) => graph().find((n) => n["@type"] === type)!;
const asText = () => JSON.stringify(buildStructuredData());

describe("it never claims something nobody can stand behind", () => {
  it("publishes no ratings", () => {
    // There are none. The first ten testers have not arrived. Inventing a
    // rating is the exact fabrication CLAUDE.md forbids, and Google
    // penalises invented review markup regardless.
    expect(asText()).not.toContain("aggregateRating");
    expect(asText()).not.toContain("ratingValue");
  });

  it("publishes no reviews and no user counts", () => {
    const text = asText();
    expect(text).not.toContain('"review"');
    expect(text).not.toContain("userInteractionCount");
    expect(text).not.toContain("interactionStatistic");
  });

  it("publishes no prices", () => {
    // Pricing has moved three times this month. Structured data that
    // contradicts the pricing page is worse than none at all.
    const text = asText();
    expect(text).not.toContain('"offers"');
    expect(text).not.toContain('"price"');
  });
});

describe("it says who this is actually for", () => {
  it("names the owner, not a sales team", () => {
    // PRODUCT_DIRECTION.md, canonical: "business owners are not able to
    // follow up. That is the main thing."
    const audience = node("SoftwareApplication").audience as Record<string, string>;
    expect(audience.audienceType).toMatch(/owner/i);
  });

  it("does not describe itself with the words that caused this", () => {
    const text = asText().toLowerCase();
    for (const wrong of ["door-to-door", "door to door", "solar", "field sales", "sales rep"]) {
      expect(text, `structured data now says "${wrong}" about FollowUp`).not.toContain(wrong);
    }
  });

  it("leads with approval, because that is the product's actual promise", () => {
    // A tool that holds every message for a human is the opposite of the
    // thing Google described. If the feature list omits it, the correction
    // has no teeth.
    const features = node("SoftwareApplication").featureList as string[];
    expect(features.join(" ")).toMatch(/approval/i);
  });
});

describe("it speaks with the site's own voice", () => {
  it("reuses the metadata description verbatim, rather than writing a second pitch", () => {
    // One product, one sentence. A second description that drifts is how a
    // site ends up telling two stories about itself.
    const layout = readFileSync(join(__dirname, "..", "..", "app", "layout.tsx"), "utf8").replace(/\s+/g, " ");
    const description = node("Organization").description as string;
    expect(layout).toContain(description);
  });

  it("gives the software and the organization the same description", () => {
    expect(node("SoftwareApplication").description).toBe(node("Organization").description);
  });

  it("links the software to the organization rather than repeating it", () => {
    const publisher = node("SoftwareApplication").publisher as Record<string, string>;
    expect(publisher["@id"]).toBe(node("Organization")["@id"]);
  });
});

describe("the shape a crawler needs", () => {
  it("declares the schema.org context", () => {
    expect(buildStructuredData()["@context"]).toBe("https://schema.org");
  });

  it("is a single JSON-LD graph, not two competing blocks", () => {
    expect(graph()).toHaveLength(2);
  });

  it("is actually rendered into the page", () => {
    // A perfect object nothing emits helps nobody.
    const layout = readFileSync(join(__dirname, "..", "..", "app", "layout.tsx"), "utf8");
    expect(layout).toContain('type="application/ld+json"');
    expect(layout).toContain("buildStructuredData()");
  });

  it("serialises without throwing", () => {
    expect(() => JSON.parse(asText())).not.toThrow();
  });
});
