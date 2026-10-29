import { describe, expect, it } from "vitest";
import { hasChannelIcon } from "@/components/app/ChannelIcon";
import { LEAD_FORM } from "@/lib/displayChannel";

// A-338: the small badge on a face shows where the customer wrote. It is drawn only when there is a glyph to put in
// it, so a channel the icon set doesn't know never leaves an empty circle on someone's face.
describe("hasChannelIcon", () => {
  it("knows every channel a customer can write from", () => {
    for (const c of ["email", "instagram", "messenger", "whatsapp", "web", LEAD_FORM, "call", "text"]) expect(hasChannelIcon(c)).toBe(true);
  });

  it("says no for an unknown or missing channel", () => {
    expect(hasChannelIcon("pigeon")).toBe(false);
    expect(hasChannelIcon(null)).toBe(false);
    expect(hasChannelIcon(undefined)).toBe(false);
  });
});
