import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { syncRoles } from "@/lib/office/roles";
import { runShift } from "@/lib/office/runner";

// A shift is one bounded model call, but a large context pack on a slow
// day can still outrun the default function timeout.
export const maxDuration = 120;

// POST /api/office/run — { roleKey } — work one shift at one desk, now.
//
// The office is meant to run on its own (see /api/cron/office); this is the
// button that lets you prove a desk works without waiting for Monday, and
// the one you reach for when you want an answer today. Same runner, same
// ceilings, same recorded run — the only difference is the trigger string.
//
// Gated by PLATFORM_ADMIN_EMAILS, the same founder-only allowlist as
// /admin — not a per-business TeamRole (see src/lib/platformAdmin.ts for
// why those are different things). The session's email is read here rather
// than accepted from the caller, and an unauthorized request gets a 404:
// this route doesn't confirm its own existence to someone who shouldn't
// know it's there.
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!isPlatformAdmin(email)) {
    return NextResponse.json({ success: false, message: "Not found." }, { status: 404 });
  }

  let roleKey: string;
  try {
    const body = (await request.json()) as { roleKey?: unknown };
    if (typeof body.roleKey !== "string" || !body.roleKey) throw new Error("roleKey is required.");
    roleKey = body.roleKey;
  } catch {
    return NextResponse.json({ success: false, message: "Which desk?" }, { status: 400 });
  }

  try {
    await syncRoles();
    const result = await runShift({ roleKey, trigger: `manual:${email}` });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "The shift could not be started.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
