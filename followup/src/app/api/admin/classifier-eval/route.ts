import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { runClassifierEval } from "@/lib/classifierEval";

// About a hundred cases (src/lib/classifierEval.ts), each one or two model calls, six at a time.
export const maxDuration = 300;

/**
 * A browser tells us where a request came from (Sec-Fetch-Site). Anything
 * from another site, or a sibling subdomain, is refused. An absent header
 * is a non-browser client (curl with a copied cookie), which cannot be
 * tricked into sending a request by a page it visits, so it is allowed.
 */
function fromAnotherSite(request: NextRequest): boolean {
  const site = request.headers.get("sec-fetch-site");
  return site === "cross-site" || site === "same-site";
}

// POST /api/admin/classifier-eval — run the lead check against the real
// model on a fixed set of invented emails with known answers (see
// src/lib/classifierEval.ts), and report which it got wrong.
//
// POST, not GET (backlog b004). This used to be a GET you opened in the
// browser, which meant any other site could start it while a platform
// admin was signed in: a link, a redirect or a window.open is a top-level
// GET navigation, and the session cookie (SameSite=Lax) rides along on
// those. Each run is 100-200 paid model calls. A cross-site POST does not
// carry a Lax cookie, which is the same protection every other
// state-changing admin route here relies on (/api/office/run is POST for
// the same reason), and the Sec-Fetch-Site check below is a second lock
// that holds even if the cookie's SameSite setting ever changes.
//
// To run it: signed in as a platform admin, in the browser console on the
// app's own origin:
//   await (await fetch("/api/admin/classifier-eval", { method: "POST" })).json()
//
// Gated by PLATFORM_ADMIN_EMAILS like /api/office/run; anyone else gets a
// 404, so the route doesn't confirm it exists.
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isPlatformAdmin(session?.user?.email)) {
    return NextResponse.json({ success: false, message: "Not found." }, { status: 404 });
  }
  if (fromAnotherSite(request)) {
    return NextResponse.json({ success: false, message: "Refused: this request came from another site." }, { status: 403 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ success: false, message: "OPENAI_API_KEY is not set on this deployment." }, { status: 503 });
  }

  const result = await runClassifierEval();
  return NextResponse.json({ success: result.failed === 0 && result.errors === 0, ...result });
}

// GET never runs anything. It answers 404 to everyone but a platform admin
// (the same "doesn't confirm it exists" rule as above), and tells the admin
// how to run it now that opening the URL no longer does.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isPlatformAdmin(session?.user?.email)) {
    return NextResponse.json({ success: false, message: "Not found." }, { status: 404 });
  }
  return NextResponse.json(
    {
      success: false,
      message:
        'The lead check now runs on POST only. From the browser console on this site: await (await fetch("/api/admin/classifier-eval", { method: "POST" })).json()',
    },
    { status: 405, headers: { Allow: "POST" } }
  );
}
