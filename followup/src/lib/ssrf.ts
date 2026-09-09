import dns from "node:dns/promises";
import net from "node:net";

/**
 * SSRF guard for any URL a tenant supplies that the server itself later
 * fetches. The only place this applies today is the outbound lead-event
 * webhook (src/lib/outboundWebhook.ts, src/app/api/webhooks/outbound) — a
 * business (or an attacker who's compromised one business's session) could
 * otherwise point that URL at an internal service, a cloud metadata
 * endpoint (169.254.169.254), or localhost on the app server itself, and
 * use the "send test event" PUT handler as a low-latency reachability
 * oracle against it.
 *
 * Checked twice by design: once when the URL is saved (reject obviously
 * bad input immediately, good UX) and again immediately before every
 * actual fetch (notifyLeadEvent, the PUT test-fire handler) — a hostname
 * that resolved to a public address at save time can be re-pointed at a
 * private one later (DNS rebinding), so a save-time-only check isn't
 * sufficient on its own.
 */
export class UnsafeWebhookUrlError extends Error {}

const BLOCKED_HOSTNAMES = new Set(["localhost", "localhost.localdomain"]);

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true; // malformed — fail closed
  const [a, b] = parts;
  if (a === 127) return true; // loopback (127.0.0.0/8)
  if (a === 10) return true; // RFC1918
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 169 && b === 254) return true; // link-local, incl. the cloud metadata IP
  if (a === 0) return true; // "this network"
  if (a >= 224) return true; // multicast (224-239) + reserved (240-255)
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true; // loopback / unspecified
  if (lower.startsWith("fe80:")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local (fc00::/7)
  // IPv4-mapped IPv6 (::ffff:a.b.c.d) — check the embedded v4 address too.
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return true; // not a recognizable address shape — fail closed
}

/**
 * Validates that `raw` is a URL the server may safely fetch on a tenant's
 * behalf. Throws UnsafeWebhookUrlError with a user-facing message on any
 * rejection; returns the parsed URL on success.
 */
export async function assertSafeWebhookUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeWebhookUrlError("That doesn't look like a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeWebhookUrlError("URL must start with http:// or https://.");
  }

  // URL.hostname keeps the brackets around an IPv6 literal (e.g. "[::1]")
  // — strip them before any IP check, or net.isIP()/isPrivateIp() never
  // recognize it as an IP at all and it falls through to the DNS-lookup
  // branch below with a hostname no resolver understands.
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new UnsafeWebhookUrlError("That address isn't reachable from outside FollowUp's own server.");
  }

  // An IP literal in the URL itself — no DNS involved, check it directly.
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new UnsafeWebhookUrlError("That address isn't reachable from outside FollowUp's own server.");
    }
    return url;
  }

  // A real hostname — resolve every address it answers with (not just the
  // first) and reject if any of them is private. A hostname can legally
  // round-robin between a public and a private answer.
  let addresses: { address: string }[];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new UnsafeWebhookUrlError("Couldn't resolve that hostname.");
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) {
    throw new UnsafeWebhookUrlError("That address isn't reachable from outside FollowUp's own server.");
  }
  return url;
}
