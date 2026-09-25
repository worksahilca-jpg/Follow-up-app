/**
 * Asking Instagram for DMs instead of waiting to be told
 * (src/lib/instagramPoll.ts). The case behind it, 2026-09-19: an account
 * connected as Business, listed under its own subscribed_apps for the
 * `messages` field, on a published app, with the owner's "Allow access to
 * messages" toggle on — and not one webhook for a real DM, in either
 * direction, while that same message was readable through the API.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { businessUpdate, businessFindMany, processMetaEnvelope } = vi.hoisted(() => ({
  businessUpdate: vi.fn(async () => ({})),
  businessFindMany: vi.fn(async () => []),
  processMetaEnvelope: vi.fn(async () => {}),
}));
vi.mock("@/lib/db", () => ({ prisma: { business: { update: businessUpdate, findMany: businessFindMany } } }));
vi.mock("@/lib/inbound/meta", () => ({ processMetaEnvelope }));

import {
  parseGraphTime,
  fetchNewInstagramEvents,
  pollInstagramForBusiness,
  pollInstagramForAllBusinesses,
} from "@/lib/instagramPoll";

const IG = "28693476873589439";
const LEAD = "784512";
const TOKEN = "IGQV-secret";

/** Meta's own timestamp format, which is not quite ISO. */
const metaTime = (msAgo: number) => new Date(Date.now() - msAgo).toISOString().replace(/\.\d{3}Z$/, "+0000");

type Msg = Record<string, unknown>;
/** Routes the two Graph shapes the poller reads: the list, then one thread. */
function mockGraph(conversations: Msg[], messagesByConversation: Record<string, Msg[]>, listFails = false) {
  return vi.spyOn(global, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/conversations?")) {
      if (listFails) return new Response(JSON.stringify({ error: { message: "(#4) Rate limit" } }), { status: 429 });
      return new Response(JSON.stringify({ data: conversations }));
    }
    const id = url.split("/").pop()!.split("?")[0];
    return new Response(JSON.stringify({ messages: { data: messagesByConversation[id] ?? [] } }));
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  businessUpdate.mockClear();
  processMetaEnvelope.mockClear();
});

describe("parseGraphTime", () => {
  it("reads Meta's +0000 offset, which Date alone does not reliably parse", () => {
    expect(parseGraphTime("2026-09-19T17:20:51+0000")?.toISOString()).toBe("2026-09-19T17:20:51.000Z");
  });

  it("returns null rather than an Invalid Date for junk", () => {
    expect(parseGraphTime("not a time")).toBeNull();
    expect(parseGraphTime(undefined)).toBeNull();
  });
});

describe("fetchNewInstagramEvents", () => {
  it("rebuilds a lead's DM as the webhook event the rest of the pipeline already understands", async () => {
    mockGraph(
      [{ id: "c1", updated_time: metaTime(60_000) }],
      { c1: [{ id: "m1", created_time: metaTime(60_000), from: { id: LEAD, username: "sahildoes" }, message: "is this available?" }] }
    );
    const { ok, events } = await fetchNewInstagramEvents(IG, TOKEN, new Date(Date.now() - 300_000));
    expect(ok).toBe(true);
    expect(events).toEqual([
      expect.objectContaining({
        sender: { id: LEAD, username: "sahildoes" },
        recipient: { id: IG },
        message: expect.objectContaining({ mid: "m1", text: "is this available?" }),
      }),
    ]);
    // Not an echo — this is the lead talking, so it must not be captured
    // as the business's own outbound message.
    expect((events[0].message as { is_echo?: boolean }).is_echo).toBeUndefined();
  });

  it("marks the business's own message as an echo, addressed to the person it was sent to", async () => {
    mockGraph(
      [{ id: "c1", updated_time: metaTime(60_000) }],
      {
        c1: [
          {
            id: "m2",
            created_time: metaTime(60_000),
            from: { id: IG },
            to: { data: [{ id: LEAD }] },
            message: "yes, still available",
          },
        ],
      }
    );
    const { events } = await fetchNewInstagramEvents(IG, TOKEN, new Date(Date.now() - 300_000));
    expect(events[0]).toEqual(
      expect.objectContaining({ sender: { id: IG }, recipient: { id: LEAD } })
    );
    expect((events[0].message as { is_echo?: boolean }).is_echo).toBe(true);
  });

  it("skips a thread untouched since the cursor, so a quiet account costs one request", async () => {
    const fetchSpy = mockGraph([{ id: "c1", updated_time: metaTime(600_000) }], { c1: [] });
    const { events } = await fetchNewInstagramEvents(IG, TOKEN, new Date(Date.now() - 300_000));
    expect(events).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("skips messages older than the cursor inside a thread that did change", async () => {
    mockGraph(
      [{ id: "c1", updated_time: metaTime(10_000) }],
      {
        c1: [
          { id: "old", created_time: metaTime(900_000), from: { id: LEAD }, message: "last week" },
          { id: "new", created_time: metaTime(10_000), from: { id: LEAD }, message: "just now" },
        ],
      }
    );
    const { events } = await fetchNewInstagramEvents(IG, TOKEN, new Date(Date.now() - 300_000));
    expect(events).toHaveLength(1);
    expect((events[0].message as { mid: string }).mid).toBe("new");
  });

  it("replays a thread oldest first", async () => {
    mockGraph(
      [{ id: "c1", updated_time: metaTime(10_000) }],
      {
        c1: [
          { id: "second", created_time: metaTime(20_000), from: { id: LEAD }, message: "still there?" },
          { id: "first", created_time: metaTime(40_000), from: { id: LEAD }, message: "hello" },
        ],
      }
    );
    const { events } = await fetchNewInstagramEvents(IG, TOKEN, new Date(Date.now() - 300_000));
    expect(events.map((e) => (e.message as { mid: string }).mid)).toEqual(["first", "second"]);
  });

  it("keeps an attachment-only DM, which carries no text at all", async () => {
    mockGraph(
      [{ id: "c1", updated_time: metaTime(10_000) }],
      { c1: [{ id: "m3", created_time: metaTime(10_000), from: { id: LEAD }, attachments: { data: [{ id: "a1" }] } }] }
    );
    const { events } = await fetchNewInstagramEvents(IG, TOKEN, new Date(Date.now() - 300_000));
    const message = events[0].message as { text: string; attachments: unknown[] };
    expect(message.text).toBe("");
    expect(message.attachments).toHaveLength(1);
  });

  it("reports a refused conversation list rather than calling it 'nothing new'", async () => {
    mockGraph([], {}, true);
    expect(await fetchNewInstagramEvents(IG, TOKEN, new Date())).toEqual({ ok: false, events: [] });
  });

  it("never puts the token anywhere but the request", async () => {
    const fetchSpy = mockGraph([{ id: "c1", updated_time: metaTime(10_000) }], { c1: [] });
    await fetchNewInstagramEvents(IG, TOKEN, new Date(Date.now() - 300_000));
    expect(String(fetchSpy.mock.calls[0][0])).toContain(`access_token=${TOKEN}`);
  });
});

describe("pollInstagramForBusiness", () => {
  const business = { id: "biz1", instagramUserId: IG, instagramAccessToken: TOKEN, instagramSyncedAt: null };

  it("hands new messages to the ordinary inbound pipeline, not a second implementation", async () => {
    mockGraph(
      [{ id: "c1", updated_time: metaTime(10_000) }],
      { c1: [{ id: "m1", created_time: metaTime(10_000), from: { id: LEAD }, message: "hi" }] }
    );
    await pollInstagramForBusiness({ ...business, instagramSyncedAt: new Date(Date.now() - 300_000) });
    expect(processMetaEnvelope).toHaveBeenCalledWith({
      object: "instagram",
      entry: [{ id: IG, messaging: [expect.objectContaining({ sender: { id: LEAD } })] }],
    });
  });

  it("does not call the pipeline at all when nothing is new", async () => {
    mockGraph([], {});
    await pollInstagramForBusiness({ ...business, instagramSyncedAt: new Date(Date.now() - 300_000) });
    expect(processMetaEnvelope).not.toHaveBeenCalled();
    expect(businessUpdate).toHaveBeenCalled();
  });

  // The whole point of the cursor: a tick Meta refused must be covered
  // again, not skipped over as though it had been read.
  it("leaves the cursor alone when Meta refused the read", async () => {
    mockGraph([], {}, true);
    await pollInstagramForBusiness({ ...business, instagramSyncedAt: new Date(Date.now() - 300_000) });
    expect(businessUpdate).not.toHaveBeenCalled();
  });

  // Connecting an account must not drag its history in and acknowledge
  // conversations that ended weeks ago.
  it("reads only a short window back on a never-polled account", async () => {
    const fetchSpy = mockGraph(
      [
        { id: "recent", updated_time: metaTime(5 * 60_000) },
        { id: "ancient", updated_time: metaTime(60 * 60_000) },
      ],
      { recent: [], ancient: [{ id: "old", created_time: metaTime(60 * 60_000), from: { id: LEAD }, message: "weeks ago" }] }
    );
    await pollInstagramForBusiness(business);
    const fetched = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(fetched.some((u) => u.includes("recent"))).toBe(true);
    expect(fetched.some((u) => u.includes("ancient"))).toBe(false);
    expect(processMetaEnvelope).not.toHaveBeenCalled();
  });
});

describe("pollInstagramForAllBusinesses", () => {
  it("only considers businesses that actually have a connected account", async () => {
    businessFindMany.mockResolvedValueOnce([]);
    expect(await pollInstagramForAllBusinesses()).toEqual({ businesses: 0, events: 0 });
    expect(businessFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { instagramUserId: { not: null }, instagramAccessToken: { not: null } },
      })
    );
  });

  it("one business's failure does not end the tick for the others", async () => {
    businessFindMany.mockResolvedValueOnce([
      { id: "bad", instagramUserId: "ig-bad", instagramAccessToken: "t", instagramSyncedAt: null },
      { id: "good", instagramUserId: IG, instagramAccessToken: TOKEN, instagramSyncedAt: null },
    ] as never);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      if (String(input).includes("ig-bad")) throw new Error("network down");
      return new Response(JSON.stringify({ data: [] }));
    });
    expect(await pollInstagramForAllBusinesses()).toEqual({ businesses: 2, events: 0 });
    expect(businessUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "good" } }));
  });
});

/**
 * "Is this our own message?" against BOTH of the account's ids (audit
 * 2026-09-24 F1/F2). The poller reads through the app-scoped id (IG above,
 * 2869…), but the Conversations API reports the account's own messages as
 * `from` its professional-account id (1784…). Comparing against IG alone
 * rebuilt every message the business sent — FollowUp's approved replies and
 * the owner's own from the phone — as an inbound DM from the business, and
 * on 2026-09-25 production had the resulting lead: phone ig:17841427527466039.
 */
describe("the account's own messages, by its professional-account id", () => {
  const PRO = "17841427527466039";
  const since = () => new Date(Date.now() - 300_000);

  it("are echoes addressed to the lead, not DMs from the business", async () => {
    mockGraph(
      [{ id: "c1", updated_time: metaTime(10_000) }],
      { c1: [{ id: "m-ours", created_time: metaTime(10_000), from: { id: PRO, username: "followupbase" }, to: { data: [{ id: LEAD }] }, message: "Yes, Saturday works." }] }
    );
    const { events } = await fetchNewInstagramEvents(IG, TOKEN, since(), PRO);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(expect.objectContaining({ recipient: { id: LEAD } }));
    expect(events[0].message).toEqual(expect.objectContaining({ is_echo: true, mid: "m-ours" }));
    // Not rebuilt as a DM from "@followupbase" — the sender of an echo is
    // the account, and processMetaEnvelope files it on the recipient.
    expect(events[0].sender).toEqual({ id: IG });
  });

  it("never pick one of the account's own ids as the person being talked to", async () => {
    mockGraph(
      [{ id: "c1", updated_time: metaTime(10_000) }],
      { c1: [{ id: "m-ours", created_time: metaTime(10_000), from: { id: PRO }, to: { data: [{ id: IG }, { id: PRO }, { id: LEAD }] }, message: "hi" }] }
    );
    const { events } = await fetchNewInstagramEvents(IG, TOKEN, since(), PRO);
    expect(events[0].recipient).toEqual({ id: LEAD });
  });

  it("leave a lead's own DM exactly as it was: inbound, from the lead", async () => {
    mockGraph(
      [{ id: "c1", updated_time: metaTime(10_000) }],
      { c1: [{ id: "m-lead", created_time: metaTime(10_000), from: { id: LEAD }, to: { data: [{ id: PRO }] }, message: "is Saturday free?" }] }
    );
    const { events } = await fetchNewInstagramEvents(IG, TOKEN, since(), PRO);
    expect(events[0]).toEqual(expect.objectContaining({ sender: { id: LEAD }, recipient: { id: IG } }));
    expect((events[0].message as { is_echo?: boolean }).is_echo).toBeUndefined();
  });

  it("are read with the stored professional-account id on every tick", async () => {
    mockGraph(
      [{ id: "c1", updated_time: metaTime(10_000) }],
      { c1: [{ id: "m-ours", created_time: metaTime(10_000), from: { id: PRO }, to: { data: [{ id: LEAD }] }, message: "Yes, Saturday works." }] }
    );
    await pollInstagramForBusiness({
      id: "biz1",
      instagramUserId: IG,
      instagramAccountId: PRO,
      instagramAccessToken: TOKEN,
      instagramSyncedAt: new Date(Date.now() - 300_000),
    });
    expect(processMetaEnvelope).toHaveBeenCalledWith({
      object: "instagram",
      entry: [{ id: IG, messaging: [expect.objectContaining({ recipient: { id: LEAD }, message: expect.objectContaining({ is_echo: true }) })] }],
    });
  });

  it("are recognised for every business the tick reads, because the id is selected", async () => {
    businessFindMany.mockResolvedValueOnce([
      { id: "biz1", instagramUserId: IG, instagramAccountId: PRO, instagramAccessToken: TOKEN, instagramSyncedAt: new Date(Date.now() - 300_000) },
    ] as never);
    mockGraph(
      [{ id: "c1", updated_time: metaTime(10_000) }],
      { c1: [{ id: "m-ours", created_time: metaTime(10_000), from: { id: PRO }, to: { data: [{ id: LEAD }] }, message: "Yes, Saturday works." }] }
    );
    await pollInstagramForAllBusinesses();
    expect(businessFindMany).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ instagramAccountId: true }) }));
    expect(processMetaEnvelope).toHaveBeenCalledWith({
      object: "instagram",
      entry: [{ id: IG, messaging: [expect.objectContaining({ message: expect.objectContaining({ is_echo: true }) })] }],
    });
  });
});

/**
 * The sender's handle. Meta's webhook payload has no username, so a lead
 * created from one is "Instagram DM" — and the first real lead was
 * greeted "Hi! Instagram, ..." on 2026-09-19 because that placeholder
 * reached the greeting as though it were a person. The REST shape the
 * poller reads does carry the handle.
 */
describe("the sender's handle", () => {
  it("is carried on the event so the lead is named after them, not after the channel", async () => {
    mockGraph(
      [{ id: "c1", updated_time: metaTime(10_000) }],
      { c1: [{ id: "m1", created_time: metaTime(10_000), from: { id: LEAD, username: "sahildoes" }, message: "hi" }] }
    );
    const { events } = await fetchNewInstagramEvents(IG, TOKEN, new Date(Date.now() - 300_000));
    expect(events[0].sender).toEqual({ id: LEAD, username: "sahildoes" });
  });

  it("is simply absent when Meta didn't give one, leaving the webhook shape unchanged", async () => {
    mockGraph(
      [{ id: "c1", updated_time: metaTime(10_000) }],
      { c1: [{ id: "m1", created_time: metaTime(10_000), from: { id: LEAD }, message: "hi" }] }
    );
    const { events } = await fetchNewInstagramEvents(IG, TOKEN, new Date(Date.now() - 300_000));
    expect(events[0].sender).toEqual({ id: LEAD });
  });
});
