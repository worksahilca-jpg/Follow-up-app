/**
 * What Instagram itself says about someone who DMs (founder, 2026-10-12:
 * "whether they talked earlier, since when they're following"). Read from
 * the platform, said plainly, never more than it said, and nothing breaks
 * when Instagram can't be read.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const h = vi.hoisted(() => ({ business: null as unknown }));
vi.mock("@/lib/db", () => ({ prisma: { business: { findUnique: vi.fn(async () => h.business) } } }));

import { backgroundLine, loadInstagramBackground, talkedBefore, withEarlierChat } from "@/lib/inbound/dmBackground";

const fetchMock = vi.fn();
const reply = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  h.business = { instagramAccessToken: "tok", instagramUserId: "biz-ig", instagramAccountId: "biz-pro" };
});
afterEach(() => vi.unstubAllGlobals());

describe("loadInstagramBackground", () => {
  it("reads who follows whom, the follower count, and the chat, oldest first", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes("/conversations")
        ? reply(200, {
            data: [
              {
                messages: {
                  data: [
                    { id: "m2", created_time: "2025-03-02T20:05:00+0000", from: { id: "biz-pro" }, message: "yes bro" },
                    { id: "m1", created_time: "2025-03-02T20:00:00+0000", from: { id: "123" }, message: "bro you coming saturday?" },
                  ],
                },
              },
            ],
          })
        : reply(200, { is_user_follow_business: true, is_business_follow_user: true, follower_count: 412 })
    );
    const bg = await loadInstagramBackground("biz1", "123");
    expect(bg).toMatchObject({ followsBusiness: true, businessFollows: true, followerCount: 412 });
    expect(bg?.messages.map((m) => [m.id, m.direction])).toEqual([
      ["m1", "inbound"],
      ["m2", "outbound"],
    ]);
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("123?fields=is_user_follow_business,is_business_follow_user,follower_count"))).toBe(true);
    expect(urls.some((u) => u.includes("biz-ig/conversations?platform=instagram&user_id=123"))).toBe(true);
  });

  it("is null when Instagram can't be read, or isn't connected", async () => {
    fetchMock.mockResolvedValue(reply(400, { error: { message: "nope" } }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await loadInstagramBackground("biz1", "123")).toBeNull();
    h.business = null;
    expect(await loadInstagramBackground("biz1", "123")).toBeNull();
  });
});

describe("backgroundLine", () => {
  it("says only what Instagram said, and never claims to know since when they follow", () => {
    const line = backgroundLine({ followsBusiness: true, businessFollows: null, followerCount: null, messages: [] }, "m9");
    expect(line).toContain("they follow the business");
    expect(line).toContain("this is the first time they've messaged the business");
    expect(line).not.toMatch(/since when|following since|followed since/i);
    expect(line).not.toContain("follows them back");
  });
  it("is nothing at all without a background", () => {
    expect(backgroundLine(null, "m1")).toBeUndefined();
  });
});

describe("the chat to judge", () => {
  const m = (id: string, body: string, date: string, direction: "inbound" | "outbound" = "inbound") => ({ id, direction, channel: "instagram" as const, body, date, opened: false });
  const bg = { followsBusiness: null, businessFollows: null, followerCount: null, messages: [m("e1", "lol", "2025-01-01T00:00:00Z"), m("x", "Isme bee bhi dal", "2026-10-12T01:01:00Z")] };

  it("adds what only Instagram has, each message once, in order", () => {
    const thread = withEarlierChat([m("x", "Isme bee bhi dal", "2026-10-12T01:01:00Z")], bg, 50);
    expect(thread.map((t) => t.id)).toEqual(["e1", "x"]);
  });
  it("knows when they talked before this message, and that a photo or emoji isn't talking", () => {
    expect(talkedBefore(bg, "x")).toBe(true);
    expect(talkedBefore({ ...bg, messages: [m("e1", "😍", "2025-01-01T00:00:00Z")] }, "x")).toBe(false);
    expect(talkedBefore(null, "x")).toBe(false);
  });
});
