import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { dismissHold } from "@/lib/pendingApprovals";

// POST /api/leads/[id]/dismiss-hold — the "Don't send" action in the
// dashboard's approval queue (src/components/ApprovalQueue.tsx). Declines
// a held draft without sending it or deleting the original "ai.hold"
// audit event; see dismissHold's own doc comment for how that drops the
// lead out of the queue.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const result = await dismissHold(id, ctx.businessId, ctx.userId);
  return NextResponse.json(result, { status: result.success ? 200 : 404 });
}
