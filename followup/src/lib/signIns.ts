/**
 * Sign-ins, and the email when one comes from somewhere new (design brain
 * A-041, from the Mercury study: tell people when their account is used).
 *
 * What is kept is deliberately coarse: "Chrome on Mac" and "Toronto,
 * Canada". The raw user agent and the IP address are never stored; the
 * place comes from the geo headers Vercel adds to every request, so no
 * lookup service sees anything.
 *
 * Nothing here may ever stop a sign-in. Every failure is logged and
 * swallowed; the worst case is a sign-in that isn't listed.
 */
import { after } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { sendAlertEmail } from "@/lib/alertEmail";
import { appUrl } from "@/lib/stripe";

export const SIGN_IN_KEEP_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

/** "Chrome on Mac" from a user agent. Order matters: Edge and Opera also say Chrome, Chrome also says Safari. */
export function describeDevice(userAgent: string | null | undefined): string {
  const ua = userAgent ?? "";
  const browser = /Edg(e|A|iOS)?\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /SamsungBrowser\//.test(ua)
        ? "Samsung Internet"
        : /Firefox\/|FxiOS\//.test(ua)
          ? "Firefox"
          : /Chrome\/|CriOS\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : null;
  const system = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /CrOS/.test(ua)
          ? "Chromebook"
          : /Mac OS X|Macintosh/.test(ua)
            ? "Mac"
            : /Windows/.test(ua)
              ? "Windows"
              : /Linux/.test(ua)
                ? "Linux"
                : null;
  if (browser && system) return `${browser} on ${system}`;
  return browser ?? (system ? `A browser on ${system}` : "An unknown browser");
}

/** "Toronto, Canada" from Vercel's x-vercel-ip-city (URL-encoded) and x-vercel-ip-country (ISO code). */
export function describePlace(city: string | null | undefined, country: string | null | undefined): string | null {
  let cityName: string | null = null;
  if (city) {
    try {
      cityName = decodeURIComponent(city);
    } catch {
      cityName = city;
    }
  }
  let countryName: string | null = null;
  if (country && /^[A-Za-z]{2}$/.test(country)) {
    try {
      countryName = new Intl.DisplayNames(["en"], { type: "region" }).of(country.toUpperCase()) ?? country;
    } catch {
      countryName = country;
    }
  }
  if (cityName && countryName) return `${cityName}, ${countryName}`;
  return cityName ?? countryName;
}

type Seen = { device: string; place: string | null };

/** A sign-in is new when no earlier one had the same device AND the same place. */
export function isNewSignIn(earlier: Seen[], now: Seen): boolean {
  return !earlier.some((s) => s.device === now.device && (s.place ?? null) === (now.place ?? null));
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

function formatWhen(at: Date, timeZone: string): string {
  const opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone };
  try {
    return at.toLocaleString("en-US", opts).replace(/, (\d{1,2}:\d{2})/, " at $1");
  } catch {
    return at.toLocaleString("en-US", { ...opts, timeZone: "America/New_York" }).replace(/, (\d{1,2}:\d{2})/, " at $1");
  }
}

export function signInAlertEmail(p: { email: string; device: string; place: string | null; at: Date; timeZone: string; base: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const when = formatWhen(p.at, p.timeZone);
  const url = `${p.base}/settings#security`;
  const rows: [string, string][] = [["Device", p.device], ...(p.place ? ([["Near", p.place]] as [string, string][]) : []), ["When", when]];
  const intro = `Someone signed in as ${p.email} from a device we haven't seen before.`;
  const ok = "If this was you, you don't need to do anything.";
  const google = "Then change your Google password. You sign in to FollowUp with Google, so your Google account is the key.";
  const why = "FollowUp emails you whenever your account is signed in from a new device. You can see recent sign-ins in Settings.";
  return {
    subject: "New sign-in to FollowUp",
    text: [
      "Your account was signed in on a new device.",
      "",
      intro,
      "",
      ...rows.map(([k, v]) => `${k}: ${v}`),
      "",
      ok,
      "",
      `Not you? Sign out everywhere: ${url}`,
      google,
      "",
      why,
    ].join("\n"),
    html:
      `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#0a0a0a;max-width:520px">` +
      `<p style="margin:0 0 8px;font-size:20px;line-height:1.3">Your account was signed in on a new device.</p>` +
      `<p style="margin:0 0 16px;color:#57534e">${escapeHtml(intro)}</p>` +
      `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px">` +
      rows
        .map(
          ([k, v], i) =>
            `<tr><td style="padding:8px 16px 8px 0;color:#736e68;font-size:14px;${i ? "border-top:1px solid #f0eeeb;" : ""}">${escapeHtml(k)}</td>` +
            `<td style="padding:8px 0;${i ? "border-top:1px solid #f0eeeb;" : ""}">${escapeHtml(v)}</td></tr>`
        )
        .join("") +
      `</table>` +
      `<p style="margin:0 0 20px">${escapeHtml(ok)}</p>` +
      `<p style="margin:0 0 12px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px">Not you? Sign out everywhere</a></p>` +
      `<p style="margin:0 0 24px;color:#736e68;font-size:13.5px">${escapeHtml(google)}</p>` +
      `<p style="margin:0;color:#736e68;font-size:13px">${escapeHtml(why)}</p>` +
      `</div>`,
  };
}

export type SignInRequest = { userAgent: string | null; city: string | null; country: string | null };

/**
 * Record one sign-in and, when it comes from a device or place this person
 * hasn't used in the last 90 days, email them. With no sign-ins in those
 * 90 days to compare against (a first sign-in, the first one after this
 * shipped, or a return after a long break) it is recorded but not emailed:
 * "new" would be true of every device, and an email that always comes
 * says nothing.
 */
export async function recordSignIn(email: string, req: SignInRequest, now: Date = new Date()): Promise<{ recorded: boolean; emailed: boolean }> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, email: true, business: { select: { timezone: true } } },
  });
  if (!user) return { recorded: false, emailed: false };

  const current = { device: describeDevice(req.userAgent), place: describePlace(req.city, req.country) };
  const since = new Date(now.getTime() - SIGN_IN_KEEP_DAYS * DAY_MS);
  const earlier = await prisma.signIn.findMany({
    where: { userId: user.id, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { device: true, place: true },
  });
  const row = await prisma.signIn.create({ data: { userId: user.id, device: current.device, place: current.place, createdAt: now } });
  await prisma.signIn.deleteMany({ where: { userId: user.id, createdAt: { lt: since } } });

  if (earlier.length === 0 || !isNewSignIn(earlier, current)) return { recorded: true, emailed: false };
  const content = signInAlertEmail({
    email: user.email,
    device: current.device,
    place: current.place,
    at: now,
    timeZone: user.business?.timezone ?? "America/New_York",
    base: appUrl(),
  });
  const sent = await sendAlertEmail({ to: user.email, ...content, idempotencyKey: `signin-${row.id}` });
  return { recorded: true, emailed: sent.sent };
}

/**
 * Called from the JWT callback right after a real Google sign-in. Reads
 * the request's headers there (they only exist inside the request), then
 * does the work after the response so signing in isn't slowed down.
 */
export async function captureSignIn(email: string | null | undefined): Promise<void> {
  if (!email) return;
  let req: SignInRequest;
  try {
    const h = await headers();
    req = { userAgent: h.get("user-agent"), city: h.get("x-vercel-ip-city"), country: h.get("x-vercel-ip-country") };
  } catch {
    return; // Not inside a request (a script or a test): nothing to record.
  }
  const work = () =>
    recordSignIn(email, req)
      .then(() => undefined)
      .catch((err) => console.error("Recording a sign-in failed:", err));
  try {
    after(work);
  } catch {
    await work();
  }
}
