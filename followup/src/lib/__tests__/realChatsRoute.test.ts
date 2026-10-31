/**
 * /api/admin/real-chats: real conversations are kept as tests only by a platform admin, never from another site, only
 * with an OK written down, and only cleaned (src/lib/realChats.ts).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getServerSession, create, deleteMany } = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "rc1", ...data })),
  deleteMany: vi.fn(async () => ({ count: 1 })),
}));
vi.mock("next-auth", () => ({ getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({ prisma: { realChatCase: { create, deleteMany } } }));

const ADMIN = { user: { email: "founder@example.com" } };
const post = (body: unknown, site = "same-origin") =>
  new NextRequest("https://app.example.com/api/admin/real-chats", { method: "POST", headers: { "content-type": "application/json", "sec-fetch-site": site }, body: JSON.stringify(body) });

const chat = {
  action: "add",
  name: "Buyer asks the fees",
  trade: "Real estate",
  channel: "instagram",
  pasted: "Customer: Hi it's Priya, priya@gmail.com. What are the condo fees?",
  customerNames: "Priya",
  businessNames: "",
  next: { kind: "reply" },
  asks: "what the condo fees are",
  told: "",
  expect: "",
  consent: "The realtor said OK, Nov 2",
};

async function route() {
  vi.resetModules();
  return import("@/app/api/admin/real-chats/route");
}

describe("/api/admin/real-chats", () => {
  beforeEach(() => {
    vi.stubEnv("PLATFORM_ADMIN_EMAILS", "founder@example.com");
    getServerSession.mockReset();
    create.mockClear();
    deleteMany.mockClear();
  });

  it("keeps a chat cleaned of names and emails", async () => {
    getServerSession.mockResolvedValue(ADMIN);
    const { POST } = await route();
    const res = await POST(post(chat));
    expect(res.status).toBe(200);
    const data = (create.mock.calls[0] as unknown as [{ data: { lines: { text: string }[]; asks: string[]; consent: string } }])[0].data;
    expect(data.lines[0].text).toBe("Hi it's Sam, [email]. What are the condo fees?");
    expect(data.asks).toEqual(["what the condo fees are"]);
    expect(data.consent).toBe("The realtor said OK, Nov 2");
  });

  it("keeps nothing without an OK written down", async () => {
    getServerSession.mockResolvedValue(ADMIN);
    const { POST } = await route();
    const res = await POST(post({ ...chat, consent: "  " }));
    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("deletes one", async () => {
    getServerSession.mockResolvedValue(ADMIN);
    const { POST } = await route();
    expect((await POST(post({ action: "delete", id: "rc1" }))).status).toBe(200);
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: "rc1" } });
  });

  it("answers 404 to anyone else and refuses another site", async () => {
    getServerSession.mockResolvedValue({ user: { email: "owner@biz.com" } });
    const { POST } = await route();
    expect((await POST(post(chat))).status).toBe(404);
    getServerSession.mockResolvedValue(ADMIN);
    expect((await POST(post(chat, "cross-site"))).status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });
});
