/**
 * A Messenger customer saved as "Facebook Messenger" gets their name on a
 * later message, once Meta allows the lookup. Meta gives names only after
 * the "Business Asset User Profile Access" review, so until 2026-10-15
 * every Messenger lead created before it kept the placeholder for good,
 * while Instagram already filled in a handle it learned late.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    lead: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    business: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn() }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn() }));
vi.mock("@/lib/outboundWebhook", () => ({ notifyLeadEvent: vi.fn() }));

import { findOrCreateLeadByMessenger } from "@/lib/facebook";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  prisma.business.findUnique.mockResolvedValue({ facebookPageId: "page1", facebookPageAccessToken: "tok" });
  prisma.lead.update.mockImplementation(async ({ data }) => ({ id: "lead1", ...data }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function metaAnswers(status: number, body: unknown) {
  fetchMock.mockResolvedValue({ ok: status < 400, status, json: async () => body });
}

describe("a Messenger customer's name arrives late", () => {
  it("replaces the placeholder once Meta answers with a name", async () => {
    prisma.lead.findFirst.mockResolvedValue({ id: "lead1", name: "Facebook Messenger" });
    metaAnswers(200, { first_name: "Priya", last_name: "Shah" });

    await findOrCreateLeadByMessenger("b1", "psid1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(prisma.lead.update.mock.calls[0][0].data.name).toBe("Priya Shah");
  });

  it("keeps the placeholder while Meta still refuses, and still records the message time", async () => {
    prisma.lead.findFirst.mockResolvedValue({ id: "lead1", name: "Facebook Messenger" });
    metaAnswers(400, { error: { code: 100, message: "No permission" } });

    await findOrCreateLeadByMessenger("b1", "psid1");

    const data = prisma.lead.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("name");
    expect(data.lastContacted).toBeInstanceOf(Date);
  });

  it("treats Meta's empty answer (no permission) as no name", async () => {
    prisma.lead.findFirst.mockResolvedValue({ id: "lead1", name: "Facebook Messenger" });
    metaAnswers(200, {});

    await findOrCreateLeadByMessenger("b1", "psid1");

    expect(prisma.lead.update.mock.calls[0][0].data).not.toHaveProperty("name");
  });

  it("never asks Meta about a customer who already has a name, so the owner's own name stays", async () => {
    prisma.lead.findFirst.mockResolvedValue({ id: "lead1", name: "Priya from the open house" });

    await findOrCreateLeadByMessenger("b1", "psid1");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(prisma.lead.update.mock.calls[0][0].data).not.toHaveProperty("name");
  });
});
