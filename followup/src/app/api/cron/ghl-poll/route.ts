import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cronAuth";
import { reportCronFailure } from "@/lib/monitoring";
import { pollGoHighLevelForAllBusinesses } from "@/lib/ghlPoll";
import { wakeGhlHistoryForAllBusinesses } from "@/lib/ghlHistory";
import { readGhlNotesForAllBusinesses } from "@/lib/ghlNotes";

// One request per connected GoHighLevel account, plus one per conversation with something new.
export const maxDuration = 300;

/**
 * GET /api/cron/ghl-poll — every two minutes (see vercel.json). Reads the texts and emails customers sent to the
 * owner's GoHighLevel (src/lib/ghlPoll.ts). Same CRON_SECRET protection as every other cron route.
 */
export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request, "ghl-poll");
  if (unauthorized) return unauthorized;

  try {
    const result = await pollGoHighLevelForAllBusinesses();
    // Then a few old customers brought back (src/lib/ghlHistory.ts). After the poll, so new messages always come
    // first, and on its own: a failure here never fails the poll.
    const wake = await wakeGhlHistoryForAllBusinesses().catch((err) => {
      reportCronFailure("ghl-poll", err, "wake-up");
      return { woken: 0, failed: 1 };
    });
    // Then a few customers' notes, like call notes (src/lib/ghlNotes.ts, A-303). Last, and on its own like the wake-up.
    const notes = await readGhlNotesForAllBusinesses().catch((err) => {
      reportCronFailure("ghl-poll", err, "notes");
      return { looked: 0, read: 0, failed: 1 };
    });
    return NextResponse.json({ success: true, ...result, woken: wake.woken, notesRead: notes.read });
  } catch (err) {
    reportCronFailure("ghl-poll", err);
    const message = err instanceof Error ? err.message : "GoHighLevel poll run failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
