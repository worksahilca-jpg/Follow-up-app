import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
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
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return true; // malformed — fail closed
  const [a, b, c] = parts;
  if (a === 127) return true; // loopback (127.0.0.0/8)
  if (a === 10) return true; // RFC1918
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 169 && b === 254) return true; // link-local, incl. the cloud metadata IP
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT (100.64.0.0/10) — some clouds put internal services here
  if (a === 192 && b === 0 && c === 0) return true; // IETF protocol assignments (192.0.0.0/24)
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking (198.18.0.0/15), used for internal fabrics
  if (a === 0) return true; // "this network"
  if (a >= 224) return true; // multicast (224-239) + reserved (240-255)
  return false;
}

/**
 * An IPv6 address as its eight 16-bit groups, or null if it is not one.
 *
 * Needed because the textual form cannot be pattern-matched: the WHATWG URL
 * parser rewrites `[::ffff:127.0.0.1]` to `[::ffff:7f00:1]`, so a check for
 * the dotted form never sees the loopback address it carries (security
 * audit 2026-09-26, A-2). Working on the numbers makes every spelling of an
 * address the same address.
 */
function ipv6Groups(ip: string): number[] | null {
  let s = ip.toLowerCase();
  const zone = s.indexOf("%");
  if (zone >= 0) s = s.slice(0, zone);
  const dotted = s.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const p = dotted[2].split(".").map(Number);
    if (p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
    s = `${dotted[1]}${((p[0] << 8) | p[1]).toString(16)}:${((p[2] << 8) | p[3]).toString(16)}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = 8 - head.length - tail.length;
  if (halves.length === 1 ? fill !== 0 : fill < 1) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? fill : 0).fill("0"), ...tail];
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((g) => parseInt(g, 16));
}

function embeddedV4(hi: number, lo: number): string {
  return `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
}

function isPrivateIPv6(ip: string): boolean {
  const g = ipv6Groups(ip);
  if (!g) return true; // unparseable — fail closed
  const zeros = (from: number, to: number) => g.slice(from, to).every((x) => x === 0);

  // ::/96 — unspecified (::), loopback (::1) and the deprecated
  // IPv4-compatible form (::a.b.c.d); and ::ffff:0:0/96, IPv4-mapped. Both
  // carry an IPv4 address in the last 32 bits that the socket really dials.
  if (zeros(0, 5) && (g[5] === 0 || g[5] === 0xffff)) {
    if (g[5] === 0 && g[6] === 0) return true; // ::, ::1, and anything else in ::/112
    return isPrivateIPv4(embeddedV4(g[6], g[7]));
  }
  // ::ffff:0:a.b.c.d — IPv4-translated (RFC 2765).
  if (zeros(0, 4) && g[4] === 0xffff && g[5] === 0) return isPrivateIPv4(embeddedV4(g[6], g[7]));
  // 64:ff9b::/96 — NAT64 well-known prefix; 64:ff9b:1::/48 — local-use NAT64.
  if (g[0] === 0x64 && g[1] === 0xff9b) {
    if (zeros(2, 6)) return isPrivateIPv4(embeddedV4(g[6], g[7]));
    return true;
  }
  // 2002::/16 — 6to4, the IPv4 address sits in groups 1-2.
  if (g[0] === 0x2002) return isPrivateIPv4(embeddedV4(g[1], g[2]));
  // 2001::/32 — Teredo, an obfuscated tunnel to an arbitrary IPv4 host.
  if (g[0] === 0x2001 && g[1] === 0) return true;
  if ((g[0] & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
  if ((g[0] & 0xffc0) === 0xfec0) return true; // site-local fec0::/10 (deprecated, still routed internally)
  if ((g[0] & 0xfe00) === 0xfc00) return true; // unique local fc00::/7
  if ((g[0] & 0xff00) === 0xff00) return true; // multicast ff00::/8
  if (g[0] === 0x100 && zeros(1, 4)) return true; // discard-only 100::/64
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

type LookupAddress = { address: string; family: number };
type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/**
 * A `lookup` for node:http(s) that refuses to CONNECT to a private address.
 *
 * assertSafeWebhookUrl() resolves the hostname and checks it, but `fetch`
 * then resolves it again on its own. A hostname whose DNS answers
 * alternate between a public and a private address (DNS rebinding, a
 * service anyone can use) passes the first lookup and is dialled on the
 * second (security audit 2026-09-26, A-2). This is the lookup the socket
 * actually uses, so what is checked is what is connected to.
 */
export function guardedLookup(
  hostname: string,
  options: { all?: boolean; family?: number | string } | number | undefined,
  callback: LookupCallback
): void {
  const wantAll = typeof options === "object" && options !== null && options.all === true;
  dns
    .lookup(hostname, { all: true })
    .then((addresses) => {
      if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) {
        const err: NodeJS.ErrnoException = new UnsafeWebhookUrlError(
          "That address isn't reachable from outside FollowUp's own server."
        );
        err.code = "EUNSAFEADDRESS";
        callback(err, wantAll ? [] : "", 0);
        return;
      }
      if (wantAll) callback(null, addresses);
      else callback(null, addresses[0].address, addresses[0].family);
    })
    .catch((err: NodeJS.ErrnoException) => callback(err, wantAll ? [] : "", 0));
}

/**
 * POST a JSON body to a tenant-supplied URL and report the status code.
 *
 * The one way FollowUp's server should call a URL a customer typed in.
 * Validates the URL (scheme, IP literal, every resolved address), then
 * connects through guardedLookup so the address dialled is re-checked at
 * connect time. Never follows a redirect (node:http has no redirect
 * handling at all, which is the point — a public host answering 302 to an
 * internal one gets nothing). The response body is never read; the caller
 * learns the status and nothing else.
 */
export async function postJsonToTenantUrl(
  raw: string,
  payload: unknown,
  { timeoutMs = 8000 }: { timeoutMs?: number } = {}
): Promise<{ status: number }> {
  const url = await assertSafeWebhookUrl(raw);
  const body = JSON.stringify(payload);
  const client = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.request(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
        lookup: guardedLookup as unknown as net.LookupFunction,
        signal: AbortSignal.timeout(timeoutMs),
      },
      (res) => {
        // The status is all anyone reads. Stop there rather than drain a
        // body an endpoint could stream for as long as it likes.
        resolve({ status: res.statusCode ?? 0 });
        res.destroy();
      }
    );
    req.on("error", reject);
    req.end(body);
  });
}
