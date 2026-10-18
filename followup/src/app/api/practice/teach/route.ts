import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { parseJsonBody, cleanedText } from "@/lib/validation";
import { deleteOwnerExample, saveOwnerExample } from "@/lib/ownerExamples";
import { MAX_EXAMPLE_TEXT } from "@/lib/ownerExampleLines";

/** Writes only, no AI call; this keeps a runaway page from filling the table. */
const TEACH_PER_DAY = 100;

const bodySchema = z.object({
  channel: z.enum(["email", "instagram", "messenger"]),
  customerSaid: cleanedText(MAX_EXAMPLE_TEXT),
  reply: cleanedText(MAX_EXAMPLE_TEXT),
});

/**
 * POST /api/practice/teach — "Write it better" (A-290): keep what the owner would really say in place of a FollowUp
 * reply, so every later draft for this business answers that moment their way (src/lib/ownerExamples.ts).
 * DELETE ?id= — undo one, this business's only.
 */
export async function POST(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const { channel, customerSaid, reply } = parsed.data;
  if (!customerSaid || !reply) {
    return NextResponse.json({ success: false, message: "Write what you'd say first." }, { status: 400 });
  }
  if (await tooManyRecentActions(ctx.businessId, "practice.teach", { windowMinutes: 24 * 60, max: TEACH_PER_DAY })) {
    return NextResponse.json({ success: false, message: "That's a lot for one day. Try again tomorrow." }, { status: 429 });
  }
  const { id } = await saveOwnerExample(ctx.businessId, ctx.userId, { channel, customerSaid, reply });
  return NextResponse.json({ success: true, id });
}

export async function DELETE(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id")?.slice(0, 64);
  if (!id) return NextResponse.json({ success: false, message: "Nothing to undo." }, { status: 400 });
  await deleteOwnerExample(ctx.businessId, id);
  return NextResponse.json({ success: true });
}
