import { prisma } from "@/lib/db";
import type { ChatCase } from "@/lib/conversationEval";
import { REPLY_EVAL_TRADE } from "@/lib/replyEval";
import { cleanChat, endsRight, LIMITS, parseChat, splitList, stepForDays, type RealLine, type RealNext } from "@/lib/realChatText";

/**
 * Real conversations as test cases (night plan A2, 2026-10-31). Every case in the accuracy tests was invented; the
 * founder offered to collect real chats from realtors ("Tell me, I'll help you to get all those conversations"). One
 * pasted on Admin → Accuracy tests is cleaned (src/lib/realChatText.ts), kept here, and run as its own row, "Real
 * conversations", by the same writers and checks as the invented ones.
 *
 * Only with the owner's OK, written down with the case. Nothing here links to a business or a customer record.
 */

export const REAL_PREFIX = "Real: ";

export type RealChatInput = {
  name: string;
  trade: string;
  channel: string;
  pasted: string;
  customerNames: string;
  businessNames: string;
  next: RealNext;
  asks: string;
  told: string;
  expect: string;
  closing: boolean;
  consent: string;
};

const CHANNELS = new Set(["email", "instagram", "messenger"]);

/** Checks and cleans what the founder entered; the same checks the page runs before it shows the preview. */
export function prepareRealChat(input: RealChatInput): { ok: true; lines: RealLine[] } | { ok: false; error: string } {
  if (!input.consent.trim()) return { ok: false, error: "Say who agreed to share this chat, and when." };
  const name = input.name.trim();
  if (!name || name.length > 120) return { ok: false, error: "Give the case a short name." };
  if (!input.trade.trim() || input.trade.length > 80) return { ok: false, error: "Pick the kind of business." };
  if (!CHANNELS.has(input.channel)) return { ok: false, error: "Pick where the chat happened." };
  const next = input.next;
  if (next.kind === "followup" && !(Number.isInteger(next.daysQuiet) && next.daysQuiet >= 1 && next.daysQuiet <= 60)) {
    return { ok: false, error: "Days quiet should be between 1 and 60." };
  }
  const parsed = parseChat(input.pasted);
  if (parsed.error) return { ok: false, error: parsed.error };
  const order = endsRight(parsed.lines, next);
  if (order) return { ok: false, error: order };
  const names = { customer: splitList(input.customerNames, LIMITS.names), business: splitList(input.businessNames, LIMITS.names) };
  return { ok: true, lines: cleanChat(parsed.lines, names, next) };
}

export async function saveRealChat(input: RealChatInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const ready = prepareRealChat(input);
  if (!ready.ok) return ready;
  const row = await prisma.realChatCase.create({
    data: {
      name: input.name.trim(),
      trade: input.trade.trim(),
      channel: input.channel,
      lines: ready.lines,
      next: input.next,
      asks: splitList(input.asks),
      told: splitList(input.told),
      expect: input.expect.trim().slice(0, LIMITS.expectChars) || null,
      closing: input.closing,
      consent: input.consent.trim().slice(0, 200),
    },
    select: { id: true },
  });
  return { ok: true, id: row.id };
}

export async function deleteRealChat(id: string): Promise<boolean> {
  const out = await prisma.realChatCase.deleteMany({ where: { id } });
  return out.count > 0;
}

export type RealChatRow = { id: string; createdAt: string; name: string; trade: string; channel: string; consent: string; lines: RealLine[] };

export async function listRealChats(): Promise<RealChatRow[]> {
  try {
    const rows = await prisma.realChatCase.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    return rows.map((r) => ({ id: r.id, createdAt: r.createdAt.toISOString(), name: r.name, trade: r.trade, channel: r.channel, consent: r.consent, lines: r.lines as RealLine[] }));
  } catch (err) {
    console.warn("Real chats: couldn't read them:", err instanceof Error ? err.message : err);
    return [];
  }
}

/** The kept real chats as conversation-test cases, named "Real: …" so they never mix with the invented ones. */
export async function realChatCases(): Promise<ChatCase[]> {
  const rows = await prisma.realChatCase.findMany({ orderBy: { createdAt: "asc" }, take: 200 });
  return rows.map((r): ChatCase => {
    const next = r.next as RealNext;
    const step = next.kind === "followup" ? stepForDays(next.daysQuiet) : null;
    return {
      name: `${REAL_PREFIX}${r.name}`,
      ...(r.trade !== REPLY_EVAL_TRADE ? { trade: r.trade } : {}),
      group: next.kind === "stop" ? "stop" : next.kind === "followup" ? "quiet" : "context",
      channel: r.channel as ChatCase["channel"],
      lines: r.lines as RealLine[],
      next:
        next.kind === "followup" && step
          ? { kind: "followup", step: step.step, total: 5, angle: step.angle, daysQuiet: next.daysQuiet, final: step.angle === "close" }
          : next.kind === "stop"
            ? { kind: "stop", shouldStop: next.shouldStop }
            : { kind: "reply" },
      ...(r.asks.length ? { asks: r.asks } : {}),
      ...(r.told.length ? { told: r.told } : {}),
      ...(r.expect ? { expect: r.expect } : {}),
      ...(r.closing ? { closing: true } : {}),
    };
  });
}
