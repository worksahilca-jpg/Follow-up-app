/**
 * task (fourth-pass audit, finding #1): assertSafeWebhookUrl() is the SSRF
 * guard for the outbound webhook URL a business can configure — the only
 * place in this codebase that fetches a tenant-supplied URL server-side.
 * Without it, a business (or an attacker who's compromised one business's
 * session) could point that URL at an internal service, localhost on the
 * app server itself, or a cloud metadata endpoint, and use the "send test
 * event" handler as a low-latency reachability oracle against it.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { lookup } = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("node:dns/promises", () => ({ default: { lookup } }));

import { assertSafeWebhookUrl, UnsafeWebhookUrlError } from "@/lib/ssrf";

beforeEach(() => {
  lookup.mockReset();
  lookup.mockResolvedValue([{ address: "203.0.113.10" }]); // a real, public TEST-NET-3 address
});

describe("assertSafeWebhookUrl", () => {
  it("accepts a normal https URL whose hostname resolves to a public address", async () => {
    await expect(assertSafeWebhookUrl("https://hooks.zapier.com/abc123")).resolves.toBeInstanceOf(URL);
  });

  it("rejects a non-http(s) scheme", async () => {
    await expect(assertSafeWebhookUrl("ftp://example.com/x")).rejects.toBeInstanceOf(UnsafeWebhookUrlError);
  });

  it("rejects an invalid URL outright", async () => {
    await expect(assertSafeWebhookUrl("not a url")).rejects.toBeInstanceOf(UnsafeWebhookUrlError);
  });

  it("rejects the literal hostname 'localhost'", async () => {
    await expect(assertSafeWebhookUrl("http://localhost:3000/x")).rejects.toBeInstanceOf(UnsafeWebhookUrlError);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("rejects an IPv4 loopback literal", async () => {
    await expect(assertSafeWebhookUrl("http://127.0.0.1/x")).rejects.toBeInstanceOf(UnsafeWebhookUrlError);
  });

  it("rejects the cloud metadata address literal", async () => {
    await expect(assertSafeWebhookUrl("http://169.254.169.254/latest/meta-data/")).rejects.toBeInstanceOf(UnsafeWebhookUrlError);
  });

  it.each(["10.0.0.5", "172.16.0.5", "172.31.255.255", "192.168.1.1"])(
    "rejects the RFC1918 private literal %s",
    async (ip) => {
      await expect(assertSafeWebhookUrl(`http://${ip}/x`)).rejects.toBeInstanceOf(UnsafeWebhookUrlError);
    }
  );

  it("accepts a public IPv4 literal", async () => {
    await expect(assertSafeWebhookUrl("http://203.0.113.10/x")).resolves.toBeInstanceOf(URL);
  });

  it("rejects an IPv6 loopback literal", async () => {
    await expect(assertSafeWebhookUrl("http://[::1]/x")).rejects.toBeInstanceOf(UnsafeWebhookUrlError);
  });

  it("rejects a hostname that resolves to a private address", async () => {
    lookup.mockResolvedValue([{ address: "10.1.2.3" }]);
    await expect(assertSafeWebhookUrl("http://internal.example.com/x")).rejects.toBeInstanceOf(UnsafeWebhookUrlError);
  });

  it("rejects a hostname when ANY of its resolved addresses is private, not just the first", async () => {
    lookup.mockResolvedValue([{ address: "203.0.113.10" }, { address: "169.254.169.254" }]);
    await expect(assertSafeWebhookUrl("http://sneaky.example.com/x")).rejects.toBeInstanceOf(UnsafeWebhookUrlError);
  });

  it("rejects a hostname that fails to resolve", async () => {
    lookup.mockRejectedValue(new Error("ENOTFOUND"));
    await expect(assertSafeWebhookUrl("http://nowhere.invalid/x")).rejects.toBeInstanceOf(UnsafeWebhookUrlError);
  });
});
