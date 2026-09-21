import Link from "next/link";
import { ArrowRight } from "lucide-react";
import styles from "./landing-dark.module.css";
import LogoMark from "@/components/LogoMark";
import { publicSans, ibmPlexMono, instrumentSerif } from "@/lib/fonts";

// Root app/not-found.tsx handles any unmatched URL app-wide (not just a
// notFound() call within a route) — without this, a typo'd link or an old
// bookmark hits Next's generic unstyled 404 instead of the real product.
// Styled with the landing page's own module so a dead link lands somewhere
// that looks like FollowUp, in whichever theme the device is in.
export default function NotFound() {
  return (
    <div
      className={`${styles.root} ${publicSans.variable} ${ibmPlexMono.variable} ${instrumentSerif.variable}`}
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24 }}
    >
      <LogoMark height={40} />
      <span className={styles.badge} style={{ marginTop: 22 }}>
        Page not found
      </span>
      <h1 className={styles.h1} style={{ maxWidth: 560 }}>
        That page isn&apos;t <span className={styles.em}>here.</span>
      </h1>
      <p className={styles.lede} style={{ maxWidth: 420 }}>
        The link might be old, or the address was typo&apos;d. Nothing&apos;s wrong on our end.
      </p>
      <Link href="/" className={styles.btn} style={{ marginTop: 28 }}>
        Back to FollowUp <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
