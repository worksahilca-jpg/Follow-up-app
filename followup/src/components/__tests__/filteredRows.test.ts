/**
 * "Filtered out" lived only under Email until 2026-10-12, so an owner who
 * connected only Instagram or WhatsApp could never see, or bring back, a
 * chat FollowUp set aside. Each page now lists its own apps' rows.
 */
import { describe, it, expect } from "vitest";
import { rowsFor } from "@/components/FilteredEmails";

const rows = ["gmail", "outlook", "instagram", "messenger", "whatsapp"].map((provider) => ({ provider }));

describe("rowsFor", () => {
  it("puts emails on the Email page", () => {
    expect(rowsFor("email", rows).map((r) => r.provider)).toEqual(["gmail", "outlook"]);
  });
  it("puts Instagram, Messenger and WhatsApp chats on the chat apps page", () => {
    expect(rowsFor("chats", rows).map((r) => r.provider)).toEqual(["instagram", "messenger", "whatsapp"]);
  });
  it("leaves nothing out", () => {
    expect(rowsFor("email", rows).length + rowsFor("chats", rows).length).toBe(rows.length);
  });
});
