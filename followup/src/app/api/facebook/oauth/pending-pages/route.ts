import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { decryptSecret } from "@/lib/crypto";
import type { ManagedPage } from "@/lib/facebook";

// GET — the picker UI's data source after a multi-Page OAuth callback.
// Names only; tokens never leave the server (see select-page/route.ts).
export async function GET(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  const raw = request.cookies.get("fb_pending_pages")?.value;
  if (!raw) return NextResponse.json({ success: true, pages: [] });
  try {
    const pages = JSON.parse(decryptSecret(raw)) as ManagedPage[];
    return NextResponse.json({ success: true, pages: pages.map((p) => ({ id: p.id, name: p.name })) });
  } catch {
    return NextResponse.json({ success: true, pages: [] });
  }
}
