"use client";

import { useState } from "react";
import { Sparkles, Send, RotateCcw } from "lucide-react";

const regenerated = [
  "just wanted to check back in — no rush at all, just didn't want this to slip through the cracks",
  "circling back on this — happy to jump on a quick call if that's easier than email",
  "following up in case this got buried — let me know if you have any questions",
];

export default function MessageComposer({
  initialMessage,
  leadName,
}: {
  initialMessage: string;
  leadName: string;
}) {
  const [message, setMessage] = useState(initialMessage);
  const [sent, setSent] = useState(false);
  const [regenCount, setRegenCount] = useState(0);

  const regenerate = () => {
    const opener = message.split(",")[0] || `Hey ${leadName.split(" ")[0]}`;
    const variant = regenerated[regenCount % regenerated.length];
    setMessage(`${opener}, ${variant}.`);
    setRegenCount((c) => c + 1);
  };

  if (sent) {
    return (
      <section>
        <h2 className="font-display text-xl">AI-suggested follow-up</h2>
        <div className="mt-3 rounded-lg border border-line p-4 text-sm" style={{ backgroundColor: "var(--sage-soft)", color: "var(--sage)" }}>
          Sent to {leadName}. FollowUp will let you know when they reply.
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="font-display text-xl flex items-center gap-2">
        <Sparkles className="h-4 w-4" style={{ color: "var(--rust)" }} />
        AI-suggested follow-up
      </h2>
      <p className="text-xs text-ink-soft mt-1">
        FollowUp drafted this based on your conversation. Nothing sends without your approval.
      </p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        className="mt-3 w-full rounded-lg border border-line bg-card p-3 text-sm leading-relaxed"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => setSent(true)}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white"
          style={{ backgroundColor: "var(--ink)" }}
        >
          <Send className="h-3.5 w-3.5" /> Send now
        </button>
        <button
          onClick={regenerate}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Regenerate
        </button>
      </div>
    </section>
  );
}
