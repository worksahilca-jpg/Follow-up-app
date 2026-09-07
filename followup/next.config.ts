import type { NextConfig } from "next";

/**
 * Security headers, applied to every response. The one deliberate
 * exception is /embed/* — the website lead-capture widget is meant to be
 * placed inside customers' own pages, so it alone may be framed. Everything
 * else refuses to be framed (clickjacking), refuses MIME sniffing, sends no
 * referrer to third parties, opts out of browser features the app doesn't
 * use, and pins HTTPS for a year.
 *
 * The Content-Security-Policy is deliberately moderate rather than strict:
 * Next.js and the inline styles/scripts it emits need 'unsafe-inline', and
 * Stripe Checkout/Portal are the only third-party frames and connections.
 * Tighten (nonces) once there's a test that exercises every page.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://api.stripe.com https://*.supabase.co",
  "frame-src https://js.stripe.com https://checkout.stripe.com https://billing.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com https://billing.stripe.com https://accounts.google.com",
  "upgrade-insecure-requests",
].join("; ");

const baseHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Everything except the embeddable widget: never framed.
        source: "/((?!embed/).*)",
        headers: [
          ...baseHeaders,
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: `${csp}; frame-ancestors 'none'` },
        ],
      },
      {
        // The widget page customers put on their own sites: frameable by anyone.
        source: "/embed/:path*",
        headers: [...baseHeaders, { key: "Content-Security-Policy", value: `${csp}; frame-ancestors *` }],
      },
    ];
  },
};

export default nextConfig;
