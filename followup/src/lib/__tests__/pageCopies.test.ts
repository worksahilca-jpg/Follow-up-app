import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The kept copies live in the module, so every test starts from a fresh one.
async function fresh() {
  vi.resetModules();
  return import("@/lib/pageCopies");
}

const ok = (json: unknown) => () => Promise.resolve(Response.json(json));

describe("collectCopies", () => {
  it("keeps the answers that came back ok, with how many parts read each", async () => {
    const { collectCopies } = await fresh();
    const page = await collectCopies({
      "/api/a": { get: ok({ success: true, n: 1 }) },
      "/api/b": { get: ok({ success: true }), reads: 2 },
      "/api/denied": { get: () => Promise.resolve(Response.json({ success: false }, { status: 403 })) },
      "/api/broken": { get: () => Promise.reject(new Error("db down")) },
    });
    expect(page.copies).toEqual({
      "/api/a": { json: { success: true, n: 1 }, reads: 1 },
      "/api/b": { json: { success: true }, reads: 2 },
    });
    expect(page.id).toMatch(/[0-9a-f-]{36}/);
  });

  it("does not wait for a slow handler: its part asks the server itself", async () => {
    const { collectCopies } = await fresh();
    const page = await collectCopies(
      {
        "/api/quick": { get: ok({ success: true }) },
        "/api/slow": { get: () => new Promise((resolve) => setTimeout(() => resolve(Response.json({ success: true })), 200)) },
      },
      20
    );
    expect(Object.keys(page.copies)).toEqual(["/api/quick"]);
  });
});

describe("fetchOnOpen", () => {
  const fetchMock = vi.fn(() => Promise.resolve(Response.json({ from: "server" })));
  beforeEach(() => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const page = { id: "p1", copies: { "/api/team": { json: { members: [1, 2] }, reads: 2 } } };

  it("serves the page's copy to as many opening parts as share it, then asks the server", async () => {
    const { keepPageCopies, fetchOnOpen } = await fresh();
    keepPageCopies(page);
    expect(await (await fetchOnOpen("/api/team")).json()).toEqual({ members: [1, 2] });
    expect(await (await fetchOnOpen("/api/team")).json()).toEqual({ members: [1, 2] });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await (await fetchOnOpen("/api/team")).json()).toEqual({ from: "server" });
    expect(fetchMock).toHaveBeenCalledWith("/api/team");
  });

  it("asks the server for a path the page didn't bring", async () => {
    const { keepPageCopies, fetchOnOpen } = await fresh();
    keepPageCopies(page);
    await fetchOnOpen("/api/alerts");
    expect(fetchMock).toHaveBeenCalledWith("/api/alerts");
  });

  it("asks the server once the copy is too old", async () => {
    vi.useFakeTimers();
    const { keepPageCopies, fetchOnOpen, COPY_MS } = await fresh();
    keepPageCopies(page);
    vi.advanceTimersByTime(COPY_MS + 1);
    expect(await (await fetchOnOpen("/api/team")).json()).toEqual({ from: "server" });
  });

  it("does not keep the same page twice (back and forward render it again)", async () => {
    const { keepPageCopies, fetchOnOpen } = await fresh();
    keepPageCopies(page);
    await fetchOnOpen("/api/team");
    await fetchOnOpen("/api/team");
    keepPageCopies(page);
    expect(await (await fetchOnOpen("/api/team")).json()).toEqual({ from: "server" });
  });

  it("keeps nothing on the server, where the module is shared by every request", async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("fetch", fetchMock);
    const { keepPageCopies, fetchOnOpen } = await fresh();
    keepPageCopies(page);
    expect(await (await fetchOnOpen("/api/team")).json()).toEqual({ from: "server" });
  });
});
