"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "@/app/landing-award.module.css";

export default function LandingNavAward() {
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
          <span
            className="h-5 w-5 rounded-md"
            style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-deep))" }}
          />
          <span className="text-[17px] font-extrabold" style={{ letterSpacing: "-0.02em", color: "var(--ink)" }}>
            FollowUp
          </span>
        </Link>
        <div className="hidden md:flex items-center gap-7 text-[13.5px] font-medium" style={{ color: "var(--ink-soft)" }}>
          <a href="#how-it-works" className="hover:opacity-70 transition-opacity">
            How it works
          </a>
          <a href="#who-its-for" className="hover:opacity-70 transition-opacity">
            Who it&apos;s for
          </a>
          <a href="#pricing" className="hover:opacity-70 transition-opacity">
            Pricing
          </a>
          <a href="#faq" className="hover:opacity-70 transition-opacity">
            FAQ
          </a>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/signin" className="hidden sm:inline text-[13.5px] font-semibold" style={{ color: "var(--ink-soft)" }}>
            Sign in
          </Link>
          <Link
            href="/signin"
            className="rounded-full px-4 py-2 text-[13px] font-bold transition-transform hover:scale-[1.04]"
            style={{ background: "var(--accent)", color: "var(--on-accent)" }}
          >
            Get started
          </Link>
        </div>
      </div>
    </nav>
  );
}
