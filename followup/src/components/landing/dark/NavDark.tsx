"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "@/app/landing-dark.module.css";
import LogoMark from "@/components/landing/light/LogoMark";

export default function NavDark() {
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
        <Link href="/" className="flex items-center gap-2.5" aria-label="FollowUp home" style={{ color: "var(--text)" }}>
          <LogoMark height={22} />
          <span className={styles.wordmark}>FollowUp</span>
        </Link>
        <div className={styles.navLinks}>
          <Link href="/#how">How it works</Link>
          <Link href="/#pricing">Prices</Link>
          <Link href="/#faq">Questions</Link>
        </div>
        <Link href="/signin" className={`${styles.btn} ${styles.btnSmall}`}>
          Start free
        </Link>
      </div>
    </nav>
  );
}
