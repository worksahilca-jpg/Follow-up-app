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
        <Link href="/" className="flex items-center gap-2.5" aria-label="FollowUp home" style={{ color: "#fff" }}>
          <LogoMark height={22} />
          <span className={styles.wordmark}>FollowUp</span>
        </Link>
        <div className={styles.navLinks}>
          <a href="#product">Product</a>
          <a href="#integrations">Integrations</a>
          <a href="#features">
            Features<span className={styles.navNew}>New</span>
          </a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </div>
        <Link href="/signin" className={`${styles.btn} ${styles.btnSmall}`}>
          Get started
        </Link>
      </div>
    </nav>
  );
}
