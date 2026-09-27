import Link from "next/link";
import LogoMark from "@/components/LogoMark";

// Root app/not-found.tsx handles any unmatched URL app-wide (not just a
// notFound() call within a route) — without this, a typo'd link or an old
// bookmark hits Next's generic unstyled 404 instead of the real product.
// In the app's own type (a thin title, a quiet line, one black button), so a
// dead link lands somewhere that looks like the rest of FollowUp.
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 text-center">
      <LogoMark height={32} />
      <p className="mt-8 font-mono text-[11.5px] uppercase tracking-[0.12em] text-ink-faint">Page not found</p>
      <h1 className="mt-3 max-w-[520px] text-[34px] leading-[1.12]">That page isn&apos;t here.</h1>
      <p className="mt-3 max-w-[400px] text-[15.5px] leading-relaxed text-ink-soft">
        The link might be old, or the address was typo&apos;d. Nothing&apos;s wrong on our end.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-[48px] items-center rounded-full px-6 text-[15px] font-medium"
        style={{ backgroundColor: "var(--ink)", color: "var(--on-accent)" }}
      >
        Back to FollowUp
      </Link>
    </main>
  );
}
