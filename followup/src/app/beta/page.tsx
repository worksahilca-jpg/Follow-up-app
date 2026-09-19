import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/app/landing-dark.module.css";
import NavDark from "@/components/landing/dark/NavDark";
import BetaForm from "@/components/landing/dark/BetaForm";
import LogoMark from "@/components/landing/light/LogoMark";
import { publicSans, ibmPlexMono, instrumentSerif } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Join the FollowUp beta",
  description: "FollowUp is in beta. Ask for access, and Sahil opens your account by hand.",
};

// The beta's front door (founder, 2026-09-19). Sign-up stays invite-only;
// this is how someone asks. Same module, same words, same one job per
// screen as the landing page.
export default function BetaPage() {
  return (
    <div className={`${styles.root} ${publicSans.variable} ${ibmPlexMono.variable} ${instrumentSerif.variable}`}>
      <NavDark />
      <section className={styles.section} style={{ paddingTop: 56, maxWidth: 720 }}>
        <div className={styles.headCenter}>
          <span className={styles.badge}>Beta</span>
          <h1 className={styles.h2}>
            We&apos;re letting a few owners in <span className={styles.em}>first.</span>
          </h1>
          <p className={styles.lede}>
            Free while we improve it. You use it on your real customers, tell us what breaks, and we fix it. Sahil opens each
            account himself, usually within a day.
          </p>
        </div>
        <div style={{ marginTop: 32 }}>
          <BetaForm />
        </div>
        <p className={styles.formNote} style={{ textAlign: "center", marginTop: 28 }}>
          Already in? <Link href="/signin" style={{ textDecoration: "underline" }}>Sign in</Link>.
        </p>
      </section>
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className="flex items-center gap-2.5" style={{ color: "var(--text)" }}>
            <LogoMark height={18} />
            <span style={{ color: "var(--muted)" }}>So no customer gets forgotten.</span>
          </div>
          <div className={styles.footerLinks}>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <a href="mailto:contact@followupbase.io">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
