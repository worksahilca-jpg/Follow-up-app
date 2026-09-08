"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "@/app/landing.module.css";

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.navScrolled : ""}`}>
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="#" className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${styles.pulseDot}`} style={{ background: "var(--amber)" }} />
          <span className="text-[17px] font-extrabold" style={{ letterSpacing: "-0.03em" }}>
            FollowUp
          </span>
        </Link>
        <div className="hidden md:flex items-center gap-7 text-[13.5px] font-medium" style={{ color: "var(--ink-soft)" }}>
          <a href="#notices" className="hover:opacity-70 transition-opacity">
            What it notices
          </a>
          <a href="#how" className="hover:opacity-70 transition-opacity">
            How it works
          </a>
          <a href="#draft" className="hover:opacity-70 transition-opacity">
            A real draft
          </a>
        </div>
        <Link
          href="/signin"
          className="rounded-full px-4 py-2 text-[13px] font-semibold transition-transform hover:scale-[1.04]"
          style={{ background: "var(--ink)", color: "#f3f0ea" }}
        >
          Get started
        </Link>
      </div>
    </nav>
  );
}
