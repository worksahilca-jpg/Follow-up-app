import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { deleteRealChat, saveRealChat, type RealChatInput } from "@/lib/realChats";

/** Same rule as the accuracy-test routes: a request started by another site is refused. */
function fromAnotherSite(request: NextRequest): boolean {
  const site = request.headers.get("sec-fetch-site");
  return site === "cross-site" || site === "same-site";
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

// POST /api/admin/real-chats — keep a real conversation, cleaned, as a test case ({ action: "add", … }), or remove one
// ({ action: "delete", id }). Platform admins only, never from another site (src/lib/realChats.ts).
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isPlatformAdmin(session?.user?.email)) {
    return NextResponse.json({ success: false, message: "Not found." }, { status: 404 });
  }
  if (fromAnotherSite(request)) {
    return NextResponse.json({ success: false, message: "Refused: this request came from another site." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ success: false, message: "Nothing was sent." }, { status: 400 });

  if (body.action === "delete") {
    const id = str(body.id);
    if (!id || id.length > 40) return NextResponse.json({ success: false, message: "Which chat?" }, { status: 400 });
    const gone = await deleteRealChat(id);
    return NextResponse.json({ success: gone }, { status: gone ? 200 : 404 });
  }

  if (body.action !== "add") return NextResponse.json({ success: false, message: "Add or delete only." }, { status: 400 });
  const n = (body.next ?? {}) as Record<string, unknown>;
  const next: RealChatInput["next"] =
    n.kind === "followup"
      ? { kind: "followup", daysQuiet: Number(n.daysQuiet) }
      : n.kind === "stop"
        ? { kind: "stop", shouldStop: n.shouldStop === true }
        : { kind: "reply" };
  const input: RealChatInput = {
    name: str(body.name),
    trade: str(body.trade),
    channel: str(body.channel),
    pasted: str(body.pasted).slice(0, 40_000),
    customerNames: str(body.customerNames).slice(0, 1_000),
    businessNames: str(body.businessNames).slice(0, 1_000),
    next,
    asks: str(body.asks).slice(0, 4_000),
    told: str(body.told).slice(0, 4_000),
    expect: str(body.expect),
    closing: body.closing === true,
    consent: str(body.consent),
  };
  const out = await saveRealChat(input);
  if (!out.ok) return NextResponse.json({ success: false, message: out.error }, { status: 400 });
  return NextResponse.json({ success: true, id: out.id });
}
