/**
 * A half-written reply is never lost (research round 2, 2026-10-07). Kept
 * per customer in the tab, only against the draft it was an edit of, and
 * gone once it is sent or set aside. Never a reason a send fails.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { dropKeptEdit, keepEdit, readKeptEdit } from "@/lib/keptEdit";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal("window", {
    sessionStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

const DRAFT = "Hi Ivy, one spot is included.";

describe("a half-written reply", () => {
  it("comes back for the same customer and the same draft", () => {
    keepEdit("lead1", DRAFT, { text: "Hi Ivy, one spot is included, and a second is $150.", mine: true, price: "" });
    expect(readKeptEdit("lead1", DRAFT)).toEqual({ text: "Hi Ivy, one spot is included, and a second is $150.", mine: true, price: "" });
    expect(readKeptEdit("lead2", DRAFT)).toBeNull();
  });

  it("is dropped when FollowUp has written a new draft since, rather than shown against it", () => {
    keepEdit("lead1", DRAFT, { text: "my words", mine: true, price: "" });
    expect(readKeptEdit("lead1", "Hi Ivy, a new reply to your new message.")).toBeNull();
    expect(store.size).toBe(0);
  });

  it("keeps a filled-in blank, and forgets an edit that is back to the draft as written", () => {
    keepEdit("lead1", "It is [PRICE].", { text: "It is [PRICE].", mine: false, price: "$40" });
    expect(readKeptEdit("lead1", "It is [PRICE].")?.price).toBe("$40");
    keepEdit("lead1", DRAFT, { text: DRAFT, mine: false, price: "" });
    expect(readKeptEdit("lead1", DRAFT)).toBeNull();
  });

  it("is gone once sent or set aside", () => {
    keepEdit("lead1", DRAFT, { text: "my words", mine: true, price: "" });
    dropKeptEdit("lead1");
    expect(readKeptEdit("lead1", DRAFT)).toBeNull();
  });

  it("never throws when the browser blocks storage", () => {
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
        removeItem: () => {
          throw new Error("blocked");
        },
      },
    });
    expect(() => keepEdit("lead1", DRAFT, { text: "x", mine: true, price: "" })).not.toThrow();
    expect(readKeptEdit("lead1", DRAFT)).toBeNull();
    expect(() => dropKeptEdit("lead1")).not.toThrow();
  });
});
