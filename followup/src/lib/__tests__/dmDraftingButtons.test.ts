import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "@/lib/types";

const generate = vi.fn();
vi.mock("@/lib/integrations/openai", () => ({ generateFollowUpMessage: (...a: unknown[]) => generate(...a) }));

import { draftDm } from "@/lib/dmDrafting";

const weekend = [
  { id: "m1", direction: "inbound", body: "Can I see the Danforth semi this weekend?", sentAt: "2026-10-17T12:00:00Z", channel: "instagram" },
] as unknown as Message[];

describe("draftDm: buttons that name a day nobody said", () => {
  beforeEach(() => generate.mockReset());

  it("keeps the reply and drops the buttons, without a second try (accuracy test, 2026-10-17)", async () => {
    generate.mockResolvedValue({
      body: "I'll check whether the Danforth semi can be seen this weekend. Which day would suit you best?",
      buttons: [{ title: "Saturday" }, { title: "Sunday" }],
    });
    const out = await draftDm("Ana", weekend, [], undefined);
    expect(out.shapeFailed).toBeNull();
    expect(out.quickReplies.buttons).toEqual([]);
    expect(out.body).toContain("I'll check whether the Danforth semi");
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("still holds a reply whose own words break the rule", async () => {
    generate.mockResolvedValue({ body: "I can show you the Danforth semi on Saturday. Does that work for you?", buttons: [] });
    const out = await draftDm("Ana", weekend, [], undefined);
    expect(out.shapeFailed).toBe("calendar");
    expect(generate).toHaveBeenCalledTimes(2);
  });
});
