/**
 * Instagram/Messenger replies use what the business has told customers
 * (A-096), like email drafts do: the facts go into the draft's instructions
 * and the DM shape check counts them as the business's own words. A figure
 * that is in neither the thread nor the facts is still refused.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Message } from "@/lib/types";

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/lib/integrations/openai", () => ({ generateFollowUpMessage: generate }));

import { draftDm } from "@/lib/dmDrafting";

const thread: Message[] = [
  { id: "m1", direction: "inbound", channel: "instagram", body: "Hi! What's your commission to sell a condo?", date: new Date("2026-10-06T12:00:00Z").toISOString() },
];
const FACTS = [{ label: "Commission", value: "2.5%" }];
const replyWith = (body: string) => generate.mockResolvedValue({ subject: "", body, buttons: [] });

beforeEach(() => generate.mockReset());

describe("DM drafts and what FollowUp knows", () => {
  it("hands the facts to the drafter", async () => {
    replyWith("Thanks for asking! My commission to sell a condo is 2.5%, which covers photos and showings. Want to chat?");
    await draftDm("Ivy Sohal", thread, [], undefined, "reply", null, FACTS);
    expect(generate.mock.calls[0][0]).toEqual(expect.objectContaining({ facts: FACTS }));
  });

  it("passes a figure the business has told customers before", async () => {
    replyWith("Thanks for asking! My commission to sell a condo is 2.5%, which covers photos and showings. Want to chat?");
    expect((await draftDm("Ivy Sohal", thread, [], undefined, "reply", null, FACTS)).shapeFailed).toBeNull();
  });

  it("still refuses a figure nobody wrote", async () => {
    replyWith("Thanks for asking! My commission to sell a condo is 3%, which covers photos and showings. Want to chat?");
    expect((await draftDm("Ivy Sohal", thread, [], undefined, "reply", null, FACTS)).shapeFailed).toBe("digits");
  });

  it("behaves exactly as before with no facts", async () => {
    replyWith("Thanks for asking! My commission to sell a condo is 2.5%, which covers photos and showings. Want to chat?");
    expect((await draftDm("Ivy Sohal", thread, [], undefined, "reply", null)).shapeFailed).toBe("digits");
    expect(generate.mock.calls[0][0]).toEqual(expect.objectContaining({ facts: [] }));
  });
});
