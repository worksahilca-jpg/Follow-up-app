/**
 * A half-written reply is never lost (research round 2, 2026-10-07: people
 * are pulled away mid-task and come back, on average, 23 minutes later;
 * Gloria Mark, UC Irvine). Until now an edit lived only on screen: leaving
 * Today, a refresh, or the phone closing the tab in the background threw
 * the owner's words away.
 *
 * Kept in this tab's sessionStorage, keyed by customer, together with the
 * draft it was an edit OF: if FollowUp has written a new draft since (the
 * customer wrote again), the old edit is stale and is dropped rather than
 * shown against a different conversation. sessionStorage, not
 * localStorage: it ends when the tab closes, so a shared computer does not
 * keep a customer's reply after the owner has gone.
 *
 * Every access is guarded: private mode and blocked storage throw, and an
 * edit that cannot be kept must never stop one from being sent.
 */
export type KeptEdit = { text: string; mine: boolean; price: string };

type Stored = KeptEdit & { draft: string };

const key = (leadId: string) => `fu:edit:${leadId}`;

export function readKeptEdit(leadId: string, draft: string): KeptEdit | null {
  try {
    const raw = window.sessionStorage.getItem(key(leadId));
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<Stored>;
    if (stored.draft !== draft || typeof stored.text !== "string") {
      window.sessionStorage.removeItem(key(leadId));
      return null;
    }
    return { text: stored.text, mine: stored.mine === true, price: typeof stored.price === "string" ? stored.price : "" };
  } catch {
    return null;
  }
}

/** Keeps the owner's edit; an edit that is back to the draft as written is not an edit, and is forgotten. */
export function keepEdit(leadId: string, draft: string, edit: KeptEdit): void {
  try {
    if (edit.text === draft && !edit.price) {
      window.sessionStorage.removeItem(key(leadId));
      return;
    }
    const stored: Stored = { draft, ...edit };
    window.sessionStorage.setItem(key(leadId), JSON.stringify(stored));
  } catch {
    // Storage full or blocked: the edit still sends from the screen.
  }
}

/** Sent, or "Don't send": nothing left to come back to. */
export function dropKeptEdit(leadId: string): void {
  try {
    window.sessionStorage.removeItem(key(leadId));
  } catch {
    // Nothing to clean.
  }
}
