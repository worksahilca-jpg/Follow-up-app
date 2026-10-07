# CASA practice scan — 2026-10-07

A free dry run of the CASA AL1 (Tier 2) dynamic scan, before paying a lab. Google asked for the real one by
Jan 4, 2027 (verification email, 2026-10-06). The founder has no budget for it yet, so this finds and fixes what a
lab's scanner would flag first.

**Tool:** OWASP ZAP 2.16.1 quick scan (spider + active scan), the kind of DAST scan CASA labs run.
**Target:** the production build (`next build` + `next start`) on a local database with test data.
**Runs:** two. One signed out, from `/`. One signed in as a test admin (session cookie injected), from `/dashboard`.

## Result: no High findings, nothing exploitable

Neither run found SQL injection, XSS, path traversal, open redirect, missing auth, cookie or session problems, or
information leaks with private data. Every Medium finding is about the Content-Security-Policy header.

| Risk | Finding | Status |
|---|---|---|
| Medium | CSP: wildcard directive (`img-src https:`) | **Fixed in this change.** The app loads no remote images, so `img-src` is now `'self' data: blob:` plus the Vercel toolbar. Checked in a browser: no blocked or broken image on any main page. |
| Medium | CSP: `script-src 'unsafe-eval'` | **Planned.** The stricter policy without it has run in Report-Only since 2026-10-05 (`appCspReportOnly`). After a clean week (around 2026-10-12), with the WhatsApp Embedded Signup tried on a preview, it comes out of `appCsp`. |
| Medium | CSP: `script-src 'unsafe-inline'` | **Open, needs a decision.** Removing it means a per-request nonce, which makes every page server-rendered, the landing page included (cost and speed). See `2026-09-26-security-hardening-perimeter.md`. |
| Medium | CSP: `style-src 'unsafe-inline'` | **Accepted.** React inline `style` attributes need it. This is a common, low-risk exception. |
| Medium | CSP: `frame-ancestors *` on `/embed` | **By design.** The lead-capture widget exists to be framed on customers' own sites. It has its own narrow policy (no eval, no frames, same-origin connect). |
| Low | "Big redirect" on signed-out `/analytics`, `/dashboard` etc. | **Accepted.** The 307 to `/signin` carries the page shell (title only); checked, no private data. |
| Info | Suspicious comments in JS chunks, modern web app, user-agent fuzzer, content-type on 404s | No action. These come from framework bundles and 404 pages. |

## For the real assessment

- Give the lab a **test business with no real customer data**, never a real owner's login.
- The questionnaire answers can come from `docs/security.md`, `docs/incident-response.md` and the privacy page's
  "How we protect your data" section.
- Re-run this scan after any change to `next.config.ts` headers, auth or new public routes.
