"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "@/app/landing-light.module.css";
import LogoMark from "./LogoMark";

export default function LandingNavLight() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.navScrolled : ""}`}>
      <div className={styles.navInner}>
        <Link href="/" className="flex items-center gap-2.5" aria-label="FollowUp home" style={{ color: "var(--ink)" }}>
          <LogoMark height={22} />
          <span className={styles.wordmark}>FollowUp</span>
        </Link>
        <div className={styles.navLinks}>
          <a href="#product">Product</a>
          <a href="#how-it-works">How it works</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/signin" className="hidden sm:inline text-[14px] font-semibold" style={{ color: "var(--ink-soft)" }}>
            Sign in
          </Link>
          <Link href="/signin" className={`${styles.btnPrimary} ${styles.btnSmall}`}>
            Get started
          </Link>
        </div>
      </div>
    </nav>
  );
}
