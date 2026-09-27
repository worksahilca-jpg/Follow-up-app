/**
 * Pause all sending, and Only admins send (design brain A-041).
 *
 * Pause is built on the hold every automated path already obeys
 * (Business.holdAllForApproval: automation.ts, sequences.ts and the
 * instant reply in acknowledge.ts all hold their drafts while it is on),
 * rather than on a new flag each of them would have to learn. So a pause
 * can't miss a path: it is the same switch as "ask me before every
 * message", plus a stamp that remembers it was meant to be temporary.
 *
 * Resuming stamps autoSendAllowedAt afresh, exactly as granting the
 * permission does. That is what keeps a resume from releasing everything
 * that queued up while paused: the send path won't act on a conversation
 * older than that stamp, so what waited during the pause keeps waiting
 * for the owner.
 */
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/session";

export type PauseResult = { ok: true } | { ok: false; status: number; message: string };

export async function pauseSending(businessId: string): Promise<PauseResult> {
  // One conditional write, so a pause racing a change in Settings can't
  // stamp an account that had just stopped sending by itself.
  const paused = await prisma.business.updateMany({
    where: { id: businessId, holdAllForApproval: false },
    data: { holdAllForApproval: true, autoSendAllowedAt: null, sendingPausedAt: new Date() },
  });
  if (paused.count === 1) return { ok: true };
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { sendingPausedAt: true } });
  if (!business) return { ok: false, status: 404, message: "Business not found." };
  if (business.sendingPausedAt) return { ok: true };
  // Nothing sends by itself, so there is nothing to pause. Refused rather
  // than stamped: a "paused" banner on an account that was never sending
  // would offer a Resume that turns sending ON, which nobody asked for.
  return { ok: false, status: 409, message: "Nothing sends by itself right now, so there's nothing to pause." };
}

export async function resumeSending(businessId: string): Promise<PauseResult> {
  // Only a pause can be resumed. Turning sending on from scratch is the
  // permission in Settings, which explains what it does before it does it.
  const resumed = await prisma.business.updateMany({
    where: { id: businessId, sendingPausedAt: { not: null } },
    data: { holdAllForApproval: false, autoSendAllowedAt: new Date(), sendingPausedAt: null },
  });
  if (resumed.count === 1) return { ok: true };
  return { ok: false, status: 409, message: "Sending isn't paused." };
}

/**
 * May this person send a message to a customer?
 *
 * The one check for "Only admins send". Everyone may send unless the
 * business turned the option on, and then only ADMINs may. Returns the
 * sentence to show when they can't.
 */
export async function sendRefusal(businessId: string, userId: string): Promise<string | null> {
  const [business, user] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { onlyAdminsSend: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { role: true, businessId: true } }),
  ]);
  if (!business?.onlyAdminsSend) return null;
  if (user && user.businessId === businessId && user.role === "ADMIN") return null;
  return "Only admins send on this account. An admin will see this reply waiting.";
}

/** sendRefusal for whoever is signed in, for pages that only need to know whether to show Send. */
export async function sendLockedForSession(): Promise<boolean> {
  const ctx = await getSessionContext();
  if (!ctx) return false;
  return (await sendRefusal(ctx.businessId, ctx.userId)) !== null;
}
