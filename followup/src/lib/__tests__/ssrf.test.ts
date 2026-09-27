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

import http from "node:http";
import type { AddressInfo } from "node:net";
import { assertSafeWebhookUrl, guardedLookup, postJsonToTenantUrl, UnsafeWebhookUrlError } from "@/lib/ssrf";

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

  // Security audit 2026-09-26, A-2. The URL parser rewrites
  // [::ffff:127.0.0.1] to [::ffff:7f00:1]; the old check matched only the
  // dotted spelling, so every one of these was ACCEPTED.
  it.each([
    "http://[::ffff:127.0.0.1]/x",
    "http://[::ffff:7f00:1]/x",
    "http://[0:0:0:0:0:ffff:a9fe:a9fe]/latest/meta-data/",
    "http://[::ffff:169.254.169.254]/latest/meta-data/",
    "http://[::127.0.0.1]/x",
    "http://[::ffff:0:127.0.0.1]/x",
    "http://[64:ff9b::a9fe:a9fe]/x",
    "http://[64:ff9b:1::1]/x",
    "http://[2002:7f00:1::1]/x",
    "http://[2002:a9fe:a9fe::]/x",
    "http://[2001:0:4136:e378:8000:63bf:3fff:fdd2]/x",
    "http://[fec0::1]/x",
    "http://[ff02::1]/x",
    "http://[::]/x",
  ])("rejects the IPv6 spelling of an internal address %s", async (u) => {
    await expect(assertSafeWebhookUrl(u)).rejects.toBeInstanceOf(UnsafeWebhookUrlError);
    expect(lookup).not.toHaveBeenCalled();
  });

  it.each(["http://100.64.0.1/x", "http://100.100.100.200/latest/meta-data/", "http://198.18.0.1/x", "http://192.0.0.170/x"])(
    "rejects the internal-use IPv4 range literal %s",
    async (u) => {
      await expect(assertSafeWebhookUrl(u)).rejects.toBeInstanceOf(UnsafeWebhookUrlError);
    }
  );

  it("rejects a hostname whose AAAA answer is an IPv4-mapped internal address in hex form", async () => {
    lookup.mockResolvedValue([{ address: "::ffff:a9fe:a9fe" }]);
    await expect(assertSafeWebhookUrl("http://aaaa.example.com/x")).rejects.toBeInstanceOf(UnsafeWebhookUrlError);
  });

  it.each(["http://[2606:4700:4700::1111]/x", "http://[::ffff:203.0.113.10]/x", "http://[64:ff9b::cb00:710a]/x", "http://100.63.255.255/x", "http://100.128.0.1/x"])(
    "still accepts the public address %s",
    async (u) => {
      await expect(assertSafeWebhookUrl(u)).resolves.toBeInstanceOf(URL);
    }
  );
});

describe("guardedLookup — the check at connect time", () => {
  it("hands a public address through to the socket", async () => {
    lookup.mockResolvedValue([{ address: "203.0.113.10", family: 4 }]);
    const result = await new Promise<unknown[]>((resolve) =>
      guardedLookup("hooks.example.com", {}, (err, address, family) => resolve([err, address, family]))
    );
    expect(result).toEqual([null, "203.0.113.10", 4]);
  });

  it("answers the all:true form Node uses for happy-eyeballs", async () => {
    lookup.mockResolvedValue([{ address: "203.0.113.10", family: 4 }]);
    const result = await new Promise<unknown[]>((resolve) =>
      guardedLookup("hooks.example.com", { all: true }, (err, address) => resolve([err, address]))
    );
    expect(result).toEqual([null, [{ address: "203.0.113.10", family: 4 }]]);
  });

  it("refuses when the answer at connect time is private", async () => {
    lookup.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
    const err = await new Promise<unknown>((resolve) => guardedLookup("rebind.example.com", {}, (e) => resolve(e)));
    expect(err).toBeInstanceOf(UnsafeWebhookUrlError);
  });
});

describe("postJsonToTenantUrl — DNS rebinding", () => {
  it("never connects when the hostname was public at check time and private at connect time", async () => {
    let hits = 0;
    const server = http.createServer((_req, res) => {
      hits += 1;
      res.end("internal");
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    const { port } = server.address() as AddressInfo;

    // First answer (the up-front check): public. Second (the socket's
    // own lookup): loopback — what a rebinding DNS server does.
    lookup.mockResolvedValueOnce([{ address: "203.0.113.10", family: 4 }]);
    lookup.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);

    try {
      await expect(postJsonToTenantUrl(`http://rebind.example.com:${port}/hook`, { a: 1 }, { timeoutMs: 2000 })).rejects.toBeTruthy();
      expect(hits).toBe(0);
      expect(lookup).toHaveBeenCalledTimes(2);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });

  it("refuses an internal IP literal before opening any socket", async () => {
    await expect(postJsonToTenantUrl("http://[::ffff:7f00:1]:1/x", {})).rejects.toBeInstanceOf(UnsafeWebhookUrlError);
  });
});
