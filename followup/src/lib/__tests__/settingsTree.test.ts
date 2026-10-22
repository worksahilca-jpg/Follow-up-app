import { describe, expect, it } from "vitest";
import { groupHref, pageForId, settingsPlace, SETTINGS_BRANCHES } from "@/lib/settingsGroups";

// Settings as a tree (A-257): every address lands on its parent, and on its branch when it is one.
describe("settingsPlace", () => {
  it("puts a branch under its parent", () => {
    expect(settingsPlace("/settings", "#team")).toEqual({ group: "Account", branch: "Team" });
    // When customers can book is how the owner works: Your business, not Sending replies (A-316).
    expect(settingsPlace("/settings", "#booking")).toEqual({ group: "Your business", branch: "Your free hours" });
  });

  it("puts a parent's own page on the parent", () => {
    expect(settingsPlace("/settings", "#replies-out")).toEqual({ group: "Sending replies", branch: null });
    expect(settingsPlace("/settings", "#more")).toEqual({ group: "Account", branch: null });
  });

  it("keeps old email links landing", () => {
    expect(settingsPlace("/settings", "#integrations")).toEqual({ group: "Connected apps", branch: null });
    expect(settingsPlace("/settings", "#calendar")).toEqual({ group: "Connected apps", branch: null });
    expect(settingsPlace("/settings", "#pause")).toEqual({ group: "Sending replies", branch: null });
  });

  it("opens on the first parent when nothing is asked for", () => {
    expect(settingsPlace("/settings", "")).toEqual({ group: "Connected apps", branch: null });
  });

  it("treats the follow-up plans page as a branch of Sending replies", () => {
    expect(settingsPlace("/workflows", "")).toEqual({ group: "Sending replies", branch: "When to check in" });
  });

  // A-316: each thing where its name says. Sending replies keeps only how replies go out.
  it("gives Sending replies one branch and Your business its free hours", () => {
    expect(SETTINGS_BRANCHES["Sending replies"]?.map((b) => b.label)).toEqual(["When to check in"]);
    expect(SETTINGS_BRANCHES["Your business"]?.map((b) => b.label)).toEqual(["Your free hours"]);
  });

  it("keeps What FollowUp asks under Sending replies (A-302)", () => {
    expect(settingsPlace("/asks", "")).toEqual({ group: "Sending replies", branch: null });
    expect(settingsPlace("/tell", "")).toEqual({ group: "Your business", branch: null });
  });
});

describe("the tree's addresses", () => {
  it("opens each parent where its page or list is", () => {
    expect(groupHref("Connected apps")).toBe("/settings#connections");
    expect(groupHref("Account")).toBe("/settings#more");
  });

  it("points every branch inside Settings at a real page", () => {
    for (const branches of Object.values(SETTINGS_BRANCHES))
      for (const b of branches ?? []) if (b.page) expect(pageForId(b.href.split("#")[1])).toBe(b.page);
  });
});
