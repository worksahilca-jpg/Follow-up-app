/**
 * Meta's developer prose, kept away from the business owner.
 *
 * Found in production 2026-09-23, on the founder's own Instagram lead.
 * Printed under the drafted reply, on the lead page, in full:
 *
 *   "To use 'Human Agent', your use of this endpoint must be reviewed
 *    and approved by Facebook. To submit this 'Human Agent' feature for
 *    review please read our documentation on reviewable features:
 *    https://developers.facebook.com/docs/apps/review."
 *
 * The owner cannot submit an app review, does not know what an endpoint
 * is, and is being handed a link to developer documentation while
 * looking at a message they wanted to send to a customer. It also sat
 * immediately beneath the draft, where it read as part of the message.
 *
 * The strings below are the real ones the live API returned, not
 * invented examples.
 */
import { describe, it, expect } from "vitest";
import { ownerFacingMetaError } from "@/lib/metaGraph";

const HUMAN_AGENT_ERROR =
  "To use 'Human Agent', your use of this endpoint must be reviewed and approved by Facebook. " +
  "To submit this 'Human Agent' feature for review please read our documentation on reviewable " +
  "features: https://developers.facebook.com/docs/apps/review.";

const FALLBACK = "Instagram rejected this message.";

describe("what the owner is shown", () => {
  it("never repeats Meta's wording for the human-agent refusal", () => {
    const shown = ownerFacingMetaError(HUMAN_AGENT_ERROR, FALLBACK);
    expect(shown).not.toContain("endpoint");
    expect(shown).not.toContain("developers.facebook.com");
    expect(shown).not.toContain("app review");
    expect(shown).not.toContain("reviewable");
  });

  it("explains the owner's own situation instead", () => {
    const shown = ownerFacingMetaError(HUMAN_AGENT_ERROR, FALLBACK);
    // What happened, and what they can still do about it — the two
    // questions brand-principles.md says every automated action must
    // answer without a support ticket.
    expect(shown).toContain("24-hour");
    expect(shown).toMatch(/reply from Instagram/i);
  });

  it("matches however Meta spells the tag", () => {
    // Graph has used both the spaced and underscored forms in prose.
    // A refusal that falls through to the generic sentence because of a
    // space is the original bug with better manners.
    expect(ownerFacingMetaError("Human Agent not approved", FALLBACK)).toContain("24-hour");
    expect(ownerFacingMetaError("human_agent tag is not permitted", FALLBACK)).toContain("24-hour");
  });

  it("falls back rather than passing through an unrecognised message", () => {
    // The important half: anything not yet understood must not reach the
    // owner as Meta wrote it. The log line keeps the real text.
    const shown = ownerFacingMetaError("(#100) Tried accessing nonexisting field (foo) on node type", FALLBACK);
    expect(shown).toBe(FALLBACK);
    expect(shown).not.toContain("node type");
  });

  it("falls back when Meta sent no message at all", () => {
    expect(ownerFacingMetaError("", FALLBACK)).toBe(FALLBACK);
  });
});
