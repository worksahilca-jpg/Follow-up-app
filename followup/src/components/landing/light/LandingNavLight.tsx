"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "@/app/landing-light.module.css";
import LogoMark from "./LogoMark";

export default function LandingNavLight() {
  const [scrolled, setScrolled] = useState(false);
  // True while the nav sits over the dark hero (#hero). It then takes the
  // dark tokens; once the hero has scrolled past, it turns back to ink on
  // paper. Without a #hero on the page (the 404) it stays light.
  const [onDark, setOnDark] = useState(true);

  useEffect(() => {
    const hero = document.getElementById("hero");
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 8);
      setOnDark(hero ? y < hero.offsetTop + hero.offsetHeight - 56 : false);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.navScrolled : ""} ${onDark ? styles.navDark : ""}`}>
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
