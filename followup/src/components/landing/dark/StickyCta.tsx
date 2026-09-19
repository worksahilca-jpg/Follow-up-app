"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import styles from "@/app/landing-dark.module.css";

/**
 * The phone-only bar that keeps "Start free" in thumb reach once the hero's
 * own button has scrolled away. On a phone the page is eight screens tall
 * and the next button after the hero used to be at the prices, six screens
 * down; a reader convinced at "how it works" had nothing to press. Hidden
 * at desktop widths (the sticky nav already carries the button there) and
 * hidden while the hero is on screen, so the button is never on the page
 * twice at once.
 */
export default function StickyCta() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const hero = document.querySelector("header");
    if (!hero || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting), { threshold: 0 });
    io.observe(hero);
    return () => io.disconnect();
  }, []);

  return (
    <div className={`${styles.stickyCta} ${show ? styles.stickyCtaShow : ""}`} aria-hidden={!show}>
      <p className={styles.stickyCtaNote}>Free while in beta. No card.</p>
      <Link href="/beta" className={`${styles.btn} ${styles.btnSmall}`} tabIndex={show ? 0 : -1}>
        Join the beta <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
