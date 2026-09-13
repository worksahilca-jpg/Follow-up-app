import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncRoles } from "@/lib/office/roles";
import { runShift } from "@/lib/office/runner";

// Desks run one after another rather than in parallel — a handful of live
// desks is not worth the concurrency, and serial runs keep the spend
// ceiling checks honest (two parallel shifts can both read "under budget"
// and both spend).
export const maxDuration = 300;

// GET /api/cron/office — the office clock. Invoked by Vercel Cron (see
// vercel.json), protected by CRON_SECRET exactly like every other cron
// route here.
//
// The *schedule* lives in vercel.json, not in this file: this runs every
// live desk it finds, so changing when the office opens is a one-line
// change there rather than a branch in here. Each desk's own runner
// decides whether there is anything to do — a shift with nothing to report
// is recorded, costs nothing, and calls no model.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    // Keeps the roster in step with src/lib/office/roles.ts on every tick,
    // so a newly written desk appears on the floor without a manual seed.
    await syncRoles();

    const live = await prisma.agentRole.findMany({
      where: { live: true, enabled: true },
      select: { key: true },
      orderBy: { key: "asc" },
    });

    const results = [];
    for (const role of live) {
      results.push({ roleKey: role.key, ...(await runShift({ roleKey: role.key, trigger: "cron" })) });
    }

    return NextResponse.json({ success: true, desks: live.length, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "The office run failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
