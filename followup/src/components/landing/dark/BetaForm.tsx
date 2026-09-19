"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import styles from "@/app/landing-dark.module.css";

const CHANNELS: Array<{ id: "email" | "instagram" | "whatsapp" | "text" | "website" | "other"; label: string }> = [
  { id: "email", label: "Email" },
  { id: "instagram", label: "Instagram" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "text", label: "Text messages" },
  { id: "website", label: "My website" },
  { id: "other", label: "Somewhere else" },
];

/**
 * The beta's front door: name, email, what you sell, where your customers
 * write. Posts to /api/access-request; the founder approves from /admin
 * and the person signs in with Google. Plain words throughout (brand
 * principle 9), one screen, no account created here.
 */
export default function BetaForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [business, setBusiness] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { alreadyApproved: boolean }>(null);

  function toggle(id: string) {
    setChannels((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/access-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, business: business || undefined, channels, note: note || undefined, website }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string; alreadyApproved?: boolean };
      if (!res.ok || !data.success) throw new Error(data.message || "Couldn't send that. Try again.");
      setDone({ alreadyApproved: Boolean(data.alreadyApproved) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className={styles.card} style={{ textAlign: "center" }}>
        <span className={styles.iconChip} style={{ margin: "0 auto" }}>
          <Check className="h-5 w-5" />
        </span>
        <h3 className={styles.cardTitle} style={{ marginTop: 14 }}>
          {done.alreadyApproved ? "You're already in." : "Got it."}
        </h3>
        <p className={styles.cardBody}>
          {done.alreadyApproved
            ? "Sign in with the same Google account and you're through."
            : "Sahil adds people by hand, usually within a day. You'll get an email from contact@followupbase.io when your account is open."}
        </p>
        {done.alreadyApproved && (
          <Link href="/signin" className={styles.btn} style={{ marginTop: 18 }}>
            Sign in <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Your name</span>
        <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>The Google email you&apos;ll sign in with</span>
        <input className={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" inputMode="email" />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>What do you sell? (optional)</span>
        <input className={styles.input} value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="Hair salon in Brampton, real estate, home cleaning…" />
      </label>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>Where do your customers write to you?</span>
        <div className={styles.checks}>
          {CHANNELS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`${styles.pick} ${channels.includes(c.id) ? styles.pickOn : ""}`}
              aria-pressed={channels.includes(c.id)}
              onClick={() => toggle(c.id)}
            >
              {channels.includes(c.id) && <Check className="h-3.5 w-3.5" />}
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Anything else? (optional)</span>
        <textarea className={styles.textarea} value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="How many enquiries a week, what usually slips…" />
      </label>
      {/* Honeypot: people never see this; bots fill everything. */}
      <label className={styles.honey} aria-hidden="true">
        Website
        <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </label>
      {error && <p className={styles.formError}>{error}</p>}
      <button type="submit" className={styles.btn} disabled={busy} style={{ justifyContent: "center" }}>
        {busy ? "Sending…" : "Ask for access"} <ArrowRight className="h-4 w-4" />
      </button>
      <p className={styles.formNote}>Free while in beta. No card. Sahil reads every request himself.</p>
    </form>
  );
}
