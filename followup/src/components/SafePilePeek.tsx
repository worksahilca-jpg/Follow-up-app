"use client";

import { useState } from "react";
import type { PendingApproval } from "@/lib/pendingApprovals";
import { sampleForSpotCheck, describeSample } from "@/lib/spotCheck";

/**
 * "Show me a few" — the way out of trusting a pile of forty blind.
 *
 * ## Closed by default, and that is the whole design
 *
 * The routine pile exists so an owner does not read 600 drafts. Opening
 * this by default would undo that on the calm path, for everyone, to
 * serve the first press. So it is one quiet press to open, and an owner
 * who has learned to trust the pile never sees it again.
 *
 * ## What a row shows, and why both halves
 *
 * The inbound message AND the draft. A reply reads as fine or as
 * nonsense depending on what it is answering — "Tuesday works" is a good
 * message or a baffling one, and the draft alone cannot tell you which.
 * Judging a reply without its question is not a spot-check.
 *
 * Both are clamped to two lines. This is a sample to form an impression
 * from, not the lead page; the name links there for anyone who wants the
 * whole conversation.
 *
 * ## Read-only, deliberately
 *
 * No Approve, no Edit, no Don't-send on these rows. Per-draft controls
 * here would turn the sample into a second approval queue, which is the
 * screen this pile was built to replace — and would beg the question of
 * what the other thirty-seven are, since they have no controls at all.
 * The decision this supports is the one below it: send the pile, or
 * don't.
 */
export default function SafePilePeek({ items }: { items: PendingApproval[] }) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  const sample = sampleForSpotCheck(items);
  const caption = describeSample(sample.length, items.length);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium underline underline-offset-2 text-ink-soft"
      >
        Read a few first
      </button>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-ink-soft">{caption}</p>
        <button onClick={() => setOpen(false)} className="text-xs font-medium underline underline-offset-2 text-ink-soft">
          Hide
        </button>
      </div>

      <ul className="mt-2 flex flex-col gap-2">
        {sample.map((item) => (
          // --card-2, the documented inset surface. Not a `box`: these sit
          // INSIDE the pile's own box, and a box in a box is the
          // card-in-card soup (S-09) this queue has been fixed for before.
          <li key={item.leadId} className="rounded-lg p-3" style={{ backgroundColor: "var(--card-2)" }}>
            <a href={`/leads/${item.leadId}`} className="text-sm font-medium underline underline-offset-2">
              {item.leadName}
            </a>
            {item.leadLastMessage && (
              <p className="mt-1 text-xs text-ink-soft line-clamp-2">
                They said: {item.leadLastMessage}
              </p>
            )}
            <p className="mt-1 text-xs line-clamp-2">{item.draftMessage}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
