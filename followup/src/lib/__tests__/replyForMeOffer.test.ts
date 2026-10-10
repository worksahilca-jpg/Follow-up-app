/**
 * When Today asks "Let FollowUp reply for you?" (A-217, A-218).
 *
 * Asked once, only of a business still on "ask me first", only with the
 * owner's own proof (most recent replies sent just as written), and never
 * when a "yes" couldn't work or would do more than it says (no active plan,
 * or sending paused on purpose).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ businessFindUnique: vi.fn(), followUpFindMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { business: { findUnique: h.businessFindUnique }, followUp: { findMany: h.followUpFindMany } } }));

import { offerFromSends, replyForMeOffer, REPLY_FOR_ME_OFFER, OFFER_LOOKBACK } from "@/lib/replyForMeOffer";

const asWritten = (n: number) => Array.from({ length: n }, () => false);
const edited = (n: number) => Array.from({ length: n }, () => true);

describe("offerFromSends", () => {
  it("needs at least five sends to say anything", () => {
    expect(offerFromSends(asWritten(4))).toBeNull();
    expect(offerFromSends(asWritten(5))).toEqual({ asWritten: 5, total: 5 });
  });

  it("needs most of them sent just as written", () => {
    expect(offerFromSends([...asWritten(5), ...edited(5)])).toBeNull();
    expect(offerFromSends([...asWritten(6), ...edited(4)])).toEqual({ asWritten: 6, total: 10 });
  });

  it("looks only at the most recent ones", () => {
    const proof = offerFromSends([...asWritten(OFFER_LOOKBACK), ...edited(30)]);
    expect(proof).toEqual({ asWritten: OFFER_LOOKBACK, total: OFFER_LOOKBACK });
  });
});

describe("replyForMeOffer", () => {
  const business = { holdAllForApproval: true, dismissedSetupSteps: [] as string[], subscriptionStatus: "active", tier: "plus", sendingPausedAt: null as Date | null };

  beforeEach(() => {
    vi.clearAllMocks();
    h.businessFindUnique.mockResolvedValue({ ...business });
    h.followUpFindMany.mockResolvedValue([...Array(11).fill({ draftEdited: false }), ...Array(2).fill({ draftEdited: true })]);
  });

  it("asks with the owner's own numbers, from their own business only", async () => {
    expect(await replyForMeOffer("biz1")).toEqual({ asWritten: 11, total: 13 });
    expect(h.followUpFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { lead: { businessId: "biz1" }, status: "sent", draftEdited: { not: null } } })
    );
  });

  it("never asks a business that already lets FollowUp send", async () => {
    h.businessFindUnique.mockResolvedValue({ ...business, holdAllForApproval: false });
    expect(await replyForMeOffer("biz1")).toBeNull();
    expect(h.followUpFindMany).not.toHaveBeenCalled();
  });

  it("never asks twice", async () => {
    h.businessFindUnique.mockResolvedValue({ ...business, dismissedSetupSteps: [REPLY_FOR_ME_OFFER] });
    expect(await replyForMeOffer("biz1")).toBeNull();
  });

  it("never asks when the plan couldn't turn it on", async () => {
    h.businessFindUnique.mockResolvedValue({ ...business, subscriptionStatus: null, tier: null });
    expect(await replyForMeOffer("biz1")).toBeNull();
  });

  it("never asks while sending is paused", async () => {
    h.businessFindUnique.mockResolvedValue({ ...business, sendingPausedAt: new Date() });
    expect(await replyForMeOffer("biz1")).toBeNull();
  });
});
