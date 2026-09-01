import { NextResponse } from "next/server";
import { fetchSalesConversations } from "@/lib/integrations/gmail";

// POST /api/integrations/gmail/sync — pulls recent inbox threads and
// upserts them as real Lead/Conversation/Message rows. Triggered by the
// "Sync now" button on Settings once Gmail is connected.
export async function POST() {
  try {
    const leads = await fetchSalesConversations();
    return NextResponse.json({ success: true, count: leads.length, leads });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gmail sync failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
