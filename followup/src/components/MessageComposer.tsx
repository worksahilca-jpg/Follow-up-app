"use client";

import { useState } from "react";
import { Send, RotateCcw } from "lucide-react";

/**
 * The one place a real follow-up email actually goes out (via
 * /api/leads/[id]/send → src/lib/sending.ts). Laid out like an actual
 * email — To / Subject / Body, not a bare textarea — because that's what
 * it is: whatever's approved here is exactly what lands in the lead's
 * inbox. A phone-only lead (no email on file) has no Subject/To concept,
 * so those rows only render when the lead has an email address; the send
 * itself still auto-routes to text/WhatsApp/Instagram/Messenger for that
 * lead (see sendFollowUpToLead), this component just doesn't pretend
 * there's a subject line on a text message.
 */
export default function MessageComposer({
  leadId,
  initialMessage,
  initialSubject,
  leadName,
  leadEmail,
  seenInboundAt,
  sendLocked = false,
}: {
  leadId: string;
  initialMessage: string;
  initialSubject?: string;
  leadName: string;
  leadEmail?: string;
  /** When the newest message from the lead on this page arrived (ISO) — see the send route's stale check. */
  seenInboundAt?: string;
  /** Only admins send, and this person isn't one (A-041): write and edit, but no Send. */
  sendLocked?: boolean;
}) {
  const isEmail = Boolean(leadEmail);
  const [message, setMessage] = useState(initialMessage);
  const [subject, setSubject] = useState(initialSubject ?? "");
  const [sent, setSent] = useState(false);
  const [sentTemplate, setSentTemplate] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function regenerate() {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/regenerate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? "Regeneration failed.");
      setMessage(data.message);
      if (typeof data.subject === "string") setSubject(data.subject);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regeneration failed.");
    } finally {
      setRegenerating(false);
    }
  }

  async function send() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          ...(isEmail ? { subject } : {}),
          ...(seenInboundAt ? { seenInboundAt } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? "Send failed.");
      // WhatsApp only allows a written reply within 24 hours of the
      // customer's last message. Past that, what actually goes out is the
      // business's approved template — not these words. Saying "Sent" and
      // clearing the box, as this did, lets someone walk away believing
      // they had a conversation they did not have.
      setSentTemplate(typeof data.sentTemplate === "string" ? data.sentTemplate : null);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setSending(false);
    }
  }

  const canSend = message.trim().length > 0 && (!isEmail || subject.trim().length > 0);

  if (sent) {
    return (
      <section>
        <h2 className="font-display text-xl">AI-suggested follow-up</h2>
        {sentTemplate ? (
          /* Not a success message. What went out was the template; these
             words did not reach anyone, and the one useful thing to say is
             exactly that, plus what would let them through. */
          <div className="mt-3 rounded-lg border border-line p-4 text-sm" style={{ backgroundColor: "var(--coral-soft)", color: "var(--coral)" }}>
            <p className="font-semibold">Your message didn&apos;t go — WhatsApp wouldn&apos;t allow it</p>
            <p className="mt-1 leading-relaxed">
              WhatsApp only lets you write freely within 24 hours of {leadName}&apos;s last message, and that window has
              closed. Your approved template went instead, so they know you&apos;ve been in touch. Once they reply, you
              can write to them properly again.
            </p>
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-line p-4 text-sm" style={{ backgroundColor: "var(--sage-soft)", color: "var(--sage)" }}>
            Sent to {leadName}{isEmail ? ` <${leadEmail}>` : ""}, for real.
          </div>
        )}
      </section>
    );
  }

  return (
    <section>
      {/* No sparkle icon. rejected.md S-13 names sparkles specifically —
          "AI is invisible capability, never personality" — and the sentence
          underneath already says what drafted this and that nothing sends
          without approval, which is the part that earns trust. The icon was
          decoration standing in for an explanation that's already there. */}
      <h2 className="font-display text-xl">AI-suggested follow-up</h2>
      <p className="text-xs text-ink-soft mt-1">
        FollowUp drafted this based on your conversation. Nothing sends without your approval.
      </p>

      <div className="mt-3 rounded-lg border border-line bg-card overflow-hidden">
        {isEmail && (
          <>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-line text-sm">
              <span className="text-ink-soft w-16 shrink-0">To</span>
              {/* min-w-0 is load-bearing, not belt-and-braces: a flex item's
                  default min-width is `auto`, so without it this span refuses
                  to shrink below its own text and `truncate` never fires. A
                  long name + address pushed the whole lead page 149px wider
                  than a 390px phone — the page itself scrolled sideways. */}
              <span className="min-w-0 truncate">{leadName} &lt;{leadEmail}&gt;</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-line">
              <label htmlFor="composer-subject" className="text-sm text-ink-soft w-16 shrink-0">
                Subject
              </label>
              <input
                id="composer-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                className="flex-1 min-w-0 bg-transparent text-sm font-medium focus:outline-none"
              />
            </div>
          </>
        )}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          className="w-full p-3 text-sm leading-relaxed bg-transparent focus:outline-none resize-y"
        />
      </div>

      {isEmail && !subject.trim() && (
        <p className="mt-1.5 text-xs text-ink-soft">A subject line is required before this can send.</p>
      )}
      {error && (
        <p className="mt-2 text-xs" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
      {sendLocked && (
        <p className="mt-2 text-xs text-ink-soft">Only admins send on this account. An admin will see this reply waiting.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {!sendLocked && (
        <button
          onClick={send}
          disabled={sending || regenerating || !canSend}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-60"
          style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
        >
          <Send className="h-3.5 w-3.5" /> {sending ? "Sending…" : "Send now"}
        </button>
        )}
        <button
          onClick={regenerate}
          disabled={sending || regenerating}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium disabled:opacity-60"
        >
          <RotateCcw className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
          {regenerating ? "Regenerating…" : "Regenerate"}
        </button>
      </div>
    </section>
  );
}
