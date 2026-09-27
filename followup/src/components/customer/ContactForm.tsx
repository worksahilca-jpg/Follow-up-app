"use client";

import { useEffect, useState } from "react";
import s from "./customer.module.css";
import { Check, PoweredBy } from "./bits";

/**
 * The website form a business puts on its own site (design brain A-065).
 *
 * It lives in a borderless iframe up to 420px wide (CopyEmbedSnippet), so
 * the page background is transparent and the form draws its own card on
 * the business's page. The business is the brand (A-017); FollowUp is the
 * credit at the foot.
 *
 * Every field has a visible label. The one rule, an email or a phone
 * number, is said under that pair, where it applies, not at the top.
 * The honeypot is unchanged: hidden with CSS rather than type="hidden",
 * so a bot that fills every visible input fills it too.
 */
export default function ContactForm({ businessId }: { businessId: string }) {
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [hp, setHp] = useState("");
  const [nameError, setNameError] = useState(false);
  const [contactError, setContactError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

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
    const missingName = !name.trim();
    const missingContact = !email.trim() && !phone.trim();
    setNameError(missingName);
    setContactError(missingContact);
    if (missingName || missingContact) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/embed/${businessId}/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, message, hp }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Couldn't send. Try again.");
      setSent(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Couldn't send. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const first = name.trim().split(/\s+/)[0] ?? "";
  const replyTo = email.trim() || phone.trim();

  return (
    <div className={s.formPage}>
      {/* Transparent, so the card sits on the business's own page. */}
      <style>{`html,body{background:transparent!important}`}</style>
      <div className={s.card}>
        {loadError ? (
          <p className={s.loading}>{loadError}</p>
        ) : !businessName ? (
          <p className={s.loading}>Loading…</p>
        ) : sent ? (
          <div className={s.sent} role="status">
            <div className={s.tick} style={{ width: 48, height: 48 }}>
              <Check size={22} />
            </div>
            <h1 className={s.sentH}>Sent. Thanks{first ? `, ${first}` : ""}.</h1>
            <p className={s.sentP}>
              {businessName} has your message and will reply to {replyTo}.
            </p>
            {message.trim() && <p className={s.quote}>&ldquo;{message.trim()}&rdquo;</p>}
            <div style={{ marginTop: 20 }}>
              <PoweredBy />
            </div>
          </div>
        ) : (
          <>
            <div className={s.cardTop}>
              <div className={s.biz}>{businessName}</div>
              <h1 className={s.formH}>Tell us what you need.</h1>
              <p className={s.formLede}>We&apos;ll reply by email or text, whichever you give us.</p>
            </div>
            <form onSubmit={handleSubmit} className={s.form} noValidate>
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
                <label htmlFor="cf-name" className={s.label}>
                  Your name
                </label>
                <input
                  id="cf-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameError) setNameError(false);
                  }}
                  className={s.input}
                  placeholder="First and last name"
                  autoComplete="name"
                  aria-invalid={nameError}
                  aria-describedby={nameError ? "cf-name-error" : undefined}
                />
                {nameError && (
                  <p id="cf-name-error" className={s.error} style={{ marginTop: 6 }}>
                    Add your name.
                  </p>
                )}
              </div>

              <div className={s.pair}>
                <div>
                  <label htmlFor="cf-email" className={s.label}>
                    Email
                  </label>
                  <input
                    id="cf-email"
                    type="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (contactError) setContactError(false);
                    }}
                    className={s.input}
                    placeholder="you@example.com"
                    autoComplete="email"
                    aria-invalid={contactError}
                    aria-describedby={contactError ? "cf-contact-error" : undefined}
                  />
                </div>
                <div>
                  <label htmlFor="cf-phone" className={s.label}>
                    Phone
                  </label>
                  <input
                    id="cf-phone"
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (contactError) setContactError(false);
                    }}
                    className={s.input}
                    placeholder="Or a phone number"
                    autoComplete="tel"
                    aria-invalid={contactError}
                    aria-describedby={contactError ? "cf-contact-error" : undefined}
                  />
                </div>
              </div>
              {contactError && (
                <p id="cf-contact-error" className={`${s.error} ${s.pairError}`}>
                  Add an email or a phone number, so they can reply.
                </p>
              )}

              <div>
                <label htmlFor="cf-message" className={s.label}>
                  What do you need?
                </label>
                <textarea
                  id="cf-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={`${s.input} ${s.textarea}`}
                  placeholder="A few words is plenty"
                  rows={4}
                />
              </div>

              {submitError && (
                <p className={s.error} role="alert">
                  {submitError}
                </p>
              )}

              <button type="submit" className={s.btn} disabled={submitting}>
                {submitting ? "Sending…" : "Send"}
              </button>
              <div className={s.formFoot}>
                <PoweredBy />
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
