import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

/**
 * Security headers, applied to every response. The one deliberate
 * exception is /embed/* — the website lead-capture widget is meant to be
 * placed inside customers' own pages, so it alone may be framed. Everything
 * else refuses to be framed (clickjacking), refuses MIME sniffing, sends no
 * referrer to third parties, opts out of browser features the app doesn't
 * use, and pins HTTPS for a year.
 *
 * The Content-Security-Policy is deliberately moderate rather than strict:
 * Next.js and the inline scripts it emits need 'unsafe-inline' unless every
 * page is rendered dynamically with a per-request nonce (see
 * node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md).
 * That trade is written up, not taken, in
 * research/audit/2026-09-26-security-hardening-perimeter.md.
 *
 * Every third-party origin below is here because something in the app
 * actually loads from it — an origin nothing uses is only attack surface.
 * 2026-09-26 removed the ones nothing used: js.stripe.com / api.stripe.com /
 * Stripe frames (Checkout and the Portal are full-page redirects via
 * window.location.assign in Settings, never Stripe.js or a frame),
 * *.supabase.co (the browser never talks to Supabase — Prisma does, from the
 * server), and fonts.googleapis.com / fonts.gstatic.com (next/font/google
 * self-hosts the font files at build time; the only runtime fetch of
 * Google Fonts is server-side, in src/app/opengraph-image.tsx).
 *
 * vercel.live is the Vercel Toolbar/comments script (Project Settings ->
 * Vercel Toolbar -> Production Deployments: On) — required per
 * https://vercel.com/docs/vercel-toolbar/managing-toolbar. Without these,
 * the toolbar's own script/websocket/frame get silently CSP-blocked even
 * once the script itself loads; team-only (gated by a Vercel-session
 * cookie), so this never exposes anything to an ordinary visitor.
 */
const isDev = process.env.NODE_ENV === "development";

const appCsp = [
  "default-src 'self'",
  // connect.facebook.net / www.facebook.com: Meta's JavaScript SDK, loaded
  // only on Settings → WhatsApp for the Embedded Signup popup
  // (src/lib/useWhatsAppSignup.ts). The SDK is a script plus a hidden
  // status frame; the signup itself runs in a popup window, outside CSP.
  //
  // 'unsafe-eval' stays in production for now ONLY because Meta's SDK is
  // reported to need it and that could not be verified from the audit
  // sandbox (connect.facebook.net is egress-blocked there). Next.js and
  // React do not need it in production. Drop it once the WhatsApp
  // Embedded Signup has been tried on a preview deploy without it.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://connect.facebook.net",
  "style-src 'self' 'unsafe-inline' https://vercel.live",
  "font-src 'self' https://assets.vercel.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://vercel.live wss://ws-us3.pusher.com https://www.facebook.com https://graph.facebook.com",
  "frame-src https://vercel.live https://www.facebook.com https://web.facebook.com",
  "object-src 'none'",
  "base-uri 'self'",
  // accounts.google.com: sign-in POSTs to next-auth, which answers with a
  // redirect to Google — form-action governs that redirect too.
  "form-action 'self' https://accounts.google.com",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

/**
 * The public booking page (/book/[leadId]) — a lead arriving from a link
 * in an email, never a signed-in user on their way to Settings, so it
 * never needs Meta's SDK and never needs eval. Same policy as the app
 * otherwise, including frame-ancestors 'none' (nobody embeds it). It can't
 * client-side navigate into the app, which matters: a CSP belongs to the
 * document, so a soft navigation onward would carry this stricter policy
 * into pages that load the SDK.
 */
const bookCsp = appCsp
  .replace(" 'unsafe-eval'", isDev ? " 'unsafe-eval'" : "")
  .replace(" https://connect.facebook.net", "")
  .replace(" https://www.facebook.com https://graph.facebook.com", "")
  .replace(" https://www.facebook.com https://web.facebook.com", "");

/**
 * The widget runs inside strangers' pages, so it gets its own, much
 * narrower policy rather than the app's: it renders one form and talks to
 * one same-origin endpoint (src/app/embed/[businessId]/page.tsx →
 * /api/embed/[businessId]/lead). No Meta SDK, no toolbar, no eval outside
 * `next dev`, no frames of its own. frame-ancestors * is the point of the
 * route: a customer's site, on whatever domain, may frame it.
 */
const embedCsp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors *",
  "upgrade-insecure-requests",
].join("; ");

/**
 * Every browser capability the app never asks for, switched off for this
 * page and anything it frames. payment=(self) is kept only because it
 * already was; nothing uses the Payment Request API today. Only feature
 * names Chromium recognises are listed — an unknown one is a console
 * warning on every page.
 */
const permissionsPolicy = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "payment=(self)",
  "usb=()",
  "serial=()",
  "hid=()",
  "midi=()",
  "accelerometer=()",
  "gyroscope=()",
  "magnetometer=()",
  "display-capture=()",
  "xr-spatial-tracking=()",
  "browsing-topics=()",
].join(", ");

const commonHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: permissionsPolicy },
  // Two years, the value hstspreload.org asks for. `preload` itself is
  // deliberately absent: it is a near-irreversible commitment for every
  // subdomain, and only means anything once the apex (followupbase.io,
  // redirected by Vercel before this config runs) serves HSTS too — a
  // founder decision, in research/audit/2026-09-26-security-hardening-
  // perimeter.md's checklist.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Everything except the embeddable widget: never framed.
        source: "/((?!embed/).*)",
        headers: [
          ...commonHeaders,
          { key: "Content-Security-Policy", value: appCsp },
          { key: "X-Frame-Options", value: "DENY" },
          // Cuts the link between this tab and any cross-origin page that
          // opened it (reverse tabnabbing, window.opener probing). The
          // allow-popups variant keeps the one popup the app opens itself
          // — Meta's WhatsApp Embedded Signup, which reports back with
          // postMessage to window.opener — working.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
        ],
      },
      {
        // Public booking page: the app's headers from the rule above, with
        // a narrower CSP. Listed after it so this value wins (Next applies
        // the last matching rule's value for a repeated key).
        source: "/book/:path*",
        headers: [{ key: "Content-Security-Policy", value: bookCsp }],
      },
      {
        // The widget page customers put on their own sites: frameable by anyone.
        source: "/embed/:path*",
        headers: [...commonHeaders, { key: "Content-Security-Policy", value: embedCsp }],
      },
      {
        // API responses are for this origin's own pages and for
        // server-to-server callers (webhooks, cron), never for another
        // site's <script>/<img> tag. CORP only affects those no-cors
        // browser loads — never navigations, fetches from our own pages, or
        // provider webhooks — so nothing legitimate is refused.
        source: "/api/:path*",
        headers: [{ key: "Cross-Origin-Resource-Policy", value: "same-origin" }],
      },
    ];
  },
};

/**
 * Wraps the config to upload source maps (only when SENTRY_AUTH_TOKEN is
 * set — silently skipped otherwise, never fails the build) and tunnel the
 * browser SDK's error/trace beacons through this app's own origin at
 * /monitoring rather than posting straight to sentry.io. Two reasons:
 * an ad-blocker won't silently eat error reports the way it does a
 * direct sentry.io request, and connect-src 'self' — already in the CSP
 * above for the app's own API calls — covers it with no CSP change needed.
 */
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.SENTRY_AUTH_TOKEN,
  tunnelRoute: "/monitoring",
  widenClientFileUpload: true,
  webpack: {
    treeshake: { removeDebugLogging: true },
    automaticVercelMonitors: false,
  },
});
