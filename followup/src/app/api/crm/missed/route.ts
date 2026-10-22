import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { addMissedToCrm, setAutoAdd } from "@/lib/missedByCrmData";
import { ADD_ALL_MAX } from "@/lib/missedByCrm";

/**
 * "Missed by your CRM" (A-315), from Results and its "Not in {CRM}" list. Admins only, like the rest of the CRM's
 * controls; every action is the signed-in business's own.
 *
 * POST { action: "add", ids }: these customers into the CRM, each with their messages as a note.
 * POST { action: "add_all" }: everyone still missing (a tap adds at most ADD_ALL_MAX).
 * POST { action: "auto", on }: new customers go in by themselves, or not.
 */

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), ids: z.array(z.string().min(1).max(64)).min(1).max(ADD_ALL_MAX) }),
  z.object({ action: z.literal("add_all") }),
  z.object({ action: z.literal("auto"), on: z.boolean() }),
]);

const fail = (message: string, status: number) => NextResponse.json({ success: false, message }, { status });

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return fail("Not signed in.", 401);
  if (!(await requireAdmin(ctx))) return fail("Only an admin can do this.", 403);
  // Each add is a call to the owner's CRM; a stuck button or a script can't run it up.
  if (await tooManyRecentActions(ctx.businessId, "crm.missed", { windowMinutes: 60, max: 60 })) {
    return fail("Too many tries. Wait a few minutes and try again.", 429);
  }
  const parsed = await parseJsonBody(request, schema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  if (body.action === "auto") {
    if (!(await setAutoAdd(ctx.businessId, body.on))) return fail("No CRM is connected.", 400);
    void recordAudit(ctx, "integration.crm.auto_add", { meta: { on: body.on } });
    return NextResponse.json({ success: true, autoAdd: body.on });
  }

  const result = await addMissedToCrm(ctx.businessId, body.action === "add_all" ? "all" : body.ids);
  if ("error" in result) return fail(result.error, 400);
  // Counts only: no names, emails or words in the audit.
  void recordAudit(ctx, "integration.crm.add_missed", { meta: { added: result.added, failed: result.failed.length, all: body.action === "add_all" } });
  return NextResponse.json({ success: true, added: result.added, failed: result.failed });
}
