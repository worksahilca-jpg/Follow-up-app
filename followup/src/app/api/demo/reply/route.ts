import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cleanedText, parseJsonBody } from "@/lib/validation";
import { DEMO_MAX_QUESTION, claimDemoTry, demoVisitorKey, requestIp, writeDemoReply } from "@/lib/demoReply";

const demoSchema = z.object({ text: cleanedText(DEMO_MAX_QUESTION) });

/**
 * POST /api/demo/reply — the live answer behind the home page's "Try it
 * yourself". Public by design: the visitor hasn't signed up. Every limit
 * and why is in src/lib/demoReply.ts.
 *
 * Over a limit, or when the answer can't be written, the response is still
 * a success with `fallback: true`: the page then plays its fixed example
 * reply, so a visitor never sees an error in the middle of the demo.
 * `limited` says which limit, so the page can say these are example replies.
 */
export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, demoSchema);
  if (!parsed.ok) return parsed.response;
  const text = parsed.data.text;
  if (!text) {
    return NextResponse.json({ success: false, message: "Type a question first." }, { status: 400 });
  }

  const visitor = demoVisitorKey(requestIp(request.headers));
  if (!visitor) return NextResponse.json({ success: true, fallback: true });

  const refusal = await claimDemoTry(visitor);
  if (refusal) return NextResponse.json({ success: true, fallback: true, limited: refusal });

  const reply = await writeDemoReply(text);
  if (!reply) return NextResponse.json({ success: true, fallback: true });
  return NextResponse.json({ success: true, reply });
}
