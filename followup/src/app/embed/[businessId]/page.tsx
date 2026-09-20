"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Check, Send } from "lucide-react";
import LogoMark from "@/components/LogoMark";

// Public, unauthenticated, and deliberately meant to be iframed into a
// stranger's own website (see the Website widget section in Settings) —
// so this stays minimal on structure (no app sidebar, no assumptions
// about the host page's width), but not on polish: this page IS the
// widget as far as the host site is concerned, so it carries its own
// small brand header rather than reading as an unstyled default form.
// Client-rendered for the same reason /book/[leadId] is: the interesting
// part (submit state, honeypot) only exists client-side.
export default function EmbedLeadPage() {
  const params = useParams<{ businessId: string }>();
  const businessId = params.businessId;

  const [businessName, setBusinessName] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [hp, setHp] = useState(""); // honeypot — real visitors never see or fill this
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/embed/${businessId}/lead`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) throw new Error(json.message ?? "This form isn't set up correctly.");
        setBusinessName(json.businessName);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "This form isn't set up correctly."));
  }, [businessId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || (!email.trim() && !phone.trim())) {
      setSubmitError("Name, and either an email or phone number, are required.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/embed/${businessId}/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, message, hp }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Couldn't send — try again.");
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Couldn't send — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const fieldClass =
    "w-full rounded-lg border border-line bg-card px-3.5 py-2.5 text-sm outline-none transition-shadow " +
    "focus:border-[var(--rust)] focus:shadow-[0_0_0_3px_var(--rust-soft)]";
  const labelClass = "text-xs font-medium text-ink-soft tracking-wide block mb-1.5";

  return (
    <div className="min-h-full flex flex-col" style={{ backgroundColor: "var(--paper)" }}>
      {/* The header is the BUSINESS's, not FollowUp's.

          It used to set a FollowUp mark, in a filled accent tile, directly
          beside the business's own name — on a widget embedded in that
          business's website, in front of their customer. Two marks side by
          side is a co-brand nobody agreed to, and the one wearing the tile
          was ours. Founder's call, 2026-09-20: drop the mark, keep the name.

          FollowUp is still credited once, at the foot of the widget, which
          is where a "powered by" belongs. */}
      <div
        className="flex items-center gap-2 px-5 py-3.5 border-b"
        style={{ borderColor: "var(--line)", backgroundColor: "var(--rust-soft)" }}
      >
        <span className="text-xs font-semibold tracking-wide" style={{ color: "var(--rust)" }}>
          {businessName ?? " "}
        </span>
      </div>

      <div className="flex-1 flex flex-col px-5 py-6">
        {loadError && <p className="text-sm text-ink-soft text-center py-10">{loadError}</p>}

        {!loadError && !businessName && <p className="text-sm text-ink-soft text-center py-10">Loading…</p>}

        {businessName && !submitted && (
          <>
            <h1 className="font-display text-xl" style={{ textWrap: "balance" }}>
              Let&apos;s talk
            </h1>
            <p className="text-sm text-ink-soft mt-1">Tell us what you need — we&apos;ll get back to you soon.</p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
              {/* Hidden from real visitors via CSS, not `type="hidden"` — a bot
                  filling every input it can see will fill this one too. */}
              <input
                type="text"
                value={hp}
                onChange={(e) => setHp(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
                aria-hidden="true"
              />

              <div>
                <label className={labelClass}>Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Phone</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} className={fieldClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className={fieldClass}
                  placeholder="What can we help with?"
                />
              </div>

              {submitError && (
                <p className="text-xs" style={{ color: "var(--coral)" }}>
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: "var(--rust)", color: "var(--paper)" }}
              >
                {submitting ? "Sending…" : "Send message"}
                {!submitting && <Send className="h-3.5 w-3.5" />}
              </button>
            </form>
          </>
        )}

        {submitted && (
          <div className="text-center py-10 m-auto">
            <div className="relative mx-auto h-14 w-14">
              <div
                className="absolute inset-0 rounded-full animate-ping"
                style={{ backgroundColor: "var(--sage-soft)", animationDuration: "1.6s", animationIterationCount: 2 }}
              />
              <div
                className="relative h-14 w-14 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "var(--sage-soft)", color: "var(--sage)" }}
              >
                <Check className="h-7 w-7" />
              </div>
            </div>
            <h1 className="font-display text-lg mt-4">Thanks — message sent</h1>
            <p className="text-sm text-ink-soft mt-1">{businessName} will get back to you soon.</p>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-ink-soft pb-4">
        <a
          href="/"
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1 hover:text-ink transition-colors"
        >
          {/* 16, not 12: public/brand/README.md sets 16px as the symbol's
              minimum, and below that the channel between the two leaves —
              the one part of the mark that must never close — stops
              reading. This is the only FollowUp mark on a page that lives
              on someone else's website, so it is the last place to let it
              go mushy. */}
          <LogoMark height={16} /> Powered by FollowUp
        </a>
      </p>
    </div>
  );
}
