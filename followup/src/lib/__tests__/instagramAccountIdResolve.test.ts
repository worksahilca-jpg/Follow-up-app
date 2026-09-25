/**
 * The Instagram account has two ids, and FollowUp only ever kept one
 * (audit research/audit/2026-09-24-app-review-path-audit.md, F1).
 *
 * For Instagram API with Instagram Login, /me's `id` is APP-SCOPED — the
 * founder's @followupbase resolves to 28693476873589439 — while webhooks,
 * the Meta console and the account's own messages in the Conversations API
 * all use the professional-account id, `user_id` (17841427527466039).
 * Storing only `id` meant a webhook never found its business, and the
 * poller filed the business's own sends as a lead from itself. Confirmed in
 * production on 2026-09-25.
 *
 * What this pins about resolveInstagramUserId (src/lib/instagram.ts):
 * it asks for `user_id`, returns it separately from `id` (which the send
 * path keeps using, because it works), reads it exactly, and never lets
 * its absence stop a connection that works today.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn() }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn() }));
vi.mock("@/lib/conversations", () => ({ findOrCreateConversation: vi.fn() }));
vi.mock("@/lib/monitoring", () => ({ recordAuthFailure: vi.fn() }));

import { instagramDiagnostics, resolveInstagramUserId } from "@/lib/instagram";

const APP_SCOPED = "28693476873589439";
const PROFESSIONAL = "17841427527466039";
const TOKEN = "IGAAT-secret-token-value";

const fetchMock = vi.fn();
const body = (raw: string, status = 200) => new Response(raw, { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("resolveInstagramUserId", () => {
  it("asks /me for user_id as well as id", async () => {
    fetchMock.mockResolvedValue(body(JSON.stringify({ id: APP_SCOPED, user_id: PROFESSIONAL, username: "followupbase" })));
    await resolveInstagramUserId(TOKEN);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toMatch(/\/me$/);
    expect(url.searchParams.get("fields")?.split(",")).toEqual(expect.arrayContaining(["id", "user_id", "username"]));
  });

  it("returns the professional-account id separately, leaving id as the app-scoped one the send path uses", async () => {
    fetchMock.mockResolvedValue(body(JSON.stringify({ id: APP_SCOPED, user_id: PROFESSIONAL, username: "followupbase" })));
    expect(await resolveInstagramUserId(TOKEN)).toEqual({ id: APP_SCOPED, accountId: PROFESSIONAL, username: "followupbase" });
  });

  // 17841427527466039 is past Number.MAX_SAFE_INTEGER: JSON.parse turns it
  // into 17841427527466040, which is somebody else's account.
  it("keeps every digit even if Meta ever sends user_id as a bare JSON number", async () => {
    fetchMock.mockResolvedValue(body(`{"id":"${APP_SCOPED}","user_id":${PROFESSIONAL},"username":"followupbase"}`));
    const resolved = await resolveInstagramUserId(TOKEN);
    expect(resolved).toEqual(expect.objectContaining({ accountId: PROFESSIONAL }));
    expect(resolved).not.toEqual(expect.objectContaining({ accountId: "17841427527466040" }));
  });

  it("still connects on id alone when Meta returns no user_id, exactly as before", async () => {
    fetchMock.mockResolvedValue(body(JSON.stringify({ id: APP_SCOPED, username: "followupbase" })));
    const resolved = await resolveInstagramUserId(TOKEN);
    expect(resolved).toEqual({ id: APP_SCOPED, username: "followupbase" });
    expect(resolved).not.toHaveProperty("accountId");
  });

  it("refuses to store a user_id that is not an id, rather than routing by it", async () => {
    fetchMock.mockResolvedValue(body(JSON.stringify({ id: APP_SCOPED, user_id: "not-an-id", username: "x" })));
    const resolved = await resolveInstagramUserId(TOKEN);
    expect(resolved).toEqual({ id: APP_SCOPED, username: "x" });
  });

  it("still refuses a token Meta refused, with Meta's reason and never the token", async () => {
    fetchMock.mockImplementation(async () => body(JSON.stringify({ error: { message: "Invalid OAuth access token", code: 190 } }), 400));
    const resolved = await resolveInstagramUserId(TOKEN);
    expect(resolved).toEqual({ error: expect.stringContaining("Invalid OAuth access token") });
    expect(JSON.stringify(resolved)).not.toContain(TOKEN);
  });

  // Graph fails a whole request over one field it does not recognise. That
  // must never turn "also ask for user_id" into "connecting stopped working".
  it("still connects if Meta refuses the user_id field, by asking again for what connect always asked for", async () => {
    fetchMock
      .mockResolvedValueOnce(body(JSON.stringify({ error: { message: "(#100) Tried accessing nonexisting field (user_id)", code: 100 } }), 400))
      .mockResolvedValueOnce(body(JSON.stringify({ id: APP_SCOPED, username: "followupbase" })));
    expect(await resolveInstagramUserId(TOKEN)).toEqual({ id: APP_SCOPED, username: "followupbase" });
    const fields = fetchMock.mock.calls.map((c) => new URL(String(c[0])).searchParams.get("fields"));
    expect(fields).toEqual(["id,user_id,username", "id,username"]);
  });

  it("asks only once when the refusal is not a 400, and returns the same shape of error as before", async () => {
    fetchMock.mockImplementation(async () => body(JSON.stringify({ error: { message: "Service temporarily unavailable", code: 2 } }), 503));
    expect(await resolveInstagramUserId(TOKEN)).toEqual({ error: expect.stringContaining("503") });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry when Meta could not be reached at all", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    expect(await resolveInstagramUserId(TOKEN)).toEqual({ error: expect.stringContaining("Couldn't reach") });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("still refuses a 200 that names no account", async () => {
    fetchMock.mockResolvedValue(body(JSON.stringify({ user_id: PROFESSIONAL })));
    expect(await resolveInstagramUserId(TOKEN)).toEqual({ error: expect.stringContaining("no account id") });
  });
});

describe("instagramDiagnostics", () => {
  // The one-request live check the audit asks for: both ids side by side.
  it("asks for user_id so the two ids can be compared against what is stored", async () => {
    fetchMock.mockImplementation(async () => body(JSON.stringify({ data: [] })));
    await instagramDiagnostics(APP_SCOPED, TOKEN);
    const meCall = fetchMock.mock.calls.map((c) => new URL(String(c[0]))).find((u) => u.pathname.endsWith("/me"));
    expect(meCall?.searchParams.get("fields")?.split(",")).toEqual(expect.arrayContaining(["id", "user_id"]));
  });
});
