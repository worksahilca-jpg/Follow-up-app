import type { Lead } from "@prisma/client";
import { prisma } from "@/lib/db";
import { pickAssignee } from "@/lib/assignment";

/**
 * Callers who hide their number (founder, 2026-09-30). Twilio still fills
 * in `From` for them, with the keypad spelling of a word (ANONYMOUS comes
 * through as +266696687) or, on some carriers, the word itself. Treated as
 * a phone number, every hidden caller landed on ONE customer, so three
 * strangers' voicemails shared a card, and the missed-call text went to a
 * number that doesn't exist.
 *
 * Now each hidden-number call is its own customer, "Hidden number", found
 * again by Twilio's id for that call so its voicemail or AI-answered
 * transcript lands on the right card. No phone is stored, and automatic
 * follow-up is off from the start: there is nothing to text or email.
 */
const HIDDEN_WORDS = ["anonymous", "unavailable", "restricted", "blocked", "unknown", "private", "withheld"];

const KEYPAD: Record<string, string> = { a: "2", b: "2", c: "2", d: "3", e: "3", f: "3", g: "4", h: "4", i: "4", j: "5", k: "5", l: "5", m: "6", n: "6", o: "6", p: "7", q: "7", r: "7", s: "7", t: "8", u: "8", v: "8", w: "9", x: "9", y: "9", z: "9" };
const HIDDEN_NUMBERS = new Set(HIDDEN_WORDS.map((w) => "+" + [...w].map((c) => KEYPAD[c]).join("")));

export const HIDDEN_CALLER_NAME = "Hidden number";

export function isHiddenCaller(from: string | null | undefined): boolean {
  const value = (from ?? "").trim().toLowerCase();
  if (!value) return false;
  if (HIDDEN_WORDS.includes(value)) return true;
  return HIDDEN_NUMBERS.has(value.replace(/[^\d+]/g, ""));
}

/**
 * One customer per hidden-number call. With the call's id, the same call
 * (the ring, then its voicemail) always finds the same card; without one,
 * every call gets a new card, which is still better than merging strangers.
 */
export async function findOrCreateHiddenCallerLead(businessId: string, callSid: string | null | undefined): Promise<Lead> {
  const sid = callSid?.trim() || null;
  if (sid) {
    const existing = await prisma.lead.findFirst({ where: { businessId, hiddenCallSid: sid } });
    if (existing) return prisma.lead.update({ where: { id: existing.id }, data: { lastContacted: new Date() } });
  }
  try {
    const lead = await prisma.lead.create({
      data: {
        businessId,
        name: HIDDEN_CALLER_NAME,
        phone: null,
        hiddenCallSid: sid,
        source: "Phone call",
        stage: "NEW",
        automationTier: "OFF",
        lastContacted: new Date(),
        assignedToId: await pickAssignee(businessId),
      },
    });
    // No source routing: a "Phone call" rule could turn follow-up on or
    // start a workflow, and there is no one to send either to.
    return lead;
  } catch (err) {
    // Twilio retried the same call while the first request was creating it.
    if (sid && err && typeof err === "object" && "code" in err && err.code === "P2002") {
      const winner = await prisma.lead.findFirst({ where: { businessId, hiddenCallSid: sid } });
      if (winner) return winner;
    }
    throw err;
  }
}
