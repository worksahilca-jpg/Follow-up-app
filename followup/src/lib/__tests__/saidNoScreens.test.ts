/**
 * When a customer says no (A-326, drawn on the real app and approved 2026-10-25: "yes to both, build it"): Today's
 * row and reply card, and the top of their page, say it in words with the one way back.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { saidNoWords } from "@/lib/saidNoWords";

const read = (...p: string[]) => readFileSync(join(__dirname, "..", "..", ...p), "utf8");

describe("saidNoWords", () => {
  it("says a clear no as drawn", () => {
    expect(saidNoWords("clear", "Karan")).toEqual({
      row: "Said no. Your last reply is ready.",
      line: "Karan said no. After this reply, FollowUp won't remind them again.",
      link: "Keep following up anyway",
      title: "Karan said no",
      body: "FollowUp stopped following up with Karan. If Karan writes again, it shows up on Today.",
    });
  });

  it("says a maybe-no honestly: FollowUp isn't sure and stopped to be safe", () => {
    const w = saidNoWords("unsure", "Karan");
    expect(w.row).toBe("Might be saying no. Check your reply.");
    expect(w.line).toBe("Karan might be saying no. To be safe, FollowUp stopped reminding them.");
    expect(w.link).toBe("Not a no? Keep following up");
    expect(w.title).toBe("Karan might be saying no");
  });

  it("says an agent the way the agent card already does", () => {
    expect(saidNoWords("agent", "Karan").title).toBe("Karan already has an agent");
  });
});

describe("the screens use them", () => {
  const queue = read("components", "ApprovalQueue.tsx");
  const page = read("app", "(app)", "leads", "[id]", "page.tsx");

  it("Today's card says the no and offers the way back, with no dot (R-141)", () => {
    expect(queue).toContain('saidNoWords(item.saidNoHow ?? "clear", firstName).line');
    expect(queue).toContain("<KeepFollowingButton leadId={item.leadId}");
  });

  it("Today's row says it before anything else about them", () => {
    const row = queue.slice(queue.indexOf("function replyRow"));
    expect(row.indexOf("if (item.saidNo)")).toBeGreaterThan(-1);
    expect(row.indexOf("if (item.saidNo)")).toBeLessThan(row.indexOf("if (item.line)"));
  });

  it("their page puts the no at the top, ahead of where they stand", () => {
    expect(page).toContain("(saidNo ?? standing ?? generalCall)");
  });
});
