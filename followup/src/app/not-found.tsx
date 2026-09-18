import Link from "next/link";
import { ArrowRight } from "lucide-react";
import styles from "./landing-light.module.css";
import LogoMark from "@/components/landing/light/LogoMark";
import { bricolageGrotesque, publicSans, ibmPlexMono, instrumentSerif } from "@/lib/fonts";

// Root app/not-found.tsx handles any unmatched URL app-wide (not just a
// notFound() call within a route) — without this, a typo'd link or an old
// bookmark hits Next's generic unstyled 404 instead of the real product.
// Styled with the marketing page's light direction so a dead link lands
// somewhere that looks like FollowUp.
export default function NotFound() {
  return (
    <div className={`${styles.root} ${styles.center} ${bricolageGrotesque.variable} ${publicSans.variable} ${ibmPlexMono.variable} ${instrumentSerif.variable}`}>
      <span style={{ color: "var(--ink)" }}><LogoMark height={40} /></span>
      <span className={styles.badge} style={{ marginTop: 22 }}>
        Page not found
      </span>
      <h1 className={styles.title} style={{ maxWidth: 560 }}>
        That page isn&apos;t <span className={styles.em}>here.</span>
      </h1>
      <p className={styles.lede} style={{ maxWidth: 420 }}>
        The link might be old, or the address was typo&apos;d. Nothing&apos;s wrong on our end.
      </p>
      <Link href="/" className={styles.btnPrimary} style={{ marginTop: 28 }}>
        Back to FollowUp <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
