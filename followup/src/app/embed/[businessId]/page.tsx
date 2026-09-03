"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Check } from "lucide-react";

// Public, unauthenticated, and deliberately meant to be iframed into a
// stranger's own website (see the Website widget section in Settings) —
// so this stays minimal on purpose: no FollowUp chrome/sidebar, no
// assumptions about the host page's width, just a form that fits a
// narrow iframe. Client-rendered for the same reason /book/[leadId] is:
// the interesting part (submit state, honeypot) only exists client-side.
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

  return (
    <div className="min-h-full flex flex-col px-5 py-6">
      {loadError && <p className="text-sm text-ink-soft text-center py-10">{loadError}</p>}

      {!loadError && !businessName && <p className="text-sm text-ink-soft text-center py-10">Loading…</p>}

      {businessName && !submitted && (
        <>
          <h1 className="font-display text-xl">Get in touch with {businessName}</h1>
          <p className="text-sm text-ink-soft mt-1">We&apos;ll get back to you soon.</p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
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
              <label className="text-xs font-medium block mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium block mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Phone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm"
                placeholder="What can we help with?"
              />
            </div>

            {submitError && (
              <p className="text-xs" style={{ color: "var(--rust)" }}>
                {submitError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-60"
              style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
            >
              {submitting ? "Sending…" : "Send"}
            </button>
          </form>
        </>
      )}

      {submitted && (
        <div className="text-center py-10">
          <div
            className="mx-auto h-12 w-12 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: "var(--sage-soft)", color: "var(--sage)" }}
          >
            <Check className="h-6 w-6" />
          </div>
          <h1 className="font-display text-lg mt-4">Thanks — message sent</h1>
          <p className="text-sm text-ink-soft mt-1">{businessName} will get back to you soon.</p>
        </div>
      )}

      <p className="text-center text-xs text-ink-soft mt-auto pt-6">
        <a href="https://follow-up-app-two.vercel.app" target="_blank" rel="noopener" className="hover:underline">
          Powered by FollowUp
        </a>
      </p>
    </div>
  );
}
