import { businessDisplayName } from "@/lib/leadName";

/**
 * The line under every email FollowUp sends on its own (founder, 2026-11-01: "Go for B"; drawing in
 * design-brain/decisions/approved.md, A-341):
 *
 *     —
 *     Harbour Homes · 100 King St W, Suite 500, Toronto ON M5X 1A9
 *     Not looking any more? Reply "stop" and I won't follow up again.
 *
 * Who sent it and where (Canada's anti-spam law asks for both), and an easy way out: someone who can stop by
 * replying doesn't press "Report spam", which is what keeps the owner's own Gmail out of spam folders. A "stop"
 * reply is recorded as an opt-out (src/lib/emailOptOut.ts), and nothing automatic goes to them again.
 *
 * Never on an email the owner sends themselves: a personal reply is not a mailing. Added at send time only, never to
 * the stored Message body, so the thread, the learning and the audit trail show only what anyone wrote.
 */
export const STOP_LINE = `Not looking any more? Reply "stop" and I won't follow up again.`;

export function automaticEmailFooter(business: { name: string | null; mailingAddress: string | null }): string {
  const address = (business.mailingAddress ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/,$/, ""))
    .filter(Boolean)
    .join(", ");
  const who = [businessDisplayName(business.name), address].filter(Boolean).join(" · ");
  return `\n\n—\n${who ? `${who}\n` : ""}${STOP_LINE}`;
}
