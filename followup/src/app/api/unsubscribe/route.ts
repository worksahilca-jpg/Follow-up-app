/**
 * The unsubscribe endpoint. Public and unauthenticated by necessity — the
 * person clicking it is a lead, not a user, and requiring them to sign in
 * to stop receiving mail would make the link decorative.
 *
 * Authorisation is the signed token itself (src/lib/suppression.ts): it
 * names the business and the address, and cannot be forged or edited
 * without the app's signing secret. Nothing is enumerable — a token is not
 * a guessable id.
 *
 * Two verbs, on purpose:
 *
 *   POST — RFC 8058 one-click. Gmail and Outlook show their own
 *     "Unsubscribe" button next to the sender and POST to it directly.
 *     This is where most real unsubscribes happen.
 *
 *   GET  — the human clicking the link in the footer. It does NOT
 *     unsubscribe; it renders a page with a button that POSTs. Mail
 *     clients and security scanners routinely prefetch links in email, and
 *     a GET that acted would unsubscribe people who never clicked
 *     anything. That failure is invisible to everyone involved, which is
 *     what makes it worth a second page.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { suppress, verifyUnsubscribeToken } from "@/lib/suppression";

export const runtime = "nodejs";

function page(title: string, message: string, form?: { token: string; business: string }): NextResponse {
  // Self-contained and inline: this renders in a browser the lead opened
  // from their mail client, with no session and no app shell around it.
  const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]!));
  const body = form
    ? `<form method="POST">
         <input type="hidden" name="t" value="${esc(form.token)}">
         <button type="submit">Yes, stop automated follow-ups</button>
       </form>
       <p class="fine">${esc(form.business)} can still reply to you personally — this only stops the automatic ones.</p>`
    : "";

  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
     <meta name="viewport" content="width=device-width,initial-scale=1">
     <title>${esc(title)}</title>
     <style>
       :root{color-scheme:light}
       body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;
            background:#f6f8fb;color:#0b1f33;
            font:16px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
       main{max-width:32rem;background:#fff;border:1px solid rgba(11,31,51,.12);
            border-radius:12px;padding:28px}
       h1{font-size:21px;margin:0 0 10px}
       p{margin:0 0 14px;color:#46566b}
       .fine{font-size:14px;margin-top:14px;margin-bottom:0}
       button{font:inherit;font-weight:600;cursor:pointer;color:#fff;background:#0b1f33;
              border:0;border-radius:9px;padding:11px 18px}
       button:focus-visible{outline:2px solid #2a5cdb;outline-offset:2px}
     </style></head>
     <body><main><h1>${esc(title)}</h1><p>${esc(message)}</p>${body}</main></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

async function businessName(businessId: string): Promise<string> {
  const b = await prisma.business.findUnique({ where: { id: businessId }, select: { name: true } });
  return b?.name ?? "This business";
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t") ?? "";
  const claim = verifyUnsubscribeToken(token);
  if (!claim) {
    return page("This link isn't valid", "It may have been altered in transit. Reply to the email and ask them to stop — a person will see it.");
  }
  return page(
    "Stop automated follow-ups?",
    `We'll stop sending automated follow-up emails to ${claim.address}.`,
    { token, business: await businessName(claim.businessId) }
  );
}

export async function POST(request: NextRequest) {
  // One-click senders post form-encoded; the confirmation page posts a
  // form too. The token is also accepted from the query string because
  // some clients POST to the header URL verbatim without a body.
  let token = request.nextUrl.searchParams.get("t") ?? "";
  try {
    const form = await request.formData();
    token = (form.get("t") as string | null) ?? token;
  } catch {
    // No body, or not form-encoded — the query-string token stands.
  }

  const claim = verifyUnsubscribeToken(token);
  if (!claim) {
    return page("This link isn't valid", "It may have been altered in transit. Reply to the email and ask them to stop — a person will see it.");
  }

  // Idempotent: a prefetch followed by a real click, or a double tap, both
  // have to end in "you're unsubscribed" rather than an error.
  await suppress(claim.businessId, claim.address, "one_click");

  // Recorded so the business can answer "when did they unsubscribe, and
  // did we email them after?" — which is the question that matters if a
  // complaint ever arrives.
  void recordAudit({ businessId: claim.businessId }, "email.unsubscribed", {
    targetType: "email_address",
    meta: { address: claim.address, via: "one_click" },
  });

  return page(
    "You're unsubscribed",
    `${await businessName(claim.businessId)} will stop sending automated follow-ups to ${claim.address}.`
  );
}
