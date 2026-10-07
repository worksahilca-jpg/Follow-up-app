/**
 * /api/business/track-record (research round 2, #3): counts only, for the
 * signed-in business, of the last 20 replies a person sent from a draft.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { getSessionContext } = vi.hoisted(() => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionContext }));
const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { followUp: { findMany } } }));

import { GET } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "u1" });
  findMany.mockResolvedValue([{ draftEdited: false }, { draftEdited: false }, { draftEdited: true }]);
});

describe("the track record", () => {
  it("counts the last 20 replies a person sent from a draft, in this business only", async () => {
    const data = await (await GET()).json();
    expect(data).toEqual({ success: true, asWritten: 2, total: 3 });
    const args = findMany.mock.calls[0][0];
    expect(args.where).toEqual({ automated: false, status: "sent", draftEdited: { not: null }, lead: { businessId: "biz1" } });
    expect(args.take).toBe(20);
    expect(args.select).toEqual({ draftEdited: true });
  });

  it("refuses anyone not signed in", async () => {
    getSessionContext.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
  });
});
