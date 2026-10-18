"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Removes one whole conversation and every example taken from it (A-292). */
export default function TrainRemove({ conversationId, examples }: { conversationId: string; examples: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function remove() {
    const what = examples === 1 ? "its example" : `all ${examples} of its examples`;
    if (!window.confirm(`Remove this conversation and ${what}? FollowUp stops using them right away.`)) return;
    setBusy(true);
    await fetch(`/api/admin/train?id=${encodeURIComponent(conversationId)}`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    router.refresh();
  }
  return (
    <button type="button" onClick={remove} disabled={busy} className="min-h-11 text-sm text-ink-soft underline underline-offset-4 disabled:opacity-50">
      {busy ? "Removing…" : "Remove conversation"}
    </button>
  );
}
