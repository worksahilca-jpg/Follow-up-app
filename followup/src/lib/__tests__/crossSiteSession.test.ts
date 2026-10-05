/**
 * Security review L2 (2026-10-05): a script on another site must not be able to act as the
 * signed-in owner. getSessionContext() is the one door every signed-in route uses.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { hdrs, getServerSession } = vi.hoisted(() => ({
  hdrs: { value: new Headers() as Headers | null },
  getServerSession: vi.fn(),
}));
vi.mock("next/headers", () => ({
  headers: async () => {
    if (!hdrs.value) throw new Error("outside a request");
    return hdrs.value;
  },
}));
vi.mock("next-auth", () => ({ getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { getSessionContext } from "@/lib/session";

const session = { user: { id: "u1", businessId: "b1", email: "o@x.test" }, authTime: 1 };

beforeEach(() => {
  getServerSession.mockReset().mockResolvedValue(session);
  hdrs.value = new Headers();
});

describe("getSessionContext and other sites", () => {
  it("refuses a fetch from another site, even with a valid cookie", async () => {
    hdrs.value = new Headers({ "sec-fetch-site": "cross-site", "sec-fetch-mode": "cors" });
    expect(await getSessionContext()).toBeNull();
    expect(getServerSession).not.toHaveBeenCalled();
  });

  it("allows a page load from another site (an OAuth return is one)", async () => {
    hdrs.value = new Headers({ "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate" });
    expect(await getSessionContext()).toMatchObject({ userId: "u1", businessId: "b1" });
  });

  it("allows the app's own requests and same-site ones (apex and www)", async () => {
    for (const site of ["same-origin", "same-site", "none"]) {
      hdrs.value = new Headers({ "sec-fetch-site": site, "sec-fetch-mode": "cors" });
      expect(await getSessionContext()).not.toBeNull();
    }
  });

  it("allows a request with no browser headers, and code running outside a request", async () => {
    expect(await getSessionContext()).not.toBeNull();
    hdrs.value = null;
    expect(await getSessionContext()).not.toBeNull();
  });
});
